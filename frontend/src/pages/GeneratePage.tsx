import { useState } from "react";

import { api, ApiError } from "../api/client";
import { Icon } from "../components/Icons";
import { functionalOutputs, generationStages } from "../state/options";
import { stageStatus } from "../state/generation";
import type { GenerationResult, Project } from "../types";

type GeneratePageProps = {
  project: Project;
  onProject: (project: Project) => void;
  onGeneration: (generation: GenerationResult) => void;
  onNavigate: (path: string) => void;
};

export function GeneratePage({ project, onProject, onGeneration, onNavigate }: GeneratePageProps) {
  const [activeStage, setActiveStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(Boolean(project.generationId));
  const [simulateError, setSimulateError] = useState(false);
  const [error, setError] = useState("");
  const selectedOutputs = project.opportunityAudience?.selectedOutputs || [];

  async function startGeneration() {
    if (running) return;
    setRunning(true);
    setComplete(false);
    setError("");
    setActiveStage(0);

    for (let index = 0; index < generationStages.length; index += 1) {
      setActiveStage(index);
      await new Promise((resolve) => setTimeout(resolve, 220));
    }

    try {
      const generation = await api.generate(project.id, simulateError);
      onGeneration(generation);
      const refreshed = await api.project(project.id);
      onProject(refreshed);
      setComplete(true);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "Generation could not be completed.";
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="wizard-page">
      <div className="page-title">
        <p className="eyebrow">Step 4</p>
        <h2>Generate materials</h2>
      </div>
      <div className="two-column uneven">
        <section className="panel">
          <h3>Generation progress</h3>
          <div className="stage-list">
            {generationStages.map((stage, index) => {
              const status = stageStatus(index, activeStage, Boolean(error));
              return (
                <div className={`stage-row ${status}`} key={stage}>
                  <span>{status === "complete" ? <Icon name="check" /> : index + 1}</span>
                  <strong>{stage}</strong>
                </div>
              );
            })}
          </div>
          {error && <p className="validation-message" role="alert">{error}</p>}
          <label className="confirm-row">
            <input type="checkbox" checked={simulateError} onChange={(event) => setSimulateError(event.currentTarget.checked)} />
            Simulate a controlled mock error
          </label>
          <div className="action-row">
            <button className="primary-button" type="button" disabled={running || selectedOutputs.length === 0} onClick={startGeneration}>
              {error ? "Retry" : running ? "Generating" : "Generate"}
              <Icon name="arrow" />
            </button>
            <button className="secondary-button" type="button" disabled={!complete && !project.generationId} onClick={() => onNavigate(`/projects/${project.id}/results`)}>
              View results
            </button>
          </div>
        </section>
        <section className="panel">
          <h3>Selected outputs</h3>
          <div className="stack-list">
            {functionalOutputs
              .filter((output) => selectedOutputs.includes(output.id))
              .map((output) => (
                <article className="output-card" key={output.id}>
                  <span className="status-pill">Mock output</span>
                  <h4>{output.label}</h4>
                  <p>{output.description}</p>
                </article>
              ))}
          </div>
        </section>
      </div>
      <div className="action-row split">
        <button className="secondary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/review-setup`)}>
          Back
        </button>
      </div>
    </section>
  );
}
