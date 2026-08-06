from fastapi.testclient import TestClient

from app.main import app
from app.models.extraction import ExtractionResult
from app.models.generation import GenerationResult
from app.services.integrity import locked_facts_preserved


def client() -> TestClient:
    return TestClient(app)


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


def test_mock_extraction_contract() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Extraction test"}).json()

    response = test_client.post(
        f"/api/sources/extract?projectId={project['id']}&filename=test.txt",
        content=b"Synthetic fixture",
        headers={"content-type": "text/plain"},
    )

    assert response.status_code == 200
    extraction = response.json()
    assert extraction["temporaryStatus"].startswith("Phase 1 temporary processing")
    assert len(extraction["fields"]) >= 13
    values = " ".join(field["value"] for field in extraction["fields"])
    assert "USD 10-25 million" in values
    assert "Global Vaccine Development Initiative" in values
    assert "2026-2030" in values


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
        content=b"Synthetic fixture",
        headers={"content-type": "text/plain"},
    ).json()
    parsed_extraction = ExtractionResult.model_validate(extraction)
    locked_model_field = next(field for field in parsed_extraction.fields if field.id == "funding_range").model_copy(update={"locked": True})
    assert locked_facts_preserved("This sentence preserves USD 10-25 million.", [locked_model_field])
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
    assert "USD 10-25 million" in body


def test_sanitized_controlled_generation_error() -> None:
    test_client = client()
    project = test_client.post("/api/projects", json={"name": "Error test"}).json()

    response = test_client.post(
        f"/api/projects/{project['id']}/generate",
        json={"simulateError": True},
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "Mock generation failed in controlled test mode."}
