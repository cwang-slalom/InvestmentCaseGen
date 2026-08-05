# Fact Extractor Prompt

Extract only facts present in the supplied source packet.

Return structured fields with:

- value
- confidence
- source label
- locator when available
- citations
- unresolved status when the source is insufficient

Do not infer funding recipient, investment vehicle, approval status, partners,
cost basis, regulatory status, or timeline details without explicit source
support.
