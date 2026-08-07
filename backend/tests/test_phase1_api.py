from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient

from app.ai import StructuredGenerationRequest, StructuredGenerationResponse
from app.main import app
from app.models.extraction import ExtractionResult
from app.models.generation import GenerationResult
from app.repositories.memory import case_repository
from app.services.extraction import ALL_FIELD_SPECS, source_processor
from app.services.integrity import locked_facts_preserved


def client() -> TestClient:
    return TestClient(app)


REAL_SOURCE_TEXT = b"""Clean Water Opportunity
Problem: Rural clinics face unreliable water systems that interrupt safe care.
Solution: Install solar-powered purification hubs with district maintenance teams.
Why now: 2026 procurement reforms create a window for implementation.
Geographies: Kenya and Uganda.
Reach: 2 million residents and 350 clinics.
Primary outcomes: safer water and reduced clinic downtime.
Differentiators: local maintenance partnerships and accountable district reporting.
Timeframe: 2026-2028.
Funding range: USD 12-18 million.
Technical team: District health offices and local maintenance partners.
Diligence: funding recipient and investment vehicle are not yet defined.
"""


class FakeExtractionProvider:
    def __init__(
        self,
        field_values: dict[str, tuple[str, int | None, str, float]] | None = None,
    ):
        self.field_values = field_values or clean_water_field_values()
        self.requests: list[StructuredGenerationRequest] = []

    def generate_structured(
        self,
        request: StructuredGenerationRequest,
    ) -> StructuredGenerationResponse:
        self.requests.append(request)
        fields = []
        for spec in ALL_FIELD_SPECS:
            configured = self.field_values.get(spec.field_id)
            if configured:
                value, page_number, excerpt, confidence = configured
                fields.append(
                    {
                        "id": spec.field_id,
                        "value": value,
                        "confidence": confidence,
                        "evidenceStatus": "source_provided",
                        "pageNumber": page_number,
                        "excerpt": excerpt,
                    }
                )
            else:
                fields.append(
                    {
                        "id": spec.field_id,
                        "value": spec.unresolved,
                        "confidence": 0.3,
                        "evidenceStatus": "unresolved",
                        "pageNumber": None,
                        "excerpt": "",
                    }
                )
        return StructuredGenerationResponse(
            output={
                "selectedOpportunity": self.field_values["opportunity_name"][0],
                "selectionRationale": "Fake provider selected the clearest source-backed concept.",
                "notes": "fake extraction",
                "fields": fields,
            },
            modelProvider="fake-structured-provider",
            modelName="fake-extraction-model",
            storedPayloadMode="validated_outputs_only",
            redactedResponseJson={"finishReasons": ["stop"]},
        )


def clean_water_field_values() -> dict[str, tuple[str, int | None, str, float]]:
    return {
        "opportunity_name": ("Clean Water Opportunity", 1, "Clean Water Opportunity", 0.94),
        "problem": (
            "Rural clinics face unreliable water systems that interrupt safe care.",
            1,
            "Problem: Rural clinics face unreliable water systems that interrupt safe care.",
            0.91,
        ),
        "solution": (
            "Install solar-powered purification hubs with district maintenance teams.",
            1,
            "Solution: Install solar-powered purification hubs with district maintenance teams.",
            0.9,
        ),
        "why_now": (
            "2026 procurement reforms create a window for implementation.",
            1,
            "Why now: 2026 procurement reforms create a window for implementation.",
            0.88,
        ),
        "geographies": ("Kenya and Uganda.", 1, "Geographies: Kenya and Uganda.", 0.89),
        "reach": ("2 million residents and 350 clinics.", 1, "Reach: 2 million residents and 350 clinics.", 0.92),
        "primary_outcomes": ("safer water and reduced clinic downtime.", 1, "Primary outcomes: safer water and reduced clinic downtime.", 0.87),
        "differentiators": (
            "local maintenance partnerships and accountable district reporting.",
            1,
            "Differentiators: local maintenance partnerships and accountable district reporting.",
            0.86,
        ),
        "timeframe": ("2026-2028.", 1, "Timeframe: 2026-2028.", 0.9),
        "funding_range": ("USD 12-18 million.", 1, "Funding range: USD 12-18 million.", 0.9),
        "technical_team": (
            "District health offices and local maintenance partners.",
            1,
            "Technical team: District health offices and local maintenance partners.",
            0.84,
        ),
        "diligence": (
            "funding recipient and investment vehicle are not yet defined.",
            1,
            "Diligence: funding recipient and investment vehicle are not yet defined.",
            0.82,
        ),
    }


