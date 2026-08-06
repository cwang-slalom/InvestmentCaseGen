from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from fastapi.testclient import TestClient

from app.main import app
from app.models.extraction import ExtractionResult
from app.models.generation import GenerationResult
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


def test_api_health_and_config_do_not_expose_credentials() -> None:
    test_client = client()

    health = test_client.get("/api/health")
    config = test_client.get("/api/config")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert config.status_code == 200
    payload = config.json()
    assert payload["mode"] == "mock"
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


def test_uploaded_text_extraction_uses_source_content() -> None:
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


def test_uploaded_pdf_extraction_reads_text_layer() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "PDF extraction test"}).json()
    pdf_content = Path("../resources/reference-output-examples/maternal-newborn-health-spotlights.pdf").read_bytes()

    response = test_client.post(
        f"/api/sources/extract?projectId={project['id']}&filename=maternal-newborn-health-spotlights.pdf",
        content=pdf_content,
        headers={"content-type": "application/pdf"},
    )

    assert response.status_code == 200
    extraction = response.json()
    values = " ".join(field["value"] for field in extraction["fields"])
    assert "maternal newborn health spotlights" in values.lower()
    assert "Global Vaccine Development Initiative" not in values


def test_mock_generation_contract_and_response_validation() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Generation test"}).json()
    project_id = project["id"]
    opportunity = test_client.get("/api/opportunities").json()[0]
    audience = test_client.get("/api/audiences").json()[0]

    test_client.put(
        f"/api/projects/{project_id}/opportunity-audience",
        json={
            "sourceMode": "existing",
            "opportunityId": opportunity["id"],
            "audienceId": audience["id"],
            "intendedOutcome": "Explore a co-funding partnership",
            "suggestions": [],
            "selectedOutputs": ["investment_case", "one_page", "source_appendix"],
        },
    )

    response = test_client.post(f"/api/projects/{project_id}/generate", json={"simulateError": False})

    assert response.status_code == 200
    parsed = GenerationResult.model_validate(response.json())
    assert parsed.generation_id.startswith("gen-")
    assert {output.type for output in parsed.outputs} == {"investment_case", "one_page", "source_appendix"}
    assert parsed.review_findings
    assert parsed.metadata["storedPayloadMode"] == "validated_outputs_only"


def test_generation_for_new_opportunity_uses_uploaded_source_fields() -> None:
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

    assert generation_response.status_code == 200
    generation = generation_response.json()
    body = "\n".join(
        section["body"]
        for output in generation["outputs"]
        for section in output["sections"]
    )
    assert generation["metadata"]["mode"] == "uploaded_source_deterministic"
    assert "Clean Water Opportunity" in body
    assert "USD 12-18 million" in body
    assert "Vaccine Development Platform" not in body
    assert any(
        citation["label"] == "clean-water.txt"
        for output in generation["outputs"]
        for section in output["sections"]
        for citation in section["citations"]
    )


def test_phase1_docx_export_uses_visible_output_payload() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Export test"}).json()
    generation = test_client.post(f"/api/projects/{project['id']}/generate", json={"simulateError": False}).json()
    output = generation["outputs"][0]
    output["sections"][0]["body"] = "Edited section text that only exists in the browser."

    response = test_client.post(
        f"/api/projects/{project['id']}/exports/docx",
        json={
            "output": output,
            "informationNeeded": generation["informationNeeded"],
            "reviewFindings": generation["reviewFindings"],
            "metadata": generation["metadata"],
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


def test_locked_number_comparison_and_generation_preserves_locked_fact() -> None:
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

    generation = test_client.post(f"/api/projects/{project_id}/generate", json={"simulateError": False}).json()
    body = "\n".join(
        section["body"]
        for output in generation["outputs"]
        for section in output["sections"]
    )
    assert "USD 12-18 million" in body


def test_sanitized_controlled_generation_error() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Error test"}).json()

    response = test_client.post(
        f"/api/projects/{project['id']}/generate",
        json={"simulateError": True},
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "Mock generation failed in controlled test mode."}
