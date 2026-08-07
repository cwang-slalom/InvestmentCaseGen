from __future__ import annotations

from datetime import UTC, datetime
from html import escape
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from ..models.generation import ExportDraftRequest, GeneratedSection, ReviewFinding
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


def _run(
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    color: str | None = None,
    size: int | None = None,
) -> str:
    run_properties = []
    if bold:
        run_properties.append("<w:b/>")
    if italic:
        run_properties.append("<w:i/>")
    if color:
        run_properties.append(f'<w:color w:val="{color}"/>')
    if size:
        run_properties.append(f'<w:sz w:val="{size}"/>')
    properties_xml = f"<w:rPr>{''.join(run_properties)}</w:rPr>" if run_properties else ""
    return f'<w:r>{properties_xml}<w:t xml:space="preserve">{_xml(text)}</w:t></w:r>'


def _markdown_runs(
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    color: str | None = None,
    size: int | None = None,
) -> str:
    runs: list[str] = []
    parts = text.split("**")
    for index, part in enumerate(parts):
        if not part:
            continue
        runs.append(
            _run(
                part,
                bold=bold or index % 2 == 1,
                italic=italic,
                color=color,
                size=size,
            )
        )
    return "".join(runs) or _run(" ", bold=bold, italic=italic, color=color, size=size)


def _paragraph_properties(
    style: str | None = None,
    *,
    align: str | None = None,
    shading: str | None = None,
    spacing_after: int | None = 140,
) -> str:
    properties = []
    if style:
        properties.append(f'<w:pStyle w:val="{style}"/>')
    if align:
        properties.append(f'<w:jc w:val="{align}"/>')
    if shading:
        properties.append(f'<w:shd w:val="clear" w:fill="{shading}"/>')
    if spacing_after is not None:
        properties.append(f'<w:spacing w:after="{spacing_after}"/>')
    return f"<w:pPr>{''.join(properties)}</w:pPr>" if properties else ""


def _paragraph(
    text: str,
    style: str | None = None,
    *,
    align: str | None = None,
    shading: str | None = None,
    bold: bool = False,
    italic: bool = False,
    color: str | None = None,
    size: int | None = None,
    spacing_after: int | None = 140,
) -> str:
    return (
        f"<w:p>{_paragraph_properties(style, align=align, shading=shading, spacing_after=spacing_after)}"
        f"{_markdown_runs(text, bold=bold, italic=italic, color=color, size=size)}</w:p>"
    )


def _paragraphs(text: str, style: str | None = None) -> list[str]:
    paragraphs: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("### "):
            paragraphs.append(_paragraph(line.removeprefix("### ").strip(), "Heading3"))
        elif line.startswith("## "):
            paragraphs.append(_paragraph(line.removeprefix("## ").strip(), "Heading2"))
        elif line.startswith("# "):
            paragraphs.append(_paragraph(line.removeprefix("# ").strip(), "Heading1"))
        elif line.startswith(("- ", "* ")):
            paragraphs.append(_paragraph(f"• {line[2:].strip()}", "ListParagraph"))
        else:
            paragraphs.append(_paragraph(line, style))
    return paragraphs


def _finding_text(finding: ReviewFinding) -> str:
    state = "resolved" if finding.resolved else "open"
    return f"{finding.severity.upper()} ({state}): {finding.message}"


PATHWAY_DEFINITIONS = [
    ("Activities", ["activities", "activity", "intervention", "solution", "approach", "proposed"]),
    ("Outputs", ["outputs", "deliverable", "access", "coverage"]),
    ("Outcomes", ["outcomes", "outcome", "result", "quality", "behavior"]),
    ("Impact", ["impact", "long-term", "benefit", "lives", "reduced", "reach"]),
]
EXECUTION_TERMS = ["timeframe", "timeline", "cost", "funding", "budget", "capital", "execute"]
SPOTLIGHT_TERMS = [
    "partner",
    "team",
    "implement",
    "delivery",
    "diligence",
    "risk",
    "engage",
    "recipient",
    "vehicle",
]

SECTION_FILLS = {
    "narrative": "F8FAFE",
    "metric": "EFFAF6",
    "opportunity": "FBFAFF",
    "team": "F5F7FF",
    "diligence": "FFF8EE",
    "risk": "FFF3F6",
    "engage": "F6FBF8",
}

IMPACT_HEADER_FILLS = ["CFEFE3", "DBE6FF", "FAE7BA", "F7DCE4"]
IMPACT_BODY_FILLS = ["F2FBF7", "F4F7FF", "FFF9EA", "FFF5F7"]


def _section_text(section: GeneratedSection) -> str:
    return f"{section.heading} {section.body}".lower()


