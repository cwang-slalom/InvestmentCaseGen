import urllib.request

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.ai import (
    AnthropicClaudeProvider,
    DatabricksModelServingProvider,
    StructuredGenerationRequest,
    StructuredGenerationResponse,
    VertexGeminiProvider,
    get_model_provider,
)
from app.config import Settings
from app.main import app
from app.prompts import load_prompt


class FakeProvider:
    def generate_structured(
        self,
        request: StructuredGenerationRequest,
    ) -> StructuredGenerationResponse:
        return StructuredGenerationResponse(
            output={
                "ok": True,
                "operation": request.operation,
                "received": request.input.get("value"),
                "externalWebSearch": request.external_web_search,
            },
            modelProvider="backend-vertex-gemini",
            modelName="gemini-test",
            storedPayloadMode="validated_outputs_only",
            redactedResponseJson={"finishReasons": ["STOP"]},
        )


def override_provider() -> FakeProvider:
    return FakeProvider()


def override_missing_provider() -> None:
    raise HTTPException(status_code=503, detail="Live model provider is not configured.")


def test_structured_generation_endpoint() -> None:
    app.dependency_overrides[get_model_provider] = override_provider
    try:
        client = TestClient(app)

        response = client.post(
            "/ai/structured",
            json={
                "operation": "render_executive_investment_case",
                "promptVersion": "test",
                "externalWebSearch": True,
                "input": {"value": "hello"},
                "jsonSchema": {
                    "type": "object",
                    "properties": {"ok": {"type": "boolean"}},
                },
                "metadata": {"promptName": "generate-investment-case"},
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "output": {
            "ok": True,
            "operation": "render_executive_investment_case",
            "received": "hello",
            "externalWebSearch": True,
        },
        "modelProvider": "backend-vertex-gemini",
        "modelName": "gemini-test",
        "storedPayloadMode": "validated_outputs_only",
        "redactedResponseJson": {"finishReasons": ["STOP"]},
    }


def test_structured_generation_requires_provider() -> None:
    app.dependency_overrides[get_model_provider] = override_missing_provider
    try:
        client = TestClient(app)

        response = client.post(
            "/ai/structured",
            json={
                "operation": "render_executive_investment_case",
                "promptVersion": "test",
                "input": {},
                "jsonSchema": {"type": "object"},
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503


def test_get_model_provider_uses_explicit_anthropic_mode() -> None:
    provider = get_model_provider(
        Settings(
            model_provider_mode="anthropic",
            anthropic_api_key="token-1",
            anthropic_model="claude-sonnet-5",
            google_cloud_project="project-1",
            vertex_ai_location="global",
            vertex_ai_model="gemini-test",
        ),
    )

    assert isinstance(provider, AnthropicClaudeProvider)
    assert provider.model_name == "claude-sonnet-5"


class CapturingVertexProvider(VertexGeminiProvider):
    def __init__(self, response_text: str):
        super().__init__(
            Settings(
                google_cloud_project="project-1",
                vertex_ai_location="us-central1",
                vertex_ai_model="gemini-test",
                google_oauth_access_token="token-1",
            ),
        )
        self.response_text = response_text
        self.payload = None

    def _access_token(self) -> str:
        return "token-1"

    def _post_json(self, url, payload, headers):  # type: ignore[no-untyped-def]
        self.payload = payload
        return {
            "candidates": [
                {
                    "content": {"parts": [{"text": self.response_text}]},
                    "finishReason": "STOP",
                },
            ],
            "usageMetadata": {"totalTokenCount": 12},
        }


def test_vertex_provider_loads_backend_prompt_bundle() -> None:
    prompt = load_prompt("generate-investment-case")
    provider = CapturingVertexProvider('{"ok": true}')

    response = provider.generate_structured(
        StructuredGenerationRequest(
            operation="render_executive_investment_case",
            promptVersion=prompt.version,
            externalWebSearch=True,
            input={"prompt": "client prompt should be ignored", "value": "hello"},
            jsonSchema={
                "type": "object",
                "required": ["ok"],
                "properties": {"ok": {"type": "boolean"}},
            },
            metadata={"promptName": "generate-investment-case"},
        ),
    )

    assert response.output == {"ok": True}
    assert provider.payload is not None
    assert "Source-Grounded Investment Case System Prompt" in (
        provider.payload["systemInstruction"]["parts"][0]["text"]
    )
    user_prompt = provider.payload["contents"][0]["parts"][0]["text"]
    assert "Generate Investment Case Prompt" in user_prompt
    assert "client prompt should be ignored" not in user_prompt
    assert provider.payload["tools"] == [{"googleSearch": {}}]
    assert response.redacted_response_json is not None
    assert response.redacted_response_json["promptName"] == "generate-investment-case"


def test_vertex_provider_uses_global_endpoint_for_global_location() -> None:
    provider = VertexGeminiProvider(
        Settings(
            google_cloud_project="project-1",
            vertex_ai_location="global",
            vertex_ai_model="gemini-test",
            google_oauth_access_token="token-1",
        ),
    )

    assert provider._vertex_url().startswith("https://aiplatform.googleapis.com/")
    assert "/locations/global/" in provider._vertex_url()


def test_vertex_provider_validates_model_output_against_schema() -> None:
    prompt = load_prompt("generate-investment-case")
    provider = CapturingVertexProvider('{"ok": "not-a-boolean"}')

    try:
        provider.generate_structured(
            StructuredGenerationRequest(
                operation="render_executive_investment_case",
                promptVersion=prompt.version,
                input={"value": "hello"},
                jsonSchema={
                    "type": "object",
                    "required": ["ok"],
                    "properties": {"ok": {"type": "boolean"}},
                },
                metadata={"promptName": "generate-investment-case"},
            ),
        )
    except ValueError as error:
        assert "$.ok must be boolean" in str(error)
    else:
        raise AssertionError("Expected invalid model output to be rejected.")


class CapturingDatabricksProvider(DatabricksModelServingProvider):
    def __init__(self, response_text: str, model_name: str = "system.ai.test-model"):
        super().__init__(
            Settings(
                databricks_host="https://workspace.cloud.databricks.com",
                databricks_model_serving_endpoint=model_name,
                databricks_token="token-1",
            ),
        )
        self.response_text = response_text
        self.payload = None
        self.url = None

    def _access_token(self) -> str:
        return "token-1"

    def _post_json(self, url, payload, headers):  # type: ignore[no-untyped-def]
        self.url = url
        self.payload = payload
        return {
            "model": "system.ai.test-model",
            "choices": [
                {
                    "message": {"content": self.response_text},
                    "finish_reason": "stop",
                },
            ],
            "usage": {"total_tokens": 12},
        }


def test_databricks_provider_loads_backend_prompt_bundle() -> None:
    prompt = load_prompt("generate-investment-case")
    provider = CapturingDatabricksProvider('{"ok": true}')

    response = provider.generate_structured(
        StructuredGenerationRequest(
            operation="render_executive_investment_case",
            promptVersion=prompt.version,
            externalWebSearch=True,
            input={"prompt": "client prompt should be ignored", "value": "hello"},
            jsonSchema={
                "type": "object",
                "required": ["ok"],
                "properties": {"ok": {"type": "boolean"}},
            },
            metadata={"promptName": "generate-investment-case"},
        ),
    )

    assert response.output == {"ok": True}
    assert provider.url == (
        "https://workspace.cloud.databricks.com/ai-gateway/mlflow/v1/chat/completions"
    )
    assert provider.payload is not None
    assert provider.payload["model"] == "system.ai.test-model"
    assert provider.payload["temperature"] == 0.2
    assert provider.payload["messages"][0]["role"] == "system"
    assert "Source-Grounded Investment Case System Prompt" in (
        provider.payload["messages"][0]["content"]
    )
    user_prompt = provider.payload["messages"][1]["content"]
    assert "Generate Investment Case Prompt" in user_prompt
    assert "client prompt should be ignored" not in user_prompt
    assert response.redacted_response_json is not None
    assert response.redacted_response_json["externalWebSearchRequested"] is True
    assert response.redacted_response_json["externalWebSearchApplied"] is False


def test_databricks_provider_omits_temperature_for_claude_models() -> None:
    prompt = load_prompt("generate-investment-case")
    provider = CapturingDatabricksProvider(
        '{"ok": true}',
        model_name="us.anthropic.claude-opus-5",
    )

    provider.generate_structured(
        StructuredGenerationRequest(
            operation="render_executive_investment_case",
            promptVersion=prompt.version,
            input={"value": "hello"},
            jsonSchema={
                "type": "object",
                "required": ["ok"],
                "properties": {"ok": {"type": "boolean"}},
            },
            metadata={"promptName": "generate-investment-case"},
        ),
    )

    assert provider.payload is not None
    assert provider.payload["model"] == "us.anthropic.claude-opus-5"
    assert "temperature" not in provider.payload


def test_databricks_provider_uses_configured_gateway_base_url() -> None:
    provider = DatabricksModelServingProvider(
        Settings(
            databricks_host="https://workspace.cloud.databricks.com",
            databricks_model_serving_endpoint="system.ai.test-model",
            databricks_ai_gateway_base_url="https://proxy.example.com/v1",
            databricks_token="token-1",
        ),
    )

    assert provider._chat_completions_url() == "https://proxy.example.com/v1/chat/completions"


def test_databricks_provider_uses_configured_request_timeout(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    seen: dict[str, int] = {}

    class FakeResponse:
        def __enter__(self):  # type: ignore[no-untyped-def]
            return self

        def __exit__(self, *args):  # type: ignore[no-untyped-def]
            return False

        def read(self) -> bytes:
            return b'{"ok": true}'

    def fake_urlopen(request, timeout):  # type: ignore[no-untyped-def]
        seen["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    provider = DatabricksModelServingProvider(
        Settings(
            databricks_host="https://workspace.cloud.databricks.com",
            databricks_model_serving_endpoint="system.ai.test-model",
            databricks_token="token-1",
            databricks_request_timeout_seconds=300,
        ),
    )

    response = provider._request(
        urllib.request.Request("https://workspace.cloud.databricks.com/test"),
    )

    assert response == {"ok": True}
    assert seen["timeout"] == 300


def test_databricks_provider_wraps_read_timeout(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    class SlowResponse:
        def __enter__(self):  # type: ignore[no-untyped-def]
            return self

        def __exit__(self, *args):  # type: ignore[no-untyped-def]
            return False

        def read(self) -> bytes:
            raise TimeoutError("The read operation timed out")

    def fake_urlopen(request, timeout):  # type: ignore[no-untyped-def]
        return SlowResponse()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    provider = DatabricksModelServingProvider(
        Settings(
            databricks_host="https://workspace.cloud.databricks.com",
            databricks_model_serving_endpoint="system.ai.test-model",
            databricks_token="token-1",
            databricks_request_timeout_seconds=300,
        ),
    )

    try:
        provider._request(
            urllib.request.Request("https://workspace.cloud.databricks.com/test"),
        )
    except ValueError as error:
        assert "Databricks Model Serving timed out after 300 seconds" in str(error)
        assert "DATABRICKS_REQUEST_TIMEOUT_SECONDS" in str(error)
    else:
        raise AssertionError("Expected Databricks read timeout to be wrapped.")


class CapturingAnthropicProvider(AnthropicClaudeProvider):
    def __init__(self, response_text: str):
        super().__init__(
            Settings(
                anthropic_api_key="token-1",
                anthropic_model="claude-sonnet-5",
            ),
        )
        self.response_text = response_text
        self.payload = None
        self.url = None
        self.headers = None

    def _post_json(self, url, payload, headers):  # type: ignore[no-untyped-def]
        self.url = url
        self.payload = payload
        self.headers = headers
        return {
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": self.response_text}],
            "model": "claude-sonnet-5",
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 4},
        }


def test_anthropic_provider_loads_backend_prompt_bundle() -> None:
    prompt = load_prompt("generate-investment-case")
    provider = CapturingAnthropicProvider('{"ok": true}')

    response = provider.generate_structured(
        StructuredGenerationRequest(
            operation="render_executive_investment_case",
            promptVersion=prompt.version,
            externalWebSearch=True,
            input={"prompt": "client prompt should be ignored", "value": "hello"},
            jsonSchema={
                "type": "object",
                "required": ["ok"],
                "properties": {"ok": {"type": "boolean"}},
            },
            metadata={"promptName": "generate-investment-case"},
        ),
    )

    assert response.output == {"ok": True}
    assert provider.url == "https://api.anthropic.com/v1/messages"
    assert provider.headers is not None
    assert provider.headers["anthropic-version"] == "2023-06-01"
    assert provider.headers["x-api-key"] == "token-1"
    assert provider.payload is not None
    assert provider.payload["model"] == "claude-sonnet-5"
    assert provider.payload["system"].startswith(
        "# Source-Grounded Investment Case System Prompt",
    )
    user_prompt = provider.payload["messages"][0]["content"]
    assert provider.payload["messages"][0]["role"] == "user"
    assert "Generate Investment Case Prompt" in user_prompt
    assert "client prompt should be ignored" not in user_prompt
    assert response.model_provider == "backend-anthropic-claude"
    assert response.redacted_response_json is not None
    assert response.redacted_response_json["stopReason"] == "end_turn"
    assert response.redacted_response_json["externalWebSearchRequested"] is True
    assert response.redacted_response_json["externalWebSearchApplied"] is False


def test_anthropic_provider_uses_configured_base_url() -> None:
    provider = AnthropicClaudeProvider(
        Settings(
            anthropic_api_key="token-1",
            anthropic_model="claude-sonnet-5",
            anthropic_base_url="https://proxy.example.com/anthropic",
        ),
    )

    assert provider._messages_url() == "https://proxy.example.com/anthropic/v1/messages"
