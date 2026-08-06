import { Icon, type IconName } from "../components/Icons";
import type { AppConfig, AudienceProfile, Opportunity, Project, SourceDocument } from "../types";

type HomePageProps = {
  projects: Project[];
  opportunities: Opportunity[];
  audiences: AudienceProfile[];
  config: AppConfig | null;
  onNewProject: () => void;
  onNavigate: (path: string) => void;
};

type DashboardAction = {
  label: string;
  path: string;
};

type Recommendation = {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  action: DashboardAction;
  tone: "priority" | "review" | "ready";
};

export function HomePage({
  projects,
  opportunities,
  audiences,
  config,
  onNewProject,
  onNavigate,
}: HomePageProps) {
  const sourceDocuments = config?.knowledgeSources || uniqueSources(opportunities);
  const selectedOutputCount = projects.reduce(
    (total, project) => total + (project.opportunityAudience?.selectedOutputs.length || 0),
    0,
  );
  const unresolvedSetupCount = projects.filter((project) => !project.reviewSetup?.confirmed).length;
  const approvedSourceCount = sourceDocuments.filter((source) => source.status === "Approved").length;
  const exampleSourceCount = sourceDocuments.filter((source) => source.status !== "Approved").length;
  const focusProject = projects[0] || null;
  const focusOpportunity = focusProject ? findOpportunity(focusProject, opportunities) : null;
  const focusAudience = focusProject ? findAudience(focusProject, audiences) : null;
  const recommendations = buildRecommendations(projects, opportunities, audiences);

  return (
    <section className="dashboard-page" aria-label="Workspace dashboard">
      <div className="dashboard-topline">
        <div>
          <p className="eyebrow">Workspace dashboard</p>
          <h2>Welcome back, Chen</h2>
          <p>
            {projects.length} active projects, {selectedOutputCount} planned outputs, and {unresolvedSetupCount} projects
            still need human confirmation before investor-ready use.
          </p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-button" type="button" onClick={() => onNavigate("/opportunity-library")}>
            <Icon name="library" />
            Opportunity library
          </button>
          <button className="primary-button" type="button" onClick={onNewProject}>
            <Icon name="plus" />
            New project
          </button>
        </div>
      </div>

      <div className="metric-grid" aria-label="Workspace summary">
        <MetricCard icon="folder" label="Active projects" value={String(projects.length)} hint="Across donor and proposal work" />
        <MetricCard icon="flask" label="Investable concepts" value={String(opportunities.length)} hint="Available in the library" />
        <MetricCard icon="presentation" label="Planned outputs" value={String(selectedOutputCount)} hint="Decks, one-pagers, talking points" />
        <MetricCard icon="shield" label="Unresolved setup" value={String(unresolvedSetupCount)} hint="Roles and evidence to confirm" tone="warning" />
      </div>

      <div className="dashboard-grid">
        <section className="panel dashboard-main-panel">
          <div className="panel-header dashboard-panel-header">
            <div>
              <p className="eyebrow">Continue work</p>
              <h3>Recent projects</h3>
            </div>
            <button className="ghost-link" type="button" onClick={() => onNavigate("/projects")}>
              View all
              <Icon name="arrow" />
            </button>
          </div>
          <div className="dashboard-project-list">
            {projects.slice(0, 4).map((project, index) => {
              const opportunity = findOpportunity(project, opportunities);
              const audience = findAudience(project, audiences);
              const nextStep = getNextStep(project);
              return (
                <button
                  className="dashboard-project-row"
                  type="button"
                  key={project.id}
                  onClick={() => onNavigate(nextStep.path)}
                >
                  <span className="project-status-marker" aria-hidden="true">{index + 1}</span>
                  <span>
                    <strong>{project.name}</strong>
                    <small>
                      {opportunity?.title || "Opportunity unresolved"} · {audience?.name || "Audience unresolved"}
                    </small>
                  </span>
                  <span className={`status-badge ${nextStep.tone}`}>{nextStep.status}</span>
                  <span className="row-action">
                    {nextStep.label}
                    <Icon name="arrow" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel recommendations-panel">
          <div className="assistant-heading compact">
            <Icon name="sparkles" />
            <h3>Recommended next</h3>
          </div>
          <div className="recommendation-list">
            {recommendations.map((item) => (
              <button
                className={`recommendation-row ${item.tone}`}
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.action.path)}
              >
                <span className="recommendation-icon"><Icon name={item.icon} /></span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                  <em>{item.action.label}</em>
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className="dashboard-lower-grid">
        <section className="panel pipeline-panel">
          <div className="panel-header dashboard-panel-header">
            <div>
              <p className="eyebrow">Opportunity pipeline</p>
              <h3>Concept readiness</h3>
            </div>
            <button className="ghost-link" type="button" onClick={() => onNavigate("/opportunity-library")}>
              Open library
              <Icon name="arrow" />
            </button>
          </div>
          <div className="pipeline-columns">
            <PipelineColumn
              title="Ready for narrative"
              count={opportunities.filter((opportunity) => opportunity.validationStatus.includes("Validated")).length}
              items={opportunities.filter((opportunity) => opportunity.validationStatus.includes("Validated")).slice(0, 2)}
            />
            <PipelineColumn
              title="Needs source review"
              count={opportunities.filter((opportunity) => !opportunity.validationStatus.includes("Validated")).length}
              items={opportunities.filter((opportunity) => !opportunity.validationStatus.includes("Validated")).slice(0, 2)}
            />
            <PipelineColumn
              title="Capital path unresolved"
              count={projects.filter((project) => !project.reviewSetup?.confirmed).length}
              projects={projects.filter((project) => !project.reviewSetup?.confirmed).slice(0, 2)}
            />
          </div>
        </section>

        <section className="panel evidence-panel">
          <div className="panel-header dashboard-panel-header">
            <div>
              <p className="eyebrow">Evidence health</p>
              <h3>Source coverage</h3>
            </div>
            <Icon name="shield" />
          </div>
          <div className="evidence-summary">
            <div>
              <strong>{approvedSourceCount}</strong>
              <span>Approved sources</span>
            </div>
            <div>
              <strong>{exampleSourceCount}</strong>
              <span>Example source sets</span>
            </div>
          </div>
          <div className="source-health-list">
            {sourceDocuments.slice(0, 4).map((source) => (
              <span key={source.id}>
                <Icon name={sourceIcon(source)} />
                <strong>{source.title}</strong>
                <small>{source.status}</small>
              </span>
            ))}
          </div>
        </section>
      </div>

      {focusProject && (
        <section className="panel focus-strip">
          <span className="focus-icon"><Icon name="target" /></span>
          <span>
            <strong>Current focus</strong>
            <small>
              {focusProject.name}: {focusOpportunity?.summary || "Opportunity summary unresolved"} Target audience is{" "}
              {focusAudience?.name || "unresolved"}.
            </small>
          </span>
          <button className="outline-action" type="button" onClick={() => onNavigate(getNextStep(focusProject).path)}>
            Continue
            <Icon name="arrow" />
          </button>
        </section>
      )}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "warning";
}) {
  return (
    <section className={`metric-card ${tone}`}>
      <span><Icon name={icon} /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
        <em>{hint}</em>
      </div>
    </section>
  );
}

function PipelineColumn({
  title,
  count,
  items = [],
  projects = [],
}: {
  title: string;
  count: number;
  items?: Opportunity[];
  projects?: Project[];
}) {
  return (
    <div className="pipeline-column">
      <div>
        <strong>{title}</strong>
        <span>{count}</span>
      </div>
      {items.map((item) => (
        <small key={`opportunity-${item.id}`}>{item.title}</small>
      ))}
      {projects.map((project) => (
        <small key={`project-${project.id}`}>{project.name}</small>
      ))}
    </div>
  );
}

function buildRecommendations(
  projects: Project[],
  opportunities: Opportunity[],
  audiences: AudienceProfile[],
): Recommendation[] {
  const primaryProject = projects[0];
  const primaryOpportunity = primaryProject ? findOpportunity(primaryProject, opportunities) : null;
  const primaryAudience = primaryProject ? findAudience(primaryProject, audiences) : null;
  const nextPrimaryStep = primaryProject ? getNextStep(primaryProject) : null;

  return [
    primaryProject && nextPrimaryStep
      ? {
          id: "continue-primary",
          icon: "target",
          title: `Continue ${primaryProject.name}`,
          detail: `${primaryOpportunity?.title || "Opportunity unresolved"} for ${primaryAudience?.name || "audience unresolved"}`,
          action: { label: nextPrimaryStep.label, path: nextPrimaryStep.path },
          tone: "priority",
        }
      : {
          id: "start-project",
          icon: "plus",
          title: "Start a source-grounded project",
          detail: "Create a task, then select or create an investable concept.",
          action: { label: "New project", path: "/" },
          tone: "priority",
        },
    {
      id: "capital-path",
      icon: "shield",
      title: "Confirm capital pathway",
      detail: "Funding recipient and investment vehicle should stay unresolved until source-backed.",
      action: { label: "Review setup", path: primaryProject ? `/projects/${primaryProject.id}/review-setup` : "/projects" },
      tone: "review",
    },
    {
      id: "library",
      icon: "library",
      title: "Scan ready concepts",
      detail: `${opportunities.length} opportunities are available for donor-specific narrative work.`,
      action: { label: "Open library", path: "/opportunity-library" },
      tone: "ready",
    },
  ];
}

function getNextStep(project: Project): { label: string; path: string; status: string; tone: string } {
  if (!project.task?.selectedTaskId) {
    return { label: "Describe task", path: `/projects/${project.id}/task`, status: "Not started", tone: "as-needed" };
  }
  if (!project.opportunityAudience?.opportunityId || !project.opportunityAudience.audienceId) {
    return {
      label: "Select opportunity",
      path: `/projects/${project.id}/opportunity-audience`,
      status: "Needs setup",
      tone: "as-needed",
    };
  }
  if (!project.reviewSetup?.confirmed) {
    return { label: "Review setup", path: `/projects/${project.id}/review-setup`, status: "In review", tone: "as-needed" };
  }
  if (!project.generationId) {
    return { label: "Generate", path: `/projects/${project.id}/generate`, status: "Ready", tone: "required" };
  }
  return { label: "Review outputs", path: `/projects/${project.id}/results`, status: "Generated", tone: "optional" };
}

function findOpportunity(project: Project, opportunities: Opportunity[]) {
  return opportunities.find((opportunity) => opportunity.id === project.opportunityAudience?.opportunityId) || null;
}

function findAudience(project: Project, audiences: AudienceProfile[]) {
  return audiences.find((audience) => audience.id === project.opportunityAudience?.audienceId) || null;
}

function uniqueSources(opportunities: Opportunity[]) {
  const sources = new Map<string, SourceDocument>();
  opportunities.forEach((opportunity) => {
    opportunity.sourceList.forEach((source) => sources.set(source.id, source));
  });
  return [...sources.values()];
}

function sourceIcon(source: SourceDocument): IconName {
  if (source.sourceType === "PDF") return "pdf";
  if (source.sourceType === "DOCX") return "docx";
  if (source.sourceType === "XLSX") return "xlsx";
  return "file";
}
