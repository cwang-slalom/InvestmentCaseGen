from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from html import escape
from io import BytesIO
from textwrap import wrap
from zipfile import ZIP_DEFLATED, ZipFile

from ..models.generation import ExportDraftRequest, GeneratedSection, ReviewFinding
from ..models.project import Project
from .docx_export import draft_output_to_docx, filename_safe


@dataclass(frozen=True)
class ExportFormatProfile:
    name: str
    label: str
    extension: str
    media_type: str


@dataclass(frozen=True)
class ExportedDraft:
    profile: ExportFormatProfile
    content: bytes


EXPORT_FORMATS = {
    "pdf": ExportFormatProfile(
        name="pdf",
        label="PDF",
        extension="pdf",
        media_type="application/pdf",
    ),
    "docx": ExportFormatProfile(
        name="docx",
        label="DOCX",
        extension="docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    "pptx": ExportFormatProfile(
        name="pptx",
        label="PPTX",
        extension="pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ),
    "markdown": ExportFormatProfile(
        name="markdown",
        label="Markdown",
        extension="md",
        media_type="text/markdown; charset=utf-8",
    ),
    "txt": ExportFormatProfile(
        name="txt",
        label="Text",
        extension="txt",
        media_type="text/plain; charset=utf-8",
    ),
}

EXPORT_FORMAT_ALIASES = {
    "pdf": "pdf",
    "docx": "docx",
    "ppt": "pptx",
    "pptx": "pptx",
    "powerpoint": "pptx",
    "md": "markdown",
    "markdown": "markdown",
    "text": "txt",
    "txt": "txt",
}

OUTPUT_TYPE_LABELS = {
    "investment_case": "Investment case",
    "one_page": "One-page summary",
    "talking_points": "Talking points",
    "source_appendix": "Source appendix",
}


def normalize_export_format(export_format: str) -> str:
    normalized = export_format.lower().strip().removeprefix(".")
    try:
        return EXPORT_FORMAT_ALIASES[normalized]
    except KeyError as error:
        raise ValueError("Unsupported export format. Choose PDF, DOCX, PPTX, Markdown, or Text.") from error


def export_draft_output(
    project: Project,
    request: ExportDraftRequest,
    export_format: str,
) -> ExportedDraft:
    canonical_format = normalize_export_format(export_format)
    profile = EXPORT_FORMATS[canonical_format]

    if canonical_format == "docx":
        content = draft_output_to_docx(project, request)
    elif canonical_format == "pdf":
        content = draft_output_to_pdf(project, request)
    elif canonical_format == "pptx":
        content = draft_output_to_pptx(project, request)
    elif canonical_format == "markdown":
        content = draft_output_to_markdown(project, request)
    elif canonical_format == "txt":
        content = draft_output_to_text(project, request)
    else:
        raise ValueError("Unsupported export format. Choose PDF, DOCX, PPTX, Markdown, or Text.")

    return ExportedDraft(profile=profile, content=content)


def draft_output_to_markdown(project: Project, request: ExportDraftRequest) -> bytes:
    output = request.output
    lines = [
        f"# {output.title}",
        "",
        "> Draft export - human review required.",
        "",
        f"- Project: {project.name}",
        f"- Output format: {_output_type_label(output.type)}",
        f"- Output status: {output.status}",
        f"- Citations included: {_citation_count(output.sections)}",
    ]
    intended_outcome = _intended_outcome(project)
    if intended_outcome:
        lines.append(f"- Intended outcome: {intended_outcome}")
    lines.extend(["", "Source-grounded draft package.", ""])

    for section in output.sections:
        lines.extend([f"## {section.heading}", "", section.body.strip() or "No body text.", ""])
        lines.extend(_citation_markdown_lines(section))
        lines.append("")

    lines.extend(_appendix_markdown_lines(request))
    return "\n".join(lines).strip().encode("utf-8")


def draft_output_to_text(project: Project, request: ExportDraftRequest) -> bytes:
    output = request.output
    title = _plain_text(output.title)
    lines = [
        title,
        "=" * min(len(title), 80),
        "",
        "Draft export - human review required.",
        "",
        f"Project: {_plain_text(project.name)}",
        f"Output format: {_output_type_label(output.type)}",
        f"Output status: {_plain_text(output.status)}",
        f"Citations included: {_citation_count(output.sections)}",
    ]
    intended_outcome = _intended_outcome(project)
    if intended_outcome:
        lines.append(f"Intended outcome: {_plain_text(intended_outcome)}")
    lines.extend(["", "Source-grounded draft package.", ""])

    for section in output.sections:
        lines.extend(
            [
                _plain_text(section.heading).upper(),
                "-" * min(len(section.heading), 80),
                _plain_text(section.body.strip()) or "No body text.",
                "",
            ]
        )
        citation_lines = _citation_text_lines(section)
        if citation_lines:
            lines.extend(citation_lines)
            lines.append("")

    lines.extend(_appendix_text_lines(request))
    return "\n".join(lines).strip().encode("utf-8")


def draft_output_to_pdf(project: Project, request: ExportDraftRequest) -> bytes:
    pages = _paginate_pdf_blocks(_pdf_blocks(project, request))
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ]

    page_refs: list[str] = []
    for page_index, page_lines in enumerate(pages):
        page_object_number = 5 + page_index * 2
        content_object_number = page_object_number + 1
        page_refs.append(f"{page_object_number} 0 R")
        content_stream = _pdf_page_stream(page_lines)
        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
                f"/Contents {content_object_number} 0 R >>"
            ).encode("ascii")
        )
        objects.append(
            b"<< /Length "
            + str(len(content_stream)).encode("ascii")
            + b" >>\nstream\n"
            + content_stream
            + b"\nendstream"
        )

    objects[1] = f"<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(page_refs)} >>".encode("ascii")
    return _build_pdf(objects)