def install_fake_extraction_provider(monkeypatch, provider: FakeExtractionProvider | None = None) -> FakeExtractionProvider:
    fake_provider = provider or FakeExtractionProvider()
    monkeypatch.setattr(source_processor, "_provider_factory", lambda: fake_provider)
    return fake_provider


def test_api_health_and_config_do_not_expose_credentials() -> None:
    test_client = client()

    health = test_client.get("/api/health")
    config = test_client.get("/api/config")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert config.status_code == 200
    payload = config.json()
    assert payload["mode"] == "not_configured"
    assert payload["backend"]["status"] == "not_configured"
    assert payload["backend"]["provider"] == "model-required-generation-backend"
    serialized = str(payload)
    for forbidden in [
        "DATABRICKS_CLIENT_SECRET",
        "DATABRICKS_TOKEN",
        "Authorization",
        "personal access token",
    ]:
        assert forbidden not in serialized


def test_project_create_and_update_contract() -> None:
    test_client = client()

    created = test_client.post("/api/projects", json={"name": "Contract test"}).json()
    project_id = created["id"]

    task = test_client.put(
        f"/api/projects/{project_id}/task",
        json={
            "selectedTaskId": "donor_meeting",
            "taskLabel": "Prepare for a donor meeting",
            "customDescription": "",
        },
    )

    assert task.status_code == 200
    assert task.json()["task"]["metadata"]["confirmed"] is True


def test_opportunity_and_audience_fixtures_load() -> None:
    test_client = client()

    opportunities = test_client.get("/api/opportunities").json()
    audiences = test_client.get("/api/audiences").json()

    assert len(opportunities) >= 4
    assert len(audiences) >= 3
    assert all("Demo" in item["validationStatus"] or "Example" in item["validationStatus"] for item in opportunities)
    assert all("@" not in item["name"] for item in audiences)


def test_uploaded_text_extraction_uses_source_content(monkeypatch) -> None:
    fake_provider = install_fake_extraction_provider(monkeypatch)
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Extraction test"}).json()

    response = test_client.post(
        f"/api/sources/extract?projectId={project['id']}&filename=clean-water.txt",
        content=REAL_SOURCE_TEXT,
        headers={"content-type": "text/plain"},
    )

    assert response.status_code == 200
    extraction = response.json()
    assert extraction["temporaryStatus"].startswith("Phase 1 temporary processing")
    assert len(extraction["fields"]) >= 13
    assert "uploaded source" in extraction["notes"].lower()
    values = " ".join(field["value"] for field in extraction["fields"])
    assert "Clean Water Opportunity" in values
    assert "USD 12-18 million" in values
    assert "Kenya and Uganda" in values
    assert "Global Vaccine Development Initiative" not in values
    assert fake_provider.requests[0].operation == "extract_opportunities"
    assert "Clean Water Opportunity" in fake_provider.requests[0].input["sourcePages"][0]["text"]


