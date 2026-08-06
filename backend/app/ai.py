import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .config import Settings, get_settings
from .prompts import PromptError, load_operation_prompt, load_system_prompt
from .schema_validation import JsonSchemaValidationError, validate_json_schema_output


class StructuredGenerationRequest(BaseModel):
    operation: str = Field(min_length=1)
    prompt_version: str = Field(alias="promptVersion", min_length=1)
    external_web_search: bool = Field(default=False, alias="externalWebSearch")
    input: dict[str, Any]
    json_schema: dict[str, Any] = Field(alias="jsonSchema")
    metadata: dict[str, str] | None = None

    @property
    def prompt_name(self) -> str | None:
        if not self.metadata:
            return None
        return self.metadata.get("promptName")


class StructuredGenerationResponse(BaseModel):
    output: Any
    model_provider: str = Field(alias="modelProvider")
    model_name: str = Field(alias="modelName")
    stored_payload_mode: str = Field(alias="storedPayloadMode")
    redacted_response_json: dict[str, Any] | None = Field(
        default=None,
        alias="redactedResponseJson",
    )


class VertexGeminiProvider:
    provider_name = "backend-vertex-gemini"

    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.google_cloud_project:
            raise ValueError("GOOGLE_CLOUD_PROJECT is required for Vertex Gemini.")
        if not settings.vertex_location:
            raise ValueError("VERTEX_AI_LOCATION or GOOGLE_CLOUD_LOCATION is required.")
        if not settings.vertex_model:
            raise ValueError("VERTEX_AI_MODEL or LIVE_API_MODEL is required.")

    @property
    def model_name(self) -> str:
        return self.settings.vertex_model or ""

    def generate_structured(
        self,
        request: StructuredGenerationRequest,
    ) -> StructuredGenerationResponse:
        system_prompt = load_system_prompt()
        task_prompt = load_operation_prompt(request.operation, request.prompt_name)
        if request.prompt_version != task_prompt.version:
            raise ValueError(
                "Prompt version mismatch for "
                f"{task_prompt.name}: caller sent {request.prompt_version}, "
                f"backend loaded {task_prompt.version}.",
            )

        access_token = self._access_token()
        response_json = self._post_json(
            self._vertex_url(),
            self._vertex_payload(request, system_prompt.text, task_prompt.text),
            headers={
                "authorization": f"Bearer {access_token}",
                "content-type": "application/json",
            },
        )
        text = "\n".join(
            part.get("text", "")
            for candidate in response_json.get("candidates", [])
            for part in candidate.get("content", {}).get("parts", [])
            if part.get("text")
        ).strip()
        if not text:
            raise ValueError("Vertex Gemini returned no text candidate.")

        output = self._parse_json_candidate(text)
        validate_json_schema_output(output, request.json_schema)

        return StructuredGenerationResponse(
            output=output,
            modelProvider=self.provider_name,
            modelName=self.model_name,
            storedPayloadMode="validated_outputs_only",
            redactedResponseJson={
                "promptName": task_prompt.name,
                "promptVersion": task_prompt.version,
                "systemPromptVersion": system_prompt.version,
                "finishReasons": [
                    candidate.get("finishReason")
                    for candidate in response_json.get("candidates", [])
                ],
                "usageMetadata": response_json.get("usageMetadata"),
                "groundingMetadata": [
                    {
                        "webSearchQueries": metadata.get("webSearchQueries"),
                        "groundingChunks": metadata.get("groundingChunks"),
                        "groundingSupports": metadata.get("groundingSupports"),
                        "retrievalMetadata": metadata.get("retrievalMetadata"),
                        "hasSearchEntryPoint": bool(metadata.get("searchEntryPoint")),
                    }
                    for metadata in [
                        candidate.get("groundingMetadata")
                        for candidate in response_json.get("candidates", [])
                    ]
                    if isinstance(metadata, dict)
                ],
            },
        )

    def _vertex_url(self) -> str:
        project = self.settings.google_cloud_project
        location = self.settings.vertex_location
        model = self.settings.vertex_model
        endpoint = (
            "https://aiplatform.googleapis.com"
            if location == "global"
            else f"https://{location}-aiplatform.googleapis.com"
        )
        return (
            f"{endpoint}/v1/projects/"
            f"{project}/locations/{location}/publishers/google/models/"
            f"{model}:generateContent"
        )

    def _vertex_payload(
        self,
        request: StructuredGenerationRequest,
        system_prompt: str,
        task_prompt: str,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "systemInstruction": {
                "role": "system",
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": self._structured_prompt(request, task_prompt)}],
                },
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95,
                "maxOutputTokens": self.settings.model_max_output_tokens,
                "responseMimeType": "application/json",
            },
        }

        if request.external_web_search:
            payload["tools"] = [{"googleSearch": {}}]

        return payload

    def _structured_prompt(
        self,
        request: StructuredGenerationRequest,
        task_prompt: str,
    ) -> str:
        input_payload = dict(request.input)
        input_payload.pop("prompt", None)
        input_payload.pop("systemPrompt", None)
        input_payload.pop("taskPrompt", None)
        return "\n".join(
            part
            for part in [
                task_prompt,
                "",
                "Return only valid JSON for this operation.",
                f"Operation: {request.operation}",
                "",
                "Structured output schema:",
                json.dumps(request.json_schema),
                "",
                "Input:",
                json.dumps(input_payload),
            ]
            if part
        )

    def _access_token(self) -> str:
        if self.settings.google_oauth_access_token:
            return self.settings.google_oauth_access_token

        credentials_path = self._credentials_path()
        credentials = json.loads(credentials_path.read_text(encoding="utf-8"))
        if credentials.get("type") != "authorized_user":
            raise ValueError(
                "Backend Vertex provider currently supports gcloud ADC "
                "authorized_user credentials or GOOGLE_OAUTH_ACCESS_TOKEN.",
            )

        token_json = self._post_form(
            credentials.get("token_uri") or "https://oauth2.googleapis.com/token",
            {
                "client_id": credentials["client_id"],
                "client_secret": credentials["client_secret"],
                "refresh_token": credentials["refresh_token"],
                "grant_type": "refresh_token",
            },
        )
        access_token = token_json.get("access_token")
        if not access_token:
            raise ValueError("Google OAuth token response did not include access_token.")

        return str(access_token)

    def _credentials_path(self) -> Path:
        if self.settings.google_application_credentials:
            configured = Path(self.settings.google_application_credentials)
            if configured.exists():
                return configured

        adc_path = Path.home() / ".config" / "gcloud" / "application_default_credentials.json"
        if adc_path.exists():
            return adc_path

        raise ValueError(
            "Vertex Gemini requires GOOGLE_OAUTH_ACCESS_TOKEN or local gcloud ADC.",
        )

    def _post_json(
        self,
        url: str,
        payload: dict[str, Any],
        headers: dict[str, str],
    ) -> dict[str, Any]:
        return self._request(
            urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            ),
        )

    def _post_form(self, url: str, payload: dict[str, str]) -> dict[str, Any]:
        return self._request(
            urllib.request.Request(
                url,
                data=urllib.parse.urlencode(payload).encode("utf-8"),
                headers={"content-type": "application/x-www-form-urlencoded"},
                method="POST",
            ),
        )

    def _request(self, request: urllib.request.Request) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            raise ValueError(f"Vertex request failed: {body}") from error

    def _parse_json_candidate(self, text: str) -> Any:
        stripped = text.strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

        if "```" in stripped:
            fenced = stripped.split("```", 2)[1]
            if fenced.lstrip().startswith("json"):
                fenced = fenced.lstrip()[4:]
            return json.loads(fenced.strip())

        first = stripped.find("{")
        last = stripped.rfind("}")
        if first >= 0 and last > first:
            return json.loads(stripped[first : last + 1])

        raise ValueError("Model response did not contain valid JSON.")


