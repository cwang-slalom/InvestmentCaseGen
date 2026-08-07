import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { functionalOutputs } from "../state/options";
import type {
  ArtifactVersion,
  GenerationResult,
  OutputType,
  Project,
  ProjectMemoryItem,
  ProjectUpdate,
  ProjectUpdateType,
  UpdateCandidate,
} from "../types";

type ProjectUpdatesPageProps = {
  project: Project;
  onProject: (project: Project) => void;
  onGeneration: (generation: GenerationResult) => void;
  onNavigate: (path: string) => void;
};

const updateTypeLabels: Record<ProjectUpdateType, string> = {
  meeting_notes: "Meeting notes",
  document_upload: "New document",
  stakeholder_feedback: "Stakeholder feedback",
  manual_note: "Manual note",
};

export function ProjectUpdatesPage({ project, onProject, onGeneration, onNavigate }: ProjectUpdatesPageProps) {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [memoryItems, setMemoryItems] = useState<ProjectMemoryItem[]>([]);
  const [artifactVersions, setArtifactVersions] = useState<ArtifactVersion[]>([]);
  const [activeUpdateId, setActiveUpdateId] = useState("");
  const [updateType, setUpdateType] = useState<ProjectUpdateType>("meeting_notes");
  const [sourceLabel, setSourceLabel] = useState("Meeting notes");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedFactIds, setSelectedFactIds] = useState<string[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedRefreshOutputs, setSelectedRefreshOutputs] = useState<OutputType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeUpdate = updates.find((update) => update.id === activeUpdateId) || updates[0] || null;
  const currentVersions = artifactVersions.filter((version) => version.status === "current" || version.status === "needs_refresh");
  const needsRefresh = artifactVersions.filter((version) => version.status === "needs_refresh");
  const hasOutputPackage = Boolean(project.generationId || artifactVersions.length > 0);

  useEffect(() => {
    void loadWorkspace();
  }, [project.id]);

  useEffect(() => {
    if (!activeUpdate) return;
    setSelectedFactIds(activeUpdate.extractedFacts.map((candidate) => candidate.id));
    setSelectedQuestionIds(activeUpdate.openQuestions.map((candidate) => candidate.id));
    setSelectedRefreshOutputs(activeUpdate.affectedOutputs.map((output) => output.outputType));
  }, [activeUpdate?.id]);

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [nextUpdates, nextMemory, nextVersions] = await Promise.all([
        api.projectUpdates(project.id),
        api.projectMemory(project.id),
        api.artifactVersions(project.id),
      ]);
      setUpdates(nextUpdates);
      setMemoryItems(nextMemory);
      setArtifactVersions(nextVersions);
      setActiveUpdateId((current) => current || nextUpdates[0]?.id || "");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Project update workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function createUpdate() {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const update = file
        ? await api.createProjectUpdateFile(project.id, updateType, file)
        : await api.createProjectUpdateText(project.id, {
            updateType,
            sourceLabel: sourceLabel || updateTypeLabels[updateType],
            text,
          });
      setUpdates((current) => [update, ...current.filter((item) => item.id !== update.id)]);
      setActiveUpdateId(update.id);
      setSelectedFactIds(update.extractedFacts.map((candidate) => candidate.id));
      setSelectedQuestionIds(update.openQuestions.map((candidate) => candidate.id));
      setSelectedRefreshOutputs(update.affectedOutputs.map((output) => output.outputType));
      setText("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      const refreshedProject = await api.project(project.id);
      onProject(refreshedProject);
      setNotice("Update extracted. Review the facts before committing them to project memory.");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Project update could not be extracted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function approveUpdate() {
    if (!activeUpdate) return;
    setApproving(true);
    setError("");
    setNotice("");
    try {
      const update = await api.reviewProjectUpdate(project.id, activeUpdate.id, {
        approvedFactIds: selectedFactIds,
        approvedQuestionIds: selectedQuestionIds,
      });
      setUpdates((current) => current.map((item) => (item.id === update.id ? update : item)));
      await loadWorkspace();
      const refreshedProject = await api.project(project.id);
      onProject(refreshedProject);
      setNotice("Approved items are now part of this project's memory.");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Project update could not be approved.");
    } finally {
      setApproving(false);
    }
  }

  async function refreshOutputs() {
    if (!activeUpdate) return;
    setRefreshing(true);
    setError("");
    setNotice("");
    try {
      const refreshed = await api.refreshProjectUpdate(project.id, activeUpdate.id, {
        selectedOutputs: selectedRefreshOutputs,
      });
      const generation = await api.generation(refreshed.generationId);
      onGeneration(generation);
      const refreshedProject = await api.project(project.id);
      onProject(refreshedProject);
      await loadWorkspace();
      setNotice("Selected outputs were regenerated as new versions.");
      onNavigate(`/projects/${project.id}/results`);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Selected outputs could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  }

  function toggleFact(candidateId: string) {
    setSelectedFactIds((current) => toggleId(current, candidateId));
  }

  function toggleQuestion(candidateId: string) {
    setSelectedQuestionIds((current) => toggleId(current, candidateId));
  }

  function toggleRefreshOutput(outputType: OutputType) {
    setSelectedRefreshOutputs((current) => toggleId(current, outputType));
  }

  return (
    <section className="updates-page">
      <div className="page-title-row">
        <div className="page-title">
          <p className="eyebrow">Living project memory</p>
          <h2>Project updates</h2>
          <p>Add meeting notes, new documents, or stakeholder feedback without restarting the case.</p>
        </div>
        <button className="outline-action" type="button" onClick={() => onNavigate(`/projects/${project.id}/results`)}>
          <Icon name="document" />
          View outputs
        </button>
      </div>

      <div className="updates-dashboard">
        <StatCard label="Updates" value={project.memorySummary?.updateCount || updates.length} />
        <StatCard label="Pending review" value={project.memorySummary?.pendingUpdateCount || 0} />
        <StatCard label="Memory items" value={project.memorySummary?.approvedMemoryCount || memoryItems.length} />
        <StatCard label="Need refresh" value={project.memorySummary?.needsRefreshCount || needsRefresh.length} />
      </div>

      <div className="updates-layout">
        <section className="panel update-compose-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Add update</p>
              <h3>New evidence event</h3>
            </div>
          </div>
          <div className="update-form">
            <label>
              <span>Update type</span>
              <select value={updateType} onChange={(event) => setUpdateType(event.currentTarget.value as ProjectUpdateType)}>
                {Object.entries(updateTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Source label</span>
              <input value={sourceLabel} onChange={(event) => setSourceLabel(event.currentTarget.value)} placeholder="Aug 7 donor meeting" />
            </label>
            <label>
              <span>Paste notes</span>
              <textarea value={text} onChange={(event) => setText(event.currentTarget.value)} placeholder="Paste meeting notes, feedback, or a short update..." />
            </label>
            <label className="file-picker">
              <span>Upload document</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
                onChange={(event) => setFile(event.currentTarget.files?.[0] || null)}
              />
              {file && <small>{file.name}</small>}
            </label>
            <button className="primary-button" type="button" disabled={submitting || (!file && text.trim().length < 20)} onClick={() => void createUpdate()}>
              <Icon name="sparkles" />
              {submitting ? "Extracting update" : "Extract update"}
            </button>
          </div>
          {notice && <p className="saved-note">{notice}</p>}
          {error && <p className="validation-message" role="alert">{error}</p>}
        </section>

        <section className="panel update-review-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Review gate</p>
              <h3>{activeUpdate ? activeUpdate.sourceLabel : "No update selected"}</h3>
            </div>
            {activeUpdate && <StatusBadge status={activeUpdate.status} />}
          </div>
          {loading ? (
            <p className="muted">Loading project update workspace...</p>
          ) : activeUpdate ? (
            <>
              <p className="update-summary">{activeUpdate.summary}</p>
              <CandidateList
                title="Extracted facts"
                candidates={activeUpdate.extractedFacts}
                selectedIds={selectedFactIds}
                disabled={activeUpdate.status === "approved"}
                onToggle={toggleFact}
              />
              <CandidateList
                title="Open questions"
                candidates={activeUpdate.openQuestions}
                selectedIds={selectedQuestionIds}
                disabled={activeUpdate.status === "approved"}
                onToggle={toggleQuestion}
                emptyLabel="No explicit open questions were detected."
              />
              <div className="affected-output-list">
                <h4>Affected outputs</h4>
                {activeUpdate.affectedOutputs.map((output) => (
                  <label className="checkbox-row" key={output.outputType}>
                    <input
                      type="checkbox"
                      checked={selectedRefreshOutputs.includes(output.outputType)}
                      onChange={() => toggleRefreshOutput(output.outputType)}
                    />
                    <span>
                      <strong>{outputLabel(output.outputType)}</strong>
                      <small>{output.reason}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="update-action-row">
                <button className="secondary-button" type="button" disabled={approving || activeUpdate.status === "approved"} onClick={() => void approveUpdate()}>
                  <Icon name="check" />
                  {approving ? "Approving" : "Approve selected"}
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={refreshing || !hasOutputPackage || activeUpdate.status !== "approved" || selectedRefreshOutputs.length === 0}
                  onClick={() => void refreshOutputs()}
                >
                  <Icon name="refresh" />
                  {refreshing ? "Refreshing" : hasOutputPackage ? "Refresh selected outputs" : "Generate outputs first"}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Add a meeting note or document to begin.</p>
          )}
        </section>

        <aside className="updates-side-stack">
          <section className="panel">
            <h3>Update timeline</h3>
            <div className="stack-list">
              {updates.map((update) => (
                <button
                  className={update.id === activeUpdate?.id ? "timeline-update active" : "timeline-update"}
                  key={update.id}
                  type="button"
                  onClick={() => setActiveUpdateId(update.id)}
                >
                  <strong>{update.sourceLabel}</strong>
                  <span>{updateTypeLabels[update.updateType]} · {new Date(update.createdAt).toLocaleDateString()}</span>
                  <em>{update.status === "approved" ? "Approved" : "Pending review"}</em>
                </button>
              ))}
              {updates.length === 0 && <p className="muted">No updates added yet.</p>}
            </div>
          </section>
          <section className="panel">
            <h3>Project memory</h3>
            <div className="memory-item-list">
              {memoryItems.slice(0, 6).map((item) => (
                <article className="memory-item" key={item.id}>
                  <strong>{item.label}</strong>
                  <p>{item.value}</p>
                  <small>{item.sourceReference}</small>
                </article>
              ))}
              {memoryItems.length === 0 && <p className="muted">Approved facts and open questions will appear here.</p>}
            </div>
          </section>
          <section className="panel">
            <h3>Output versions</h3>
            <div className="version-list">
              {currentVersions.map((version) => (
                <article className={`version-row ${version.status}`} key={version.id}>
                  <strong>{outputLabel(version.outputType)} v{version.version}</strong>
                  <small>{version.status === "needs_refresh" ? "Needs refresh" : "Current"}</small>
                </article>
              ))}
              {currentVersions.length === 0 && <p className="muted">Generate outputs to start version history.</p>}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function CandidateList({
  title,
  candidates,
  selectedIds,
  disabled,
  emptyLabel = "No candidates detected.",
  onToggle,
}: {
  title: string;
  candidates: UpdateCandidate[];
  selectedIds: string[];
  disabled: boolean;
  emptyLabel?: string;
  onToggle: (candidateId: string) => void;
}) {
  return (
    <div className="candidate-list">
      <h4>{title}</h4>
      {candidates.map((candidate) => (
        <label className="candidate-row" key={candidate.id}>
          <input
            type="checkbox"
            checked={selectedIds.includes(candidate.id)}
            disabled={disabled}
            onChange={() => onToggle(candidate.id)}
          />
          <span>
            <strong>{candidate.label}</strong>
            <small>{candidate.value}</small>
          </span>
        </label>
      ))}
      {candidates.length === 0 && <p className="muted">{emptyLabel}</p>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="update-stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function StatusBadge({ status }: { status: ProjectUpdate["status"] }) {
  return <span className={`status-pill ${status === "approved" ? "" : "warning"}`}>{status === "approved" ? "Approved" : "Pending review"}</span>;
}

function outputLabel(outputType: OutputType) {
  return functionalOutputs.find((output) => output.id === outputType)?.label || outputType.replace(/_/g, " ");
}

function toggleId<T extends string>(items: T[], item: T) {
  return items.includes(item) ? items.filter((existing) => existing !== item) : [...items, item];
}