def draft_output_to_pptx(project: Project, request: ExportDraftRequest) -> bytes:
    slides = _build_ppt_slides(project, request)
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _ppt_content_types(len(slides)))
        archive.writestr("_rels/.rels", PPT_ROOT_RELS)
        archive.writestr("docProps/core.xml", _core_props(request.output.title))
        archive.writestr("docProps/app.xml", _ppt_app_props(len(slides)))
        archive.writestr("ppt/presentation.xml", _ppt_presentation_xml(len(slides)))
        archive.writestr("ppt/_rels/presentation.xml.rels", _ppt_presentation_rels(len(slides)))
        archive.writestr("ppt/slideMasters/slideMaster1.xml", PPT_SLIDE_MASTER)
        archive.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", PPT_SLIDE_MASTER_RELS)
        archive.writestr("ppt/slideLayouts/slideLayout1.xml", PPT_SLIDE_LAYOUT)
        archive.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", PPT_SLIDE_LAYOUT_RELS)
        archive.writestr("ppt/theme/theme1.xml", PPT_THEME)
        for index, slide in enumerate(slides, start=1):
            archive.writestr(f"ppt/slides/slide{index}.xml", _ppt_slide_xml(slide[0], slide[1], index))
            archive.writestr(f"ppt/slides/_rels/slide{index}.xml.rels", PPT_SLIDE_RELS)
    return buffer.getvalue()


def _output_type_label(output_type: str) -> str:
    return OUTPUT_TYPE_LABELS.get(output_type, output_type.replace("_", " ").title())


def _intended_outcome(project: Project) -> str | None:
    if not project.opportunity_audience:
        return None
    return project.opportunity_audience.intended_outcome


def _citation_count(sections: list[GeneratedSection]) -> int:
    return sum(len(section.citations) for section in sections)


def _plain_text(value: str) -> str:
    return value.replace("**", "").replace("\r\n", "\n").replace("\r", "\n").strip()


def _finding_text(finding: ReviewFinding) -> str:
    state = "resolved" if finding.resolved else "open"
    return f"{finding.severity.upper()} ({state}): {finding.message}"


def _citation_markdown_lines(section: GeneratedSection) -> list[str]:
    if not section.citations:
        return []
    lines = ["**Citations**"]
    for citation in section.citations:
        locator = f" {citation.locator}" if citation.locator else ""
        excerpt = f": {citation.excerpt}" if citation.excerpt else ""
        lines.append(f"- {citation.label}{locator}{excerpt}")
    return lines


