import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import { functionalOutputs, futureOutputs, generationStages } from "../state/options";
import type { AppConfig, GenerationResult, Project } from "../types";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const generationPromiseRef = useRef<Promise<GenerationResult | null> | null>(null);
  const selectedOutputs = project.opportunityAudience?.selectedOutputs || [];
  const currentGeneration = generation?.projectId === project.id ? generation : null;
  const liveModelReady = config?.mode === "live";
  const complete = Boolean(project.generationId || currentGeneration?.status === "completed");
  const progress = !liveModelReady ? 0 : complete ? 100 : generating ? 78 : 65;
  const outputCards = generationOutputCards(selectedOutputs, complete, liveModelReady);

  const runGeneration = useCallback(async () => {
    if (!liveModelReady) {
      setError(config?.backend.message || "Live model generation is required before outputs can be generated.");
      return null;
    }
    if (project.generationId) return null;
    if (generationPromiseRef.current) return generationPromiseRef.current;

    setGenerating(true);
    setError("");
    const request = api.generate(project.id, false)
      .then(async (nextGeneration) => {
        onGeneration(nextGeneration);
        const refreshed = await api.project(project.id);
        onProject(refreshed);
        return nextGeneration;
      })
      .catch((apiError) => {
        setError(apiError instanceof Error ? apiError.message : "Generation could not be completed.");
        return null;
      })
      .finally(() => {
        generationPromiseRef.current = null;
        setGenerating(false);
      });

    generationPromiseRef.current = request;
    return request;
  }, [config?.backend.message, liveModelReady, onGeneration, onProject, project.generationId, project.id]);

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
                const status = !liveModelReady ? "queued" : complete ? "completed" : index < 2 ? "completed" : index === 2 ? "in-progress" : "queued";
                return (
                  <div className={`stage-row ${status}`} key={stage}>
                    <span>{status === "completed" ? <Icon name="check" /> : <Icon name={status === "in-progress" ? "circle-check" : "clock"} />}</span>
                    <strong>{stage}</strong>
                    <em>{status === "completed" ? "Completed" : status === "in-progress" ? "In progress" : "Queued"}</em>
                  </div>
                );
              })}
            </div>
            <div className="progress-ring" style={{ "--progress": `${progress}%` } as CSSProperties}>
              <span>{progress}%</span>
              <small>{!liveModelReady ? "Model required" : complete ? "Completed" : "In progress"}</small>
            </div>
          </div>
          <p className="duration-note">This usually takes 2-4 minutes.</p>
          <div className="info-callout slim">
            <Icon name="info" />
            <p>
              {liveModelReady
                ? "You'll be notified when your materials are ready."
                : config?.backend.message || "Live model generation is required before outputs can be generated."}
            </p>
          </div>
          {error && <p className="validation-message" role="alert">{error}</p>}
        </section>

        <section className="panel outputs-generation-panel">
          <h3>Outputs being generated ({outputCards.length})</h3>
          <div className="generated-output-grid">
            {outputCards.map((output) => (
              <article className={`generated-output-card ${output.status}`} key={output.label}>
                <span className={`generated-icon ${output.tone}`}><Icon name={output.icon} /></span>
                <input type="checkbox" checked={output.checked} readOnly />
                <strong>{output.label}</strong>
                {output.description && <small>{output.description}</small>}
                <em>{output.statusLabel}</em>
                {output.percent && <div className="mini-progress"><span style={{ width: output.percent }} /></div>}
                {output.percent && <b>{output.percent}</b>}
                {output.done && <Icon name="check" />}
              </article>
            ))}
          </div>
          <div className="generation-settings">
            <strong>Generation settings</strong>
            <p>
              Narrative style: Innovation-focused&nbsp;&nbsp;•&nbsp;&nbsp;Tone: Balanced and credible&nbsp;&nbsp;•&nbsp;&nbsp;Technical depth: Moderate
            </p>
            <p>Evidence density: High&nbsp;&nbsp;•&nbsp;&nbsp;External web search: Enabled (4-6 sources)</p>
            <button type="button" onClick={() => setSettingsOpen(true)}>View all settings <Icon name="arrow" /></button>
          </div>
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
          <button className="primary-button large" type="button" disabled={!liveModelReady || generating} onClick={viewResults}>
            {!liveModelReady ? "Configure model to generate" : generating ? "Generating results..." : "View results"}
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

function generationOutputCards(selectedOutputs: string[], complete: boolean, liveModelReady: boolean) {
  const functionalCards = functionalOutputs.map((output, index) => ({
    label: output.label,
    description: output.description,
    checked: selectedOutputs.includes(output.id),
    icon: output.id === "talking_points" ? "file" : "document",
    tone: output.id === "talking_points" ? "green" : "blue",
    status: !liveModelReady ? "queued" : complete ? "completed" : index === 0 ? "in-progress" : index === 1 ? "in-progress" : index === 2 ? "completed" : "queued",
    statusLabel: !liveModelReady ? "Model required" : complete ? "Completed" : index === 0 ? "In progress" : index === 1 ? "In progress" : index === 2 ? "Completed" : "Queued",
    percent: !liveModelReady || complete ? "" : index === 0 ? "65%" : index === 1 ? "55%" : "",
    done: liveModelReady && (complete || index === 2),
  }));

  const futureCards = futureOutputs.map((label) => ({
    label,
    description: label === "Technical annex (Internal)" ? "" : undefined,
    checked: false,
    icon: "document",
    tone: "blue",
    status: "queued",
    statusLabel: "Queued",
    percent: "",
    done: false,
  }));

  return [...functionalCards, ...futureCards] as Array<{
    label: string;
    description?: string;
    checked: boolean;
    icon: IconName;
    tone: string;
    status: string;
    statusLabel: string;
    percent: string;
    done: boolean;
  }>;
}
