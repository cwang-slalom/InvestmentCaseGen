import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path


class PromptError(ValueError):
    pass


@dataclass(frozen=True)
class PromptBundle:
    name: str
    version: str
    text: str
    path: Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SYSTEM_PROMPT_NAME = "system-source-grounded"

OPERATION_PROMPTS = {
    "extract_opportunities": "extract-opportunities",
    "assess_opportunity": "assess-investability",
    "validate_citations": "validate-citations",
    "render_executive_investment_case": "generate-investment-case",
    "render_opportunity_spotlight": "generate-opportunity-spotlight",
    "strengthen_narrative": "strengthen-narrative",
    "regenerate_draft_section": "strengthen-narrative",
    "apply_donor_followup": "apply-donor-followup",
    "export_docx": "generate-investment-case",
}

VERSION_PATTERN = re.compile(
    r"(?:<!--\s*version:\s*([^>]+?)\s*-->|^version:\s*(.+)$)",
    re.IGNORECASE | re.MULTILINE,
)


def safe_prompt_name(prompt_name: str) -> str:
    safe_name = re.sub(r"[^a-zA-Z0-9-]", "", prompt_name)
    if not safe_name:
        raise PromptError("Prompt name is empty after sanitization.")
    return safe_name


def prompt_name_for_operation(operation: str) -> str:
    try:
        return OPERATION_PROMPTS[operation]
    except KeyError as error:
        raise PromptError(
            f"No backend prompt is registered for operation {operation!r}.",
        ) from error


def prompt_directories() -> list[Path]:
    configured = os.environ.get("INVESTMENTGEN_PROMPTS_DIR")
    candidates = [
        Path(configured).expanduser() if configured else None,
        REPO_ROOT / "prompts",
        Path(__file__).resolve().parents[1] / "prompts",
        Path.cwd() / "prompts",
    ]

    paths: list[Path] = []
    for candidate in candidates:
        if candidate and candidate not in paths:
            paths.append(candidate)
    return paths


def load_prompt(prompt_name: str) -> PromptBundle:
    safe_name = safe_prompt_name(prompt_name)
    checked_paths = [
        prompt_dir / f"{safe_name}.md" for prompt_dir in prompt_directories()
    ]
    for path in checked_paths:
        try:
            text = path.read_text(encoding="utf-8")
            break
        except FileNotFoundError:
            continue
    else:
        searched = ", ".join(str(path) for path in checked_paths)
        raise PromptError(
            f"Backend prompt {safe_name!r} was not found in: {searched}.",
        )

    match = VERSION_PATTERN.search(text)
    explicit_version = (match.group(1) or match.group(2)).strip() if match else None
    version = explicit_version or hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]

    return PromptBundle(name=safe_name, version=version, text=text, path=path)


def load_system_prompt() -> PromptBundle:
    return load_prompt(SYSTEM_PROMPT_NAME)


def load_operation_prompt(
    operation: str,
    requested_prompt_name: str | None = None,
) -> PromptBundle:
    prompt_name = requested_prompt_name or prompt_name_for_operation(operation)
    expected_prompt_name = prompt_name_for_operation(operation)
    if safe_prompt_name(prompt_name) != expected_prompt_name:
        raise PromptError(
            f"Prompt {prompt_name!r} is not registered for operation {operation!r}.",
        )

    return load_prompt(prompt_name)
