import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import { editExtractedField } from "../state/workflow";
import { validateExtraction, validateOpportunityAudience } from "../state/validation";
import type { ExtractedField, Project } from "../types";

type ExtractionReviewPageProps = {
  project: Project;
  onProject: (project: Project) => void;
  onNavigate: (path: string) => void;
};

export function ExtractionReviewPage({ project, onProject, onNavigate }: ExtractionReviewPageProps) {
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [confirmed, setConfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    let active = true;
    async function loadProject() {
      setLoading(true);
      const refreshed = await api.project(project.id);
      if (!active) return;
      onProject(refreshed);
      const extraction = refreshed.extractionId ? await api.projectExtraction(refreshed.id) : null;
      if (!active) return;
      setFields((extraction?.fields || []).map((field) => ({ ...field, verified: true })));
      setConfirmed(true);
      setLoading(false);
    }
    loadProject().catch(() => {
      if (active) {
        setError("Extraction is not available for this project.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [project.id]);

  const validation = validateExtraction(fields, confirmed);
  const flowValidation = validateOpportunityAudience({
    sourceMode: "new",
    extractionConfirmed: confirmed,
    audienceId: project.opportunityAudience?.audienceId,
    intendedOutcome: project.opportunityAudience?.intendedOutcome,
    selectedOutputs: project.opportunityAudience?.selectedOutputs || [],
  });
  const sourceLabel = fields[0]?.sourceLabel || "Uploaded source";
  const sourceType = sourceLabel.toLowerCase().endsWith(".pdf") ? "PDF" : "Text";
  const confirmedCount = fields.filter((field) => field.value && !field.value.toLowerCase().startsWith("unresolved")).length;

  async function continueToReviewSetup() {
    if (!validation.valid || !flowValidation.valid) return;
    setSaving(true);
    const updated = await api.updateExtractionReview(project.id, { fields, confirmed });
    onProject(updated);
    setSaving(false);
    onNavigate(`/projects/${project.id}/review-setup`);
  }

  async function rerunExtraction() {
    setSaving(true);
    setError("");
    try {
      const extraction = await api.rerunExtraction(project.id);
      setFields(extraction.fields.map((field) => ({ ...field, verified: true })));
      setConfirmed(true);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Extraction could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  function focusField(fieldId: string) {
    setActiveFieldId(fieldId);
    window.requestAnimationFrame(() => {
      const field = fieldRefs.current[fieldId];
      field?.focus();
      field?.select();
    });
  }

  if (loading) {
    return <section className="panel full-panel"><h2>Loading extraction</h2></section>;
  }

  const visibleFields = fields.filter((field) =>
    [
      "opportunity_name",
      "problem",
      "solution",
      "why_now",
      "geographies",
      "reach",
      "primary_outcomes",
      "differentiators",
      "timeframe",
    ].includes(field.id),
  );

  return (
    <section className="wizard-page extraction-page">
      <div className="page-title">
        <p className="eyebrow">Step 2 of 4</p>
        <h2>Review AI-extracted key information</h2>
        <p>We've extracted key details from your materials. Review and edit to ensure accuracy.</p>
      </div>
      <div className="extraction-layout">
        <section className="panel extraction-panel">
          <div className="source-header">
            <span className="file-icon"><Icon name="file" /></span>
            <div>
              <strong>{sourceLabel}</strong>
              <small>{sourceType}&nbsp;&nbsp;•&nbsp;&nbsp;temporary Phase 1 source</small>
            </div>
            <span className="status-pill ready">LLM extracted</span>
            <button className="secondary-button" type="button" onClick={rerunExtraction} disabled={saving}>
              <Icon name="refresh" />
              Re-run extraction
            </button>
          </div>
          <div className="extraction-content">
            <div className="key-info">
              <h3>Key information</h3>
              <div className="field-table">
                {visibleFields.map((field) => (
                  <label className={`field-row ${activeFieldId === field.id ? "editing" : ""}`} key={field.id}>
                    <span className="field-icon"><Icon name={fieldIcon(field.id)} /></span>
                    <strong>{field.label}</strong>
                    <textarea
                      ref={(node) => {
                        fieldRefs.current[field.id] = node;
                      }}
                      value={field.value}
                      onFocus={() => setActiveFieldId(field.id)}
                      onChange={(event) => setFields((current) => editExtractedField(current, field.id, { value: event.currentTarget.value, verified: true }))}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        focusField(field.id);
                      }}
                    >
                      <Icon name="edit" />
                      Edit
                    </button>
                  </label>
                ))}
              </div>
            </div>
            <aside className="confidence-panel">
              <h3>Confidence in extraction <Icon name="info" /></h3>
              <div className="confidence-track"><span /></div>
              <div className="confidence-meta">
                <span>High confidence</span>
                <span>{confirmedCount} of {fields.length} fields have source candidates</span>
              </div>
              <p className="review-note">Please review all items and make edits if needed before proceeding.</p>
              <label className="field-block compact notes-field">
                <span>Notes <small>(optional)</small></span>
                <textarea placeholder="Add any notes or additional context..." maxLength={500} />
                <em>0/500</em>
              </label>
            </aside>
          </div>
          {error && <p className="validation-message" role="alert">{error}</p>}
        </section>
        <HowItWorks activeStep={2} />
      </div>
      {(!validation.valid || !flowValidation.valid) && (
        <p className="validation-message" role="alert">{validation.messages[0] || flowValidation.messages[0]}</p>
      )}
      <div className="bottom-actions">
        <button className="secondary-button large" type="button" onClick={() => onNavigate(`/projects/${project.id}/opportunity-audience`)}>
          <Icon name="arrow-left" />
          Back
        </button>
        <button className="primary-button large" type="button" disabled={!validation.valid || !flowValidation.valid || saving} onClick={continueToReviewSetup}>
          Continue to review setup
          <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}

function HowItWorks({ activeStep }: { activeStep: number }) {
  const steps = [
    ["Upload approved materials", "Add source documents that have been reviewed and approved.", "clipboard"],
    ["We'll analyze your materials", "Our AI will extract key information and structure the opportunity.", "sparkles"],
    ["Review and refine", "Review the extracted information, edit for accuracy, and add missing details.", "edit"],
    ["Add to library", "Send for PST validation before adding to the Opportunity Library.", "template"],
  ] as const;

  return (
    <aside className="panel how-card">
      <h3><Icon name="sparkles" /> How it works</h3>
      {steps.map(([title, body, icon], index) => (
        <div className={`how-step ${index === activeStep ? "active" : ""}`} key={title}>
          <span><Icon name={icon} /></span>
          <div>
            <strong>{index + 1}. {title}</strong>
            <p>{body}</p>
          </div>
        </div>
      ))}
    </aside>
  );
}

function fieldIcon(id: string): IconName {
  if (id.includes("problem")) return "flask";
  if (id.includes("solution")) return "shield";
  if (id.includes("why")) return "clock";
  if (id.includes("geographies")) return "pin";
  if (id.includes("reach")) return "people";
  if (id.includes("outcomes")) return "document";
  if (id.includes("differentiators")) return "sparkles";
  if (id.includes("timeframe")) return "clock";
  return "target";
}
