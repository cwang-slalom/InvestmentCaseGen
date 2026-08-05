import { generationStages } from "./options";

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
