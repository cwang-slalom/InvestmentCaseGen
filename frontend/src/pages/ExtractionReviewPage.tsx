import { useEffect, useState } from "react";

import { api } from "../api/client";
import { Icon } from "../components/Icons";
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
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProject() {
      setLoading(true);
      const refreshed = await api.project(project.id);
      if (!active) return;
      onProject(refreshed);
      const extraction = refreshed.extractionId ? await api.projectExtraction(refreshed.id) : null;
      if (!active) return;
      setFields(extraction?.fields || []);
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
      const extraction = await api.extractText(project.id, fields[0]?.sourceLabel || "Synthetic source re-run", "rerun");
      setFields(extraction.fields);
      setConfirmed(false);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Extraction could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="panel full-panel"><h2>Loading extraction</h2></section>;
  }

  return (
    <section className="wizard-page">
      <div className="page-title">
        <p className="eyebrow">Review AI-extracted key information</p>
        <h2>Confirm the source facts before generation</h2>
      </div>
      <div className="panel full-panel">
        <div className="panel-header">
          <div>
            <span className="status-pill">Phase 1 temporary processing</span>
            <h3>{fields[0]?.sourceLabel || "Synthetic source"}</h3>
          </div>
          <button className="secondary-button" type="button" onClick={rerunExtraction} disabled={saving}>
            <Icon name="refresh" />
            Re-run extraction
          </button>
        </div>
        {error && <p className="validation-message" role="alert">{error}</p>}
        <label className="field-block compact">
          <span>Optional notes</span>
          <textarea placeholder="Add reviewer notes for this temporary extraction." />
        </label>
        <div className="extraction-grid">
          {fields.map((field) => (
            <article className="extracted-field" key={field.id}>
              <div>
                <h4>{field.label}</h4>
                <small>{field.sourceLabel} - {field.locator} - confidence {Math.round(field.confidence * 100)}%</small>
              </div>
              <textarea
                value={field.value}
                onChange={(event) => setFields((current) => editExtractedField(current, field.id, { value: event.currentTarget.value }))}
              />
              <div className="field-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={field.verified}
                    onChange={(event) => setFields((current) => editExtractedField(current, field.id, { verified: event.currentTarget.checked }))}
                  />
                  Verified
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={field.locked}
                    onChange={(event) => setFields((current) => editExtractedField(current, field.id, { locked: event.currentTarget.checked }))}
                  />
                  Locked
                </label>
              </div>
            </article>
          ))}
        </div>
        <label className="confirm-row">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} />
          I confirm this extracted information is ready for the Phase 1 mock generation step.
        </label>
      </div>
      {(!validation.valid || !flowValidation.valid) && (
        <p className="validation-message" role="alert">{validation.messages[0] || flowValidation.messages[0]}</p>
      )}
      <div className="action-row split">
        <button className="secondary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/opportunity-audience`)}>
          Back
        </button>
        <button className="primary-button" type="button" disabled={!validation.valid || !flowValidation.valid || saving} onClick={continueToReviewSetup}>
          Continue
          <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}
