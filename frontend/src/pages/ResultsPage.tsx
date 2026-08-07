import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { OutputDocument } from "../components/OutputDocument";
import type { CitationRef, ExportFormat, GeneratedOutput, GenerationResult, Project } from "../types";

type ResultsPageProps = {
  project: Project;
  generation?: GenerationResult | null;
  onProject: (project: Project) => void;
  onGeneration: (generation: GenerationResult) => void;
  onNavigate: (path: string) => void;
};

export function ResultsPage({ project, generation, onProject, onGeneration, onNavigate }: ResultsPageProps) {
  const [activeOutputId, setActiveOutputId] = useState("");
  const [editedOutputs, setEditedOutputs] = useState<GeneratedOutput[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [drawerCitation, setDrawerCitation] = useState<CitationRef | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportingOutputId, setExportingOutputId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const exportExtensions: Record<ExportFormat, string> = {
    pdf: "pdf",
    docx: "docx",
    pptx: "pptx",
    markdown: "md",
    txt: "txt",
  };

  const exportLabels: Record<ExportFormat, string> = {
    pdf: "PDF",
    docx: "DOCX",
    pptx: "PPTX",
    markdown: "Markdown",
    txt: "Text",
  };

  useEffect(() => {
    let active = true;
    async function loadGeneration() {
      if (!project.generationId) return;
      const result = await api.generation(project.generationId);
      if (!active) return;
      onGeneration(result);
      setEditedOutputs(result.outputs);
      setActiveOutputId((current) => current || result.outputs[0]?.id || "");
    }
    if (generation) {
      setEditedOutputs(generation.outputs);
      setActiveOutputId((current) => current || generation.outputs[0]?.id || "");
    } else {
      loadGeneration().catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [generation, onGeneration, project.generationId]);

  const activeOutput = useMemo(
    () => editedOutputs.find((output) => output.id === activeOutputId) || editedOutputs[0],
    [activeOutputId, editedOutputs],
  );
  const originalOutput = generation?.outputs.find((output) => output.id === activeOutput?.id);
  const activeGenerationId = generation?.generationId || project.generationId || "";

  function editSection(sectionId: string, body: string) {
    setEditedOutputs((outputs) =>
      outputs.map((output) => ({
        ...output,
        sections: output.sections.map((section) => (section.id === sectionId ? { ...section, body } : section)),
      })),
    );
  }

  function resetSection(sectionId: string) {
    const original = generation?.outputs
      .flatMap((output) => output.sections)
      .find((section) => section.id === sectionId);
    if (original) {
      editSection(sectionId, original.body);
    }
  }

  async function regenerateSection(sectionId: string) {
    if (!generation) return;
    const section = await api.regenerateSection(generation.generationId, sectionId);
    setEditedOutputs((outputs) =>
      outputs.map((output) => ({
        ...output,
        sections: output.sections.map((existing) => (existing.id === sectionId ? section : existing)),
      })),
    );
  }

  async function resolveFinding(findingId: string, resolved: boolean) {
    if (!generation) return;
    const updated = await api.updateFinding(generation.generationId, findingId, resolved);
    onGeneration(updated);
  }

  function filenameSafe(value: string) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    return slug || "investment-case-draft";
  }

  async function exportOutput(output: GeneratedOutput, format: ExportFormat) {
    setExportingOutputId(output.id);
    setExportingFormat(format);
    setExportStatus("");
    try {
      const blob = await api.exportDraft(project.id, format, {
        output,
        informationNeeded: generation?.informationNeeded || [],
        reviewFindings: generation?.reviewFindings || [],
        metadata: generation?.metadata || { mode: "unknown" },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filenameSafe(output.title)}.${exportExtensions[format]}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportStatus(`Draft ${exportLabels[format]} downloaded.`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Export could not be completed.");
    } finally {
      setExportingOutputId(null);
      setExportingFormat(null);
    }
  }

  async function saveVersion() {
    if (!activeOutput || !activeGenerationId) return;
    setSavingVersion(true);
    setSaveStatus("");
    try {
      const version = await api.saveArtifactVersion(project.id, {
        generationId: activeGenerationId,
        output: activeOutput,
      });
      const [updatedGeneration, updatedProject] = await Promise.all([
        api.generation(activeGenerationId),
        api.project(project.id),
      ]);
      onGeneration(updatedGeneration);
      onProject(updatedProject);
      setSaveStatus(`${activeOutput.title} saved as v${version.version}. Version history is in Project Overview.`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Version could not be saved.");
    } finally {
      setSavingVersion(false);
    }
  }

  if (!project.generationId && !generation) {
    return (
      <section className="panel full-panel">
        <h2>No generated materials yet</h2>
        <button className="primary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/generate`)}>
          Go to Generate
        </button>
      </section>
    );
  }

  if (!activeOutput) {
    return <section className="panel full-panel"><h2>Loading results</h2></section>;
  }

  return (
    <section className="results-layout">
      <div className="results-main">
        <section className="results-memory-panel">
          <div>
            <p className="eyebrow">Project Overview</p>
            <h3>Keep materials current</h3>
            <p>Add new notes, documents, or feedback and review which outputs are affected.</p>
          </div>
          <div className="memory-summary-strip">
            <span><strong>{project.memorySummary?.updateCount || 0}</strong> updates</span>
            <span><strong>{project.memorySummary?.approvedMemoryCount || 0}</strong> approved items</span>
            <span><strong>{project.memorySummary?.needsRefreshCount || 0}</strong> need refresh</span>
          </div>
          <button className="primary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/updates`)}>
            <Icon name="plus" />
            Add update
          </button>
        </section>
        <div className="tabs" role="tablist" aria-label="Generated outputs">
          {editedOutputs.map((output) => (
            <button key={output.id} type="button" className={output.id === activeOutput.id ? "active" : ""} onClick={() => setActiveOutputId(output.id)}>
              {output.title}
            </button>
          ))}
        </div>
        <OutputDocument
          output={activeOutput}
          sections={activeOutput.sections}
          editingSectionId={editingSectionId}
          onBeginEdit={setEditingSectionId}
          onEditSection={editSection}
          onReset={resetSection}
          onRegenerate={regenerateSection}
          onCitation={setDrawerCitation}
          onExport={exportOutput}
          isExporting={exportingOutputId === activeOutput.id}
          exportingFormat={exportingOutputId === activeOutput.id ? exportingFormat : null}
          exportStatus={exportStatus}
        />
        {originalOutput && <p className="muted">Local edits are held in the browser until you save a version or export the visible draft.</p>}
      </div>
      <aside className="results-side">
        <section className="panel">
          <h3>Source citations</h3>
          <div className="stack-list">
            {activeOutput.sections.flatMap((section) => section.citations).map((citation) => (
              <button className="citation-chip wide" key={`${citation.sourceId}-${citation.locator}`} type="button" onClick={() => setDrawerCitation(citation)}>
                {citation.label} {citation.locator}
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>Information needed</h3>
          {(generation?.informationNeeded || []).map((item) => (
            <p className="info-flag" key={item.id}>{item.message}</p>
          ))}
        </section>
        <section className="panel">
          <h3>Integrity findings</h3>
          <div className="stack-list">
            {(generation?.reviewFindings || []).map((finding) => (
              <label className={`finding-row ${finding.severity}`} key={finding.id}>
                <input type="checkbox" checked={finding.resolved} onChange={(event) => resolveFinding(finding.id, event.currentTarget.checked)} />
                <span>
                  <strong>{finding.severity}</strong>
                  <small>{finding.message}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>Setup summary</h3>
          <dl>
            <div><dt>Outcome</dt><dd>{project.opportunityAudience?.intendedOutcome || "Unresolved"}</dd></div>
            <div><dt>Review status</dt><dd>{project.reviewSetup?.confirmed ? "Confirmed" : "Unconfirmed"}</dd></div>
            <div><dt>Mode</dt><dd>{generation?.metadata.mode || "Unknown"}</dd></div>
            <div><dt>Updates</dt><dd>{project.memorySummary?.updateCount || 0} tracked</dd></div>
          </dl>
          {Boolean(project.memorySummary?.needsRefreshCount) && (
            <p className="info-flag">{project.memorySummary?.needsRefreshCount} output version needs refresh.</p>
          )}
          <div className="action-stack">
            <button className="secondary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/updates`)}>
              <Icon name="plus" />
              Add update
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/review-setup`)}>
              Return to setup
            </button>
            <button className="primary-button" type="button" disabled={savingVersion || !activeGenerationId} onClick={() => void saveVersion()}>
              <Icon name="save" />
              {savingVersion ? "Saving version" : "Save version"}
            </button>
            {saveStatus && <p className="saved-note">{saveStatus}</p>}
          </div>
        </section>
      </aside>
      {drawerCitation && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Source excerpt">
          <button className="icon-button drawer-close" type="button" title="Close" onClick={() => setDrawerCitation(null)}>
            <Icon name="close" />
          </button>
          <p className="eyebrow">Source excerpt</p>
          <h3>{drawerCitation.label}</h3>
          <p className="muted">{drawerCitation.locator}</p>
          <blockquote>{drawerCitation.excerpt || "Synthetic excerpt for this citation."}</blockquote>
        </div>
      )}
    </section>
  );
}
