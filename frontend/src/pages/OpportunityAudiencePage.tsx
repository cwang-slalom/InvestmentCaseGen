import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import { defaultSelectedOutputs, functionalOutputs, futureOutputs, intendedOutcomes } from "../state/options";
import { editField, suggestionFromSelection, toggleOutput } from "../state/workflow";
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
type DetailsDrawer = "opportunities" | "donor-profile" | "customize-details" | "output-options" | null;

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
  const [selectedOutputs, setSelectedOutputs] = useState<OutputType[]>(
    existingState?.selectedOutputs?.length ? existingState.selectedOutputs : defaultSelectedOutputs,
  );
  const [suggestions, setSuggestions] = useState<FieldValue[]>(existingState?.suggestions || []);
  const [query, setQuery] = useState("");
  const [sourceInputMode, setSourceInputMode] = useState<SourceInputMode>("file");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [knowledgeSourceId, setKnowledgeSourceId] = useState(config?.knowledgeSources[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [detailsDrawer, setDetailsDrawer] = useState<DetailsDrawer>(null);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === opportunityId) || null;
  const selectedAudience = audiences.find((audience) => audience.id === audienceId) || null;

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
    const updated = await api.updateOpportunityAudience(project.id, {
      sourceMode: "existing",
      opportunityId,
      audienceId,
      intendedOutcome,
      suggestions,
      selectedOutputs,
    });
    onProject(updated);
    setSubmitting(false);
    onNavigate(`/projects/${project.id}/review-setup`);
  }

  async function submitNewSource() {
    setSubmitting(true);
    setError("");
    try {
      const updated = await api.updateOpportunityAudience(project.id, {
        sourceMode: "new",
        opportunityId: null,
        audienceId,
        intendedOutcome,
        suggestions,
        selectedOutputs,
      });
      onProject(updated);

      if (sourceInputMode === "file" && sourceFile) {
        await api.extractFile(project.id, sourceFile);
      } else {
        const source = config?.knowledgeSources.find((item) => item.id === knowledgeSourceId);
        await api.extractKnowledgeSource(project.id, source?.title || "Vaccine Strategy 2026.pdf", knowledgeSourceId || "src-vaccine-strategy");
      }

      const refreshed = await api.project(project.id);
      onProject(refreshed);
      onNavigate(`/projects/${project.id}/extraction-review`);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Extraction could not be completed.");
    } finally {
      setSubmitting(false);
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

  function openCustomizeDetails(suggestionId?: string) {
    setActiveSuggestionId(suggestionId || null);
    setDetailsDrawer("customize-details");
  }

  function closeDetailsDrawer() {
    setDetailsDrawer(null);
    setActiveSuggestionId(null);
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
        {sourceMode === "existing" && (
          <button className="outline-action" type="button">
            <Icon name="sparkles" />
            Why these suggestions?
          </button>
        )}
      </div>

      <div className="tab-strip" role="tablist" aria-label="Opportunity source mode">
        <button type="button" className={sourceMode === "existing" ? "active" : ""} onClick={() => setSourceMode("existing")}>
          <Icon name="search" />
          Search existing opportunity
        </button>
        <button type="button" className={sourceMode === "new" ? "active" : ""} onClick={() => setSourceMode("new")}>
          Create new opportunity
        </button>
        <button className="tab-plus" type="button" onClick={() => setSourceMode("new")} aria-label="Create new opportunity">
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
          <SetupPanel
            suggestions={suggestions}
            selectedOutputs={selectedOutputs}
            onEditSuggestion={(id, value) => setSuggestions((current) => editField(current, id, value))}
            onToggleOutput={(output) => setSelectedOutputs((current) => toggleOutput(current, output))}
            onCustomizeDetails={openCustomizeDetails}
            onViewOutputOptions={() => setDetailsDrawer("output-options")}
          />
        </div>
      ) : (
        <div className="new-opportunity-grid">
          <section className="new-source-column">
            <label className="upload-panel">
              <input
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
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
            <button className="kb-button" type="button" onClick={() => setSourceInputMode("knowledge")}>
              <Icon name="book" />
              Browse Knowledge Base
            </button>
            <button className="choice-button" type="button" onClick={() => setSourceInputMode("knowledge")}>
              Or choose from Knowledge Base
            </button>
            {sourceInputMode === "knowledge" && (
              <label className="field-block compact source-select">
                <span>Approved knowledge-base source</span>
                <select value={knowledgeSourceId} onChange={(event) => setKnowledgeSourceId(event.currentTarget.value)}>
                  {(config?.knowledgeSources || []).map((source) => (
                    <option key={source.id} value={source.id}>{source.title}</option>
                  ))}
                </select>
              </label>
            )}
            {sourceFile && <p className="selected-file"><Icon name="file" /> {sourceFile.name}</p>}
            {error && <p className="validation-message" role="alert">{error}</p>}
            <div className="info-callout">
              <Icon name="info" />
              <p>
                You can refine and send the draft for PST validation before it's added to the
                <strong> Opportunity Library</strong>.
              </p>
            </div>
          </section>
          <HowItWorks activeStep={1} />
        </div>
      )}

      {sourceMode === "existing" && !validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
      <div className="bottom-actions">
        <button className="secondary-button large" type="button" onClick={() => onNavigate(`/projects/${project.id}/task`)}>
          <Icon name="arrow-left" />
          Back
        </button>
        {sourceMode === "existing" ? (
          <button className="primary-button large" type="button" disabled={!validation.valid || submitting} onClick={saveExistingAndContinue}>
            Continue to review setup
            <Icon name="arrow" />
          </button>
        ) : (
          <button className="primary-button large" type="button" disabled={submitting} onClick={submitNewSource}>
            Continue to review setup
            <Icon name="arrow" />
          </button>
        )}
      </div>
      {detailsDrawer && (
        <OpportunityAudienceDrawer
          drawer={detailsDrawer}
          opportunities={opportunities}
          selectedOpportunity={selectedOpportunity}
          selectedAudience={selectedAudience}
          suggestions={suggestions}
          activeSuggestionId={activeSuggestionId}
          selectedOutputs={selectedOutputs}
          onClose={closeDetailsDrawer}
          onSelectOpportunity={(id) => {
            updateSelection(id);
            closeDetailsDrawer();
          }}
          onEditSuggestion={(id, value) => setSuggestions((current) => editField(current, id, value))}
          onToggleOutput={(output) => setSelectedOutputs((current) => toggleOutput(current, output))}
        />
      )}
    </section>
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

function SetupPanel({
  suggestions,
  selectedOutputs,
  onEditSuggestion,
  onToggleOutput,
  onCustomizeDetails,
  onViewOutputOptions,
}: {
  suggestions: FieldValue[];
  selectedOutputs: OutputType[];
  onEditSuggestion: (id: string, value: string) => void;
  onToggleOutput: (output: OutputType) => void;
  onCustomizeDetails: (suggestionId?: string) => void;
  onViewOutputOptions: () => void;
}) {
  return (
    <section className="setup-stack">
      <div className="panel suggestions-panel">
        <h3>3. System suggestions <small>(based on KB, opportunity, and past work)</small></h3>
        <div className="suggestion-list">
          {suggestions.map((field) => (
            <label className="suggestion-row" key={field.id}>
              <span className="suggestion-icon"><Icon name={suggestionIcon(field.id)} /></span>
              <strong>{field.label}</strong>
              <input value={field.value} onChange={(event) => onEditSuggestion(field.id, event.currentTarget.value)} />
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  onCustomizeDetails(field.id);
                }}
              >
                Edit
              </button>
            </label>
          ))}
        </div>
        <button className="soft-button customize-button" type="button" onClick={() => onCustomizeDetails()}>
          Customize details
          <Icon name="sliders" />
        </button>
      </div>
      <div className="panel outputs-panel">
        <h3>4. Outputs to generate</h3>
        <p>You can generate multiple coordinated outputs from this opportunity.</p>
        <div className="output-grid">
          {functionalOutputs.map((output) => (
            <label className={`output-tile ${selectedOutputs.includes(output.id) ? "selected" : ""}`} key={output.id}>
              <input
                type="checkbox"
                checked={selectedOutputs.includes(output.id)}
                onChange={() => onToggleOutput(output.id)}
                disabled={selectedOutputs.length === 1 && selectedOutputs.includes(output.id)}
              />
              <strong>{output.label}</strong>
              <small>{output.description}</small>
            </label>
          ))}
          {futureOutputs.slice(0, 2).map((label) => (
            <label className="output-tile" key={label}>
              <input type="checkbox" disabled />
              <strong>{label}</strong>
            </label>
          ))}
        </div>
        <button className="ghost-link" type="button" onClick={onViewOutputOptions}>View all output options</button>
      </div>
    </section>
  );
}