def _matches_terms(section: GeneratedSection, terms: list[str]) -> bool:
    text = _section_text(section)
    return any(term in text for term in terms)


def _matches_heading_terms(section: GeneratedSection, terms: list[str]) -> bool:
    heading = section.heading.lower()
    return any(term in heading for term in terms)


def _layout_sections(sections: list[GeneratedSection]) -> tuple[
    GeneratedSection | None,
    list[tuple[str, GeneratedSection]],
    list[GeneratedSection],
    list[GeneratedSection],
    list[GeneratedSection],
]:
    used: set[str] = set()
    lead = (
        next((section for section in sections if section.type == "opportunity"), None)
        or next((section for section in sections if section.type == "narrative"), None)
        or (sections[0] if sections else None)
    )
    if lead:
        used.add(lead.id)

    pathway: list[tuple[str, GeneratedSection]] = []
    for label, terms in PATHWAY_DEFINITIONS:
        matched = next(
            (section for section in sections if section.id not in used and _matches_terms(section, terms)),
            None,
        ) or next((section for section in sections if section.id not in used), None)
        if matched:
            used.add(matched.id)
            pathway.append((label, matched))

    remaining = [section for section in sections if section.id not in used]
    execution = [section for section in remaining if _matches_heading_terms(section, EXECUTION_TERMS)]
    used.update(section.id for section in execution)
    spotlight = [
        section
        for section in sections
        if section.id not in used and _matches_terms(section, SPOTLIGHT_TERMS)
    ]
    used.update(section.id for section in spotlight)
    detail = [section for section in sections if section.id not in used]
    return lead, pathway, execution, spotlight, detail


def _cell(content: list[str], *, width: int, fill: str | None = None) -> str:
    shading = f'<w:shd w:val="clear" w:fill="{fill}"/>' if fill else ""
    return (
        "<w:tc>"
        f'<w:tcPr><w:tcW w:w="{width}" w:type="pct"/>{shading}'
        '<w:tcMar><w:top w:w="120" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>'
        '<w:bottom w:w="120" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>'
        "</w:tcPr>"
        f"{''.join(content)}"
        "</w:tc>"
    )


def _row(cells: list[str]) -> str:
    return f"<w:tr>{''.join(cells)}</w:tr>"


def _table(rows: list[str], *, border_color: str = "D9E0EE") -> str:
    borders = (
        f'<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/></w:tblBorders>'
    )
    return (
        "<w:tbl><w:tblPr>"
        '<w:tblW w:w="5000" w:type="pct"/>'
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0"/>'
        f"{borders}</w:tblPr>{''.join(rows)}</w:tbl>"
        "<w:p/>"
    )


def _section_citations(section: GeneratedSection) -> list[str]:
    if not section.citations:
        return []
    paragraphs = [_paragraph("Citations", "Caption", bold=True, color="235BA5", spacing_after=80)]
    for citation in section.citations:
        locator = f" {citation.locator}" if citation.locator else ""
        excerpt = f": {citation.excerpt}" if citation.excerpt else ""
        paragraphs.append(_paragraph(f"• {citation.label}{locator}{excerpt}", "Caption", spacing_after=80))
    return paragraphs


def _section_block(section: GeneratedSection, *, fill: str | None = None) -> str:
    block = [
        _paragraph(section.heading, "Heading2", spacing_after=120),
        *_paragraphs(section.body),
        *_section_citations(section),
    ]
    return _table([_row([_cell(block, width=5000, fill=fill or SECTION_FILLS.get(section.type, "FFFFFF"))])])


def _heading_band(label: str, *, fill: str = "A9DCCA", color: str = "061A23") -> str:
    return _paragraph(label, "BandHeading", align="center", shading=fill, bold=True, color=color, spacing_after=180)


def _hero_block(
    project: Project,
    request: ExportDraftRequest,
    intended_outcome: str | None,
    citation_count: int,
) -> str:
    output = request.output
    metadata = [
        _paragraph(output.title, "Title", color="061A23", spacing_after=160),
        _paragraph("Draft export - human review required", "Subtitle", color="1D4B4F", spacing_after=120),
        _paragraph(f"Project: {project.name}", "Meta", bold=True, spacing_after=90),
        _paragraph(f"Output status: {output.status}", "Meta", spacing_after=90),
        _paragraph(f"Citations included: {citation_count}", "Meta", spacing_after=90),
    ]
    if intended_outcome:
        metadata.append(_paragraph(f"Intended outcome: {intended_outcome}", "Meta", spacing_after=90))
    metadata.append(_paragraph("Source-grounded draft package", "Caption"))
    return _table([_row([_cell(metadata, width=5000, fill="F4FBF8")])], border_color="BEDACF")


