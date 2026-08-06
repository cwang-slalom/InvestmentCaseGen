import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { OutputDocument } from "../components/OutputDocument";
import type { CitationRef, GeneratedOutput, GenerationResult, Project } from "../types";

type ResultsPageProps = {
  project: Project;
  generation?: GenerationResult | null;
  onGeneration: (generation: GenerationResult) => void;
  onNavigate: (path: string) => void;
};

export function ResultsPage({ project, generation, onGeneration, onNavigate }: ResultsPageProps) {
  const [activeOutputId, setActiveOutputId] = useState("");
  const [editedOutputs, setEditedOutputs] = useState<GeneratedOutput[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [drawerCitation, setDrawerCitation] = useState<CitationRef | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportingOutputId, setExportingOutputId] = useState<string | null>(null);

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

  async function exportOutput(output: GeneratedOutput) {
    setExportingOutputId(output.id);
    setExportStatus("");
    try {
      const blob = await api.exportDocx(project.id, {
        output,
        informationNeeded: generation?.informationNeeded || [],
        reviewFindings: generation?.reviewFindings || [],
        metadata: generation?.metadata || { mode: "unknown" },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filenameSafe(output.title)}.docx`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportStatus("Draft DOCX downloaded.");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Export could not be completed.");
    } finally {
      setExportingOutputId(null);
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
          exportStatus={exportStatus}
        />
        {originalOutput && <p className="muted">Local edits are held in memory for this Phase 1 session.</p>}
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
          </dl>
          <div className="action-stack">
            <button className="secondary-button" type="button" onClick={() => onNavigate(`/projects/${project.id}/review-setup`)}>
              Return to setup
            </button>
            <button className="primary-button" type="button" onClick={() => setSaveStatus("Saved in memory for this running session.")}>
              <Icon name="save" />
              Save version
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
