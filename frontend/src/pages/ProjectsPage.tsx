import type { Project } from "../types";
import { Icon } from "../components/Icons";

type ProjectsPageProps = {
  projects: Project[];
  onNewProject: () => void;
  onNavigate: (path: string) => void;
};

export function ProjectsPage({ projects, onNewProject, onNavigate }: ProjectsPageProps) {
  return (
    <section className="panel full-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">In-memory demo cases</p>
          <h2>My projects</h2>
        </div>
        <button className="primary-button" type="button" onClick={onNewProject}>
          <Icon name="plus" />
          New project
        </button>
      </div>
      <div className="table-list">
        {projects.map((project) => (
          <button className="table-row" key={project.id} type="button" onClick={() => onNavigate(`/projects/${project.id}/task`)}>
            <span>{project.name}</span>
            <span>{project.task?.taskLabel || "Setup not started"}</span>
            <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
            <Icon name="arrow" />
          </button>
        ))}
      </div>
    </section>
  );
}
