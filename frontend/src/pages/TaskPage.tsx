import { useEffect, useState } from "react";

import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icons";
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
    <section className="wizard-page task-page">
      <div className="hero-title">
        <h2>What are you preparing?</h2>
        <p>
          Tell us what you need, and we'll help you create a high-quality investment case with the right
          opportunity, audience, sources and outputs.
        </p>
      </div>
      <div className="home-layout">
        <section className="task-panel">
          <h3>What are you preparing?</h3>
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
                <span className="task-icon"><Icon name={taskIcon(task.id)} /></span>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.description}</small>
                </span>
                {selectedTaskId === task.id && <span className="card-check"><Icon name="check" /></span>}
              </button>
            ))}
          </div>
          <div className="prompt-box">
            <label className="field-block">
              <span>Or describe what you need:</span>
              <textarea
                value={customDescription}
                onChange={(event) => setCustomDescription(event.currentTarget.value)}
                placeholder={'"Create a deck for HKJC about vaccine development for an upcoming cultivation meeting..."'}
              />
            </label>
            {!validation.valid && <p className="validation-message" role="alert">{validation.messages[0]}</p>}
            <div className="action-row">
              <button className="primary-button" type="button" disabled={!validation.valid || saving} onClick={continueToNext}>
                <Icon name="sparkles" />
                Continue
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        </section>
        <aside className="assistant-card">
          <div className="assistant-heading">
            <Icon name="sparkles" />
            <h3>Your Assistant</h3>
          </div>
          <p>I can help you create high-quality investment materials faster.</p>
          <div className="assistant-list">
            <h4>What I can do:</h4>
            {[
              "Find relevant opportunities",
              "Add donor context from our KB",
              "Recommend narrative approach",
              "Ensure PST review compliance",
              "Generate multiple output formats",
            ].map((item) => (
              <span key={item}><Icon name="check" /> {item}</span>
            ))}
          </div>
          <div className="quick-tip">
            <Icon name="lightbulb" />
            <p><strong>Quick tips:</strong><br />Start with a clear task, and I'll handle the rest.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function taskIcon(taskId: string): IconName {
  if (taskId === "donor_meeting") return "users";
  if (taskId === "donor_deck") return "presentation";
  if (taskId === "opportunity_brief") return "document";
  if (taskId === "proposal") return "clipboard";
  if (taskId === "rfp_package") return "mail";
  return "refresh";
}
