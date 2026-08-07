import type { Project } from "../types";
import { Icon } from "../components/Icons";
import { projectResumeTarget } from "../state/projectNavigation";

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
        {projects.map((project) => {
          const resume = projectResumeTarget(project);
          return (
            <button className="table-row project-table-row" key={project.id} type="button" onClick={() => onNavigate(resume.path)}>
              <span>
                <strong>{project.name}</strong>
                <small>{project.task?.taskLabel || "Setup not started"}</small>
              </span>
              <span className="project-memory-meta">
                <strong>{project.memorySummary?.approvedMemoryCount || 0} memory items</strong>
                <small>{project.memorySummary?.updateCount || 0} project updates</small>
              </span>
              <span className={`status-badge ${resume.tone}`}>{resume.status}</span>
              <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
              <span className="row-action">
                {resume.label}
                <Icon name="arrow" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
