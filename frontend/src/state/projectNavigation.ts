import type { Project } from "../types";

export type ProjectResumeTarget = {
  label: string;
  path: string;
  status: string;
  tone: "as-needed" | "optional" | "required";
};

export function projectResumeTarget(project: Project): ProjectResumeTarget {
  const pendingUpdates = project.memorySummary?.pendingUpdateCount || 0;
  const needsRefresh = project.memorySummary?.needsRefreshCount || 0;

  if (pendingUpdates > 0 || needsRefresh > 0) {
    return {
      label: "Review updates",
      path: `/projects/${project.id}/updates`,
      status: needsRefresh > 0 ? "Needs refresh" : "Update review",
      tone: "required",
    };
  }

  if (project.generationId) {
    return {
      label: "Review outputs",
      path: `/projects/${project.id}/results`,
      status: "Generated",
      tone: "optional",
    };
  }

  if (!project.task?.selectedTaskId) {
    return {
      label: "Describe task",
      path: `/projects/${project.id}/task`,
      status: "Not started",
      tone: "as-needed",
    };
  }

  const audienceReady = Boolean(project.opportunityAudience?.audienceId);
  const sourceReady =
    project.opportunityAudience?.sourceMode === "new"
      ? Boolean(project.extractionId)
      : Boolean(project.opportunityAudience?.opportunityId);

  if (!audienceReady || !sourceReady) {
    return {
      label: "Select source",
      path: `/projects/${project.id}/opportunity-audience`,
      status: "Needs setup",
      tone: "as-needed",
    };
  }

  if (project.opportunityAudience?.sourceMode === "new" && !project.reviewSetup?.sourceReadiness.ready) {
    return {
      label: "Review source",
      path: `/projects/${project.id}/extraction-review`,
      status: "Source review",
      tone: "as-needed",
    };
  }

  if (!project.reviewSetup?.confirmed) {
    return {
      label: "Review setup",
      path: `/projects/${project.id}/review-setup`,
      status: "In review",
      tone: "as-needed",
    };
  }

  return {
    label: "Generate",
    path: `/projects/${project.id}/generate`,
    status: "Ready",
    tone: "required",
  };
}
