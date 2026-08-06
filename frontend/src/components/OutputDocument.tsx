import type { CitationRef, GeneratedOutput, GeneratedSection } from "../types";
import { Icon } from "./Icons";

type OutputDocumentProps = {
  output: GeneratedOutput;
  sections: GeneratedSection[];
  editingSectionId?: string | null;
  isExporting?: boolean;
  exportStatus?: string;
  onEditSection?: (sectionId: string, body: string) => void;
  onBeginEdit?: (sectionId: string) => void;
  onReset?: (sectionId: string) => void;
  onRegenerate?: (sectionId: string) => void;
  onCitation?: (citation: CitationRef) => void;
  onExport?: (output: GeneratedOutput) => void;
};

export function OutputDocument({
  output,
  sections,
  editingSectionId,
  isExporting,
  exportStatus,
  onEditSection,
  onBeginEdit,
  onReset,
  onRegenerate,
  onCitation,
  onExport,
}: OutputDocumentProps) {
  return (
    <article className="generated-document">
      <div className="document-heading">
        <div>
          <p className="eyebrow">{output.status}</p>
          <h2>{output.title}</h2>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={!onExport || isExporting}
          aria-busy={isExporting || undefined}
          onClick={() => onExport?.(output)}
        >
          <Icon name="docx" />
          {isExporting ? "Exporting" : "Export DOCX"}
        </button>
      </div>
      {exportStatus && <p className="export-status">{exportStatus}</p>}
      {sections.map((section) => (
        <section className={`document-section section-${section.type}`} key={section.id}>
          <div className="section-heading-row">
            <h3>{section.heading}</h3>
            <div className="section-actions">
              <button type="button" className="icon-button" title="Edit section" onClick={() => onBeginEdit?.(section.id)}>
                Edit
              </button>
              <button type="button" className="icon-button" title="Reset section" onClick={() => onReset?.(section.id)}>
                Reset
              </button>
              <button type="button" className="icon-button" title="Regenerate section" onClick={() => onRegenerate?.(section.id)}>
                Regen
              </button>
            </div>
          </div>
          {editingSectionId === section.id ? (
            <textarea
              className="section-editor"
              value={section.body}
              onChange={(event) => onEditSection?.(section.id, event.currentTarget.value)}
            />
          ) : (
            <p>{section.body}</p>
          )}
          <div className="citation-row">
            {section.citations.map((citation) => (
              <button key={`${section.id}-${citation.sourceId}`} type="button" className="citation-chip" onClick={() => onCitation?.(citation)}>
                {citation.label} {citation.locator}
              </button>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
