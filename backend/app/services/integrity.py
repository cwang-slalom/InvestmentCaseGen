from __future__ import annotations

import re

from ..models.extraction import ExtractedField


PROTECTED_FACT_PATTERN = re.compile(
    r"(?:USD\s?\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?\s?(?:million|billion)?|\d+(?:\.\d+)?%|\bQ[1-4]\s+\d{4}\b|\b\d{4}\b|\b\d+(?:\.\d+)?\s?(?:million|clinics|districts|months|residents)\b)",
    re.IGNORECASE,
)


def protected_fact_tokens(fields: list[ExtractedField]) -> list[str]:
    tokens: list[str] = []
    for field in fields:
        if not field.locked:
            continue
        tokens.extend(match.group(0).strip() for match in PROTECTED_FACT_PATTERN.finditer(field.value))
    return sorted(set(tokens))


def locked_facts_preserved(text: str, fields: list[ExtractedField]) -> bool:
    return all(token in text for token in protected_fact_tokens(fields))
