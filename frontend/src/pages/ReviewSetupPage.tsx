import { useEffect, useState } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import { editField } from "../state/workflow";
import { validateReviewSetup } from "../state/validation";
import type { AppConfig, FieldValue, Opportunity, Project, ReviewRole, SourceDocument, SourceReadiness } from "../types";

type ReviewSetupPageProps = {
  project: Project;
  opportunities: Opportunity[];
  config?: AppConfig | null;
  onProject: (project: Project) => void;
  onNavigate: (path: string) => void;
};

type ReviewSetupDrawerName = "approach" | "reviewers" | "sources" | "web-search" | null;

export function ReviewSetupPage({ project, opportunities, config, onProject, onNavigate }: ReviewSetupPageProps) {
  const [approachFields, setApproachFields] = useState<FieldValue[]>(project.reviewSetup?.approachFields || []);
  const [roles, setRoles] = useState<ReviewRole[]>(project.reviewSetup?.roles || []);
  const [confirmed, setConfirmed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailsDrawer, setDetailsDrawer] = useState<ReviewSetupDrawerName>(null);

  useEffect(() => {
    setApproachFields(project.reviewSetup?.approachFields || []);
    setRoles(project.reviewSetup?.roles || []);
    setConfirmed(true);
  }, [project.id, project.reviewSetup]);

  const readiness = project.reviewSetup?.sourceReadiness;
  const validation = validateReviewSetup(approachFields, roles, confirmed, Boolean(readiness?.ready));
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === project.opportunityAudience?.opportunityId) || null;
  const internalSources = config?.knowledgeSources?.length ? config.knowledgeSources : selectedOpportunity?.sourceList || [];
  const sourceCount = internalSources.length || 8;
  const externalSearchField = approachFields.find((field) => field.id === "external_web_search");

  async function continueToGenerate() {
    if (!validation.valid) return;
    setSaving(true);
    const updated = await api.updateReviewSetup(project.id, { approachFields, roles, confirmed });
    onProject(updated);
    setSaving(false);
    onNavigate(`/projects/${project.id}/generate`);
  }

  function updateApproachField(fieldId: string, value: string) {
    setApproachFields((current) => editField(current, fieldId, value));
  }

  function toggleRole(roleId: string) {
    setRoles((current) =>
      current.map((item) =>
        item.id === roleId
          ? { ...item, selected: !item.selected, status: !item.selected ? statusForRole(item.id) : "Optional" }
          : item,
      ),
    );
  }

  return (
    <section className="wizard-page review-setup-page">
      <div className="page-title-row">
        <div className="page-title">
          <p className="eyebrow">Step 3 of 4</p>
          <h2>Review setup</h2>
          <p>Review the recommended approach and confirm before generating.</p>
        </div>
        <button className="outline-action" type="button" onClick={() => setDetailsDrawer("approach")}>
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
          <button className="ghost-link" type="button" onClick={() => setDetailsDrawer("approach")}>
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
                onClick={() => toggleRole(role.id)}
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
          <button className="ghost-link" type="button" onClick={() => setDetailsDrawer("reviewers")}>
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
                <span>{sourceCount} approved sources</span>
                <div className="file-stack">
                  <Icon name="file" />
                  <Icon name="pdf" />
                  <Icon name="docx" />
                  <Icon name="xlsx" />
                  {sourceCount > 4 && <b>+{sourceCount - 4}</b>}
                </div>
                <button type="button" onClick={() => setDetailsDrawer("sources")}>View all</button>
              </div>
            </div>
            <div className="source-box">
              <strong>External web search</strong>
              <button className="status-pill ready status-button" type="button" onClick={() => setDetailsDrawer("web-search")}>
                {externalSearchField?.value || "Enabled"}
              </button>
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
      {detailsDrawer && (
        <ReviewSetupDrawer
          drawer={detailsDrawer}
          approachFields={approachFields}
          roles={roles}
          internalSources={internalSources}
          readiness={readiness}
          onClose={() => setDetailsDrawer(null)}
          onEditApproach={updateApproachField}
          onToggleRole={toggleRole}
          onOpenApproach={() => setDetailsDrawer("approach")}
        />
      )}
    </section>
  );
}

