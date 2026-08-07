import { useEffect, useState } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import { editField, setExternalWebSearch } from "../state/workflow";
import { validateReviewSetup } from "../state/validation";
import type { FieldValue, Opportunity, Project, ReviewRole, SourceDocument, SourceReadiness } from "../types";

type ReviewSetupPageProps = {
  project: Project;
  opportunities: Opportunity[];
  onProject: (project: Project) => void;
  onNavigate: (path: string) => void;
};

type ReviewSetupDrawerName = "system-suggestions" | "approach" | "reviewers" | "sources" | "web-search" | null;

export function ReviewSetupPage({ project, opportunities, onProject, onNavigate }: ReviewSetupPageProps) {
  const [suggestionFields, setSuggestionFields] = useState<FieldValue[]>(project.opportunityAudience?.suggestions || []);
  const [approachFields, setApproachFields] = useState<FieldValue[]>(project.reviewSetup?.approachFields || []);
  const [roles, setRoles] = useState<ReviewRole[]>(project.reviewSetup?.roles || []);
  const [confirmed, setConfirmed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailsDrawer, setDetailsDrawer] = useState<ReviewSetupDrawerName>(null);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);

  useEffect(() => {
    setSuggestionFields(project.opportunityAudience?.suggestions || []);
    setApproachFields(project.reviewSetup?.approachFields || []);
    setRoles(project.reviewSetup?.roles || []);
    setConfirmed(true);
    setError("");
  }, [project.id, project.opportunityAudience, project.reviewSetup]);

  const readiness = project.reviewSetup?.sourceReadiness;
  const validation = validateReviewSetup(approachFields, roles, confirmed, Boolean(readiness?.ready));
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === project.opportunityAudience?.opportunityId) || null;
  const sourceMode = project.opportunityAudience?.sourceMode;
  const internalSources = sourceMode === "existing" ? selectedOpportunity?.sourceList || [] : [];
  const sourceCount = sourceMode === "new" ? (project.extractionId ? 1 : 0) : internalSources.length;
  const externalSearchField = approachFields.find((field) => field.id === "external_web_search");
  const externalSearchEnabled = externalSearchField?.value.trim().toLowerCase() === "enabled";

  async function continueToGenerate() {
    if (!validation.valid) return;
    setSaving(true);
    setError("");
    try {
      const opportunityAudience = project.opportunityAudience;
      if (opportunityAudience) {
        await api.updateOpportunityAudience(project.id, {
          sourceMode: opportunityAudience.sourceMode,
          opportunityId: opportunityAudience.opportunityId || null,
          audienceId: opportunityAudience.audienceId || null,
          intendedOutcome: opportunityAudience.intendedOutcome || null,
          suggestions: suggestionFields,
          selectedOutputs: opportunityAudience.selectedOutputs,
        });
      }
      const updated = await api.updateReviewSetup(project.id, { approachFields, roles, confirmed });
      onProject(updated);
      setSaving(false);
      onNavigate(`/projects/${project.id}/generate`);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Review setup could not be saved.");
      setSaving(false);
    }
  }

  function updateSuggestionField(fieldId: string, value: string) {
    setSuggestionFields((current) => editField(current, fieldId, value));
  }

  function updateApproachField(fieldId: string, value: string) {
    setApproachFields((current) => editField(current, fieldId, value));
  }

  function updateExternalSearch(enabled: boolean) {
    setApproachFields((current) => setExternalWebSearch(current, enabled));
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

  function openSystemSuggestions(fieldId?: string) {
    setActiveSuggestionId(fieldId || null);
    setDetailsDrawer("system-suggestions");
  }

  function closeDetailsDrawer() {
    setDetailsDrawer(null);
    setActiveSuggestionId(null);
  }

  return (
    <section className="wizard-page review-setup-page">
      <div className="page-title-row">
        <div className="page-title">
          <p className="eyebrow">Step 3 of 4</p>
          <h2>Review setup</h2>
          <p>Review the system suggestions and recommended approach before generating.</p>
        </div>
        <button className="outline-action" type="button" onClick={() => setDetailsDrawer("approach")}>
          <Icon name="edit" />
          Edit setup
        </button>
      </div>

      <div className="review-grid">
        <section className="panel system-suggestions-card">
          <h3>System suggestions</h3>
          <p>Based on the selected opportunity, audience, approved knowledge base, and past work.</p>
          <div className="system-suggestion-list">
            {suggestionFields.map((field) => (
              <div className="system-suggestion-row" key={field.id}>
                <span><Icon name={suggestionIcon(field.id)} /></span>
                <strong>{field.label}</strong>
                <em title={field.value}>{field.value}</em>
                <button type="button" onClick={() => openSystemSuggestions(field.id)}>Edit</button>
              </div>
            ))}
          </div>
          <button className="ghost-link customize-button" type="button" onClick={() => openSystemSuggestions()}>
            Customize details
            <Icon name="sliders" />
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
              <strong>{sourceMode === "new" ? "Attached source" : "Internal sources"}</strong>
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
              <div className="source-box-header">
                <strong>External web search</strong>
                <div className="source-box-actions">
                  <WebSearchToggle enabled={externalSearchEnabled} onChange={updateExternalSearch} />
                  <button
                    className="icon-button compact"
                    type="button"
                    title="View external web search details"
                    onClick={() => setDetailsDrawer("web-search")}
                  >
                    <Icon name="info" />
                  </button>
                </div>
              </div>
              <p>{externalSearchEnabled ? "Topics: Background context, recent data & trends, case studies, policy landscape" : "No external web sources will be added."}</p>
              {externalSearchEnabled && <p>Estimated 4-6 web sources</p>}
            </div>
          </div>
          <div className={`readiness-card ${readiness?.ready ? "ready" : "needs-review"}`}>
            <Icon name={readiness?.ready ? "check" : "warning"} />
            <div>
              <strong>External-use readiness</strong>
              <p>
                {readiness?.ready
                  ? "This setup meets requirements for external use."
                  : readiness?.blockingIssues[0] || "Source readiness has not been confirmed yet."}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="next-card">
        <Icon name="info" />
        <div>
          <strong>What happens next?</strong>
          <p>Next, you'll review selected outputs and start generation only when you're ready.</p>
          <p>You'll be able to review and approve each output after materials are generated.</p>
        </div>
      </div>

      {!validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
      {error && <p className="validation-message" role="alert">{error}</p>}
      <div className="bottom-actions">
        <button className="secondary-button large" type="button" onClick={() => onNavigate(`/projects/${project.id}/opportunity-audience`)}>
          <Icon name="arrow-left" />
          Back
        </button>
        <button className="primary-button large" type="button" disabled={!validation.valid || saving} onClick={continueToGenerate}>
          {saving ? "Saving setup..." : "Continue to generate"}
          <Icon name="arrow" />
        </button>
      </div>
      {detailsDrawer && (
        <ReviewSetupDrawer
          drawer={detailsDrawer}
          suggestionFields={suggestionFields}
          activeSuggestionId={activeSuggestionId}
          approachFields={approachFields}
          roles={roles}
          internalSources={internalSources}
          readiness={readiness}
          onClose={closeDetailsDrawer}
          onEditSuggestion={updateSuggestionField}
          onEditApproach={updateApproachField}
          onSetExternalSearch={updateExternalSearch}
          onToggleRole={toggleRole}
          onOpenApproach={() => setDetailsDrawer("approach")}
        />
      )}
    </section>
  );
}

function ReviewSetupDrawer({
  drawer,
  suggestionFields,
  activeSuggestionId,
  approachFields,
  roles,
  internalSources,
  readiness,
  onClose,
  onEditSuggestion,
  onEditApproach,
  onSetExternalSearch,
  onToggleRole,
  onOpenApproach,
}: {
  drawer: Exclude<ReviewSetupDrawerName, null>;
  suggestionFields: FieldValue[];
  activeSuggestionId: string | null;
  approachFields: FieldValue[];
  roles: ReviewRole[];
  internalSources: SourceDocument[];
  readiness?: SourceReadiness;
  onClose: () => void;
  onEditSuggestion: (fieldId: string, value: string) => void;
  onEditApproach: (fieldId: string, value: string) => void;
  onSetExternalSearch: (enabled: boolean) => void;
  onToggleRole: (roleId: string) => void;
  onOpenApproach: () => void;
}) {
  const drawerTitle = {
    "system-suggestions": "System suggestions",
    approach: "Full customization details",
    reviewers: "Reviewer setup",
    sources: "All internal sources",
    "web-search": "External web search",
  }[drawer];
  const externalSearch = approachFields.find((field) => field.id === "external_web_search");
  const externalSearchEnabled = externalSearch?.value.trim().toLowerCase() === "enabled";
  const evidenceDensity = approachFields.find((field) => field.id === "evidence_density");
  const estimatedSources = approachFields.find((field) => field.id === "estimated_sources");

  return (
    <div className="drawer details-drawer" role="dialog" aria-modal="true" aria-label={drawerTitle}>
      <button className="icon-button drawer-close" type="button" title="Close" onClick={onClose}>
        <Icon name="close" />
      </button>
      {drawer === "system-suggestions" && (
        <>
          <p className="eyebrow">System suggestions</p>
          <h3>Customize details</h3>
          <div className="drawer-field-list">
            {suggestionFields.map((field) => (
              <label className={`drawer-field ${activeSuggestionId === field.id ? "active" : ""}`} key={field.id}>
                <span>
                  <strong>{field.label}</strong>
                  <small>{field.provenanceLabel}</small>
                </span>
                <textarea
                  value={field.value}
                  autoFocus={activeSuggestionId === field.id}
                  onChange={(event) => onEditSuggestion(field.id, event.currentTarget.value)}
                />
                <em>
                  {sourceLabel(field.metadata.source)}
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
      {drawer === "approach" && (
        <>
          <p className="eyebrow">Recommended setup</p>
          <h3>Full customization details</h3>
          <div className="drawer-field-list">
            {approachFields.map((field) => {
              const fieldMeta = (
                <>
                  {sourceLabel(field.metadata.source)}
                  {field.metadata.required ? " · Required" : ""}
                  {field.metadata.confidence ? ` · ${Math.round(field.metadata.confidence * 100)}% confidence` : ""}
                </>
              );
              const citations = field.metadata.citations?.length ? (
                <div className="drawer-citation-list">
                  {field.metadata.citations.map((citation) => (
                    <span key={`${field.id}-${citation.sourceId}-${citation.locator}`}>
                      {citation.label}{citation.locator ? `, ${citation.locator}` : ""}
                    </span>
                  ))}
                </div>
              ) : null;

              if (field.id === "external_web_search") {
                return (
                  <div className="drawer-field" key={field.id}>
                    <span>
                      <strong>{field.label}</strong>
                      <small>{field.provenanceLabel}</small>
                    </span>
                    <WebSearchToggle enabled={externalSearchEnabled} onChange={onSetExternalSearch} />
                    <em>{fieldMeta}</em>
                    {citations}
                  </div>
                );
              }

              return (
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
                  <em>{fieldMeta}</em>
                  {citations}
                </label>
              );
            })}
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
          <h3>{internalSources.length ? "All internal sources" : "Attached uploaded source"}</h3>
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
              <p className="muted">Uploaded-source excerpts are passed to the model from the reviewed extraction fields.</p>
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
          <h3>Search mode</h3>
          <WebSearchToggle enabled={externalSearchEnabled} onChange={onSetExternalSearch} />
          <dl className="drawer-metadata-grid">
            <div><dt>Topics</dt><dd>{externalSearchEnabled ? "Background context, recent data and trends, case studies, policy landscape" : "Not requested"}</dd></div>
            <div><dt>Estimated web sources</dt><dd>{externalSearchEnabled ? "4-6 sources" : "0 sources"}</dd></div>
            <div><dt>Evidence density</dt><dd>{evidenceDensity?.value || "High"}</dd></div>
            <div><dt>Total source estimate</dt><dd>{estimatedSources?.value || "Attached internal/uploaded sources only"}</dd></div>
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

function WebSearchToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <div className="segmented-control web-search-toggle" role="group" aria-label="External web search">
      <button
        className={enabled ? "active" : ""}
        type="button"
        aria-pressed={enabled}
        onClick={() => onChange(true)}
      >
        <Icon name="globe" />
        Enabled
      </button>
      <button
        className={!enabled ? "active" : ""}
        type="button"
        aria-pressed={!enabled}
        onClick={() => onChange(false)}
      >
        <Icon name="lock" />
        Disabled
      </button>
    </div>
  );
}

function suggestionIcon(id: string): IconName {
  if (id.includes("relationship")) return "document";
  if (id.includes("geography")) return "profile";
  if (id.includes("persona")) return "profile";
  if (id.includes("technical")) return "presentation";
  return "target";
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
  if (source === "ai_suggestion") return "Model suggestion";
  if (source === "system_setup") return "Setup default";
  if (source === "opportunity") return "Opportunity";
  if (source === "extracted_source") return "Extracted source";
  return "User edited";
}