def _citation_text_lines(section: GeneratedSection) -> list[str]:
    if not section.citations:
        return []
    lines = ["Citations"]
    for citation in section.citations:
        locator = f" {_plain_text(citation.locator)}" if citation.locator else ""
        excerpt = f": {_plain_text(citation.excerpt)}" if citation.excerpt else ""
        lines.append(f"- {_plain_text(citation.label)}{locator}{excerpt}")
    return lines


def _appendix_markdown_lines(request: ExportDraftRequest) -> list[str]:
    lines = ["## Reviewer Appendix", "", "### Information Needed", ""]
    if request.information_needed:
        lines.extend(f"- {item.message}" for item in request.information_needed)
    else:
        lines.append("- No open information-needed items were included.")

    lines.extend(["", "### Integrity Findings", ""])
    if request.review_findings:
        lines.extend(f"- {_finding_text(finding)}" for finding in request.review_findings)
    else:
        lines.append("- No integrity findings were included.")

    generated_at = datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    lines.extend(
        [
            "",
            "### Export Metadata",
            "",
            f"- Generated at: {generated_at}",
            f"- Generation mode: {request.metadata.get('mode', 'unknown')}",
            "- Stored payload mode: visible draft payload only",
        ]
    )
    return lines


def _appendix_text_lines(request: ExportDraftRequest) -> list[str]:
    lines = ["REVIEWER APPENDIX", "-----------------", "", "Information Needed"]
    if request.information_needed:
        lines.extend(f"- {_plain_text(item.message)}" for item in request.information_needed)
    else:
        lines.append("- No open information-needed items were included.")

    lines.extend(["", "Integrity Findings"])
    if request.review_findings:
        lines.extend(f"- {_plain_text(_finding_text(finding))}" for finding in request.review_findings)
    else:
        lines.append("- No integrity findings were included.")

    generated_at = datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    lines.extend(
        [
            "",
            "Export Metadata",
            f"- Generated at: {generated_at}",
            f"- Generation mode: {request.metadata.get('mode', 'unknown')}",
            "- Stored payload mode: visible draft payload only",
        ]
    )
    return lines


def _pdf_blocks(project: Project, request: ExportDraftRequest) -> list[tuple[str, str]]:
    output = request.output
    blocks = [
        ("title", output.title),
        ("caption", "Draft export - human review required"),
        ("space", ""),
        ("normal", f"Project: {project.name}"),
        ("normal", f"Output format: {_output_type_label(output.type)}"),
        ("normal", f"Output status: {output.status}"),
        ("normal", f"Citations included: {_citation_count(output.sections)}"),
    ]
    intended_outcome = _intended_outcome(project)
    if intended_outcome:
        blocks.append(("normal", f"Intended outcome: {intended_outcome}"))
    blocks.extend([("space", ""), ("caption", "Source-grounded draft package")])

    for section in output.sections:
        blocks.extend([("space", ""), ("heading", section.heading), ("normal", _plain_text(section.body))])
        for citation_line in _citation_text_lines(section):
            blocks.append(("caption", citation_line))

    blocks.extend([("space", ""), ("heading", "Reviewer Appendix")])
    for line in _appendix_text_lines(request)[3:]:
        style = "heading" if line in {"Information Needed", "Integrity Findings", "Export Metadata"} else "caption"
        blocks.append((style, line))
    return blocks


PDF_STYLES = {
    "title": {"font": "F2", "size": 18, "leading": 24, "width": 58},
    "heading": {"font": "F2", "size": 13, "leading": 18, "width": 74},
    "normal": {"font": "F1", "size": 10, "leading": 15, "width": 92},
    "caption": {"font": "F1", "size": 8, "leading": 12, "width": 112},
}


