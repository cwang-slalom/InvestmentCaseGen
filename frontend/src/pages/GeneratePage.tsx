import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import {
  activeStageIndexForProgress,
  estimatedGenerationPercent,
  estimatedOutputPercent,
  estimatedRemainingLabel,
  formatGenerationDuration,
} from "../state/generation";
import { functionalOutputs, futureOutputs, generationStages } from "../state/options";
import { toggleOutput } from "../state/workflow";
import type { AppConfig, FieldValue, GenerationJobStatus, GenerationResult, OutputType, Project } from "../types";

const GENERATION_POLL_INTERVAL_MS = 3000;

type GeneratePageProps = {
  project: Project;
  config?: AppConfig | null;
  generation?: GenerationResult | null;
  onProject: (project: Project) => void;
  onGeneration: (generation: GenerationResult) => void;
  onNavigate: (path: string) => void;
};

export function GeneratePage({ project, config, generation, onProject, onGeneration, onNavigate }: GeneratePageProps) {
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cancelNotice, setCancelNotice] = useState("");
  const [selectionSaving, setSelectionSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const generationPromiseRef = useRef<Promise<GenerationResult | null> | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationRunRef = useRef(0);
  const selectedOutputs = project.opportunityAudience?.selectedOutputs || [];
  const currentGeneration = generation?.projectId === project.id ? generation : null;
  const liveModelReady = config?.mode === "live";
  const hasGeneration = Boolean(project.generationId || currentGeneration?.generationId);
  const complete = Boolean(project.generationId || currentGeneration?.status === "completed");
  const generationFailed = liveModelReady && Boolean(error) && !generating && !complete;
  const progress = complete
    ? 100
    : !liveModelReady
      ? 0
      : generating || generationFailed
        ? estimatedGenerationPercent(elapsedSeconds)
        : 0;
  const activeStageIndex = activeStageIndexForProgress(progress);
  const canEditOutputs = !generating && !selectionSaving && !hasGeneration;
  const outputCards = generationOutputCards(selectedOutputs, complete, liveModelReady, generationFailed, generating, canEditOutputs, progress);
  const approachFields = project.reviewSetup?.approachFields || [];
  const narrativeStyle = settingValue(approachFields, "narrative_style");
  const tone = settingValue(approachFields, "tone");
  const technicalDepth = settingValue(approachFields, "technical_depth");
  const evidenceDensity = settingValue(approachFields, "evidence_density");
  const externalWebSearch = settingValue(approachFields, "external_web_search");

  const applyGenerationStatus = useCallback(async (status: GenerationJobStatus, runId: number) => {
    if (generationRunRef.current !== runId) return null;

    if (status.state === "completed" && status.result) {
      onGeneration(status.result);
      const refreshed = await api.project(project.id);
      if (generationRunRef.current === runId) {
        onProject(refreshed);
      }
      return status.result;
    }

    if (status.state === "completed") {
      setError("Generation completed but no output payload was returned.");
    }

    if (status.state === "failed") {
      setError(status.error || status.message || "Generation could not be completed.");
    }

    return null;
  }, [onGeneration, onProject, project.id]);

  const pollGenerationUntilComplete = useCallback(async (initialStatus: GenerationJobStatus, runId: number) => {
    let status = initialStatus;
    while (generationRunRef.current === runId) {
      const result = await applyGenerationStatus(status, runId);
      if (result || status.state === "completed" || status.state === "failed" || status.state === "idle") {
        return result;
      }

      await wait(GENERATION_POLL_INTERVAL_MS);
      if (generationRunRef.current !== runId) {
        return null;
      }
      status = await api.generationStatus(project.id);
    }
    return null;
  }, [applyGenerationStatus, project.id]);

  const runGeneration = useCallback(async () => {
    if (!liveModelReady) {
      setError(config?.backend.message || "Live model generation is required before outputs can be generated.");
      return null;
    }
    if (project.generationId) return null;
    if (generationPromiseRef.current) return generationPromiseRef.current;

    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;
    setGenerating(true);
    setGenerationStartedAt(Date.now());
    setElapsedSeconds(0);
    setError("");
    setCancelNotice("");
    const abortController = new AbortController();
    generationAbortRef.current = abortController;
    const request = api.generate(project.id, false, { signal: abortController.signal })
      .then((status) => pollGenerationUntilComplete(status, runId))
      .catch((apiError) => {
        if (isAbortError(apiError)) {
          setCancelNotice("Stopped watching this generation. It may continue running in the background.");
          setError("");
          return null;
        }
        setError(apiError instanceof Error ? apiError.message : "Generation could not be completed.");
        return null;
      })
      .finally(() => {
        if (generationRunRef.current === runId) {
          generationPromiseRef.current = null;
          generationAbortRef.current = null;
          setGenerating(false);
        }
      });

    generationPromiseRef.current = request;
    return request;
  }, [config?.backend.message, liveModelReady, pollGenerationUntilComplete, project.generationId, project.id]);

  const stopWatchingGeneration = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    generationRunRef.current += 1;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    generationPromiseRef.current = null;
    setGenerating(false);
    setCancelNotice("Stopped watching this generation. It may continue running in the background.");
    setError("");
  }, []);

  const toggleOutputSelection = useCallback(async (output: OutputType) => {
    const opportunityAudience = project.opportunityAudience;
    if (!opportunityAudience || !canEditOutputs) return;

    const nextOutputs = toggleOutput(selectedOutputs, output);
    if (nextOutputs === selectedOutputs) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    setSelectionSaving(true);
    setError("");
    try {
      const updated = await api.updateOpportunityAudience(project.id, {
        sourceMode: opportunityAudience.sourceMode,
        opportunityId: opportunityAudience.opportunityId || null,
        audienceId: opportunityAudience.audienceId || null,
        intendedOutcome: opportunityAudience.intendedOutcome || null,
        suggestions: opportunityAudience.suggestions,
        selectedOutputs: nextOutputs,
      });
      onProject(updated);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Output selection could not be updated.");
    } finally {
      setSelectionSaving(false);
    }
  }, [canEditOutputs, onProject, project.id, project.opportunityAudience, selectedOutputs]);

  useEffect(() => {
    if (!liveModelReady) return;
    if (project.generationId) return;
    timerRef.current = window.setTimeout(() => {
      void runGeneration();
    }, 18000);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [liveModelReady, project.generationId, runGeneration]);

  useEffect(() => {
    if (!generating || generationStartedAt === null) return;

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - generationStartedAt) / 1000));
    };
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [generating, generationStartedAt]);

  useEffect(() => {
    return () => {
      generationRunRef.current += 1;
      generationAbortRef.current?.abort();
    };
  }, []);

  async function viewResults() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!project.generationId && !currentGeneration?.generationId) {
      const nextGeneration = await runGeneration();
      if (!nextGeneration) return;
    }
    onNavigate(`/projects/${project.id}/results`);
  }

  return (
    <section className="wizard-page generate-page">
      <div className="page-title-row">
        <div className="page-title">
          <p className="eyebrow">Step 4 of 4</p>
          <h2>Generate materials</h2>
          <p>We're generating your content package. You can track progress below.</p>
        </div>
        <button className="outline-action" type="button" onClick={() => onNavigate(`/projects/${project.id}/review-setup`)}>
          <Icon name="sliders" />
          View setup summary
        </button>
      </div>

      <div className="generation-grid">
        <section className="panel progress-panel">
          <h3>Generation progress</h3>
          <div className="progress-content">
            <div className="stage-list">
              {generationStages.map((stage, index) => {
                const status = generationStageStatus(index, complete, liveModelReady, generationFailed, generating, activeStageIndex);
                return (
                  <div className={`stage-row ${status}`} key={stage}>
                    <span>
                      {status === "completed" ? (
                        <Icon name="check" />
                      ) : (
                        <Icon name={status === "failed" ? "warning" : status === "in-progress" ? "circle-check" : "clock"} />
                      )}
                    </span>
                    <strong>{stage}</strong>
                    <em>{generationStatusLabel(status)}</em>
                  </div>
                );
              })}
            </div>
            <div className={`progress-ring ${generationFailed ? "failed" : ""}`} style={{ "--progress": `${progress}%` } as CSSProperties}>
              <span>{progress}%</span>
              <small>{progressStatusLabel(complete, liveModelReady, generationFailed, generating)}</small>
            </div>
          </div>
          <div
            className={`generation-meter ${complete ? "completed" : generationFailed ? "failed" : generating ? "active" : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="generation-meter-copy">
              <strong>{progressHeadline(complete, liveModelReady, generationFailed, generating, activeStageIndex)}</strong>
              <span>{progressMetaLabel(complete, liveModelReady, generationFailed, generating, elapsedSeconds)}</span>
            </div>
            <div className="generation-meter-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="duration-note">
            {generating
              ? "Estimated progress. Final completion depends on the model response."
              : complete
                ? "Generation completed. Results are ready for review."
                : "This usually takes 2-4 minutes once generation starts."}
          </p>
          <div className="info-callout slim">
            <Icon name="info" />
            <p>
              {liveModelReady
                ? progressCalloutLabel(complete, generating)
                : config?.backend.message || "Live model generation is required before outputs can be generated."}
            </p>
          </div>
          {error && <p className="validation-message" role="alert">{error}</p>}
          {cancelNotice && !error && <p className="generation-cancel-message" role="status">{cancelNotice}</p>}
        </section>

        <section className="panel outputs-generation-panel">
          <h3>{complete ? "Generated outputs" : generating ? "Outputs being generated" : generationFailed ? "Generation failed" : "Outputs selected"} ({selectedOutputs.length})</h3>
          <div className="generated-output-grid">
            {outputCards.map((output) => (
              <article className={`generated-output-card ${output.status}`} key={output.label}>
                <span className={`generated-icon ${output.tone}`}><Icon name={output.icon} /></span>
                <input
                  type="checkbox"
                  checked={output.checked}
                  disabled={output.disabled}
                  onChange={() => output.id && void toggleOutputSelection(output.id)}
                  title={output.disabledReason || undefined}
                  aria-label={`${output.checked ? "Remove" : "Add"} ${output.label}`}
                />
                <strong>{output.label}</strong>
                {output.description && <small>{output.description}</small>}
                <em>{output.statusLabel}</em>
                {output.disabledReason && output.status !== "failed" && <small className="output-lock-note">{output.disabledReason}</small>}
                {output.percent && <div className="mini-progress"><span style={{ width: output.percent }} /></div>}
                {output.percent && <b>{output.percent}</b>}
                {output.done && <Icon name="check" />}
              </article>
            ))}
          </div>
          <div className="generation-settings">
            <strong>Generation settings</strong>
            <p>
              Narrative style: {narrativeStyle}&nbsp;&nbsp;•&nbsp;&nbsp;Tone: {tone}&nbsp;&nbsp;•&nbsp;&nbsp;Technical depth: {technicalDepth}
            </p>
            <p>Evidence density: {evidenceDensity}&nbsp;&nbsp;•&nbsp;&nbsp;External web search: {externalWebSearch}</p>
            <button type="button" onClick={() => setSettingsOpen(true)}>View all settings <Icon name="arrow" /></button>
          </div>
          {!complete && (
            <p className="output-selection-hint">
              You can adjust functional outputs here until generation starts. At least one output must stay selected.
            </p>
          )}
        </section>
      </div>

      <section className="next-steps-band">
        <h3><Icon name="sparkles" /> What happens next?</h3>
        <div className="next-step-columns">
          <div>
            <Icon name="users" />
            <strong>1. Review outputs</strong>
            <p>You'll be able to review and approve each output in the next step.</p>
          </div>
          <div>
            <Icon name="edit" />
            <strong>2. Make edits</strong>
            <p>Request changes or regenerate specific outputs as needed.</p>
          </div>
          <div>
            <Icon name="template" />
            <strong>3. Reuse and save</strong>
            <p>Save approved outputs to your project or as templates.</p>
          </div>
        </div>
      </section>

      <div className="bottom-actions">
        <button className="secondary-button large" type="button" onClick={() => onNavigate(`/projects/${project.id}/review-setup`)}>
          <Icon name="arrow-left" />
          Back
        </button>
        <div className="right-actions">
          <button className="secondary-button large" type="button" onClick={() => onNavigate("/projects")}>
            Save and exit
          </button>
          {generating && (
            <button className="secondary-button large" type="button" onClick={stopWatchingGeneration}>
              <Icon name="close" />
              Stop watching
            </button>
          )}
          <button className="primary-button large" type="button" disabled={(!liveModelReady && !hasGeneration) || generating || selectionSaving} onClick={viewResults}>
            {hasGeneration ? "View results" : !liveModelReady ? "Configure model to generate" : generating ? "Generating results..." : generationFailed ? "Retry generation" : "View results"}
          </button>
        </div>
      </div>
      {settingsOpen && (
        <GenerationSettingsDrawer
          project={project}
          selectedOutputs={selectedOutputs}
          onClose={() => setSettingsOpen(false)}
          onEditSetup={() => onNavigate(`/projects/${project.id}/review-setup`)}
        />
      )}
    </section>
  );
}

function settingValue(fields: FieldValue[] | undefined, id: string) {
  return fields?.find((field) => field.id === id)?.value || "Unresolved";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function generationStageStatus(
  index: number,
  complete: boolean,
  liveModelReady: boolean,
  generationFailed: boolean,
  generating: boolean,
  activeStageIndex: number,
) {
  if (complete) return "completed";
  if (!liveModelReady) return "queued";
  if (generationFailed) return index < activeStageIndex ? "completed" : index === activeStageIndex ? "failed" : "queued";
  if (!generating) return "queued";
  return index < activeStageIndex ? "completed" : index === activeStageIndex ? "in-progress" : "queued";
}

function generationStatusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "in-progress") return "In progress";
  return "Queued";
}

function progressStatusLabel(complete: boolean, liveModelReady: boolean, generationFailed: boolean, generating: boolean) {
  if (complete) return "Completed";
  if (!liveModelReady) return "Model required";
  if (generationFailed) return "Failed";
  if (!generating) return "Ready";
  return "In progress";
}

function progressHeadline(
  complete: boolean,
  liveModelReady: boolean,
  generationFailed: boolean,
  generating: boolean,
  activeStageIndex: number,
) {
  if (complete) return "Materials are ready for review.";
  if (!liveModelReady) return "Connect a live model before generation can start.";
  if (generationFailed) return "Generation failed before completion.";
  if (!generating) return "Generation will start automatically, or when you view results.";
  return generationStages[activeStageIndex];
}

function progressMetaLabel(
  complete: boolean,
  liveModelReady: boolean,
  generationFailed: boolean,
  generating: boolean,
  elapsedSeconds: number,
) {
  if (complete) return "Elapsed time is no longer updating.";
  if (!liveModelReady) return "No model request has been sent.";
  if (generationFailed) return `Failed after ${formatGenerationDuration(elapsedSeconds)}.`;
  if (!generating) return "You can still adjust selected outputs.";
  return `Elapsed ${formatGenerationDuration(elapsedSeconds)} · ${estimatedRemainingLabel(elapsedSeconds)}`;
}

function progressCalloutLabel(complete: boolean, generating: boolean) {
  if (complete) return "Your materials are ready. Continue to results for human review and edits.";
  if (generating) return "Keep this page open while the model works; progress will continue updating here.";
  return "You can still adjust selected outputs until generation starts.";
}

function outputCardStatus(
  checked: boolean,
  complete: boolean,
  liveModelReady: boolean,
  generationFailed: boolean,
  active: boolean,
  outputPercent: number,
) {
  if (!checked) return "not-selected";
  if (complete) return "completed";
  if (generationFailed) return "failed";
  if (!liveModelReady) return "queued";
  if (active && outputPercent > 0) return "in-progress";
  return "queued";
}

function outputCardStatusLabel(
  checked: boolean,
  complete: boolean,
  liveModelReady: boolean,
  generationFailed: boolean,
  active: boolean,
  outputPercent: number,
) {
  if (!checked) return "Not selected";
  if (complete) return "Completed";
  if (generationFailed) return "Failed";
  if (!liveModelReady) return "Model required";
  if (!active) return "Selected";
  if (outputPercent === 0) return "Queued";
  return outputPercent >= 88 ? "Finalizing" : "In progress";
}

function GenerationSettingsDrawer({
  project,
  selectedOutputs,
  onClose,
  onEditSetup,
}: {
  project: Project;
  selectedOutputs: string[];
  onClose: () => void;
  onEditSetup: () => void;
}) {
  const approachFields = project.reviewSetup?.approachFields || [];
  const roles = project.reviewSetup?.roles || [];
  const sourceReadiness = project.reviewSetup?.sourceReadiness;

  return (
    <div className="drawer details-drawer" role="dialog" aria-modal="true" aria-label="All generation settings">
      <button className="icon-button drawer-close" type="button" title="Close" onClick={onClose}>
        <Icon name="close" />
      </button>
      <p className="eyebrow">Generation settings</p>
      <h3>All settings</h3>
      <h4>Approach</h4>
      <div className="drawer-field-list">
        {approachFields.map((field) => (
          <div className="drawer-field readonly" key={field.id}>
            <span>
              <strong>{field.label}</strong>
              <small>{field.provenanceLabel}</small>
            </span>
            <p>{field.value}</p>
            <em>{field.metadata.required ? "Required" : "Optional"}</em>
          </div>
        ))}
      </div>
      <h4>Outputs</h4>
      <div className="output-option-list">
        {functionalOutputs.map((output) => (
          <div className={`drawer-card output-option ${selectedOutputs.includes(output.id) ? "selected" : ""}`} key={output.id}>
            <input type="checkbox" checked={selectedOutputs.includes(output.id)} readOnly />
            <span>
              <strong>{output.label}</strong>
              <small>{output.description}</small>
            </span>
            <em>{selectedOutputs.includes(output.id) ? "Included" : "Not included"}</em>
          </div>
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
      <h4>Review and sources</h4>
      <dl className="drawer-metadata-grid">
        <div><dt>Selected reviewers</dt><dd>{roles.filter((role) => role.selected).map((role) => role.label).join(", ") || "Unresolved"}</dd></div>
        <div><dt>External-use readiness</dt><dd>{sourceReadiness?.ready ? "Ready" : "Needs review"}</dd></div>
        <div><dt>Readiness checks</dt><dd>{sourceReadiness?.checks.join(", ") || "Unresolved"}</dd></div>
      </dl>
      <div className="drawer-actions">
        <button className="secondary-button" type="button" onClick={onEditSetup}>Edit setup</button>
        <button className="primary-button" type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function generationOutputCards(
  selectedOutputs: string[],
  complete: boolean,
  liveModelReady: boolean,
  generationFailed: boolean,
  generating: boolean,
  canEditOutputs: boolean,
  progress: number,
) {
  const selectedProgressSlots = functionalOutputs
    .filter((output) => selectedOutputs.includes(output.id))
    .map((output) => output.id);

  const functionalCards = functionalOutputs.map((output) => {
    const checked = selectedOutputs.includes(output.id);
    const selectedIndex = selectedProgressSlots.indexOf(output.id);
    const lockedAsLastSelection = checked && selectedOutputs.length === 1;
    const disabledReason = !canEditOutputs
      ? complete
        ? "Generated outputs are locked."
        : generating
          ? "Generation is already running."
          : undefined
      : lockedAsLastSelection
        ? "At least one output is required."
        : undefined;
    const disabled = Boolean(disabledReason);
    const active = checked && liveModelReady && generating && !generationFailed;
    const outputPercent = active ? estimatedOutputPercent(progress, selectedIndex) : 0;
    const percent = active && outputPercent > 0 ? `${outputPercent}%` : "";
    const status = outputCardStatus(checked, complete, liveModelReady, generationFailed, active, outputPercent);
    const statusLabel = outputCardStatusLabel(checked, complete, liveModelReady, generationFailed, active, outputPercent);

    return {
      id: output.id,
      label: output.label,
      description: output.description,
      checked,
      disabled,
      disabledReason,
      icon: output.id === "talking_points" ? "file" : "document",
      tone: output.id === "talking_points" ? "green" : "blue",
      status,
      statusLabel,
      percent,
      done: checked && liveModelReady && complete,
    };
  });

  const futureCards = futureOutputs.map((label) => ({
    label,
    description: label === "Technical annex (Internal)" ? "" : undefined,
    checked: false,
    disabled: true,
    disabledReason: "Reserved for a later workflow.",
    icon: "document",
    tone: "blue",
    status: "not-selected",
    statusLabel: "Coming soon",
    percent: "",
    done: false,
  }));

  return [...functionalCards, ...futureCards] as Array<{
    id?: OutputType;
    label: string;
    description?: string;
    checked: boolean;
    disabled: boolean;
    disabledReason?: string;
    icon: IconName;
    tone: string;
    status: string;
    statusLabel: string;
    percent: string;
    done: boolean;
  }>;
}
