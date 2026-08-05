import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../api/client";
import { Icon } from "../components/Icons";
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

type SourceInputMode = "file" | "paste" | "knowledge";

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
  const [opportunityId, setOpportunityId] = useState(existingState?.opportunityId || "");
  const [audienceId, setAudienceId] = useState(existingState?.audienceId || "");
  const [intendedOutcome, setIntendedOutcome] = useState(existingState?.intendedOutcome || "");
  const [selectedOutputs, setSelectedOutputs] = useState<OutputType[]>(existingState?.selectedOutputs?.length ? existingState.selectedOutputs : defaultSelectedOutputs);
  const [suggestions, setSuggestions] = useState<FieldValue[]>(existingState?.suggestions || []);
  const [query, setQuery] = useState("");
  const [sourceInputMode, setSourceInputMode] = useState<SourceInputMode>("paste");
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [knowledgeSourceId, setKnowledgeSourceId] = useState(config?.knowledgeSources[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    if (selectedOpportunity && selectedAudience && suggestions.length === 0) {
      setSuggestions(suggestionFromSelection(selectedOpportunity, selectedAudience));
    }
  }, [selectedOpportunity, selectedAudience, suggestions.length]);

  useEffect(() => {
    if (selectedOpportunity && selectedAudience) {
      setSuggestions((current) =>
        current.length ? current : suggestionFromSelection(selectedOpportunity, selectedAudience),
      );
    }
  }, [opportunityId, audienceId]);

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
      if (sourceInputMode === "file") {
        if (!sourceFile) throw new ApiError("Choose a PDF, DOCX, or TXT file.", 400);
        await api.extractFile(project.id, sourceFile);
      } else if (sourceInputMode === "knowledge") {
        const source = config?.knowledgeSources.find((item) => item.id === knowledgeSourceId);
        await api.extractKnowledgeSource(project.id, source?.title || "Synthetic knowledge-base source", knowledgeSourceId);
      } else {
        if (!sourceText.trim()) throw new ApiError("Paste synthetic source text before extraction.", 400);
        await api.extractText(project.id, "Pasted synthetic source", sourceText);
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
    if (!selectedOpportunity && audience && suggestions.length === 0) {
      setSuggestions([
        {
          id: "relationship_stage",
          label: "Relationship stage",
          value: audience.relationshipStage,
          provenanceLabel: "Suggested from demo profile",
          metadata: { source: "audience_profile", required: true, editable: true, confirmed: false, confidence: 0.82 },
        },
        {
          id: "narrative_approach",
          label: "Narrative approach",
          value: audience.narrativeApproach,
          provenanceLabel: "Suggested from demo profile",
          metadata: { source: "audience_profile", required: true, editable: true, confirmed: false, confidence: 0.82 },
        },
      ]);
    }
  }

  const sourceReady =
    sourceInputMode === "file" ? Boolean(sourceFile) : sourceInputMode === "knowledge" ? Boolean(knowledgeSourceId) : Boolean(sourceText.trim());
  const newPathReady = Boolean(audienceId && intendedOutcome && selectedOutputs.length && sourceReady);

  return (
    <section className="wizard-page">
      <div className="page-title">
        <p className="eyebrow">Step 2</p>
        <h2>Opportunity and audience</h2>
      </div>
      <div className="segmented-control" role="tablist" aria-label="Opportunity source mode">
        <button type="button" className={sourceMode === "existing" ? "active" : ""} onClick={() => setSourceMode("existing")}>
          Search existing opportunity
        </button>
        <button type="button" className={sourceMode === "new" ? "active" : ""} onClick={() => setSourceMode("new")}>
          Create new opportunity
        </button>
      </div>
      {sourceMode === "existing" ? (
        <div className="three-column">
          <section className="panel">
            <h3>Opportunity search and recommendations</h3>
            <input className="search-input" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search synthetic opportunities" />
            <div className="stack-list scroll-list">
              {filteredOpportunities.map((opportunity) => (
                <button
                  key={opportunity.id}
                  type="button"
                  className={`select-row ${opportunityId === opportunity.id ? "selected" : ""}`}
                  onClick={() => updateSelection(opportunity.id)}
                >
                  <span>
                    <strong>{opportunity.title}</strong>
                    <small>{opportunity.summary}</small>
                  </span>
                  <span className="status-pill">{opportunity.validationStatus}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="panel">
            <h3>Audience and intended meeting outcome</h3>
            <div className="stack-list">
              {audiences.map((audience) => (
                <button
                  key={audience.id}
                  type="button"
                  className={`select-row ${audienceId === audience.id ? "selected" : ""}`}
                  onClick={() => updateAudience(audience.id)}
                >
                  <span>
                    <strong>{audience.name}</strong>
                    <small>{audience.audienceType} - {audience.familiarity}</small>
                  </span>
                  <a href={audience.profileUrl} onClick={(event) => event.preventDefault()}>View mock profile</a>
                </button>
              ))}
            </div>
            <label className="field-block compact">
              <span>Intended meeting outcome</span>
              <select value={intendedOutcome} onChange={(event) => setIntendedOutcome(event.currentTarget.value)} required>
                <option value="">Select outcome</option>
                {intendedOutcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}
              </select>
            </label>
          </section>
          <SetupColumn
            selectedOpportunity={selectedOpportunity}
            suggestions={suggestions}
            selectedOutputs={selectedOutputs}
            onEditSuggestion={(id, value) => setSuggestions((current) => editField(current, id, value))}
            onToggleOutput={(output) => setSelectedOutputs((current) => toggleOutput(current, output))}
          />
        </div>
      ) : (
        <div className="two-column uneven">
          <section className="panel">
            <h3>Phase 1 temporary processing</h3>
            <p className="muted">Sources are sent only to the FastAPI backend for temporary mock extraction.</p>
            <div className="segmented-control small" role="tablist" aria-label="Source input method">
              <button type="button" className={sourceInputMode === "paste" ? "active" : ""} onClick={() => setSourceInputMode("paste")}>Paste text</button>
              <button type="button" className={sourceInputMode === "file" ? "active" : ""} onClick={() => setSourceInputMode("file")}>File</button>
              <button type="button" className={sourceInputMode === "knowledge" ? "active" : ""} onClick={() => setSourceInputMode("knowledge")}>Knowledge source</button>
            </div>
            {sourceInputMode === "paste" && (
              <label className="field-block">
                <span>Pasted source text</span>
                <textarea value={sourceText} onChange={(event) => setSourceText(event.currentTarget.value)} placeholder="Paste synthetic source material for the mock extraction." />
              </label>
            )}
            {sourceInputMode === "file" && (
              <label className="upload-box">
                <span>Choose PDF, DOCX, or TXT</span>
                <small>Conservative Phase 1 limit: {config?.maxUploadMb || 2} MB</small>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => setSourceFile(event.currentTarget.files?.[0] || null)}
                />
              </label>
            )}
            {sourceInputMode === "knowledge" && (
              <label className="field-block compact">
                <span>Synthetic Knowledge Base source</span>
                <select value={knowledgeSourceId} onChange={(event) => setKnowledgeSourceId(event.currentTarget.value)}>
                  {(config?.knowledgeSources || []).map((source) => (
                    <option key={source.id} value={source.id}>{source.title}</option>
                  ))}
                </select>
              </label>
            )}
            {error && <p className="validation-message" role="alert">{error}</p>}
          </section>
          <section className="panel">
            <h3>Audience and outputs</h3>
            <label className="field-block compact">
              <span>Audience or partner</span>
              <select value={audienceId} onChange={(event) => updateAudience(event.currentTarget.value)}>
                <option value="">Select audience</option>
                {audiences.map((audience) => <option value={audience.id} key={audience.id}>{audience.name}</option>)}
              </select>
            </label>
            <label className="field-block compact">
              <span>Intended meeting outcome</span>
              <select value={intendedOutcome} onChange={(event) => setIntendedOutcome(event.currentTarget.value)}>
                <option value="">Select outcome</option>
                {intendedOutcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}
              </select>
            </label>
            <OutputSelector selectedOutputs={selectedOutputs} onToggleOutput={(output) => setSelectedOutputs((current) => toggleOutput(current, output))} />
          </section>
        </div>
      )}
      {sourceMode === "existing" && !validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
      <div className="action-row split">
        <button className="secondary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/task`)}>
          Back
        </button>
        {sourceMode === "existing" ? (
          <button className="primary-button" type="button" disabled={!validation.valid || submitting} onClick={saveExistingAndContinue}>
            Continue
            <Icon name="arrow" />
          </button>
        ) : (
          <button className="primary-button" type="button" disabled={!newPathReady || submitting} onClick={submitNewSource}>
            Run mock extraction
            <Icon name="arrow" />
          </button>
        )}
      </div>
    </section>
  );
}

function SetupColumn({
  selectedOpportunity,
  suggestions,
  selectedOutputs,
  onEditSuggestion,
  onToggleOutput,
}: {
  selectedOpportunity: Opportunity | null;
  suggestions: FieldValue[];
  selectedOutputs: OutputType[];
  onEditSuggestion: (id: string, value: string) => void;
  onToggleOutput: (output: OutputType) => void;
}) {
  return (
    <section className="panel">
      <h3>System suggestions and outputs</h3>
      {selectedOpportunity && (
        <div className="summary-box">
          <span className="status-pill">{selectedOpportunity.validationStatus}</span>
          <h4>{selectedOpportunity.title}</h4>
          <p>{selectedOpportunity.summary}</p>
          <dl>
            <div><dt>Funding range</dt><dd>{selectedOpportunity.fundingRange}</dd></div>
            <div><dt>Why now</dt><dd>{selectedOpportunity.whyNow}</dd></div>
            <div><dt>Reach</dt><dd>{selectedOpportunity.reach}</dd></div>
            <div><dt>Sources</dt><dd>{selectedOpportunity.sourceList.map((source) => source.title).join(", ")}</dd></div>
          </dl>
        </div>
      )}
      <div className="suggestion-list">
        {suggestions.map((field) => (
          <label className={`suggestion-field source-${field.metadata.source}`} key={field.id}>
            <span>
              {field.label}
              <small>{field.provenanceLabel}</small>
            </span>
            <input value={field.value} onChange={(event) => onEditSuggestion(field.id, event.currentTarget.value)} disabled={!field.metadata.editable} />
          </label>
        ))}
      </div>
      <OutputSelector selectedOutputs={selectedOutputs} onToggleOutput={onToggleOutput} />
    </section>
  );
}

function OutputSelector({
  selectedOutputs,
  onToggleOutput,
}: {
  selectedOutputs: OutputType[];
  onToggleOutput: (output: OutputType) => void;
}) {
  return (
    <div className="output-selector">
      <h4>Outputs</h4>
      {functionalOutputs.map((output) => (
        <label className="checkbox-row" key={output.id}>
          <input
            type="checkbox"
            checked={selectedOutputs.includes(output.id)}
            onChange={() => onToggleOutput(output.id)}
            disabled={selectedOutputs.length === 1 && selectedOutputs.includes(output.id)}
          />
          <span>
            <strong>{output.label}</strong>
            <small>{output.description}</small>
          </span>
        </label>
      ))}
      {futureOutputs.map((label) => (
        <label className="checkbox-row disabled" key={label}>
          <input type="checkbox" disabled />
          <span>
            <strong>{label}</strong>
            <small>Future phase</small>
          </span>
        </label>
      ))}
    </div>
  );
}
