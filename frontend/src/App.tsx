import { useEffect, useMemo, useState } from "react";

import { api } from "./api/client";
import { Shell } from "./components/Shell";
import { GeneratePage } from "./pages/GeneratePage";
import { HomePage } from "./pages/HomePage";
import { ExtractionReviewPage } from "./pages/ExtractionReviewPage";
import { DonorProfilesPage, KnowledgeBasePage, OpportunityLibraryPage, PlaceholderPage } from "./pages/LibraryPages";
import { OpportunityAudiencePage } from "./pages/OpportunityAudiencePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ResultsPage } from "./pages/ResultsPage";
import { ReviewSetupPage } from "./pages/ReviewSetupPage";
import { TaskPage } from "./pages/TaskPage";
import type { AppConfig, AudienceProfile, GenerationResult, Opportunity, Project } from "./types";

export function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [audiences, setAudiences] = useState<AudienceProfile[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const projectId = useMemo(() => path.match(/^\/projects\/([^/]+)/)?.[1] || "", [path]);

  useEffect(() => {
    function onPopState() {
      setPath(window.location.pathname);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [nextConfig, nextProjects, nextOpportunities, nextAudiences] = await Promise.all([
        api.config(),
        api.projects(),
        api.opportunities(),
        api.audiences(),
      ]);
      if (!active) return;
      setConfig(nextConfig);
      setProjects(nextProjects);
      setOpportunities(nextOpportunities);
      setAudiences(nextAudiences);
      setLoading(false);
    }
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Application data could not be loaded.");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setCurrentProject(null);
      return;
    }
    let active = true;
    api.project(projectId)
      .then((project) => {
        if (active) setCurrentProject(project);
      })
      .catch(() => {
        if (active) setError("Project not found.");
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", nextPath);
    window.scrollTo({ top: 0, left: 0 });
    setPath(nextPath);
  }

  async function createProject() {
    const project = await api.createProject();
    setProjects((current) => [project, ...current]);
    setCurrentProject(project);
    navigate(`/projects/${project.id}/task`);
  }

  function updateProject(project: Project) {
    setCurrentProject(project);
    setProjects((current) => {
      const withoutProject = current.filter((item) => item.id !== project.id);
      return [project, ...withoutProject];
    });
  }

  let content;
  if (loading) {
    content = <section className="panel full-panel"><h2>Loading Investment Case Generator</h2></section>;
  } else if (error) {
    content = <section className="panel full-panel"><h2>{error}</h2></section>;
  } else if (path === "/" || path === "/home") {
    content = (
      <HomePage
        projects={projects}
        opportunities={opportunities}
        audiences={audiences}
        config={config}
        onNewProject={createProject}
        onNavigate={navigate}
      />
    );
  } else if (path === "/projects") {
    content = <ProjectsPage projects={projects} onNewProject={createProject} onNavigate={navigate} />;
  } else if (path === "/opportunity-library") {
    content = <OpportunityLibraryPage opportunities={opportunities} audiences={audiences} config={config} />;
  } else if (path === "/donor-profiles") {
    content = <DonorProfilesPage opportunities={opportunities} audiences={audiences} config={config} />;
  } else if (path === "/knowledge-base") {
    content = <KnowledgeBasePage opportunities={opportunities} audiences={audiences} config={config} />;
  } else if (path === "/templates") {
    content = <PlaceholderPage title="Templates" />;
  } else if (path === "/help") {
    content = <PlaceholderPage title="Help & resources" />;
  } else if (!currentProject) {
    content = <section className="panel full-panel"><h2>Loading project</h2></section>;
  } else if (path.endsWith("/task")) {
    content = <TaskPage project={currentProject} onProject={updateProject} onNavigate={navigate} />;
  } else if (path.endsWith("/opportunity-audience")) {
    content = (
      <OpportunityAudiencePage
        project={currentProject}
        opportunities={opportunities}
        audiences={audiences}
        config={config}
        onProject={updateProject}
        onNavigate={navigate}
      />
    );
  } else if (path.endsWith("/extraction-review")) {
    content = <ExtractionReviewPage project={currentProject} onProject={updateProject} onNavigate={navigate} />;
  } else if (path.endsWith("/review-setup")) {
    content = (
      <ReviewSetupPage
        project={currentProject}
        opportunities={opportunities}
        onProject={updateProject}
        onNavigate={navigate}
      />
    );
  } else if (path.endsWith("/generate")) {
    content = (
      <GeneratePage
        project={currentProject}
        config={config}
        generation={generation}
        onProject={updateProject}
        onGeneration={setGeneration}
        onNavigate={navigate}
      />
    );
  } else if (path.endsWith("/results")) {
    content = (
      <ResultsPage
        project={currentProject}
        generation={generation}
        onGeneration={setGeneration}
        onNavigate={navigate}
      />
    );
  } else {
    content = (
      <HomePage
        projects={projects}
        opportunities={opportunities}
        audiences={audiences}
        config={config}
        onNewProject={createProject}
        onNavigate={navigate}
      />
    );
  }

  return (
    <Shell
      currentPath={path}
      project={currentProject}
      projects={projects}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((current) => !current)}
      onNavigate={navigate}
      onNewProject={createProject}
    >
      {content}
    </Shell>
  );
}
