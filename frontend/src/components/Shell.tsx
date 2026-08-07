import type { ReactNode } from "react";

import type { Project } from "../types";
import { wizardSteps } from "../state/options";
import { Icon } from "./Icons";

type ShellProps = {
  children: ReactNode;
  currentPath: string;
  project?: Project | null;
  projects: Project[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (path: string) => void;
  onNewProject: () => void;
};

const navItems = [
  { label: "Home", path: "/", icon: "home" },
  { label: "My projects", path: "/projects", icon: "folder" },
  { label: "Opportunity library", path: "/opportunity-library", icon: "library" },
  { label: "Donor profiles", path: "/donor-profiles", icon: "profile" },
  { label: "Knowledge base", path: "/knowledge-base", icon: "book" },
  { label: "Templates", path: "/templates", icon: "template" },
] as const;

const stepSubtitles: Record<string, string> = {
  task: "What are you preparing?",
  "opportunity-audience": "Select opportunity and audience",
  "review-setup": "Review recommended approach",
  generate: "Generate your materials",
};

export function Shell({
  children,
  currentPath,
  project,
  projects,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onNewProject,
}: ShellProps) {
  const projectRouteMatch = currentPath.match(/^\/projects\/([^/]+)\/([^/]+)/);
  const rawStep = projectRouteMatch?.[2] || "";
  const currentStep = rawStep === "extraction-review" ? "opportunity-audience" : rawStep === "updates" ? "generate" : rawStep;
  const isProjectFlow = Boolean(projectRouteMatch);
  const currentStepIndex = wizardSteps.findIndex((step) => step.path === currentStep);

  function isNavActive(path: string) {
    if (currentPath === path) return true;
    if (isProjectFlow && (rawStep === "results" || rawStep === "updates")) return path === "/projects";
    if (isProjectFlow && currentStep === "task" && path === "/") return true;
    if (isProjectFlow && currentStep !== "task" && path === "/opportunity-library") return true;
    return false;
  }

  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Primary">
        <button className="brand gates-brand" type="button" onClick={() => onNavigate("/")}>
          <span className="gates-wordmark" aria-hidden="true">
            <span>GATES</span>
            <em>foundation</em>
          </span>
          {!collapsed && <span className="sr-only">Gates Foundation</span>}
        </button>
        <button className="new-project-button" type="button" onClick={onNewProject}>
          <Icon name="plus" />
          {!collapsed && <span>New project</span>}
        </button>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              className={isNavActive(item.path) ? "nav-item active" : "nav-item"}
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        {!collapsed && (
          <div className="recent-projects" aria-label="Recent projects">
            <h2>Recent projects</h2>
            {(projects.length ? projects : []).slice(0, 3).map((item, index) => (
              <button
                type="button"
                className={`recent-project ${index === 0 ? "active" : ""}`}
                key={item.id}
                onClick={() => onNavigate(`/projects/${item.id}/task`)}
              >
                <strong>{item.name}</strong>
                <span>
                  {index === 0 ? "Donor deck" : index === 1 ? "Proposal" : "One-pager"}
                  <b>{index === 0 ? "In review" : index === 1 ? "Draft" : "Approved"}</b>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="sidebar-footer">
          <button className="nav-item" type="button" onClick={() => onNavigate("/help")}>
            <Icon name="help" />
            {!collapsed && <span>Help & resources</span>}
          </button>
          <button className="nav-item collapse-button" type="button" onClick={onToggleCollapsed}>
            <Icon name="collapse" />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="app-header">
          <div className="app-title">
            <h1>Investment Case Generator</h1>
          </div>
          <div className="top-actions" aria-label="User actions">
            <button className="header-icon-button" type="button" aria-label="Help">
              <Icon name="help" />
            </button>
            <button className="header-icon-button has-alert" type="button" aria-label="Notifications">
              <Icon name="bell" />
            </button>
            <button className="profile-button" type="button">
              <span>CW</span>
              <strong>Chen Wang</strong>
              <Icon name="chevron-down" />
            </button>
          </div>
        </header>
        {isProjectFlow && (
          <div className="stepper" aria-label="Project workflow">
            {wizardSteps.map((step, index) => {
              const isActive = currentStep === step.path;
              const isDone = currentStepIndex > index || rawStep === "results" || rawStep === "updates";
              return (
                <div className="step-wrap" key={step.id}>
                  <button
                    type="button"
                    className={`step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                    disabled={!project}
                    onClick={() => project && onNavigate(`/projects/${project.id}/${step.path}`)}
                  >
                    <span>{isDone ? <Icon name="check" /> : index + 1}</span>
                    {!collapsed && (
                      <div>
                        <strong>{step.label}</strong>
                        <small>{stepSubtitles[step.path]}</small>
                      </div>
                    )}
                  </button>
                  {index < wizardSteps.length - 1 && <i className="step-connector" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        )}
        <section className="workspace">{children}</section>
      </main>
    </div>
  );
}
