import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { api } from "../api/client";
import { projectOverviewApi } from "../api/projectOverview";
import { Icon } from "../components/Icons";
import { functionalOutputs } from "../state/options";
import type {
  ArtifactVersion,
  GeneratedOutput,
  GenerationResult,
  OutputChangeDecision,
  OutputChangeReview,
  OutputType,
  Project,
  ProjectUpdate,
  ProjectUpdateType,
} from "../types";

type ProjectUpdatesPageProps = {
  project: Project;
  onProject: (project: Project) => void;
  onGeneration: (generation: GenerationResult) => void;
  onNavigate: (path: string) => void;
};

type DrawerMode = "add" | "update" | "impact" | "review" | null;

type OverviewOutput = {
  outputType: OutputType;
  title: string;
  version: number;
  status: "update_available" | "up_to_date";
  changeCount: number;
  affectedUpdateIds: string[];
};

const outputOrder: OutputType[] = ["investment_case", "one_page", "talking_points", "source_appendix"];

const outputTitleFallbacks: Record<OutputType, string> = {
  investment_case: "Investment Memo",
  one_page: "Executive Summary",
  talking_points: "Donor Brief",
  source_appendix: "Source Appendix",
};

const updateTypeLabels: Record<ProjectUpdateType, string> = {
  meeting_notes: "Meeting notes",
  document_upload: "Document",
  stakeholder_feedback: "Stakeholder feedback",
  manual_note: "Project note",
};

