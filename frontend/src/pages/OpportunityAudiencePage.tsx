import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import { defaultSelectedOutputs, intendedOutcomes } from "../state/options";
import { suggestionFromSelection } from "../state/workflow";
import { validateOpportunityAudience } from "../state/validation";
import type { AppConfig, AudienceProfile, FieldValue, Opportunity, OutputType, Project } from "../types";

type OpportunityAudiencePageProps = {
  project: Project;
  opportunities: Opportunity[];
  audiences: AudienceProfile[];
  config?: AppConfig | null;
  onProject: (project: Project) => void;
  onNavigate: (path: string) => void;
};

type SourceInputMode = "file" | "knowledge";
type NewSourceProgressStage = "idle" | "saving" | "analyzing" | "preparing";
type DetailsDrawer = "opportunities" | "donor-profile" | null;

const SOURCE_PROGRESS_MIN_STAGE_MS = {
  saving: 800,
  analyzing: 1800,
  preparing: 1600,
} satisfies Record<Exclude<NewSourceProgressStage, "idle">, number>;

export function OpportunityAudiencePage({
  project,
  opportunities,
  audiences,
  config,
  onProject,
  onNavigate,
}: OpportunityAudiencePageProps) {
  const existingState = project.opportunityAudience;
  const [sourceMode, setSourceMode] = useState<"existing" | "new">(existingState?.sourceMode || "existing");
  const [opportunityId, setOpportunityId] = useState(existingState?.opportunityId || opportunities[0]?.id || "");
  const [audienceId, setAudienceId] = useState(existingState?.audienceId || audiences[0]?.id || "");
  const [intendedOutcome, setIntendedOutcome] = useState(existingState?.intendedOutcome || intendedOutcomes[0]);
  const [selectedOutputs] = useState<OutputType[]>(
    existingState?.selectedOutputs?.length ? existingState.selectedOutputs : defaultSelectedOutputs,
  );
  const [suggestions, setSuggestions] = useState<FieldValue[]>(existingState?.suggestions || []);
  const [query, setQuery] = useState("");
  const [sourceInputMode, setSourceInputMode] = useState<SourceInputMode>("file");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [knowledgeSourceId, setKnowledgeSourceId] = useState(config?.knowledgeSources[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [newSourceProgressStage, setNewSourceProgressStage] = useState<NewSourceProgressStage>("idle");
  const [error, setError] = useState("");
  const [detailsDrawer, setDetailsDrawer] = useState<DetailsDrawer>(null);

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === opportunityId) || null;
  const selectedAudience = audiences.find((audience) => audience.id === audienceId) || null;
  const selectedKnowledgeSource = config?.knowledgeSources.find((source) => source.id === knowledgeSourceId) || null;
  const newSourceLabel = sourceInputMode === "file"
    ? sourceFile?.name || "Uploaded source"
    : selectedKnowledgeSource?.title || "Knowledge-base source";
  const newSourceReady = sourceInputMode === "file" ? Boolean(sourceFile) : Boolean(knowledgeSourceId);
  const isExtractingNewSource = sourceMode === "new" && submitting;
  const howItWorksProgress = newSourceHowItWorksProgress(newSourceProgressStage);

  const filteredOpportunities = useMemo(
    () =>
      opportunities.filter((opportunity) =>
        `${opportunity.title} ${opportunity.programArea} ${opportunity.geography}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [opportunities, query],
  );

  useEffect(() => {
    if (!opportunityId && opportunities[0]) setOpportunityId(opportunities[0].id);
  }, [opportunities, opportunityId]);

  useEffect(() => {
    if (!audienceId && audiences[0]) setAudienceId(audiences[0].id);
  }, [audienceId, audiences]);

  useEffect(() => {
    if (!knowledgeSourceId && config?.knowledgeSources[0]) {
      setKnowledgeSourceId(config.knowledgeSources[0].id);
    }
  }, [config?.knowledgeSources, knowledgeSourceId]);

  useEffect(() => {
    if (selectedOpportunity && selectedAudience && suggestions.length === 0) {
      setSuggestions(suggestionFromSelection(selectedOpportunity, selectedAudience));
    }
  }, [selectedOpportunity, selectedAudience, suggestions.length]);

  const validation = validateOpportunityAudience({
    sourceMode,
    opportunityId,
    extractionConfirmed: Boolean(project.extractionId),
    audienceId,
    intendedOutcome,
    selectedOutputs,
  });

  async function saveExistingAndContinue() {
    if (!validation.valid) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await api.updateOpportunityAudience(project.id, {
        sourceMode: "existing",
        opportunityId,
        audienceId,
        intendedOutcome,
        suggestions,
        selectedOutputs,
      });
      onProject(updated);
      onNavigate(`/projects/${project.id}/review-setup`);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Opportunity setup could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runSourceProgressStage<T>(
    stage: Exclude<NewSourceProgressStage, "idle">,
    task: () => Promise<T>,
  ) {
    setNewSourceProgressStage(stage);
    await waitForStagePaint();
    const startedAt = performance.now();
    const result = await task();
    await waitForMinimumElapsed(startedAt, SOURCE_PROGRESS_MIN_STAGE_MS[stage]);
    return result;
  }

  async function submitNewSource() {
    if (sourceInputMode === "file" && !sourceFile) {
      setError("Select a text-layer PDF, TXT, or Markdown source before continuing.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const updated = await runSourceProgressStage("saving", () =>
        api.updateOpportunityAudience(project.id, {
          sourceMode: "new",
          opportunityId: null,
          audienceId,
          intendedOutcome,
          suggestions,
          selectedOutputs,
        }),
      );
      onProject(updated);

      await runSourceProgressStage("analyzing", async () => {
        if (sourceInputMode === "file") {
          if (!sourceFile) {
            throw new Error("Select a text-layer PDF, TXT, or Markdown source before continuing.");
          }
          await api.extractFile(project.id, sourceFile);
        } else {
          const source = selectedKnowledgeSource;
          if (!source) {
            throw new Error("Select a knowledge-base source before continuing.");
          }
          await api.extractKnowledgeSource(project.id, source.title, source.id);
        }
      });

      const refreshed = await runSourceProgressStage("preparing", () => api.project(project.id));
      onProject(refreshed);
      onNavigate(`/projects/${project.id}/extraction-review`);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Extraction could not be completed.");
    } finally {
      setSubmitting(false);
      setNewSourceProgressStage("idle");
    }
  }

  function updateSelection(nextOpportunityId: string) {
    setOpportunityId(nextOpportunityId);
    const opportunity = opportunities.find((item) => item.id === nextOpportunityId);
    if (opportunity && selectedAudience) {
      setSuggestions(suggestionFromSelection(opportunity, selectedAudience));
    }
  }

  function updateAudience(nextAudienceId: string) {
    setAudienceId(nextAudienceId);
    const audience = audiences.find((item) => item.id === nextAudienceId);
    if (selectedOpportunity && audience) {
      setSuggestions(suggestionFromSelection(selectedOpportunity, audience));
    }
  }

  function closeDetailsDrawer() {
    setDetailsDrawer(null);
  }

  return (
    <section className="wizard-page opportunity-page">
      <div className="page-title-row">
        <div className="page-title">
          <p className="eyebrow">Step 2 of 4</p>
          <h2>{sourceMode === "new" ? "Create a new opportunity card" : "Select opportunity and audience"}</h2>
          <p>
            {sourceMode === "new"
              ? "Create a new opportunity from approved source materials."
              : "Search for an approved opportunity from our library."}
          </p>
        </div>
      </div>

      <div className="tab-strip" role="tablist" aria-label="Opportunity source mode">
        <button type="button" className={sourceMode === "existing" ? "active" : ""} onClick={() => setSourceMode("existing")} disabled={submitting}>
          <Icon name="search" />
          Search existing opportunity
        </button>
        <button type="button" className={sourceMode === "new" ? "active" : ""} onClick={() => setSourceMode("new")} disabled={submitting}>
          Create new opportunity
        </button>
        <button className="tab-plus" type="button" onClick={() => setSourceMode("new")} aria-label="Create new opportunity" disabled={submitting}>
          <Icon name="plus" />
        </button>
      </div>

      {sourceMode === "existing" ? (
        <div className="opportunity-audience-grid">
          <OpportunitySearchPanel
            opportunities={filteredOpportunities}
            selectedOpportunity={selectedOpportunity}
            opportunityId={opportunityId}
            query={query}
            onQuery={setQuery}
            onSelect={updateSelection}
            onViewAll={() => setDetailsDrawer("opportunities")}
          />
          <AudiencePanel
            audience={selectedAudience}
            audiences={audiences}
            audienceId={audienceId}
            intendedOutcome={intendedOutcome}
            onAudience={updateAudience}
            onOutcome={setIntendedOutcome}
            onViewProfile={() => setDetailsDrawer("donor-profile")}
          />
        </div>
      ) : (
        <div className="new-opportunity-grid">
          <section className="new-source-column">
            <label className={`upload-panel ${submitting ? "disabled" : ""}`}>
              <input
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                disabled={submitting}
                onChange={(event) => {
                  setSourceInputMode("file");
                  setSourceFile(event.currentTarget.files?.[0] || null);
                }}
              />
              <span className="upload-cloud"><Icon name="upload" /></span>
              <strong>Select or upload approved source documents</strong>
              <small>Drag &amp; drop files here or <b>browse</b></small>
              <em>Supported files: text-layer PDF, TXT, Markdown&nbsp;&nbsp;•&nbsp;&nbsp;Max 25MB each</em>
            </label>
            <button className="kb-button" type="button" onClick={() => {
              setSourceInputMode("knowledge");
              setSourceFile(null);
            }} disabled={submitting}>
              <Icon name="book" />
              Browse Knowledge Base
            </button>
            <button className="choice-button" type="button" onClick={() => {
              setSourceInputMode("knowledge");
              setSourceFile(null);
            }} disabled={submitting}>
              Or choose from Knowledge Base
            </button>
            {sourceInputMode === "knowledge" && (
              <label className="field-block compact source-select">
                <span>Approved knowledge-base source</span>
                <select value={knowledgeSourceId} onChange={(event) => setKnowledgeSourceId(event.currentTarget.value)} disabled={submitting}>
                  {(config?.knowledgeSources || []).map((source) => (
                    <option key={source.id} value={source.id}>{source.title}</option>
                  ))}
                </select>
              </label>
            )}
            {sourceFile && <p className="selected-file"><Icon name="file" /> {sourceFile.name}</p>}
            {isExtractingNewSource && (
              <SourceAnalysisProgress
                stage={newSourceProgressStage}
                sourceInputMode={sourceInputMode}
                sourceLabel={newSourceLabel}
              />
            )}
            {error && <p className="validation-message" role="alert">{error}</p>}
            <div className="info-callout">
              <Icon name="info" />
              <p>
                You can refine and send the draft for PST validation before it's added to the
                <strong> Opportunity Library</strong>.
              </p>
            </div>
          </section>
          <HowItWorks
            activeStep={howItWorksProgress.activeStep}
            processing={isExtractingNewSource}
            processingLabel={howItWorksProgress.label}
          />
        </div>
      )}

      {sourceMode === "existing" && !validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
      {sourceMode === "existing" && error && <p className="validation-message" role="alert">{error}</p>}
      <div className="bottom-actions">
        <button className="secondary-button large" type="button" onClick={() => onNavigate(`/projects/${project.id}/task`)} disabled={submitting}>
          <Icon name="arrow-left" />
          Back
        </button>
        {sourceMode === "existing" ? (
          <button className="primary-button large" type="button" disabled={!validation.valid || submitting} onClick={saveExistingAndContinue}>
            Continue to review setup
            <Icon name="arrow" />
          </button>
        ) : (
          <button className="primary-button large" type="button" disabled={submitting || !newSourceReady} onClick={submitNewSource}>
            {isExtractingNewSource ? (
              <>
                <span className="button-spinner" aria-hidden="true" />
                {newSourceProgressCopy(newSourceProgressStage, sourceInputMode).buttonLabel}
              </>
            ) : (
              <>
                Continue to review setup
                <Icon name="arrow" />
              </>
            )}
          </button>
        )}
      </div>
      {detailsDrawer && (
        <OpportunityAudienceDrawer
          drawer={detailsDrawer}
          opportunities={opportunities}
          selectedOpportunity={selectedOpportunity}
          selectedAudience={selectedAudience}
          onClose={closeDetailsDrawer}
          onSelectOpportunity={(id) => {
            updateSelection(id);
            closeDetailsDrawer();
          }}
        />
      )}
    </section>
  );
}

function waitForMinimumElapsed(startedAt: number, minimumMs: number) {
  const remainingMs = minimumMs - (performance.now() - startedAt);
  if (remainingMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, remainingMs);
  });
}

function waitForStagePaint() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 50);
  });
}

function newSourceHowItWorksProgress(stage: NewSourceProgressStage) {
  if (stage === "preparing") {
    return { activeStep: 2, label: "Preparing review" };
  }
  if (stage === "saving") {
    return { activeStep: 1, label: "Saving setup" };
  }
  return { activeStep: 1, label: "Analyzing now" };
}

function SourceAnalysisProgress({
  stage,
  sourceInputMode,
  sourceLabel,
}: {
  stage: NewSourceProgressStage;
  sourceInputMode: SourceInputMode;
  sourceLabel: string;
}) {
  const copy = newSourceProgressCopy(stage, sourceInputMode);
  const stages: Array<{ id: Exclude<NewSourceProgressStage, "idle">; title: string; detail: string }> = [
    {
      id: "saving",
      title: "Save setup",
      detail: "Keeping audience and output choices with this project.",
    },
    {
      id: "analyzing",
      title: sourceInputMode === "file" ? "Analyze uploaded source" : "Analyze knowledge-base source",
      detail: "Extracting sourced opportunity facts and marking unsupported details as unresolved.",
    },
    {
      id: "preparing",
      title: "Prepare review",
      detail: "Loading the draft opportunity card for human review and edits.",
    },
  ];
  const activeIndex = Math.max(0, stages.findIndex((item) => item.id === stage));

  return (
    <div className="source-progress-card" role="status" aria-live="polite" aria-atomic="true" aria-label={copy.title}>
      <div className="source-progress-heading">
        <span className="source-progress-spinner" aria-hidden="true" />
        <div>
          <strong>{copy.title}</strong>
          <p>{copy.body}</p>
        </div>
      </div>
      <div className="source-progress-track" aria-hidden="true">
        <span />
      </div>
      <ol className="source-progress-steps" aria-label={`Progress for ${sourceLabel}`}>
        {stages.map((item, index) => {
          const status = index < activeIndex ? "completed" : index === activeIndex ? "in-progress" : "queued";
          return (
            <li className={status} key={item.id}>
              <span>{status === "completed" ? <Icon name="check" /> : index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="source-progress-footnote">
        Source: <strong>{sourceLabel}</strong>
      </p>
    </div>
  );
}

function OpportunitySearchPanel({
  opportunities,
  selectedOpportunity,
  opportunityId,
  query,
  onQuery,
  onSelect,
  onViewAll,
}: {
  opportunities: Opportunity[];
  selectedOpportunity: Opportunity | null;
  opportunityId: string;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="panel search-panel">
      <h3>1. Search for an opportunity</h3>
      <div className="search-row">
        <label>
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => onQuery(event.currentTarget.value)}
            placeholder="Search opportunities by keyword, topic, or region..."
          />
        </label>
        <button className="secondary-button" type="button">
          <Icon name="sliders" />
          Filters
        </button>
      </div>
      <div className="recommended-heading">
        <strong>Recommended opportunities</strong>
        <Icon name="info" />
      </div>
      <div className="opportunity-list">
        {opportunities.map((opportunity) => (
          <button
            key={opportunity.id}
            type="button"
            className={`opportunity-row ${opportunityId === opportunity.id ? "selected" : ""}`}
            onClick={() => onSelect(opportunity.id)}
          >
            <span className="opportunity-icon"><Icon name={opportunityIcon(opportunity)} /></span>
            <span className="opportunity-copy">
              <strong>{opportunity.title}</strong>
              <small><b>{opportunity.programArea}</b><i>•</i>{opportunity.geography}</small>
              <em>{opportunity.summary}</em>
            </span>
            <span className="opportunity-meta">
              <b>{statusLabel(opportunity.validationStatus)}</b>
              <small>Updated {formatDate(opportunity.lastUpdated)}</small>
            </span>
            <Icon name="chevron-down" />
          </button>
        ))}
      </div>
      {selectedOpportunity && (
        <button className="ghost-link" type="button" onClick={onViewAll}>
          View all opportunities
          <Icon name="arrow" />
        </button>
      )}
    </section>
  );
}

function AudiencePanel({
  audience,
  audiences,
  audienceId,
  intendedOutcome,
  onAudience,
  onOutcome,
  onViewProfile,
}: {
  audience: AudienceProfile | null;
  audiences: AudienceProfile[];
  audienceId: string;
  intendedOutcome: string;
  onAudience: (id: string) => void;
  onOutcome: (value: string) => void;
  onViewProfile: () => void;
}) {
  return (
    <section className="panel audience-panel">
      <h3>2. Audience (Donor / Partner)</h3>
      <label className="sr-only" htmlFor="audience-select">Audience</label>
      <select id="audience-select" value={audienceId} onChange={(event) => onAudience(event.currentTarget.value)}>
        {audiences.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
      {audience && (
        <div className="donor-profile">
          <span className="donor-avatar">{initials(audience.name)}</span>
          <div>
            <strong>{audience.name}</strong>
            <small>{audience.relationshipStage}</small>
          </div>
        </div>
      )}
      <p className="found-message"><Icon name="check" /> Donor profile found in KB</p>
      {audience && <p className="interests">Interests: {audience.interests.join(", ")}</p>}
      <button className="soft-button" type="button" onClick={onViewProfile} disabled={!audience}>View donor profile</button>
      <div className="outcome-group">
        <h4>What should happen after this meeting?</h4>
        <p>This helps shape the narrative and ask.</p>
        {intendedOutcomes.map((outcome) => (
          <label className={`radio-card ${intendedOutcome === outcome ? "selected" : ""}`} key={outcome}>
            <input
              type="radio"
              name="intended-outcome"
              checked={intendedOutcome === outcome}
              onChange={() => onOutcome(outcome)}
            />
            <span>
              <strong>{outcome === "Other" ? "Other (please specify)" : outcome}</strong>
              <small>{outcomeDescription(outcome)}</small>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function OpportunityAudienceDrawer({
  drawer,
  opportunities,
  selectedOpportunity,
  selectedAudience,
  onClose,
  onSelectOpportunity,
}: {
  drawer: Exclude<DetailsDrawer, null>;
  opportunities: Opportunity[];
  selectedOpportunity: Opportunity | null;
  selectedAudience: AudienceProfile | null;
  onClose: () => void;
  onSelectOpportunity: (id: string) => void;
}) {
  const drawerTitle = {
    opportunities: "All opportunities",
    "donor-profile": "Donor profile",
  }[drawer];

  return (
    <div className="drawer details-drawer" role="dialog" aria-modal="true" aria-label={drawerTitle}>
      <button className="icon-button drawer-close" type="button" title="Close" onClick={onClose}>
        <Icon name="close" />
      </button>
      {drawer === "opportunities" && (
        <>
          <p className="eyebrow">Opportunity library</p>
          <h3>All opportunities</h3>
          <div className="drawer-list">
            {opportunities.map((opportunity) => (
              <article className={`drawer-card ${selectedOpportunity?.id === opportunity.id ? "selected" : ""}`} key={opportunity.id}>
                <div className="drawer-card-header">
                  <span className="opportunity-icon"><Icon name={opportunityIcon(opportunity)} /></span>
                  <div>
                    <strong>{opportunity.title}</strong>
                    <small>{opportunity.programArea} • {opportunity.geography}</small>
                  </div>
                  <span className="status-pill">{statusLabel(opportunity.validationStatus)}</span>
                </div>
                <p>{opportunity.summary}</p>
                <dl className="drawer-metadata-grid">
                  <div><dt>Funding range</dt><dd>{opportunity.fundingRange || "Unresolved"}</dd></div>
                  <div><dt>Why now</dt><dd>{opportunity.whyNow || "Unresolved"}</dd></div>
                  <div><dt>Reach</dt><dd>{opportunity.reach || "Unresolved"}</dd></div>
                </dl>
                <h4>Investor rationale</h4>
                <div className="drawer-chip-list">
                  {opportunity.differentiators.map((item) => <span key={item}>{item}</span>)}
                </div>
                <h4>Primary outcomes</h4>
                <div className="drawer-chip-list">
                  {opportunity.primaryOutcomes.map((item) => <span key={item}>{item}</span>)}
                </div>
                <div className="drawer-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={selectedOpportunity?.id === opportunity.id}
                    onClick={() => onSelectOpportunity(opportunity.id)}
                  >
                    {selectedOpportunity?.id === opportunity.id ? "Selected" : "Select opportunity"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {drawer === "donor-profile" && (
        <>
          <p className="eyebrow">Donor profile</p>
          {selectedAudience ? (
            <>
              <div className="drawer-profile-heading">
                <span className="donor-avatar">{initials(selectedAudience.name)}</span>
                <div>
                  <h3>{selectedAudience.name}</h3>
                  <small>{selectedAudience.audienceType}</small>
                </div>
              </div>
              <dl className="drawer-metadata-grid">
                <div><dt>Relationship stage</dt><dd>{selectedAudience.relationshipStage}</dd></div>
                <div><dt>Geography lens</dt><dd>{selectedAudience.geography}</dd></div>
                <div><dt>Familiarity</dt><dd>{selectedAudience.familiarity}</dd></div>
                <div><dt>Donor persona</dt><dd>{selectedAudience.donorPersona}</dd></div>
                <div><dt>Technical familiarity</dt><dd>{selectedAudience.technicalFamiliarity}</dd></div>
                <div><dt>Narrative approach</dt><dd>{selectedAudience.narrativeApproach}</dd></div>
              </dl>
              <h4>Interests</h4>
              <div className="drawer-chip-list">
                {selectedAudience.interests.map((interest) => <span key={interest}>{interest}</span>)}
              </div>
              {selectedOpportunity && (
                <div className="drawer-note">
                  Current opportunity lens: {selectedOpportunity.title} / {selectedOpportunity.geography}
                </div>
              )}
            </>
          ) : (
            <p className="muted">No donor profile is selected.</p>
          )}
        </>
      )}
    </div>
  );
}

function HowItWorks({
  activeStep,
  processing = false,
  processingLabel = "Analyzing now",
}: {
  activeStep: number;
  processing?: boolean;
  processingLabel?: string;
}) {
  const steps = [
    ["Upload approved materials", "Add source documents that have been reviewed and approved.", "clipboard"],
    ["We'll analyze your materials", "Our AI will extract key information and structure the opportunity.", "sparkles"],
    ["Review and refine", "Review the draft opportunity card and make any necessary edits.", "edit"],
    ["Add to library", "Send for PST validation before adding to the Opportunity Library.", "template"],
  ] as const;

  return (
    <aside className="panel how-card">
      <h3><Icon name="sparkles" /> How it works</h3>
      {steps.map(([title, body, icon], index) => {
        const active = index === activeStep;
        const processingStep = active && processing;

        return (
          <div className={`how-step ${active ? "active" : ""} ${processingStep ? "processing" : ""}`} key={title}>
            <span>{processingStep ? <span className="how-step-spinner" aria-hidden="true" /> : <Icon name={icon} />}</span>
            <div>
              <strong>{index + 1}. {title}</strong>
              <p>{body}</p>
              {processingStep && (
                <div className="how-step-live">
                  <small>{processingLabel}</small>
                  <div className="source-progress-track" aria-hidden="true"><span /></div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function newSourceProgressCopy(stage: NewSourceProgressStage, sourceInputMode: SourceInputMode) {
  if (stage === "saving") {
    return {
      title: "Preparing source analysis",
      body: "Saving the selected audience and output package before extraction starts.",
      buttonLabel: "Preparing analysis...",
    };
  }
  if (stage === "preparing") {
    return {
      title: "Preparing review workspace",
      body: "Loading the extracted opportunity card so you can review and refine it next.",
      buttonLabel: "Preparing review...",
    };
  }
  if (sourceInputMode === "knowledge") {
    return {
      title: "Analyzing knowledge-base source",
      body: "Extracting source-backed opportunity facts from the approved knowledge-base material.",
      buttonLabel: "Analyzing source...",
    };
  }
  return {
    title: "Analyzing uploaded materials",
    body: "Reading the source text and extracting supported opportunity facts for review.",
    buttonLabel: "Analyzing materials...",
  };
}

function statusLabel(status: string) {
  return status ? "PST Validated" : "PST Validated";
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function opportunityIcon(opportunity: Opportunity): IconName {
  if (opportunity.title.includes("AMR")) return "flask";
  if (opportunity.title.includes("Nutrition")) return "pin";
  if (opportunity.title.includes("Education")) return "book";
  return "heart";
}

function initials(name: string) {
  if (name.includes("Hong Kong")) return "HK";
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function outcomeDescription(outcome: string) {
  if (outcome === "Explore a co-funding partnership") return "Position the opportunity and build interest";
  if (outcome === "Agree to another conversation") return "Continue the discussion";
  if (outcome === "Introduce to leadership") return "Set up an internal connection";
  if (outcome === "Review the opportunity in more detail") return "Provide more information";
  return "Define custom next step";
}