def _paginate_pdf_blocks(blocks: list[tuple[str, str]]) -> list[list[tuple[str, str, int, int]]]:
    pages: list[list[tuple[str, str, int, int]]] = []
    current: list[tuple[str, str, int, int]] = []
    y = 740
    bottom = 54

    for style, text in blocks:
        if style == "space":
            y -= 10
            continue
        spec = PDF_STYLES[style]
        wrapped_lines: list[str] = []
        for paragraph in _plain_text(text).splitlines() or [""]:
            wrapped_lines.extend(
                wrap(paragraph, width=int(spec["width"]), replace_whitespace=False, drop_whitespace=True)
                or [""]
            )
        for line in wrapped_lines:
            if y < bottom:
                pages.append(current)
                current = []
                y = 740
            current.append((style, line, int(spec["size"]), y))
            y -= int(spec["leading"])

    if current:
        pages.append(current)
    return pages or [[("normal", "No draft content was provided.", 10, 740)]]


def _pdf_literal(text: str) -> str:
    safe = text.encode("latin-1", "replace").decode("latin-1")
    escaped = safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return f"({escaped})"


def _pdf_page_stream(page_lines: list[tuple[str, str, int, int]]) -> bytes:
    commands = ["q", "0.035 0.075 0.160 rg"]
    for style, text, size, y in page_lines:
        font = PDF_STYLES[style]["font"]
        commands.append(f"BT /{font} {size} Tf 54 {y} Td {_pdf_literal(text)} Tj ET")
    commands.append("Q")
    return "\n".join(commands).encode("latin-1", "replace")


def _build_pdf(objects: list[bytes]) -> bytes:
    body = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for object_number, payload in enumerate(objects, start=1):
        offsets.append(len(body))
        body.extend(f"{object_number} 0 obj\n".encode("ascii"))
        body.extend(payload)
        body.extend(b"\nendobj\n")

    xref_offset = len(body)
    body.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    body.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        body.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    body.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(body)


def _build_ppt_slides(project: Project, request: ExportDraftRequest) -> list[tuple[str, list[str]]]:
    output = request.output
    first_slide = [
        "Draft export - human review required",
        f"Project: {project.name}",
        f"Output format: {_output_type_label(output.type)}",
        f"Output status: {output.status}",
        f"Citations included: {_citation_count(output.sections)}",
    ]
    intended_outcome = _intended_outcome(project)
    if intended_outcome:
        first_slide.append(f"Intended outcome: {intended_outcome}")
    slides: list[tuple[str, list[str]]] = [(output.title, first_slide)]

    for section in output.sections:
        section_lines = _wrap_slide_text(_plain_text(section.body))
        for citation_line in _citation_text_lines(section):
            section_lines.extend(_wrap_slide_text(citation_line, width=88))
        slides.extend(_chunk_slide(section.heading, section_lines))

    appendix_lines = _appendix_text_lines(request)
    slides.extend(_chunk_slide("Reviewer Appendix", appendix_lines, max_lines=10))
    return slides


def _wrap_slide_text(text: str, *, width: int = 92) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines() or [""]:
        stripped = paragraph.strip()
        if not stripped:
            continue
        lines.extend(wrap(stripped, width=width, replace_whitespace=False, drop_whitespace=True) or [stripped])
    return lines or ["No body text."]


def _chunk_slide(title: str, lines: list[str], *, max_lines: int = 9) -> list[tuple[str, list[str]]]:
    chunks: list[tuple[str, list[str]]] = []
    for index in range(0, max(len(lines), 1), max_lines):
        chunk = lines[index : index + max_lines] or ["No body text."]
        chunk_title = title if index == 0 else f"{title} (continued)"
        chunks.append((chunk_title, chunk))
    return chunks