export function ProjectUpdatesPage({ project, onProject, onGeneration, onNavigate }: ProjectUpdatesPageProps) {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [artifactVersions, setArtifactVersions] = useState<ArtifactVersion[]>([]);
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [activeUpdateId, setActiveUpdateId] = useState("");
  const [activeReview, setActiveReview] = useState<OutputChangeReview | null>(null);
  const [changeDecisions, setChangeDecisions] = useState<Record<string, OutputChangeDecision>>({});
  const [editedSuggestions, setEditedSuggestions] = useState<Record<string, string>>({});
  const [editingChangeId, setEditingChangeId] = useState("");
  const [locallyResolvedOutputs, setLocallyResolvedOutputs] = useState<OutputType[]>([]);
  const [newUpdateText, setNewUpdateText] = useState("");
  const [newUpdateSource, setNewUpdateSource] = useState("");
  const [newUpdateDate, setNewUpdateDate] = useState("");
  const [newUpdateFile, setNewUpdateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadWorkspace();
  }, [project.id, project.generationId]);

  const activeUpdate = useMemo(
    () => updates.find((update) => update.id === activeUpdateId) || updates[0] || null,
    [activeUpdateId, updates],
  );

  const pendingUpdates = useMemo(() => updates.filter((update) => update.status === "pending_review"), [updates]);
  const resolvedOutputSet = useMemo(() => new Set(locallyResolvedOutputs), [locallyResolvedOutputs]);

  const outputCards = useMemo(
    () => buildOutputCards(project, generation?.outputs || [], artifactVersions, pendingUpdates, resolvedOutputSet),
    [artifactVersions, generation?.outputs, pendingUpdates, project, resolvedOutputSet],
  );

  const impact = useMemo(() => buildImpactOverview(pendingUpdates, outputCards), [outputCards, pendingUpdates]);
  const recentUpdates = updates.slice(0, 2);
  const showImpactBanner = pendingUpdates.length > 0 && impact.affectedOutputCount > 0;
  const projectInitials = initials(project.name);
  const projectSubtitle = overviewSubtitle(project);
  const hasOutputPackage = Boolean(project.generationId || artifactVersions.length > 0 || generation?.outputs.length);

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [nextUpdates, , nextVersions, nextGeneration] = await Promise.all([
        api.projectUpdates(project.id),
        api.projectMemory(project.id),
        api.artifactVersions(project.id),
        project.generationId ? api.generation(project.generationId).catch(() => null) : Promise.resolve(null),
      ]);
      setUpdates(nextUpdates);
      setArtifactVersions(nextVersions);
      setGeneration(nextGeneration);
      if (nextGeneration) onGeneration(nextGeneration);
      setActiveUpdateId((current) => current || nextUpdates[0]?.id || "");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Project overview could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function createUpdate() {
    setSubmitting(true);
    setAnalyzing(true);
    setError("");
    setNotice("");
    try {
      const sourceLabel = newUpdateSource.trim() || newUpdateFile?.name || inferSourceLabel(newUpdateText);
      const updateType = newUpdateFile ? "document_upload" : inferUpdateType(newUpdateText, sourceLabel);
      const update = newUpdateFile
        ? await api.createProjectUpdateFile(project.id, updateType, newUpdateFile)
        : await api.createProjectUpdateText(project.id, {
            updateType,
            sourceLabel,
            text: withOptionalSourceDate(newUpdateText, newUpdateDate),
          });
      setUpdates((current) => [update, ...current.filter((item) => item.id !== update.id)]);
      setActiveUpdateId(update.id);
      setNewUpdateText("");
      setNewUpdateSource("");
      setNewUpdateDate("");
      setNewUpdateFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const refreshedProject = await api.project(project.id);
      onProject(refreshedProject);
      setNotice("Update analyzed. Review the impact before refreshing materials.");
      setDrawerMode("impact");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Project update could not be added.");
    } finally {
      setSubmitting(false);
      setAnalyzing(false);
    }
  }

  function openUpdateDetails(update: ProjectUpdate) {
    setActiveUpdateId(update.id);
    setNotice("");
    setError("");
    setDrawerMode("update");
  }

  async function openReviewChanges(output: OverviewOutput) {
    setDrawerMode("review");
    setReviewLoading(true);
    setActiveReview(null);
    setNotice("");
    setError("");
    try {
      const review = await projectOverviewApi.getOutputChangeReview({
        project,
        outputType: output.outputType,
        outputTitle: output.title,
        currentVersion: output.version,
        updates: pendingUpdates.length ? pendingUpdates : updates,
        generation,
      });
      setActiveReview(review);
      setChangeDecisions(
        Object.fromEntries(review.changes.map((change) => [change.id, "accepted" satisfies OutputChangeDecision])),
      );
      setEditedSuggestions(Object.fromEntries(review.changes.map((change) => [change.id, change.suggestedText])));
      setEditingChangeId("");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Change review could not be prepared.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function applyAcceptedChanges() {
    if (!activeReview) return;
    const acceptedChanges = activeReview.changes
      .filter((change) => changeDecisions[change.id] !== "ignored")
      .map((change) => ({
        ...change,
        suggestedText: editedSuggestions[change.id] || change.suggestedText,
        decision: changeDecisions[change.id] || "accepted",
      }));
    if (!acceptedChanges.length) return;

    setApplying(true);
    setError("");
    setNotice("");
    try {
      const savedVersion = await projectOverviewApi.applyAcceptedOutputChanges({
        projectId: project.id,
        outputType: activeReview.outputType,
        outputTitle: activeReview.outputTitle,
        currentVersion: activeReview.currentVersion,
        acceptedChanges,
      });
      setArtifactVersions((current) => [
        ...current.map((version) =>
          version.outputType === activeReview.outputType && (version.status === "current" || version.status === "needs_refresh")
            ? { ...version, status: "superseded" as const }
            : version,
        ),
        savedVersion,
      ]);
      setLocallyResolvedOutputs((current) =>
        current.includes(activeReview.outputType) ? current : [...current, activeReview.outputType],
      );
      setDrawerMode(null);
      setNotice(`${activeReview.outputTitle} updated to v${savedVersion.version}. Previous versions are preserved.`);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Accepted changes could not be applied.");
    } finally {
      setApplying(false);
    }
  }

  async function refreshAllAffected() {
    const outputsToRefresh = outputCards
      .filter((output) => output.status === "update_available")
      .map((output) => output.outputType);
    const sourceUpdate = pendingUpdates[0] || updates.find((update) => update.affectedOutputs.length > 0);

    if (!sourceUpdate || outputsToRefresh.length === 0) {
      setNotice("Everything is already up to date.");
      return;
    }
    if (!hasOutputPackage) {
      setError("Generate outputs before refreshing project materials.");
      return;
    }

    setRefreshing(true);
    setNotice("");
    setError("");
    try {
      let reviewedUpdate = sourceUpdate;
      if (sourceUpdate.status === "pending_review") {
        reviewedUpdate = await api.reviewProjectUpdate(project.id, sourceUpdate.id, {
          approvedFactIds: sourceUpdate.extractedFacts.map((candidate) => candidate.id),
          approvedQuestionIds: sourceUpdate.openQuestions.map((candidate) => candidate.id),
        });
        setUpdates((current) => current.map((item) => (item.id === reviewedUpdate.id ? reviewedUpdate : item)));
      }
      const refreshed = await api.refreshProjectUpdate(project.id, reviewedUpdate.id, {
        selectedOutputs: outputsToRefresh,
      });
      const [nextGeneration, refreshedProject] = await Promise.all([
        api.generation(refreshed.generationId),
        api.project(project.id),
      ]);
      onGeneration(nextGeneration);
      onProject(refreshedProject);
      setGeneration(nextGeneration);
      await loadWorkspace();
      setNotice("Affected outputs were refreshed as new versions.");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Affected outputs could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  }

  function setDecision(changeId: string, decision: OutputChangeDecision) {
    setChangeDecisions((current) => ({ ...current, [changeId]: decision }));
    if (decision === "edited") setEditingChangeId(changeId);
    if (decision !== "edited" && editingChangeId === changeId) setEditingChangeId("");
  }

  function drawerTitle() {
    if (drawerMode === "add") return "Add update";
    if (drawerMode === "update") return activeUpdate?.sourceLabel || "Update details";
    if (drawerMode === "impact") return "Impact details";
    if (drawerMode === "review") return activeReview?.outputTitle || "Review changes";
    return "";
  }

  return (
    <section className="project-overview-page">
      <div className="overview-hero">
        <div className="project-avatar" aria-hidden="true">{projectInitials}</div>
        <div className="overview-title">
          <div className="overview-title-line">
            <h2>{project.name}</h2>
            <button className="favorite-button" type="button" aria-label="Favorite project">
              <Icon name="star" />
            </button>
          </div>
          <p>{projectSubtitle}</p>
          <div className="overview-metadata">
            <span>Last updated {formatRelativeDate(project.updatedAt)}</span>
            <i aria-hidden="true" />
            <span>Created {formatShortDate(project.createdAt)}</span>
          </div>
        </div>
        <button className="primary-button overview-add-button" type="button" onClick={() => setDrawerMode("add")}>
          <Icon name="plus" />
          Add update
          <Icon name="chevron-down" />
        </button>
      </div>

      {notice && <p className="overview-toast success">{notice}</p>}
      {error && <p className="overview-toast error" role="alert">{error}</p>}

      {showImpactBanner && (
        <section className="impact-banner">
          <span className="impact-banner-icon"><Icon name="sparkles" /></span>
          <div>
            <strong>{pendingUpdates.length} new {plural("update", pendingUpdates.length)} may affect {impact.affectedOutputCount} {plural("output", impact.affectedOutputCount)}</strong>
            <p>Review the impact and refresh your materials.</p>
          </div>
          <div className="impact-banner-actions">
            <button className="outline-action" type="button" onClick={() => setDrawerMode("impact")}>
              Review impact
            </button>
            <button className="primary-button" type="button" disabled={refreshing} onClick={() => void refreshAllAffected()}>
              {refreshing ? "Refreshing" : "Refresh all affected"}
            </button>
          </div>
        </section>
      )}

      <div className="overview-grid">
        <div className="overview-main-stack">
          <section className="panel overview-card recent-updates-card">
            <PanelHeading title="Recent updates" action="View all updates" onAction={() => setDrawerMode("impact")} />
            <div className="recent-update-list">
              {loading ? (
                <p className="muted">Loading updates...</p>
              ) : recentUpdates.length ? (
                recentUpdates.map((update) => (
                  <button className="recent-update-row" key={update.id} type="button" onClick={() => openUpdateDetails(update)}>
                    <span className={`overview-icon ${updateIconTone(update)}`}><Icon name={updateIcon(update)} /></span>
                    <span>
                      <strong>{update.sourceLabel}</strong>
                      <small>{formatShortDate(update.createdAt)} <b aria-hidden="true">·</b> {updateTypeLabels[update.updateType]}</small>
                    </span>
                    {update.status === "pending_review" && <StatusPill tone="new">New</StatusPill>}
                    <em>Affects {update.affectedOutputs.length} {plural("output", update.affectedOutputs.length)}</em>
                    <Icon name="chevron-right" />
                  </button>
                ))
              ) : (
                <EmptyCompact title="No updates yet" body="Add meeting notes, stakeholder feedback, or a new document when something changes." />
              )}
            </div>
          </section>

          <section className="panel overview-card outputs-overview-card">
            <PanelHeading title="Your outputs" action="View all outputs" onAction={() => onNavigate(`/projects/${project.id}/results`)} />
            <div className="output-overview-grid">
              {outputCards.map((output) => (
                <article className={`output-overview-card ${output.status}`} key={output.outputType}>
                  <div className="output-overview-heading">
                    <span className={`overview-icon ${outputTone(output.outputType)}`}><Icon name="document" /></span>
                    <strong>{output.title}</strong>
                    <span className="version-pill">v{output.version}</span>
                  </div>
                  {output.status === "update_available" ? (
                    <>
                      <StatusPill tone="warning">Update available</StatusPill>
                      <p>{output.changeCount} {plural("change", output.changeCount)} detected</p>
                      <button className="outline-action compact-action" type="button" onClick={() => void openReviewChanges(output)}>
                        Review changes
                      </button>
                    </>
                  ) : (
                    <>
                      <StatusPill tone="success">Up to date</StatusPill>
                      <p>No changes</p>
                    </>
                  )}
                  <button className="output-open-link" type="button" onClick={() => onNavigate(`/projects/${project.id}/results`)}>
                    Open
                    <Icon name="chevron-right" />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="panel overview-card impact-overview-card">
          <div className="impact-heading">
            <h3>Impact overview</h3>
            <span>AI</span>
          </div>
          <p>Based on {pendingUpdates.length} new {plural("update", pendingUpdates.length)}</p>
          <div className="impact-stat-list">
            <ImpactStat label="New information" value={impact.newInformationCount} tone="green" />
            <ImpactStat label="Decisions" value={impact.decisionCount} tone="blue" />
            <ImpactStat label="Open questions" value={impact.openQuestionCount} tone="amber" />
          </div>
          <h4>Affects {impact.affectedOutputCount} {plural("output", impact.affectedOutputCount)}</h4>
          <div className="impact-output-list">
            {outputCards.map((output) => (
              <div className="impact-output-row" key={output.outputType}>
                <span>{output.title}</span>
                <i aria-hidden="true" />
                <strong className={output.changeCount ? "" : "no-change"}>{output.changeCount ? `${output.changeCount} ${plural("section", output.changeCount)}` : "No changes"}</strong>
              </div>
            ))}
          </div>
          <button className="outline-action impact-details-button" type="button" onClick={() => setDrawerMode("impact")}>
            Review impact details
          </button>
        </aside>
      </div>

      <section className="panel overview-card activity-card">
        <h3>Activity</h3>
        <div className="activity-list">
          {buildActivityItems(project, updates, artifactVersions).map((item) => (
            <article className="activity-item" key={item.id}>
              <span className={`overview-icon ${item.tone}`}><Icon name={item.icon} /></span>
              <div>
                <strong>{item.title}</strong>
                {item.badge && <StatusPill tone="new">{item.badge}</StatusPill>}
                <small>{item.date}</small>
                {item.detail && <p>{item.detail}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {drawerMode && (
        <div className="overview-drawer-backdrop" role="presentation" onMouseDown={() => setDrawerMode(null)}>
          <aside
            className={`overview-drawer ${drawerMode === "review" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={drawerTitle()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="icon-button drawer-close" type="button" aria-label="Close" onClick={() => setDrawerMode(null)}>
              <Icon name="close" />
            </button>
            {drawerMode === "add" && (
              <AddUpdateDrawer
                text={newUpdateText}
                source={newUpdateSource}
                date={newUpdateDate}
                file={newUpdateFile}
                submitting={submitting}
                analyzing={analyzing}
                fileInputRef={fileInputRef}
                onText={setNewUpdateText}
                onSource={setNewUpdateSource}
                onDate={setNewUpdateDate}
                onFile={setNewUpdateFile}
                onSubmit={() => void createUpdate()}
              />
            )}
            {drawerMode === "update" && activeUpdate && <UpdateDetailsDrawer update={activeUpdate} onReviewImpact={() => setDrawerMode("impact")} />}
            {drawerMode === "impact" && (
              <ImpactDetailsDrawer
                updates={pendingUpdates.length ? pendingUpdates : updates}
                outputs={outputCards}
                impact={impact}
                onReviewChanges={(output) => void openReviewChanges(output)}
              />
            )}
            {drawerMode === "review" && (
              <ReviewChangesDrawer
                review={activeReview}
                loading={reviewLoading}
                applying={applying}
                decisions={changeDecisions}
                editedSuggestions={editedSuggestions}
                editingChangeId={editingChangeId}
                onDecision={setDecision}
                onEdit={(changeId, value) => setEditedSuggestions((current) => ({ ...current, [changeId]: value }))}
                onApply={() => void applyAcceptedChanges()}
              />
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function PanelHeading({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="overview-card-heading">
      <h3>{title}</h3>
      <button className="ghost-link" type="button" onClick={onAction}>{action}</button>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "warning" | "new"; children: string }) {
  return <span className={`overview-status-pill ${tone}`}>{children}</span>;
}

function ImpactStat({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "amber" }) {
  return (
    <div className={`impact-stat ${tone}`}>
      <span>{label}</span>
      <i aria-hidden="true" />
      <strong>{value}</strong>
    </div>
  );
}

function EmptyCompact({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-compact">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function AddUpdateDrawer({
  text,
  source,
  date,
  file,
  submitting,
  analyzing,
  fileInputRef,
  onText,
  onSource,
  onDate,
  onFile,
  onSubmit,
}: {
  text: string;
  source: string;
  date: string;
  file: File | null;
  submitting: boolean;
  analyzing: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onText: (value: string) => void;
  onSource: (value: string) => void;
  onDate: (value: string) => void;
  onFile: (file: File | null) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="overview-drawer-content">
      <p className="eyebrow">Add update</p>
      <h3>What's new?</h3>
      <p>Paste notes, feedback, or fresh context. The project will analyze what changed before anything is regenerated.</p>
      <label className="drawer-field-label">
        <span>What's new?</span>
        <textarea
          value={text}
          onChange={(event) => onText(event.currentTarget.value)}
          placeholder="Paste meeting notes, feedback, or an update..."
        />
      </label>
      <label className="upload-update-option">
        <Icon name="upload" />
        <span>
          <strong>Upload document</strong>
          <small>TXT, Markdown, or text-layer PDF</small>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
          onChange={(event) => onFile(event.currentTarget.files?.[0] || null)}
        />
      </label>
      {file && <p className="selected-file"><Icon name="file" /> {file.name}</p>}
      <div className="drawer-metadata-row">
        <label className="drawer-field-label">
          <span>Source optional</span>
          <input value={source} onChange={(event) => onSource(event.currentTarget.value)} placeholder="HKJC partner meeting" />
        </label>
        <label className="drawer-field-label">
          <span>Date optional</span>
          <input type="date" value={date} onChange={(event) => onDate(event.currentTarget.value)} />
        </label>
      </div>
      <button className="primary-button" type="button" disabled={submitting || (!file && text.trim().length < 20)} onClick={onSubmit}>
        {analyzing && <span className="button-spinner" aria-hidden="true" />}
        {analyzing ? "Analyzing update" : "Add to project"}
      </button>
    </div>
  );
}

function UpdateDetailsDrawer({ update, onReviewImpact }: { update: ProjectUpdate; onReviewImpact: () => void }) {
  return (
    <div className="overview-drawer-content">
      <p className="eyebrow">{updateTypeLabels[update.updateType]}</p>
      <h3>{update.sourceLabel}</h3>
      <p>{update.summary}</p>
      <dl className="update-detail-grid">
        <div><dt>Date</dt><dd>{formatShortDate(update.createdAt)}</dd></div>
        <div><dt>Status</dt><dd>{update.status === "pending_review" ? "New" : "Reviewed"}</dd></div>
        <div><dt>Affected outputs</dt><dd>{update.affectedOutputs.length}</dd></div>
      </dl>
      <DrawerList title="New information" items={update.extractedFacts.map((fact) => fact.value)} emptyLabel="No new facts were detected." />
      <DrawerList title="Open questions" items={update.openQuestions.map((question) => question.value)} emptyLabel="No open questions were detected." />
      <div className="drawer-affected-list">
        <h4>Affected outputs</h4>
        {update.affectedOutputs.map((output) => (
          <article key={output.outputType}>
            <strong>{outputTitleFallbacks[output.outputType]}</strong>
            <p>{output.reason}</p>
          </article>
        ))}
      </div>
      <button className="primary-button" type="button" onClick={onReviewImpact}>Review impact</button>
    </div>
  );
}

function ImpactDetailsDrawer({
  updates,
  outputs,
  impact,
  onReviewChanges,
}: {
  updates: ProjectUpdate[];
  outputs: OverviewOutput[];
  impact: ReturnType<typeof buildImpactOverview>;
  onReviewChanges: (output: OverviewOutput) => void;
}) {
  return (
    <div className="overview-drawer-content">
      <p className="eyebrow">Impact review</p>
      <h3>{updates.length} new {plural("update", updates.length)} may affect {impact.affectedOutputCount} {plural("output", impact.affectedOutputCount)}</h3>
      <p>The project has analyzed the new information. Review proposed changes first, then refresh only the affected materials.</p>
      <div className="impact-detail-summary">
        <ImpactStat label="New information" value={impact.newInformationCount} tone="green" />
        <ImpactStat label="Decisions" value={impact.decisionCount} tone="blue" />
        <ImpactStat label="Open questions" value={impact.openQuestionCount} tone="amber" />
      </div>
      <div className="drawer-affected-list">
        <h4>Affected outputs</h4>
        {outputs.map((output) => (
          <article className={output.changeCount > 0 ? "with-action" : ""} key={output.outputType}>
            <span>
              <strong>{output.title}</strong>
              <small>{output.changeCount ? `${output.changeCount} ${plural("section", output.changeCount)} flagged` : "No changes"}</small>
            </span>
            {output.changeCount > 0 && (
              <button className="outline-action compact-action" type="button" onClick={() => onReviewChanges(output)}>
                Review changes
              </button>
            )}
          </article>
        ))}
      </div>
      <DrawerList
        title="Update sources"
        items={updates.map((update) => `${update.sourceLabel} · ${formatShortDate(update.createdAt)}`)}
        emptyLabel="No new updates are waiting for review."
      />
    </div>
  );
}

function ReviewChangesDrawer({
  review,
  loading,
  applying,
  decisions,
  editedSuggestions,
  editingChangeId,
  onDecision,
  onEdit,
  onApply,
}: {
  review: OutputChangeReview | null;
  loading: boolean;
  applying: boolean;
  decisions: Record<string, OutputChangeDecision>;
  editedSuggestions: Record<string, string>;
  editingChangeId: string;
  onDecision: (changeId: string, decision: OutputChangeDecision) => void;
  onEdit: (changeId: string, value: string) => void;
  onApply: () => void;
}) {
  if (loading) {
    return (
      <div className="overview-drawer-content">
        <p className="eyebrow">Review changes</p>
        <h3>Preparing proposed changes</h3>
        <p><span className="button-spinner" aria-hidden="true" /> Comparing new updates against the current output.</p>
      </div>
    );
  }
  if (!review) {
    return (
      <div className="overview-drawer-content">
        <p className="eyebrow">Review changes</p>
        <h3>No proposed changes</h3>
        <p>The selected output does not have pending changes.</p>
      </div>
    );
  }
  const acceptedCount = review.changes.filter((change) => decisions[change.id] !== "ignored").length;
  return (
    <div className="overview-drawer-content review-delta-content">
      <p className="eyebrow">Review changes</p>
      <h3>{review.outputTitle} v{review.currentVersion} {"->"} v{review.nextVersion}</h3>
      <p>Review only the proposed deltas. Accepted changes will create a new version and preserve the previous one.</p>
      <div className="delta-change-list">
        {review.changes.map((change) => {
          const decision = decisions[change.id] || "accepted";
          const isEditing = editingChangeId === change.id;
          return (
            <article className={`delta-change ${decision}`} key={change.id}>
              <div className="delta-change-heading">
                <strong>{change.sectionName}</strong>
                <StatusPill tone={decision === "ignored" ? "warning" : "new"}>{decisionLabel(decision)}</StatusPill>
              </div>
              <dl className="delta-copy">
                <div>
                  <dt>Current:</dt>
                  <dd>{change.currentText}</dd>
                </div>
                <div>
                  <dt>Suggested:</dt>
                  <dd>
                    {isEditing ? (
                      <textarea value={editedSuggestions[change.id] || ""} onChange={(event) => onEdit(change.id, event.currentTarget.value)} />
                    ) : (
                      editedSuggestions[change.id] || change.suggestedText
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Source:</dt>
                  <dd>{change.sourceLabel} · {change.sourceDate}</dd>
                </div>
              </dl>
              <div className="delta-actions">
                <button className="secondary-button" type="button" onClick={() => onDecision(change.id, "accepted")}>Accept</button>
                <button className="secondary-button" type="button" onClick={() => onDecision(change.id, "edited")}>Edit</button>
                <button className="secondary-button" type="button" onClick={() => onDecision(change.id, "ignored")}>Ignore</button>
              </div>
            </article>
          );
        })}
      </div>
      <button className="primary-button apply-delta-button" type="button" disabled={applying || acceptedCount === 0} onClick={onApply}>
        {applying ? "Applying changes" : `Apply ${acceptedCount} accepted ${plural("change", acceptedCount)}`}
      </button>
    </div>
  );
}

function DrawerList({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="drawer-simple-list">
      <h4>{title}</h4>
      {items.length ? items.map((item) => <p key={item}>{item}</p>) : <p className="muted">{emptyLabel}</p>}
    </div>
  );
}

function buildOutputCards(
  project: Project,
  generatedOutputs: GeneratedOutput[],
  versions: ArtifactVersion[],
  pendingUpdates: ProjectUpdate[],
  locallyResolved: Set<OutputType>,
): OverviewOutput[] {
  const outputTypes = uniqueOutputTypes([
    ...(project.opportunityAudience?.selectedOutputs || []),
    ...generatedOutputs.map((output) => output.type),
    ...versions.map((version) => version.outputType),
  ]);
  const fallbackTypes: OutputType[] = outputTypes.length ? outputTypes : ["investment_case", "one_page", "talking_points"];
  return fallbackTypes.map((outputType) => {
    const version = latestVisibleVersion(versions, outputType);
    const generatedOutput = generatedOutputs.find((output) => output.type === outputType);
    const affectedUpdates = pendingUpdates.filter((update) =>
      update.affectedOutputs.some((affected) => affected.outputType === outputType && affected.status === "needs_refresh"),
    );
    const versionNeedsRefresh = version?.status === "needs_refresh";
    const updateAvailable = !locallyResolved.has(outputType) && (affectedUpdates.length > 0 || versionNeedsRefresh);
    const candidateCount = affectedUpdates.reduce(
      (sum, update) => sum + update.extractedFacts.length + update.openQuestions.length,
      0,
    );
    const maxVisibleChanges = outputType === "investment_case" ? 3 : 2;
    const changeCount = updateAvailable
      ? Math.max(1, Math.min(maxVisibleChanges, candidateCount || affectedUpdates.length || (versionNeedsRefresh ? 1 : 0)))
      : 0;
    return {
      outputType,
      title: outputTitleFallbacks[outputType] || generatedOutput?.title || outputLabel(outputType),
      version: version?.version || 1,
      status: updateAvailable ? "update_available" : "up_to_date",
      changeCount,
      affectedUpdateIds: affectedUpdates.map((update) => update.id),
    };
  });
}

function buildImpactOverview(pendingUpdates: ProjectUpdate[], outputs: OverviewOutput[]) {
  const newInformationCount = pendingUpdates.reduce((sum, update) => sum + update.extractedFacts.length, 0);
  const openQuestionCount = pendingUpdates.reduce((sum, update) => sum + update.openQuestions.length, 0);
  const decisionCount = pendingUpdates.reduce(
    (sum, update) =>
      sum + update.extractedFacts.filter((fact) => /\b(confirmed|decided|approved|will|agreed|expected)\b/i.test(fact.value)).length,
    0,
  );
  const affectedOutputCount = outputs.filter((output) => output.changeCount > 0).length;
  return {
    newInformationCount,
    decisionCount,
    openQuestionCount,
    affectedOutputCount,
  };
}

function buildActivityItems(project: Project, updates: ProjectUpdate[], versions: ArtifactVersion[]) {
  const updateItems = updates.map((update) => ({
    id: update.id,
    title: `${update.sourceLabel} added`,
    date: formatShortDate(update.createdAt),
    detail: activityDetail(update),
    icon: updateIcon(update),
    tone: updateIconTone(update),
    badge: update.status === "pending_review" ? "New" : "",
    timestamp: Date.parse(update.createdAt),
  }));
  const versionItems = versions
    .filter((version) => version.status === "current" || version.status === "needs_refresh")
    .map((version) => ({
      id: version.id,
      title: `${outputTitleFallbacks[version.outputType]} v${version.version} generated`,
      date: formatShortDate(version.createdAt),
      detail: "",
      icon: "document" as const,
      tone: outputTone(version.outputType),
      badge: "",
      timestamp: Date.parse(version.createdAt),
    }));
  return [
    ...updateItems,
    ...versionItems,
    {
      id: `${project.id}-created`,
      title: "Project created",
      date: formatShortDate(project.createdAt),
      detail: "",
      icon: "file" as const,
      tone: "neutral" as const,
      badge: "",
      timestamp: Date.parse(project.createdAt),
    },
  ].sort((first, second) => second.timestamp - first.timestamp);
}

function activityDetail(update: ProjectUpdate) {
  const facts = update.extractedFacts.length ? `${update.extractedFacts.length} new ${plural("fact", update.extractedFacts.length)}` : "";
  const questions = update.openQuestions.length ? `${update.openQuestions.length} open ${plural("question", update.openQuestions.length)}` : "";
  const impacts = update.affectedOutputs.length ? `impacts ${update.affectedOutputs.length} ${plural("output", update.affectedOutputs.length)}` : "";
  return [facts, questions, impacts].filter(Boolean).join(", ");
}

function latestVisibleVersion(versions: ArtifactVersion[], outputType: OutputType) {
  return versions
    .filter((version) => version.outputType === outputType && (version.status === "current" || version.status === "needs_refresh"))
    .sort((first, second) => second.version - first.version)[0];
}

function uniqueOutputTypes(values: OutputType[]): OutputType[] {
  return Array.from(new Set(values)).sort((first, second) => outputOrder.indexOf(first) - outputOrder.indexOf(second));
}

function inferUpdateType(text: string, sourceLabel: string): ProjectUpdateType {
  const lower = `${sourceLabel} ${text}`.toLowerCase();
  if (lower.includes("feedback")) return "stakeholder_feedback";
  if (lower.includes("meeting") || lower.includes("notes")) return "meeting_notes";
  return "manual_note";
}

function inferSourceLabel(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("meeting")) return "Meeting notes";
  if (lower.includes("feedback")) return "Stakeholder feedback";
  return "Project update";
}

function withOptionalSourceDate(text: string, date: string) {
  return date ? `${text.trim()}\n\nSource date: ${date}` : text;
}

function overviewSubtitle(project: Project) {
  const title = project.opportunityAudience?.customOpportunityTitle || project.name.split("-").slice(1).join("-").trim();
  if (project.name.toLowerCase().includes("hkjc") && project.name.toLowerCase().includes("vaccine")) {
    return "Investment case for therapeutic vaccine development in Asia";
  }
  return title ? `Investment case for ${title.toLowerCase()}` : "Living investment case workspace";
}

function initials(value: string) {
  const tokens = value.split(/[^a-z0-9]+/i).filter(Boolean);
  if (!tokens.length) return "IC";
  if (tokens[0].toUpperCase() === "HKJC") return "HK";
  return tokens.slice(0, 2).map((token) => token[0]?.toUpperCase()).join("");
}

function outputLabel(outputType: OutputType) {
  return functionalOutputs.find((output) => output.id === outputType)?.label || outputType.replace(/_/g, " ");
}

function outputTone(outputType: OutputType) {
  if (outputType === "investment_case") return "blue";
  if (outputType === "one_page") return "green";
  if (outputType === "talking_points") return "amber";
  return "neutral";
}

function updateIcon(update: ProjectUpdate) {
  if (update.sourceLabel.toLowerCase().endsWith(".xlsx")) return "xlsx" as const;
  if (update.updateType === "meeting_notes") return "people" as const;
  if (update.updateType === "document_upload") return "document" as const;
  return "file" as const;
}

function updateIconTone(update: ProjectUpdate) {
  if (update.sourceLabel.toLowerCase().endsWith(".xlsx")) return "green";
  if (update.updateType === "meeting_notes") return "purple";
  return "blue";
}

function formatShortDate(value: string) {
  if (!value) return "Unresolved";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatRelativeDate(value: string) {
  if (!value) return "unresolved";
  const date = new Date(value);
  const today = new Date();
  const diffMs = today.getTime() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatShortDate(value);
}

function plural(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

function decisionLabel(decision: OutputChangeDecision) {
  if (decision === "ignored") return "Ignored";
  if (decision === "edited") return "Edited";
  return "Accepted";
}
