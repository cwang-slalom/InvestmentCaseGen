import { generationStages } from "./options";

export const GENERATION_ESTIMATE_SECONDS = 210;

const MAX_ESTIMATED_PROGRESS = 92;
const MIN_ACTIVE_PROGRESS = 6;
const stageProgressThresholds = [0, 12, 32, 56, 76, 88];

export function stageStatus(index: number, activeIndex: number, failed: boolean): "complete" | "active" | "pending" | "failed" {
  if (failed && index === activeIndex) {
    return "failed";
  }
  if (index < activeIndex) {
    return "complete";
  }
  if (index === activeIndex) {
    return "active";
  }
  return "pending";
}

export function nextStageIndex(activeIndex: number): number {
  return Math.min(activeIndex + 1, generationStages.length - 1);
}

export function estimatedGenerationPercent(elapsedSeconds: number): number {
  const safeElapsed = Math.max(0, elapsedSeconds);
  const easedProgress = 1 - Math.exp(-safeElapsed / 85);
  const estimate = MIN_ACTIVE_PROGRESS + easedProgress * (MAX_ESTIMATED_PROGRESS - MIN_ACTIVE_PROGRESS);

  return Math.min(MAX_ESTIMATED_PROGRESS, Math.round(estimate));
}

export function activeStageIndexForProgress(progress: number): number {
  const safeProgress = Math.max(0, progress);
  const nextThreshold = stageProgressThresholds.findIndex((threshold) => safeProgress < threshold);

  if (nextThreshold === -1) {
    return generationStages.length - 1;
  }

  return Math.max(0, nextThreshold - 1);
}

export function estimatedOutputPercent(overallProgress: number, selectedIndex: number): number {
  const offsetProgress = overallProgress - selectedIndex * 8;

  if (offsetProgress <= 0) {
    return 0;
  }

  return Math.min(96, Math.max(8, Math.round(offsetProgress)));
}

export function formatGenerationDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

export function estimatedRemainingLabel(elapsedSeconds: number): string {
  const remainingSeconds = GENERATION_ESTIMATE_SECONDS - elapsedSeconds;

  if (remainingSeconds <= 0) {
    return "Finalizing";
  }

  if (remainingSeconds < 60) {
    return `About ${Math.ceil(remainingSeconds / 10) * 10}s left`;
  }

  return `About ${Math.ceil(remainingSeconds / 60)} min left`;
}