def _ppt_content_types(slide_count: int) -> str:
    slide_overrides = "".join(
        f'<Override PartName="/ppt/slides/slide{index}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for index in range(1, slide_count + 1)
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  {slide_overrides}
</Types>'''


def _ppt_presentation_xml(slide_count: int) -> str:
    slide_ids = "".join(
        f'<p:sldId id="{255 + index}" r:id="rId{index + 1}"/>'
        for index in range(1, slide_count + 1)
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>{slide_ids}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle>
</p:presentation>'''


def _ppt_presentation_rels(slide_count: int) -> str:
    slide_relationships = "".join(
        f'<Relationship Id="rId{index + 1}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
        f'Target="slides/slide{index}.xml"/>'
        for index in range(1, slide_count + 1)
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  {slide_relationships}
</Relationships>'''


def _ppt_slide_xml(title: str, lines: list[str], slide_number: int) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="F4FBF8"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      {PPT_GROUP_SHAPE}
      {_ppt_shape(2, "Title", 548640, 365760, 11100000, 780000, [_ppt_text(title, 3200, bold=True, color="061A23")], fill=None)}
      {_ppt_shape(3, "Body", 640080, 1310640, 10820000, 4190000, [_ppt_text(line, 1700, color="263655") for line in lines], fill="FFFFFF")}
      {_ppt_shape(4, "Footer", 640080, 6070000, 10820000, 360000, [_ppt_text(f"Slide {slide_number} | Source-grounded draft | Human review required", 1000, color="465783")], fill=None)}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>'''


def _ppt_shape(
    shape_id: int,
    name: str,
    x: int,
    y: int,
    cx: int,
    cy: int,
    paragraphs: list[str],
    *,
    fill: str | None,
) -> str:
    fill_xml = (
        f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="D9E0EE"/></a:solidFill></a:ln>'
        if fill
        else "<a:noFill/><a:ln><a:noFill/></a:ln>"
    )
    return f'''<p:sp>
  <p:nvSpPr><p:cNvPr id="{shape_id}" name="{name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>{fill_xml}</p:spPr>
  <p:txBody><a:bodyPr wrap="square" lIns="182880" tIns="137160" rIns="182880" bIns="137160"><a:spAutoFit/></a:bodyPr><a:lstStyle/>{"".join(paragraphs)}</p:txBody>
</p:sp>'''


def _ppt_text(text: str, size: int, *, bold: bool = False, color: str = "263655") -> str:
    bold_attribute = ' b="1"' if bold else ""
    return (
        f'<a:p><a:r><a:rPr lang="en-US" sz="{size}"{bold_attribute}>'
        f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:rPr>'
        f"<a:t>{escape(_plain_text(text), quote=True)}</a:t></a:r>"
        f'<a:endParaRPr lang="en-US" sz="{size}"/></a:p>'
    )


def _core_props(title: str) -> str:
    now = datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escape(title, quote=True)}</dc:title>
  <dc:creator>Investment Case Generator</dc:creator>
  <cp:lastModifiedBy>Investment Case Generator</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>'''


def _ppt_app_props(slide_count: int) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Investment Case Generator</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>{slide_count}</Slides>
</Properties>'''


PPT_ROOT_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''

PPT_SLIDE_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>'''

PPT_SLIDE_MASTER_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>'''

PPT_SLIDE_LAYOUT_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>'''

PPT_GROUP_SHAPE = '''<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'''

PPT_SLIDE_MASTER = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>{PPT_GROUP_SHAPE}</p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>'''

PPT_SLIDE_LAYOUT = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree>{PPT_GROUP_SHAPE}</p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>'''

PPT_THEME = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="InvestmentGen">
  <a:themeElements>
    <a:clrScheme name="InvestmentGen">
      <a:dk1><a:srgbClr val="061A23"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="263655"/></a:dk2>
      <a:lt2><a:srgbClr val="F4FBF8"/></a:lt2>
      <a:accent1><a:srgbClr val="45AF86"/></a:accent1>
      <a:accent2><a:srgbClr val="382CFF"/></a:accent2>
      <a:accent3><a:srgbClr val="F2C36B"/></a:accent3>
      <a:accent4><a:srgbClr val="E47A97"/></a:accent4>
      <a:accent5><a:srgbClr val="235BA5"/></a:accent5>
      <a:accent6><a:srgbClr val="97D1BD"/></a:accent6>
      <a:hlink><a:srgbClr val="235BA5"/></a:hlink>
      <a:folHlink><a:srgbClr val="465783"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="InvestmentGen">
      <a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="InvestmentGen">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
        <a:solidFill><a:schemeClr val="accent2"/></a:solidFill>
        <a:solidFill><a:schemeClr val="accent3"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln>
        <a:ln w="12700"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:ln>
        <a:ln w="19050"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="lt1"/></a:solidFill>
        <a:solidFill><a:schemeClr val="lt2"/></a:solidFill>
        <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>'''
