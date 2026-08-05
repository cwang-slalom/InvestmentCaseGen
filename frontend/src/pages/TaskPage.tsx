import { useEffect, useState } from "react";

import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { taskOptions } from "../state/options";
import { validateTask } from "../state/validation";
import type { Project } from "../types";

type TaskPageProps = {
  project: Project;
  onProject: (project: Project) => void;
  onNavigate: (path: string) => void;
};

export function TaskPage({ project, onProject, onNavigate }: TaskPageProps) {
  const [selectedTaskId, setSelectedTaskId] = useState(project.task?.selectedTaskId || "donor_meeting");
  const [customDescription, setCustomDescription] = useState(project.task?.customDescription || "");
  const [saving, setSaving] = useState(false);
  const validation = validateTask(selectedTaskId, customDescription);

  useEffect(() => {
    setSelectedTaskId(project.task?.selectedTaskId || "donor_meeting");
    setCustomDescription(project.task?.customDescription || "");
  }, [project.id, project.task?.customDescription, project.task?.selectedTaskId]);

  async function continueToNext() {
    if (!validation.valid) return;
    setSaving(true);
    const option = taskOptions.find((task) => task.id === selectedTaskId);
    const updated = await api.updateTask(project.id, {
      selectedTaskId,
      taskLabel: option?.title || null,
      customDescription,
    });
    onProject(updated);
    setSaving(false);
    onNavigate(`/projects/${project.id}/opportunity-audience`);
  }

  return (
    <section className="wizard-page">
      <div className="page-title">
        <p className="eyebrow">Step 1</p>
        <h2>What are you preparing?</h2>
      </div>
      <div className="task-grid" role="radiogroup" aria-label="Task type">
        {taskOptions.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`task-card ${selectedTaskId === task.id ? "selected" : ""}`}
            role="radio"
            aria-checked={selectedTaskId === task.id}
            onClick={() => setSelectedTaskId(task.id)}
          >
            <span className="card-check">{selectedTaskId === task.id && <Icon name="check" />}</span>
            <strong>{task.title}</strong>
            <small>{task.description}</small>
          </button>
        ))}
      </div>
      <label className="field-block">
        <span>Or describe what you need</span>
        <textarea
          value={customDescription}
          onChange={(event) => setCustomDescription(event.currentTarget.value)}
          placeholder="Example: prepare a first conversation package for a fictional implementation concept"
        />
      </label>
      {!validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
      <div className="action-row">
        <button className="primary-button" type="button" disabled={!validation.valid || saving} onClick={continueToNext}>
          Continue
          <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}