def test_uploaded_pdf_extraction_reads_text_layer(monkeypatch) -> None:
    fake_provider = install_fake_extraction_provider(
        monkeypatch,
        FakeExtractionProvider(
            {
                **clean_water_field_values(),
                "opportunity_name": (
                    "The Beginnings Fund phase 1 countries",
                    4,
                    "Opportunity spotlight: The Beginnings Fund phase 1 countries",
                    0.94,
                ),
                "funding_range": (
                    "$30M",
                    4,
                    "$30M reflects current gap to target",
                    0.88,
                ),
            }
        ),
    )
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "PDF extraction test"}).json()
    repo_root = Path(__file__).resolve().parents[2]
    pdf_content = (repo_root / "resources/reference-output-examples/maternal-newborn-health-spotlights.pdf").read_bytes()

    response = test_client.post(
        f"/api/sources/extract?projectId={project['id']}&filename=maternal-newborn-health-spotlights.pdf",
        content=pdf_content,
        headers={"content-type": "application/pdf"},
    )

    assert response.status_code == 200
    extraction = response.json()
    values = " ".join(field["value"] for field in extraction["fields"])
    assert "the beginnings fund phase 1 countries" in values.lower()
    assert "$30M" in values
    assert "Global Vaccine Development Initiative" not in values
    assert len(fake_provider.requests[0].input["sourcePages"]) >= 1
    assert "maternal newborn health spotlights" in fake_provider.requests[0].input["sourcePages"][0]["text"].lower()


def test_project_extraction_rerun_uses_cached_source_text(monkeypatch) -> None:
    fake_provider = install_fake_extraction_provider(monkeypatch)
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Rerun extraction test"}).json()
    project_id = project["id"]

    uploaded = test_client.post(
        f"/api/sources/extract?projectId={project_id}&filename=clean-water.txt",
        content=REAL_SOURCE_TEXT,
        headers={"content-type": "text/plain"},
    )
    rerun = test_client.post(f"/api/projects/{project_id}/extraction/rerun", json={})

    assert uploaded.status_code == 200
    assert rerun.status_code == 200
    assert len(fake_provider.requests) == 2
    rerun_page_text = fake_provider.requests[1].input["sourcePages"][0]["text"]
    assert "Clean Water Opportunity" in rerun_page_text
    assert "Opportunity name:" not in rerun_page_text


def test_generation_requires_live_model_by_default() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Generation test"}).json()

    response = test_client.post(f"/api/projects/{project['id']}/generate", json={"simulateError": False})

    assert response.status_code == 503
    assert "Live model generation is required" in response.json()["detail"]


def test_new_opportunity_generation_requires_live_model_after_extraction(monkeypatch) -> None:
    install_fake_extraction_provider(monkeypatch)
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Source generation test"}).json()
    project_id = project["id"]
    audience = test_client.get("/api/audiences").json()[0]

    test_client.put(
        f"/api/projects/{project_id}/opportunity-audience",
        json={
            "sourceMode": "new",
            "opportunityId": None,
            "audienceId": audience["id"],
            "intendedOutcome": "Explore a co-funding partnership",
            "suggestions": [],
            "selectedOutputs": ["investment_case", "one_page", "source_appendix"],
        },
    )
    extraction = test_client.post(
        f"/api/sources/extract?projectId={project_id}&filename=clean-water.txt",
        content=REAL_SOURCE_TEXT,
        headers={"content-type": "text/plain"},
    ).json()
    for field in extraction["fields"]:
        field["verified"] = True
    reviewed = test_client.put(
        f"/api/projects/{project_id}/extraction-review",
        json={"fields": extraction["fields"], "confirmed": True},
    )
    assert reviewed.status_code == 200

    generation_response = test_client.post(f"/api/projects/{project_id}/generate", json={"simulateError": False})

    assert generation_response.status_code == 503
    assert "Live model generation is required" in generation_response.json()["detail"]


def export_output_payload() -> dict:
    return {
        "id": "out-investment-case",
        "type": "investment_case",
        "title": "Investment Case Draft",
        "status": "Model generated - human review required",
        "sections": [
            {
                "id": "case-summary",
                "type": "narrative",
                "heading": "Strategic Opportunity",
                "body": "Edited section text that only exists in the browser. Essential tools are available in **45% of facilities**.",
                "citations": [
                    {
                        "sourceId": "src-clean-water",
                        "label": "clean-water.txt",
                        "locator": "p. 1",
                        "excerpt": "Clean Water Opportunity",
                    }
                ],
            },
            {
                "id": "activities",
                "type": "opportunity",
                "heading": "Activities",
                "body": "Deliver a core set of low-cost interventions.",
                "citations": [],
            },
            {
                "id": "outputs",
                "type": "metric",
                "heading": "Outputs",
                "body": "Clinics have access to improved delivery tools.",
                "citations": [],
            },
        ],
    }


