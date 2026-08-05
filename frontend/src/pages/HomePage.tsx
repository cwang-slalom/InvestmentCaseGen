import type { Project } from "../types";
import { Icon } from "../components/Icons";

type HomePageProps = {
  projects: Project[];
  onNewProject: () => void;
  onNavigate: (path: string) => void;
};

export function HomePage({ projects, onNewProject, onNavigate }: HomePageProps) {
  return (
    <div className="page-grid two-column">
      <section className="panel intro-panel">
        <p className="eyebrow">Concept-first workflow</p>
        <h2>Prepare source-grounded investment materials</h2>
        <p>
          Start from a task, select or create an opportunity, confirm the audience and review plan,
          then generate a structured draft with citations and integrity findings.
        </p>
        <button className="primary-button" type="button" onClick={onNewProject}>
          <Icon name="plus" />
          New project
        </button>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Recent</p>
            <h2>My projects</h2>
          </div>
          <button className="secondary-button" type="button" onClick={() => onNavigate("/projects")}>
            View all
          </button>
        </div>
        <div className="stack-list">
          {projects.slice(0, 3).map((project) => (
            <button
              className="project-row"
              type="button"
              key={project.id}
              onClick={() => onNavigate(`/projects/${project.id}/task`)}
            >
              <span>
                <strong>{project.name}</strong>
                <small>{project.demoNotice}</small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
