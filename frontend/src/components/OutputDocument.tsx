import type { CitationRef, ExportFormat, GeneratedOutput, GeneratedSection } from "../types";
import { Icon, type IconName } from "./Icons";

type OutputDocumentProps = {
  output: GeneratedOutput;
  sections: GeneratedSection[];
  editingSectionId?: string | null;
  isExporting?: boolean;
  exportingFormat?: ExportFormat | null;
  exportStatus?: string;
  onEditSection?: (sectionId: string, body: string) => void;
  onBeginEdit?: (sectionId: string) => void;
  onReset?: (sectionId: string) => void;
  onRegenerate?: (sectionId: string) => void;
  onCitation?: (citation: CitationRef) => void;
  onExport?: (output: GeneratedOutput, format: ExportFormat) => void;
};

type PathwaySlot = {
  label: string;
  section: GeneratedSection;
};

const pathwayDefinitions = [
  {
    label: "Activities",
    terms: ["activities", "activity", "intervention", "solution", "approach", "proposed"],
  },
  {
    label: "Outputs",
    terms: ["outputs", "deliverable", "access", "coverage"],
  },
  {
    label: "Outcomes",
    terms: ["outcomes", "outcome", "result", "quality", "behavior"],
  },
  {
    label: "Impact",
    terms: ["impact", "long-term", "benefit", "lives", "reduced", "reach"],
  },
];

const executionTerms = ["timeframe", "timeline", "cost", "funding", "budget", "capital", "execute"];
const spotlightTerms = [
  "partner",
  "team",
  "implement",
  "delivery",
  "diligence",
  "risk",
  "engage",
  "recipient",
  "vehicle",
];

const exportOptions: { format: ExportFormat; label: string; icon: IconName }[] = [
  { format: "pdf", label: "Export PDF", icon: "pdf" },
  { format: "docx", label: "Export DOCX", icon: "docx" },
  { format: "pptx", label: "Export PPTX", icon: "presentation" },
  { format: "markdown", label: "Export Markdown", icon: "document" },
  { format: "txt", label: "Export Text", icon: "file" },
];

function sectionText(section: GeneratedSection) {
  return `${section.heading} ${section.body}`.toLowerCase();
}

function matchesTerms(section: GeneratedSection, terms: string[]) {
  const text = sectionText(section);
  return terms.some((term) => text.includes(term));
}

function matchesHeadingTerms(section: GeneratedSection, terms: string[]) {
  const heading = section.heading.toLowerCase();
  return terms.some((term) => heading.includes(term));
}

function citationCount(sections: GeneratedSection[]) {
  return sections.reduce((total, section) => total + section.citations.length, 0);
}

function outputTypeLabel(type: GeneratedOutput["type"]) {
  const labels: Record<GeneratedOutput["type"], string> = {
    investment_case: "Investment case",
    one_page: "One-page summary",
    talking_points: "Talking points",
    source_appendix: "Source appendix",
  };
  return labels[type];
}

function buildLayout(sections: GeneratedSection[]) {
  const used = new Set<string>();
  const lead =
    sections.find((section) => section.type === "opportunity") ||
    sections.find((section) => section.type === "narrative") ||
    sections[0] ||
    null;

  if (lead) {
    used.add(lead.id);
  }

  const pathway = pathwayDefinitions.reduce<PathwaySlot[]>((slots, definition) => {
    const matched =
      sections.find((section) => !used.has(section.id) && matchesTerms(section, definition.terms)) ||
      sections.find((section) => !used.has(section.id));

    if (matched) {
      used.add(matched.id);
      slots.push({ label: definition.label, section: matched });
    }

    return slots;
  }, []);

  const remaining = sections.filter((section) => !used.has(section.id));
  const execution = remaining.filter((section) => matchesHeadingTerms(section, executionTerms));
  execution.forEach((section) => used.add(section.id));

  const spotlight = sections.filter((section) => !used.has(section.id) && matchesTerms(section, spotlightTerms));
  spotlight.forEach((section) => used.add(section.id));

  const detail = sections.filter((section) => !used.has(section.id));

  return { lead, pathway, execution, spotlight, detail };
}

function SectionActions({
  section,
  onBeginEdit,
  onReset,
  onRegenerate,
}: {
  section: GeneratedSection;
  onBeginEdit?: (sectionId: string) => void;
  onReset?: (sectionId: string) => void;
  onRegenerate?: (sectionId: string) => void;
}) {
  return (
    <div className="section-actions">
      <button type="button" className="icon-button" title="Edit section" onClick={() => onBeginEdit?.(section.id)}>
        <Icon name="edit" />
      </button>
      <button type="button" className="icon-button" title="Reset section" onClick={() => onReset?.(section.id)}>
        <Icon name="refresh" />
      </button>
      <button type="button" className="icon-button" title="Regenerate section" onClick={() => onRegenerate?.(section.id)}>
        <Icon name="sparkles" />
      </button>
    </div>
  );
}

