from __future__ import annotations

from datetime import UTC, datetime
from html import escape
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from ..models.generation import ExportDraftRequest, ReviewFinding
from ..models.project import Project


def filename_safe(value: str) -> str:
    slug = "".join(
        character.lower() if character.isascii() and character.isalnum() else "-"
        for character in value
    )
    compact = "-".join(part for part in slug.split("-") if part)
    return compact[:80] or "investment-case-draft"


def _xml(value: str) -> str:
    return escape(value, quote=True)


def _paragraph(text: str, style: str | None = None) -> str:
    style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return f'<w:p>{style_xml}<w:r><w:t xml:space="preserve">{_xml(text)}</w:t></w:r></w:p>'


def _paragraphs(text: str) -> list[str]:
    return [
        _paragraph(line.strip())
        for line in text.splitlines()
        if line.strip()
    ]


def _finding_text(finding: ReviewFinding) -> str:
    state = "resolved" if finding.resolved else "open"
    return f"{finding.severity.upper()} ({state}): {finding.message}"


def _document_xml(project: Project, request: ExportDraftRequest) -> str:
    output = request.output
    body: list[str] = [
        _paragraph(output.title, "Title"),
        _paragraph("Draft export - human review required", "Subtitle"),
        _paragraph(f"Project: {project.name}"),
        _paragraph(f"Output status: {output.status}"),
    ]

    intended_outcome = (
        project.opportunity_audience.intended_outcome
        if project.opportunity_audience
        else None
    )
    if intended_outcome:
        body.append(_paragraph(f"Intended outcome: {intended_outcome}"))

    body.append(_paragraph("Generated Material", "Heading1"))
    for section in output.sections:
        body.append(_paragraph(section.heading, "Heading2"))
        body.extend(_paragraphs(section.body))
        if section.citations:
            body.append(_paragraph("Citations", "Heading3"))
            for citation in section.citations:
                locator = f" {citation.locator}" if citation.locator else ""
                body.append(_paragraph(f"- {citation.label}{locator}: {citation.excerpt}"))

    body.append(_paragraph("Information Needed", "Heading1"))
    open_items = request.information_needed
    if open_items:
        for item in open_items:
            body.append(_paragraph(f"- {item.message}"))
    else:
        body.append(_paragraph("No open information-needed items were included."))

    body.append(_paragraph("Integrity Findings", "Heading1"))
    if request.review_findings:
        for finding in request.review_findings:
            body.append(_paragraph(f"- {_finding_text(finding)}"))
    else:
        body.append(_paragraph("No integrity findings were included."))

    body.append(_paragraph("Export Metadata", "Heading1"))
    generated_at = datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    body.append(_paragraph(f"Generated at: {generated_at}"))
    body.append(_paragraph(f"Generation mode: {request.metadata.get('mode', 'unknown')}"))
    body.append(_paragraph("Stored payload mode: visible draft payload only"))

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>{"".join(body)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>'''


CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''

ROOT_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''

STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:i/><w:color w:val="465783"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:sz w:val="21"/></w:rPr></w:style>
</w:styles>'''

APP_PROPS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Investment Case Generator</Application>
</Properties>'''


def _core_props(title: str) -> str:
    now = datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{_xml(title)}</dc:title>
  <dc:creator>Investment Case Generator</dc:creator>
  <cp:lastModifiedBy>Investment Case Generator</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>'''


def draft_output_to_docx(project: Project, request: ExportDraftRequest) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", CONTENT_TYPES)
        archive.writestr("_rels/.rels", ROOT_RELS)
        archive.writestr("word/document.xml", _document_xml(project, request))
        archive.writestr("word/styles.xml", STYLES)
        archive.writestr("docProps/core.xml", _core_props(request.output.title))
        archive.writestr("docProps/app.xml", APP_PROPS)
    return buffer.getvalue()