function ReviewSetupDrawer({
  drawer,
  approachFields,
  roles,
  internalSources,
  readiness,
  onClose,
  onEditApproach,
  onToggleRole,
  onOpenApproach,
}: {
  drawer: Exclude<ReviewSetupDrawerName, null>;
  approachFields: FieldValue[];
  roles: ReviewRole[];
  internalSources: SourceDocument[];
  readiness?: SourceReadiness;
  onClose: () => void;
  onEditApproach: (fieldId: string, value: string) => void;
  onToggleRole: (roleId: string) => void;
  onOpenApproach: () => void;
}) {
  const drawerTitle = {
    approach: "Full customization details",
    reviewers: "Reviewer setup",
    sources: "All internal sources",
    "web-search": "External web search",
  }[drawer];
  const externalSearch = approachFields.find((field) => field.id === "external_web_search");
  const evidenceDensity = approachFields.find((field) => field.id === "evidence_density");
  const estimatedSources = approachFields.find((field) => field.id === "estimated_sources");

  return (
    <div className="drawer details-drawer" role="dialog" aria-modal="true" aria-label={drawerTitle}>
      <button className="icon-button drawer-close" type="button" title="Close" onClick={onClose}>
        <Icon name="close" />
      </button>
      {drawer === "approach" && (
        <>
          <p className="eyebrow">Recommended setup</p>
          <h3>Full customization details</h3>
          <div className="drawer-field-list">
            {approachFields.map((field) => (
              <label className={`drawer-field ${field.metadata.editable ? "" : "readonly"}`} key={field.id}>
                <span>
                  <strong>{field.label}</strong>
                  <small>{field.provenanceLabel}</small>
                </span>
                <textarea
                  value={field.value}
                  readOnly={!field.metadata.editable}
                  onChange={(event) => onEditApproach(field.id, event.currentTarget.value)}
                />
                <em>
                  {sourceLabel(field.metadata.source)}
                  {field.metadata.required ? " · Required" : ""}
                  {field.metadata.confidence ? ` · ${Math.round(field.metadata.confidence * 100)}% confidence` : ""}
                </em>
                {field.metadata.citations?.length ? (
                  <div className="drawer-citation-list">
                    {field.metadata.citations.map((citation) => (
                      <span key={`${field.id}-${citation.sourceId}-${citation.locator}`}>
                        {citation.label}{citation.locator ? `, ${citation.locator}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>
            ))}
          </div>
          <div className="drawer-actions">
            <button className="primary-button" type="button" onClick={onClose}>Done</button>
          </div>
        </>
      )}
      {drawer === "reviewers" && (
        <>
          <p className="eyebrow">Human review</p>
          <h3>Reviewer setup</h3>
          <div className="output-option-list">
            {roles.map((role) => (
              <label className={`drawer-card output-option ${role.selected ? "selected" : ""}`} key={role.id}>
                <input type="checkbox" checked={role.selected} onChange={() => onToggleRole(role.id)} />
                <span>
                  <strong>{role.label}</strong>
                  <small>{role.notes}</small>
                </span>
                <em>{role.status}</em>
              </label>
            ))}
          </div>
          <div className="drawer-note">
            Generated materials remain drafts until the selected review roles confirm factual accuracy and external-use readiness.
          </div>
        </>
      )}
      {drawer === "sources" && (
        <>
          <p className="eyebrow">Source &amp; evidence plan</p>
          <h3>All internal sources</h3>
          <div className="drawer-list">
            {internalSources.length ? (
              internalSources.map((source) => (
                <article className="drawer-card" key={source.id}>
                  <div className="drawer-card-header">
                    <span className="opportunity-icon"><Icon name={sourceIcon(source.sourceType)} /></span>
                    <div>
                      <strong>{source.title}</strong>
                      <small>{source.sourceType} · {source.label}</small>
                    </div>
                    <span className="status-pill">{source.status}</span>
                  </div>
                  <dl className="drawer-metadata-grid">
                    <div><dt>Locator</dt><dd>{source.locator || "Unresolved"}</dd></div>
                    <div><dt>Evidence boundary</dt><dd>{source.excerpt || "No excerpt available."}</dd></div>
                  </dl>
                </article>
              ))
            ) : (
              <p className="muted">No internal sources are attached to this setup.</p>
            )}
          </div>
          {readiness?.checks.length ? (
            <>
              <h4>Readiness checks</h4>
              <div className="drawer-chip-list">
                {readiness.checks.map((check) => <span key={check}>{check}</span>)}
              </div>
            </>
          ) : null}
        </>
      )}
      {drawer === "web-search" && (
        <>
          <p className="eyebrow">External web search</p>
          <h3>{externalSearch?.value || "Enabled"}</h3>
          <dl className="drawer-metadata-grid">
            <div><dt>Topics</dt><dd>Background context, recent data and trends, case studies, policy landscape</dd></div>
            <div><dt>Estimated web sources</dt><dd>4-6 sources</dd></div>
            <div><dt>Evidence density</dt><dd>{evidenceDensity?.value || "High"}</dd></div>
            <div><dt>Total source estimate</dt><dd>{estimatedSources?.value || "~12 internal + web"}</dd></div>
          </dl>
          <div className="drawer-note">
            External web sources can add current context, but generated claims still require citation review before external use.
          </div>
          <div className="drawer-actions">
            <button className="secondary-button" type="button" onClick={onOpenApproach}>View approach details</button>
            <button className="primary-button" type="button" onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </div>
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

function sourceIcon(sourceType: string): IconName {
  const normalized = sourceType.toLowerCase();
  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("doc")) return "docx";
  if (normalized.includes("xls")) return "xlsx";
  return "file";
}

function sourceLabel(source: FieldValue["metadata"]["source"]) {
  if (source === "audience_profile") return "Audience profile";
  if (source === "ai_suggestion") return "AI suggestion";
  if (source === "opportunity") return "Opportunity";
  if (source === "extracted_source") return "Extracted source";
  return "User edited";
}
