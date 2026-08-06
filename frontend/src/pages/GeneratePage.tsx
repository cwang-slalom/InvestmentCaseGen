import { useEffect, useRef, useState, type CSSProperties } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
import { functionalOutputs, futureOutputs, generationStages } from "../state/options";
import type { GenerationResult, Project } from "../types";

type GeneratePageProps = {
  project: Project;
  onProject: (project: Project) => void;
  onGeneration: (generation: GenerationResult) => void;
  onNavigate: (path: string) => void;
};

export function GeneratePage({ project, onProject, onGeneration, onNavigate }: GeneratePageProps) {
  const progress = 65;
  const complete = false;
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const selectedOutputs = project.opportunityAudience?.selectedOutputs || [];

  useEffect(() => {
    if (project.generationId || startedRef.current) return;
    startedRef.current = true;
    const timer = window.setTimeout(() => {
      api.generate(project.id, false)
        .then(async (generation) => {
          onGeneration(generation);
          const refreshed = await api.project(project.id);
          onProject(refreshed);
        })
        .catch((apiError) => {
          setError(apiError instanceof Error ? apiError.message : "Generation could not be completed.");
        });
    }, 18000);

    return () => window.clearTimeout(timer);
  }, [onGeneration, onProject, project.generationId, project.id]);

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
                const status = complete ? "completed" : index < 2 ? "completed" : index === 2 ? "in-progress" : "queued";
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
              <small>{complete ? "Completed" : "In progress"}</small>
            </div>
          </div>
          <p className="duration-note">This usually takes 2-4 minutes.</p>
          <div className="info-callout slim">
            <Icon name="info" />
            <p>You'll be notified when your materials are ready.</p>
          </div>
          {error && <p className="validation-message" role="alert">{error}</p>}
        </section>

        <section className="panel outputs-generation-panel">
          <h3>Outputs being generated (7)</h3>
          <div className="generated-output-grid">
            {generationOutputCards(selectedOutputs).map((output) => (
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
            <button type="button">View all settings <Icon name="arrow" /></button>
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
          <button className="primary-button large disabled-look" type="button" disabled={!complete}>
            View results (coming soon)
          </button>
        </div>
      </div>
    </section>
  );
}

function generationOutputCards(selectedOutputs: string[]) {
  const functionalCards = functionalOutputs.map((output, index) => ({
    label: output.label,
    description: output.description,
    checked: selectedOutputs.includes(output.id),
    icon: output.id === "talking_points" ? "file" : "document",
    tone: output.id === "talking_points" ? "green" : "blue",
    status: index === 0 ? "in-progress" : index === 1 ? "in-progress" : index === 2 ? "completed" : "queued",
    statusLabel: index === 0 ? "In progress" : index === 1 ? "In progress" : index === 2 ? "Completed" : "Queued",
    percent: index === 0 ? "65%" : index === 1 ? "55%" : "",
    done: index === 2,
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