function EditableSectionBody({
  section,
  editingSectionId,
  onEditSection,
  onCitation,
}: {
  section: GeneratedSection;
  editingSectionId?: string | null;
  onEditSection?: (sectionId: string, body: string) => void;
  onCitation?: (citation: CitationRef) => void;
}) {
  return (
    <>
      {editingSectionId === section.id ? (
        <textarea
          className="section-editor"
          value={section.body}
          onChange={(event) => onEditSection?.(section.id, event.currentTarget.value)}
        />
      ) : (
        <p>{section.body}</p>
      )}
      {section.citations.length > 0 && (
        <div className="citation-row">
          {section.citations.map((citation) => (
            <button key={`${section.id}-${citation.sourceId}-${citation.locator}`} type="button" className="citation-chip" onClick={() => onCitation?.(citation)}>
              {citation.label} {citation.locator}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function DetailSection({
  section,
  editingSectionId,
  onEditSection,
  onBeginEdit,
  onReset,
  onRegenerate,
  onCitation,
}: {
  section: GeneratedSection;
  editingSectionId?: string | null;
  onEditSection?: (sectionId: string, body: string) => void;
  onBeginEdit?: (sectionId: string) => void;
  onReset?: (sectionId: string) => void;
  onRegenerate?: (sectionId: string) => void;
  onCitation?: (citation: CitationRef) => void;
}) {
  return (
    <section className={`document-section section-${section.type}`} key={section.id}>
      <div className="section-heading-row">
        <h3>{section.heading}</h3>
        <SectionActions section={section} onBeginEdit={onBeginEdit} onReset={onReset} onRegenerate={onRegenerate} />
      </div>
      <EditableSectionBody section={section} editingSectionId={editingSectionId} onEditSection={onEditSection} onCitation={onCitation} />
    </section>
  );
}

export function OutputDocument({
  output,
  sections,
  editingSectionId,
  isExporting,
  exportingFormat,
  exportStatus,
  onEditSection,
  onBeginEdit,
  onReset,
  onRegenerate,
  onCitation,
  onExport,
}: OutputDocumentProps) {
  const layout = buildLayout(sections);
  const allCitations = citationCount(sections);

  return (
    <article className="generated-document investor-document">
      <header className="investment-hero">
        <div>
          <p className="eyebrow">{output.status}</p>
          <h2>{output.title}</h2>
          <div className="document-meta-row" aria-label="Output metadata">
            <span>{outputTypeLabel(output.type)}</span>
            <span>{allCitations} citation{allCitations === 1 ? "" : "s"}</span>
            <span>Human review required</span>
          </div>
        </div>
        <div className="export-actions" aria-label="Export formats">
          <span className="export-actions-label">Export options</span>
          {exportOptions.map((option) => {
            const exportingThisFormat = Boolean(isExporting && exportingFormat === option.format);
            return (
              <button
                className="secondary-button export-button"
                type="button"
                key={option.format}
                disabled={!onExport || isExporting}
                aria-busy={exportingThisFormat || undefined}
                onClick={() => onExport?.(output, option.format)}
              >
                <Icon name={option.icon} />
                {exportingThisFormat ? "Exporting" : option.label}
              </button>
            );
          })}
        </div>
      </header>
      {exportStatus && <p className="export-status">{exportStatus}</p>}
      {layout.lead && (
        <section className="thesis-panel">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Opportunity thesis</p>
              <h3>{layout.lead.heading}</h3>
            </div>
            <SectionActions section={layout.lead} onBeginEdit={onBeginEdit} onReset={onReset} onRegenerate={onRegenerate} />
          </div>
          <EditableSectionBody section={layout.lead} editingSectionId={editingSectionId} onEditSection={onEditSection} onCitation={onCitation} />
        </section>
      )}
      {layout.pathway.length > 0 && (
        <section className="impact-module" aria-labelledby="impact-potential-heading">
          <h3 id="impact-potential-heading">Impact Potential</h3>
          <div className="impact-grid">
            {layout.pathway.map((slot) => (
              <section className={`impact-card section-${slot.section.type}`} key={slot.section.id}>
                <div className="impact-card-label">
                  <span>{slot.label}</span>
                  <SectionActions section={slot.section} onBeginEdit={onBeginEdit} onReset={onReset} onRegenerate={onRegenerate} />
                </div>
                <h4>{slot.section.heading}</h4>
                <EditableSectionBody section={slot.section} editingSectionId={editingSectionId} onEditSection={onEditSection} onCitation={onCitation} />
              </section>
            ))}
          </div>
        </section>
      )}
      {layout.execution.length > 0 && (
        <section className="execution-module" aria-label="Execution snapshot">
          {layout.execution.map((section) => (
            <section className={`execution-band section-${section.type}`} key={section.id}>
              <div className="execution-label">
                <h3>{section.heading}</h3>
                <SectionActions section={section} onBeginEdit={onBeginEdit} onReset={onReset} onRegenerate={onRegenerate} />
              </div>
              <div className="execution-copy">
                <EditableSectionBody section={section} editingSectionId={editingSectionId} onEditSection={onEditSection} onCitation={onCitation} />
              </div>
            </section>
          ))}
        </section>
      )}
      {layout.spotlight.length > 0 && (
        <section className="spotlight-module" aria-labelledby="spotlight-heading">
          <h3 id="spotlight-heading">Partner & Diligence Spotlight</h3>
          <div className="spotlight-grid">
            {layout.spotlight.map((section) => (
              <DetailSection
                key={section.id}
                section={section}
                editingSectionId={editingSectionId}
                onEditSection={onEditSection}
                onBeginEdit={onBeginEdit}
                onReset={onReset}
                onRegenerate={onRegenerate}
                onCitation={onCitation}
              />
            ))}
          </div>
        </section>
      )}
      {layout.detail.length > 0 && (
        <section className="supporting-detail" aria-labelledby="supporting-detail-heading">
          <h3 id="supporting-detail-heading">Supporting Detail</h3>
          {layout.detail.map((section) => (
            <DetailSection
              key={section.id}
              section={section}
              editingSectionId={editingSectionId}
              onEditSection={onEditSection}
              onBeginEdit={onBeginEdit}
              onReset={onReset}
              onRegenerate={onRegenerate}
              onCitation={onCitation}
            />
          ))}
        </section>
      )}
    </article>
  );
}
