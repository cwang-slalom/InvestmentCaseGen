import { useEffect, useState } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
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
  const [confirmed, setConfirmed] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setApproachFields(project.reviewSetup?.approachFields || []);
    setRoles(project.reviewSetup?.roles || []);
    setConfirmed(true);
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
    <section className="wizard-page review-setup-page">
      <div className="page-title-row">
        <div className="page-title">
          <p className="eyebrow">Step 3 of 4</p>
          <h2>Review setup</h2>
          <p>Review the recommended approach and confirm before generating.</p>
        </div>
        <button className="outline-action" type="button">
          <Icon name="edit" />
          Edit setup
        </button>
      </div>

      <div className="review-grid">
        <section className="panel approach-card">
          <h3>Approach summary</h3>
          <p>Here's how we will approach your request.</p>
          <div className="approach-list">
            {approachFields.map((field) => (
              <div className="approach-row" key={field.id}>
                <span><Icon name={approachIcon(field.id)} /></span>
                <strong>{field.label}</strong>
                <em>{field.value}</em>
                {field.id === "external_web_search" && <small>Recent data, trends, and case studies</small>}
              </div>
            ))}
          </div>
          <button className="ghost-link" type="button">
            View full customization details
            <Icon name="arrow" />
          </button>
        </section>

        <section className="panel review-plan-card">
          <h3>Review plan</h3>
          <p>Select reviewers and confirm the review process.</p>
          <div className="role-list">
            {roles.map((role) => (
              <button
                className={`role-row ${role.selected ? "selected" : ""}`}
                key={role.id}
                type="button"
                onClick={() =>
                  setRoles((current) =>
                    current.map((item) =>
                      item.id === role.id
                        ? { ...item, selected: !item.selected, status: !item.selected ? statusForRole(item.id) : "Optional" }
                        : item,
                    ),
                  )
                }
              >
                <span><Icon name={roleIcon(role.id)} /></span>
                <div>
                  <strong>{role.label}</strong>
                  <p>{role.notes}</p>
                </div>
                <b className={`status-badge ${statusClass(role.status)}`}>{role.status}</b>
              </button>
            ))}
          </div>
          <button className="ghost-link" type="button">
            Manage reviewers
            <Icon name="arrow" />
          </button>
        </section>

        <section className="source-plan-stack">
          <div className="panel source-plan-card">
            <h3>Source &amp; evidence plan</h3>
            <p>Confirm the sources and search approach.</p>
            <div className="source-box">
              <strong>Internal sources <small>(from Gates Foundation)</small></strong>
              <div className="source-count-row">
                <span>8 approved sources</span>
                <div className="file-stack">
                  <Icon name="file" />
                  <Icon name="pdf" />
                  <Icon name="docx" />
                  <Icon name="xlsx" />
                  <b>+4</b>
                </div>
                <button type="button">View all</button>
              </div>
            </div>
            <div className="source-box">
              <strong>External web search</strong>
              <span className="status-pill ready">Enabled</span>
              <p>Topics: Background context, recent data &amp; trends, case studies, policy landscape</p>
              <p>Estimated 4-6 web sources</p>
            </div>
          </div>
          <div className="readiness-card">
            <Icon name="check" />
            <div>
              <strong>External-use readiness</strong>
              <p>This setup meets requirements for external use.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="next-card">
        <Icon name="info" />
        <div>
          <strong>What happens next?</strong>
          <p>Once you continue, we'll generate your content package based on this setup.</p>
          <p>You'll be able to review and approve each output.</p>
        </div>
      </div>

      {!validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
      <div className="bottom-actions">
        <button className="secondary-button large" type="button" onClick={() => onNavigate(`/projects/${project.id}/opportunity-audience`)}>
          <Icon name="arrow-left" />
          Back
        </button>
        <button className="primary-button large" type="button" disabled={!validation.valid || saving} onClick={continueToGenerate}>
          Continue to generate
          <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}

function approachIcon(id: string): IconName {
  if (id.includes("narrative")) return "sparkles";
  if (id.includes("tone")) return "home";
  if (id.includes("technical")) return "presentation";
  if (id.includes("evidence")) return "document";
  if (id.includes("ask")) return "flask";
  if (id.includes("external")) return "target";
  return "people";
}

function roleIcon(id: string): IconName {
  if (id === "technical") return "flask";
  if (id === "communications") return "heart";
  if (id === "legal") return "lock";
  return "target";
}

function statusForRole(id: string) {
  if (id === "technical" || id === "communications") return "Required";
  if (id === "legal") return "As needed";
  return "Optional";
}

function statusClass(status: string) {
  if (status === "Required") return "required";
  if (status === "As needed") return "as-needed";
  return "optional";
}