def test_phase1_docx_export_uses_visible_output_payload() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Export test"}).json()
    output = export_output_payload()

    response = test_client.post(
        f"/api/projects/{project['id']}/exports/docx",
        json={
            "output": output,
            "informationNeeded": [],
            "reviewFindings": [],
            "metadata": {"mode": "live"},
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert response.headers["content-disposition"].endswith(".docx\"")
    assert response.content[:2] == b"PK"
    with ZipFile(BytesIO(response.content)) as archive:
        document_xml = archive.read("word/document.xml").decode()
    assert "Edited section text that only exists in the browser." in document_xml
    assert "Draft export - human review required" in document_xml
    assert "Impact Potential" in document_xml
    assert "<w:tbl" in document_xml
    assert "A9DCCA" in document_xml
    assert "**45% of facilities**" not in document_xml
    assert "45% of facilities" in document_xml


@pytest.mark.parametrize(
    ("export_format", "expected_content_type", "extension"),
    [
        ("pdf", "application/pdf", ".pdf"),
        (
            "pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".pptx",
        ),
        ("markdown", "text/markdown", ".md"),
        ("txt", "text/plain", ".txt"),
    ],
)
def test_phase1_export_formats_use_visible_output_payload(
    export_format: str,
    expected_content_type: str,
    extension: str,
) -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": f"{export_format} export test"}).json()
    output = export_output_payload()

    response = test_client.post(
        f"/api/projects/{project['id']}/exports/{export_format}",
        json={
            "output": output,
            "informationNeeded": [{"id": "info-1", "message": "Confirm funding recipient.", "relatedSection": "diligence"}],
            "reviewFindings": [
                {
                    "id": "finding-1",
                    "severity": "warning",
                    "type": "citation_gap",
                    "message": "Review one claim before external use.",
                    "resolved": False,
                }
            ],
            "metadata": {"mode": "live"},
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(expected_content_type)
    assert response.headers["content-disposition"].endswith(f'{extension}"')

    if export_format == "pdf":
        assert response.content.startswith(b"%PDF")
        assert b"Edited section text that only exists in the browser." in response.content
        assert b"Confirm funding recipient." in response.content
    elif export_format == "pptx":
        assert response.content[:2] == b"PK"
        with ZipFile(BytesIO(response.content)) as archive:
            slide_xml = "\n".join(
                archive.read(name).decode()
                for name in archive.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            )
        assert "Edited section text that only exists in the browser." in slide_xml
        assert "Confirm funding recipient." in slide_xml
    elif export_format == "markdown":
        markdown = response.content.decode()
        assert "Edited section text that only exists in the browser." in markdown
        assert "**45% of facilities**" in markdown
        assert "Confirm funding recipient." in markdown
    else:
        text = response.content.decode()
        assert "Edited section text that only exists in the browser." in text
        assert "45% of facilities" in text
        assert "**45% of facilities**" not in text
        assert "Confirm funding recipient." in text


def test_export_rejects_unsupported_format() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Unsupported export test"}).json()

    response = test_client.post(
        f"/api/projects/{project['id']}/exports/keynote",
        json={
            "output": export_output_payload(),
            "informationNeeded": [],
            "reviewFindings": [],
            "metadata": {"mode": "live"},
        },
    )

    assert response.status_code == 400
    assert "Unsupported export format" in response.json()["detail"]


def test_save_artifact_version_uses_visible_output_payload() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Version save test"}).json()
    project_id = project["id"]
    output = export_output_payload()
    generation_id = f"gen-{project_id}-version-test"
    case_repository.save_generation(
        project_id,
        GenerationResult(
            generationId=generation_id,
            projectId=project_id,
            status="completed",
            outputs=[output],
            informationNeeded=[],
            reviewFindings=[],
            metadata={"mode": "test"},
        ),
    )

    edited_output = export_output_payload()
    edited_output["sections"][0]["body"] = "Saved visible edit from the browser."
    response = test_client.post(
        f"/api/projects/{project_id}/artifact-versions",
        json={"generationId": generation_id, "output": edited_output},
    )

    assert response.status_code == 200
    assert response.json()["version"] == 2
    assert response.json()["status"] == "current"

    generation = test_client.get(f"/api/generations/{generation_id}").json()
    versions = test_client.get(f"/api/projects/{project_id}/artifact-versions").json()
    assert generation["outputs"][0]["sections"][0]["body"] == "Saved visible edit from the browser."
    assert any(item["version"] == 1 and item["status"] == "superseded" for item in versions)
    assert any(item["version"] == 2 and item["status"] == "current" for item in versions)


def test_locked_number_comparison_and_generation_preserves_locked_fact(monkeypatch) -> None:
    install_fake_extraction_provider(monkeypatch)
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Locked fact test"}).json()
    project_id = project["id"]
    audience = test_client.get("/api/audiences").json()[0]

    test_client.put(
        f"/api/projects/{project_id}/opportunity-audience",
        json={
            "sourceMode": "new",
            "opportunityId": None,
            "audienceId": audience["id"],
            "intendedOutcome": "Agree to another conversation",
            "suggestions": [],
            "selectedOutputs": ["investment_case", "source_appendix"],
        },
    )
    extraction = test_client.post(
        f"/api/sources/extract?projectId={project_id}&filename=fixture.txt",
        content=REAL_SOURCE_TEXT,
        headers={"content-type": "text/plain"},
    ).json()
    parsed_extraction = ExtractionResult.model_validate(extraction)
    locked_model_field = next(field for field in parsed_extraction.fields if field.id == "funding_range").model_copy(update={"locked": True})
    assert locked_facts_preserved("This sentence preserves USD 12-18 million.", [locked_model_field])
    assert not locked_facts_preserved("This sentence omits the amount.", [locked_model_field])

    fields = []
    for field in extraction["fields"]:
        field["verified"] = True
        field["locked"] = field["id"] == "funding_range"
        fields.append(field)

    reviewed = test_client.put(
        f"/api/projects/{project_id}/extraction-review",
        json={"fields": fields, "confirmed": True},
    )
    assert reviewed.status_code == 200

    generation = test_client.post(f"/api/projects/{project_id}/generate", json={"simulateError": False})
    assert generation.status_code == 503
    assert "Live model generation is required" in generation.json()["detail"]


def test_sanitized_controlled_generation_error() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Error test"}).json()

    response = test_client.post(
        f"/api/projects/{project['id']}/generate",
        json={"simulateError": True},
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "Generation failed in controlled test mode."}


def test_project_update_review_commits_approved_memory() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Update memory test"}).json()
    project_id = project["id"]

    update_response = test_client.post(
        f"/api/projects/{project_id}/updates",
        json={
            "updateType": "meeting_notes",
            "sourceLabel": "Aug 7 donor meeting",
            "text": (
                "The donor confirmed interest in Kenya clinics and asked for sharper meeting talking points. "
                "Funding recipient and investment vehicle are not yet defined. "
                "Need to confirm whether district health offices will be the delivery partners?"
            ),
        },
    )

    assert update_response.status_code == 200
    update = update_response.json()
    assert update["status"] == "pending_review"
    assert update["extractedFacts"]
    assert update["openQuestions"]
    assert any(item["outputType"] == "talking_points" for item in update["affectedOutputs"])

    review_response = test_client.put(
        f"/api/projects/{project_id}/updates/{update['id']}/review",
        json={
            "approvedFactIds": [item["id"] for item in update["extractedFacts"]],
            "approvedQuestionIds": [item["id"] for item in update["openQuestions"]],
        },
    )

    assert review_response.status_code == 200
    assert review_response.json()["status"] == "approved"

    memory = test_client.get(f"/api/projects/{project_id}/memory").json()
    refreshed_project = test_client.get(f"/api/projects/{project_id}").json()
    assert len(memory) == len(update["extractedFacts"]) + len(update["openQuestions"])
    assert refreshed_project["memorySummary"]["updateCount"] == 1
    assert refreshed_project["memorySummary"]["approvedMemoryCount"] == len(memory)
