import { useEffect, useState } from "react";

import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { editField } from "../state/workflow";
import { validateReviewSetup } from "../state/validation";
import type { FieldValue, Project, ReviewRole } from "../types";

type ReviewSetupPageProps = {
  project: Project;
  onProject: (project: Project) => void;
  onNavigate: (path: string) => void;
};

export function ReviewSetupPage({ project, onProject, onNavigate }: ReviewSetupPageProps) {
  const [approachFields, setApproachFields] = useState<FieldValue[]>(project.reviewSetup?.approachFields || []);
  const [roles, setRoles] = useState<ReviewRole[]>(project.reviewSetup?.roles || []);
  const [confirmed, setConfirmed] = useState(project.reviewSetup?.confirmed || false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setApproachFields(project.reviewSetup?.approachFields || []);
    setRoles(project.reviewSetup?.roles || []);
    setConfirmed(project.reviewSetup?.confirmed || false);
  }, [project.id, project.reviewSetup]);

  const readiness = project.reviewSetup?.sourceReadiness;
  const validation = validateReviewSetup(approachFields, roles, confirmed, Boolean(readiness?.ready));

  async function continueToGenerate() {
    if (!validation.valid) return;
    setSaving(true);
    const updated = await api.updateReviewSetup(project.id, { approachFields, roles, confirmed });
    onProject(updated);
    setSaving(false);
    onNavigate(`/projects/${project.id}/generate`);
  }

  return (
    <section className="wizard-page">
      <div className="page-title">
        <p className="eyebrow">Step 3</p>
        <h2>Review setup</h2>
      </div>
      <div className="three-panel">
        <section className="panel">
          <h3>Approach summary</h3>
          <div className="suggestion-list">
            {approachFields.map((field) => (
              <label className={`suggestion-field source-${field.metadata.source}`} key={field.id}>
                <span>
                  {field.label}
                  <small>{field.provenanceLabel}</small>
                </span>
                <input
                  value={field.value}
                  disabled={!field.metadata.editable}
                  onChange={(event) => setApproachFields((current) => editField(current, field.id, event.currentTarget.value))}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>Review plan</h3>
          <p className="muted">Planned review process - generic roles only.</p>
          <div className="stack-list">
            {roles.map((role) => (
              <label className="checkbox-row" key={role.id}>
                <input
                  type="checkbox"
                  checked={role.selected}
                  onChange={(event) =>
                    setRoles((current) =>
                      current.map((item) =>
                        item.id === role.id ? { ...item, selected: event.currentTarget.checked, status: event.currentTarget.checked ? "Planned" : "Optional" } : item,
                      ),
                    )
                  }
                />
                <span>
                  <strong>{role.label}</strong>
                  <small>{role.status} - {role.notes}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>Source and evidence plan</h3>
          <span className={readiness?.ready ? "status-pill ready" : "status-pill warning"}>
            {readiness?.ready ? "Ready for mock generation" : "Needs attention"}
          </span>
          <ul className="check-list">
            {(readiness?.checks || []).map((check) => <li key={check}>{check}</li>)}
          </ul>
          {Boolean(readiness?.blockingIssues.length) && (
            <div className="warning-box">
              {readiness?.blockingIssues.map((issue) => <p key={issue}>{issue}</p>)}
            </div>
          )}
          <label className="confirm-row">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} />
            I confirm this review setup for Phase 1 mock generation.
          </label>
        </section>
      </div>
      {!validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
      <div className="action-row split">
        <button className="secondary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/opportunity-audience`)}>
          Back
        </button>
        <button className="primary-button" type="button" disabled={!validation.valid || saving} onClick={continueToGenerate}>
          Continue
          <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}