class DatabricksModelServingProvider:
    provider_name = "backend-databricks-model-serving"

    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.databricks_host:
            raise ValueError("DATABRICKS_HOST is required for Databricks Model Serving.")
        if not settings.databricks_model_name:
            raise ValueError(
                "DATABRICKS_MODEL_SERVING_ENDPOINT or DATABRICKS_MODEL is required.",
            )

    @property
    def model_name(self) -> str:
        return self.settings.databricks_model_name or ""

    def generate_structured(
        self,
        request: StructuredGenerationRequest,
    ) -> StructuredGenerationResponse:
        system_prompt = load_system_prompt()
        task_prompt = load_operation_prompt(request.operation, request.prompt_name)
        if request.prompt_version != task_prompt.version:
            raise ValueError(
                "Prompt version mismatch for "
                f"{task_prompt.name}: caller sent {request.prompt_version}, "
                f"backend loaded {task_prompt.version}.",
            )

        response_json = self._post_json(
            self._chat_completions_url(),
            self._chat_payload(request, system_prompt.text, task_prompt.text),
            headers={
                "authorization": f"Bearer {self._access_token()}",
                "content-type": "application/json",
            },
        )
        text = self._chat_response_text(response_json)
        if not text:
            raise ValueError("Databricks Model Serving returned no text candidate.")

        output = self._parse_json_candidate(text)
        validate_json_schema_output(output, request.json_schema)

        return StructuredGenerationResponse(
            output=output,
            modelProvider=self.provider_name,
            modelName=self.model_name,
            storedPayloadMode="validated_outputs_only",
            redactedResponseJson={
                "promptName": task_prompt.name,
                "promptVersion": task_prompt.version,
                "systemPromptVersion": system_prompt.version,
                "finishReasons": [
                    choice.get("finish_reason")
                    for choice in response_json.get("choices", [])
                    if isinstance(choice, dict)
                ],
                "usageMetadata": response_json.get("usage"),
                "externalWebSearchApplied": False,
                "externalWebSearchRequested": request.external_web_search,
            },
        )

    def _host(self) -> str:
        host = self.settings.databricks_host or ""
        if not host.startswith(("http://", "https://")):
            host = f"https://{host}"
        return host.rstrip("/")

    def _chat_completions_url(self) -> str:
        base_url = self.settings.databricks_ai_gateway_base_url
        if base_url:
            return f"{base_url.rstrip('/')}/chat/completions"
        return f"{self._host()}/ai-gateway/mlflow/v1/chat/completions"

    def _chat_payload(
        self,
        request: StructuredGenerationRequest,
        system_prompt: str,
        task_prompt: str,
    ) -> dict[str, Any]:
        return {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": self._structured_prompt(request, task_prompt),
                },
            ],
            "temperature": 0.2,
            "max_tokens": self.settings.model_max_output_tokens,
        }

    def _structured_prompt(
        self,
        request: StructuredGenerationRequest,
        task_prompt: str,
    ) -> str:
        input_payload = dict(request.input)
        input_payload.pop("prompt", None)
        input_payload.pop("systemPrompt", None)
        input_payload.pop("taskPrompt", None)
        return "\n".join(
            part
            for part in [
                task_prompt,
                "",
                "Return only valid JSON for this operation.",
                "Do not include Markdown fences or explanatory prose.",
                f"Operation: {request.operation}",
                "",
                "Structured output schema:",
                json.dumps(request.json_schema),
                "",
                "Input:",
                json.dumps(input_payload),
            ]
            if part
        )

    def _access_token(self) -> str:
        if self.settings.databricks_token:
            return self.settings.databricks_token

        client_id = self.settings.databricks_client_id
        client_secret = self.settings.databricks_client_secret
        if not client_id or not client_secret:
            raise ValueError(
                "Databricks Model Serving requires DATABRICKS_TOKEN or "
                "DATABRICKS_CLIENT_ID plus DATABRICKS_CLIENT_SECRET.",
            )

        auth = base64.b64encode(
            f"{client_id}:{client_secret}".encode("utf-8"),
        ).decode("ascii")
        token_json = self._post_form(
            f"{self._host()}/oidc/v1/token",
            {
                "grant_type": "client_credentials",
                "scope": "all-apis",
            },
            headers={"authorization": f"Basic {auth}"},
        )
        access_token = token_json.get("access_token")
        if not access_token:
            raise ValueError("Databricks OAuth response did not include access_token.")

        return str(access_token)

    def _post_json(
        self,
        url: str,
        payload: dict[str, Any],
        headers: dict[str, str],
    ) -> dict[str, Any]:
        return self._request(
            urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            ),
        )

    def _post_form(
        self,
        url: str,
        payload: dict[str, str],
        *,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        merged_headers = {"content-type": "application/x-www-form-urlencoded"}
        if headers:
            merged_headers.update(headers)
        return self._request(
            urllib.request.Request(
                url,
                data=urllib.parse.urlencode(payload).encode("utf-8"),
                headers=merged_headers,
                method="POST",
            ),
        )

    def _request(self, request: urllib.request.Request) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            raise ValueError(f"Databricks request failed: {body}") from error

    def _chat_response_text(self, response_json: dict[str, Any]) -> str:
        for choice in response_json.get("choices", []):
            if not isinstance(choice, dict):
                continue

            message = choice.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content.strip()
                if isinstance(content, list):
                    text_parts = [
                        part.get("text") or part.get("content")
                        for part in content
                        if isinstance(part, dict)
                    ]
                    joined = "\n".join(str(part) for part in text_parts if part)
                    if joined.strip():
                        return joined.strip()

            text = choice.get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()

        predictions = response_json.get("predictions")
        if isinstance(predictions, list):
            for prediction in predictions:
                if isinstance(prediction, str) and prediction.strip():
                    return prediction.strip()
                if isinstance(prediction, dict):
                    text = prediction.get("text") or prediction.get("content")
                    if isinstance(text, str) and text.strip():
                        return text.strip()

        return ""

    def _parse_json_candidate(self, text: str) -> Any:
        stripped = text.strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

        if "```" in stripped:
            fenced = stripped.split("```", 2)[1]
            if fenced.lstrip().startswith("json"):
                fenced = fenced.lstrip()[4:]
            return json.loads(fenced.strip())

        first = stripped.find("{")
        last = stripped.rfind("}")
        if first >= 0 and last > first:
            return json.loads(stripped[first : last + 1])

        raise ValueError("Model response did not contain valid JSON.")


class AnthropicClaudeProvider:
    provider_name = "backend-anthropic-claude"

    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for Claude.")
        if not settings.claude_model_name:
            raise ValueError("ANTHROPIC_MODEL or CLAUDE_MODEL is required.")

    @property
    def model_name(self) -> str:
        return self.settings.claude_model_name or ""

    def generate_structured(
        self,
        request: StructuredGenerationRequest,
    ) -> StructuredGenerationResponse:
        system_prompt = load_system_prompt()
        task_prompt = load_operation_prompt(request.operation, request.prompt_name)
        if request.prompt_version != task_prompt.version:
            raise ValueError(
                "Prompt version mismatch for "
                f"{task_prompt.name}: caller sent {request.prompt_version}, "
                f"backend loaded {task_prompt.version}.",
            )

        response_json = self._post_json(
            self._messages_url(),
            self._messages_payload(request, system_prompt.text, task_prompt.text),
            headers={
                "anthropic-version": self.settings.anthropic_version,
                "content-type": "application/json",
                "x-api-key": self.settings.anthropic_api_key or "",
            },
        )
        text = self._message_response_text(response_json)
        if not text:
            raise ValueError("Claude returned no text content block.")

        output = self._parse_json_candidate(text)
        validate_json_schema_output(output, request.json_schema)

        return StructuredGenerationResponse(
            output=output,
            modelProvider=self.provider_name,
            modelName=self.model_name,
            storedPayloadMode="validated_outputs_only",
            redactedResponseJson={
                "promptName": task_prompt.name,
                "promptVersion": task_prompt.version,
                "systemPromptVersion": system_prompt.version,
                "stopReason": response_json.get("stop_reason"),
                "stopSequence": response_json.get("stop_sequence"),
                "usageMetadata": response_json.get("usage"),
                "externalWebSearchApplied": False,
                "externalWebSearchRequested": request.external_web_search,
            },
        )

    def _messages_url(self) -> str:
        return f"{self.settings.anthropic_base_url.rstrip('/')}/v1/messages"

    def _messages_payload(
        self,
        request: StructuredGenerationRequest,
        system_prompt: str,
        task_prompt: str,
    ) -> dict[str, Any]:
        return {
            "model": self.model_name,
            "max_tokens": self.settings.model_max_output_tokens,
            "temperature": 0.2,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": self._structured_prompt(request, task_prompt),
                },
            ],
        }

    def _structured_prompt(
        self,
        request: StructuredGenerationRequest,
        task_prompt: str,
    ) -> str:
        input_payload = dict(request.input)
        input_payload.pop("prompt", None)
        input_payload.pop("systemPrompt", None)
        input_payload.pop("taskPrompt", None)
        return "\n".join(
            part
            for part in [
                task_prompt,
                "",
                "Return only valid JSON for this operation.",
                "Do not include Markdown fences or explanatory prose.",
                f"Operation: {request.operation}",
                "",
                "Structured output schema:",
                json.dumps(request.json_schema),
                "",
                "Input:",
                json.dumps(input_payload),
            ]
            if part
        )

    def _post_json(
        self,
        url: str,
        payload: dict[str, Any],
        headers: dict[str, str],
    ) -> dict[str, Any]:
        return self._request(
            urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            ),
        )

    def _request(self, request: urllib.request.Request) -> dict[str, Any]:
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            raise ValueError(f"Claude request failed: {body}") from error

    def _message_response_text(self, response_json: dict[str, Any]) -> str:
        content = response_json.get("content")
        if isinstance(content, str):
            return content.strip()
        if not isinstance(content, list):
            return ""

        text_parts = [
            block.get("text")
            for block in content
            if isinstance(block, dict)
            and block.get("type") == "text"
            and isinstance(block.get("text"), str)
        ]
        return "\n".join(text_parts).strip()

    def _parse_json_candidate(self, text: str) -> Any:
        stripped = text.strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

        if "```" in stripped:
            fenced = stripped.split("```", 2)[1]
            if fenced.lstrip().startswith("json"):
                fenced = fenced.lstrip()[4:]
            return json.loads(fenced.strip())

        first = stripped.find("{")
        last = stripped.rfind("}")
        if first >= 0 and last > first:
            return json.loads(stripped[first : last + 1])

        raise ValueError("Model response did not contain valid JSON.")