def _impact_table(pathway: list[tuple[str, GeneratedSection]]) -> str:
    header_cells: list[str] = []
    body_cells: list[str] = []
    cell_width = max(1, int(5000 / len(pathway)))
    for index, (label, section) in enumerate(pathway):
        header_fill = IMPACT_HEADER_FILLS[index % len(IMPACT_HEADER_FILLS)]
        body_fill = IMPACT_BODY_FILLS[index % len(IMPACT_BODY_FILLS)]
        header_cells.append(
            _cell(
                [_paragraph(label, "TableHeading", align="center", bold=True, spacing_after=0)],
                width=cell_width,
                fill=header_fill,
            )
        )
        body_cells.append(
            _cell(
                [
                    _paragraph(section.heading, "Heading3", spacing_after=100),
                    *_paragraphs(section.body, "CompactBody"),
                    *_section_citations(section),
                ],
                width=cell_width,
                fill=body_fill,
            )
        )
    return _table([_row(header_cells), _row(body_cells)], border_color="C8D7D0")


def _execution_band(section: GeneratedSection) -> str:
    return _table(
        [
            _row(
                [
                    _cell([_paragraph(section.heading, "CalloutLabel", bold=True, spacing_after=0)], width=1450, fill="97D1BD"),
                    _cell([*_paragraphs(section.body), *_section_citations(section)], width=3550, fill="DBEEE9"),
                ]
            )
        ],
        border_color="BBDDD2",
    )


def _appendix_block(request: ExportDraftRequest) -> list[str]:
    body = [_heading_band("Reviewer Appendix", fill="E7E3FA")]
    body.append(_paragraph("Information Needed", "Heading1"))
    if request.information_needed:
        for item in request.information_needed:
            body.append(_paragraph(f"• {item.message}", "ListParagraph"))
    else:
        body.append(_paragraph("No open information-needed items were included."))

    body.append(_paragraph("Integrity Findings", "Heading1"))
    if request.review_findings:
        for finding in request.review_findings:
            body.append(_paragraph(f"• {_finding_text(finding)}", "ListParagraph"))
    else:
        body.append(_paragraph("No integrity findings were included."))

    generated_at = datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    body.append(_paragraph("Export Metadata", "Heading1"))
    body.append(_paragraph(f"Generated at: {generated_at}", "Caption"))
    body.append(_paragraph(f"Generation mode: {request.metadata.get('mode', 'unknown')}", "Caption"))
    body.append(_paragraph("Stored payload mode: visible draft payload only", "Caption"))
    return body


def _document_xml(project: Project, request: ExportDraftRequest) -> str:
    output = request.output
    intended_outcome = (
        project.opportunity_audience.intended_outcome
        if project.opportunity_audience
        else None
    )
    citation_count = sum(len(section.citations) for section in output.sections)
    lead, pathway, execution, spotlight, detail = _layout_sections(output.sections)
    body: list[str] = [_hero_block(project, request, intended_outcome, citation_count)]

    if lead:
        body.append(_heading_band("Opportunity Thesis", fill="E7E3FA"))
        body.append(_section_block(lead, fill="FBFAFF"))

    if pathway:
        body.append(_heading_band("Impact Potential", fill="A9DCCA"))
        body.append(_impact_table(pathway))

    if execution:
        body.append(_heading_band("Execution Snapshot", fill="CFEFE3"))
        for section in execution:
            body.append(_execution_band(section))

    if spotlight:
        body.append(_heading_band("Partner & Diligence Spotlight", fill="E7EEF9"))
        for section in spotlight:
            body.append(_section_block(section, fill=SECTION_FILLS.get(section.type, "FFFFFF")))

    if detail:
        body.append(_heading_band("Supporting Detail", fill="F3F4F8"))
        for section in detail:
            body.append(_section_block(section, fill=SECTION_FILLS.get(section.type, "FFFFFF")))

    body.extend(_appendix_block(request))

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
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="263655"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="263655"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:color w:val="061A23"/><w:sz w:val="38"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:i/><w:color w:val="1D4B4F"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Metadata"/><w:rPr><w:color w:val="1D4B4F"/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="BandHeading"><w:name w:val="Band Heading"/><w:rPr><w:b/><w:color w:val="061A23"/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:color w:val="07133D"/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:color w:val="07133D"/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:color w:val="07133D"/><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeading"><w:name w:val="Table Heading"/><w:rPr><w:b/><w:color w:val="061A23"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CalloutLabel"><w:name w:val="Callout Label"/><w:rPr><w:b/><w:color w:val="061A23"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CompactBody"><w:name w:val="Compact Body"/><w:rPr><w:color w:val="263655"/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:rPr><w:color w:val="263655"/><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:rPr><w:color w:val="465783"/><w:sz w:val="18"/></w:rPr></w:style>
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
