import type { ReactNode } from "react";

import type { Project } from "../types";
import { wizardSteps } from "../state/options";
import { Icon } from "./Icons";

type ShellProps = {
  children: ReactNode;
  currentPath: string;
  project?: Project | null;
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
  { label: "Help & resources", path: "/help", icon: "help" },
] as const;

export function Shell({
  children,
  currentPath,
  project,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onNewProject,
}: ShellProps) {
  const projectRouteMatch = currentPath.match(/^\/projects\/([^/]+)\/([^/]+)/);
  const currentStep = projectRouteMatch?.[2] || "";
  const isProjectFlow = Boolean(projectRouteMatch);

  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Primary">
        <button className="brand" type="button" onClick={() => onNavigate("/")}>
          <span className="brand-mark">IC</span>
          {!collapsed && <span>Investment Case Generator</span>}
        </button>
        <button className="new-project-button" type="button" onClick={onNewProject}>
          <Icon name="plus" />
          {!collapsed && <span>New project</span>}
        </button>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              className={currentPath === item.path ? "nav-item active" : "nav-item"}
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
        <button className="nav-item collapse-button" type="button" onClick={onToggleCollapsed}>
          <Icon name="collapse" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>
      <main className="main">
        <header className="app-header">
          <div>
            <p className="eyebrow">Phase 1 demo data - not persistent</p>
            <h1>{project?.name || "Investment Case Generator"}</h1>
          </div>
          <div className="header-status">
            <span className="status-dot" />
            Same-origin FastAPI runtime
          </div>
        </header>
        {isProjectFlow && (
          <div className="stepper" aria-label="Project workflow">
            {wizardSteps.map((step, index) => {
              const isActive = currentStep === step.path;
              const isDone = wizardSteps.findIndex((candidate) => candidate.path === currentStep) > index || currentStep === "results";
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                  onClick={() => project && onNavigate(`/projects/${project.id}/${step.path}`)}
                >
                  <span>{index + 1}</span>
                  {step.label}
                </button>
              );
            })}
            {currentStep === "results" && <span className="step active result-step">5 Review generated materials</span>}
          </div>
        )}
        <section className="workspace">{children}</section>
      </main>
    </div>
  );
}