function OpportunityAudienceDrawer({
  drawer,
  opportunities,
  selectedOpportunity,
  selectedAudience,
  suggestions,
  activeSuggestionId,
  selectedOutputs,
  onClose,
  onSelectOpportunity,
  onEditSuggestion,
  onToggleOutput,
}: {
  drawer: Exclude<DetailsDrawer, null>;
  opportunities: Opportunity[];
  selectedOpportunity: Opportunity | null;
  selectedAudience: AudienceProfile | null;
  suggestions: FieldValue[];
  activeSuggestionId: string | null;
  selectedOutputs: OutputType[];
  onClose: () => void;
  onSelectOpportunity: (id: string) => void;
  onEditSuggestion: (id: string, value: string) => void;
  onToggleOutput: (output: OutputType) => void;
}) {
  const drawerTitle = {
    opportunities: "All opportunities",
    "donor-profile": "Donor profile",
    "customize-details": "Customize details",
    "output-options": "All output options",
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
      {drawer === "customize-details" && (
        <>
          <p className="eyebrow">System suggestions</p>
          <h3>Customize details</h3>
          <div className="drawer-field-list">
            {suggestions.map((field) => (
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
      {drawer === "output-options" && (
        <>
          <p className="eyebrow">Output package</p>
          <h3>All output options</h3>
          <div className="output-option-list">
            {functionalOutputs.map((output) => (
              <label className={`drawer-card output-option ${selectedOutputs.includes(output.id) ? "selected" : ""}`} key={output.id}>
                <input
                  type="checkbox"
                  checked={selectedOutputs.includes(output.id)}
                  disabled={selectedOutputs.length === 1 && selectedOutputs.includes(output.id)}
                  onChange={() => onToggleOutput(output.id)}
                />
                <span>
                  <strong>{output.label}</strong>
                  <small>{output.description}</small>
                </span>
                <em>Available</em>
              </label>
            ))}
            {futureOutputs.map((label) => (
              <div className="drawer-card output-option disabled" key={label}>
                <input type="checkbox" disabled />
                <span>
                  <strong>{label}</strong>
                  <small>Reserved for a later workflow.</small>
                </span>
                <em>Coming soon</em>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HowItWorks({ activeStep }: { activeStep: number }) {
  const steps = [
    ["Upload approved materials", "Add source documents that have been reviewed and approved.", "clipboard"],
    ["We'll analyze your materials", "Our AI will extract key information and structure the opportunity.", "sparkles"],
    ["Review and refine", "Review the draft opportunity card and make any necessary edits.", "edit"],
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

function suggestionIcon(id: string): IconName {
  if (id.includes("relationship")) return "document";
  if (id.includes("geography")) return "profile";
  if (id.includes("persona")) return "profile";
  if (id.includes("technical")) return "presentation";
  return "target";
}

function sourceLabel(source: FieldValue["metadata"]["source"]) {
  if (source === "audience_profile") return "Audience profile";
  if (source === "ai_suggestion") return "AI suggestion";
  if (source === "opportunity") return "Opportunity";
  if (source === "extracted_source") return "Extracted source";
  return "User edited";
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