LiveModelProvider = (
    VertexGeminiProvider | DatabricksModelServingProvider | AnthropicClaudeProvider
)


def get_model_provider(
    settings: Settings = Depends(get_settings),
) -> LiveModelProvider:
    mode = settings.model_provider_mode.strip().lower()
    databricks_requested = (
        mode in {"databricks", "databricks-model-serving", "mosaic", "mosaic-ai"}
        or bool(settings.databricks_model_name)
    )
    anthropic_requested = (
        mode in {"anthropic", "claude"}
        or bool(settings.claude_model_name)
    )
    vertex_requested = (
        mode in {"vertex", "vertex-gemini", "gemini"}
        or settings.google_genai_use_vertexai
        or bool(settings.vertex_model)
        or bool(settings.live_api_model)
    )
    if settings.use_mock_ai or not (
        databricks_requested or anthropic_requested or vertex_requested
    ):
        raise HTTPException(
            status_code=503,
            detail="Live model provider is not configured.",
        )

    try:
        if mode in {"anthropic", "claude"}:
            return AnthropicClaudeProvider(settings)
        if mode in {"databricks", "databricks-model-serving", "mosaic", "mosaic-ai"}:
            return DatabricksModelServingProvider(settings)
        if mode in {"vertex", "vertex-gemini", "gemini"}:
            return VertexGeminiProvider(settings)
        if databricks_requested:
            return DatabricksModelServingProvider(settings)
        if anthropic_requested:
            return AnthropicClaudeProvider(settings)
        return VertexGeminiProvider(settings)
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/structured",
    response_model=StructuredGenerationResponse,
    response_model_by_alias=True,
)
def generate_structured(
    request: StructuredGenerationRequest,
    provider: LiveModelProvider = Depends(get_model_provider),
) -> StructuredGenerationResponse:
    try:
        return provider.generate_structured(request)
    except (PromptError, JsonSchemaValidationError, ValueError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
