import type { ExtractedField, FieldValue, OutputType, ReviewRole } from "../types";

export type ValidationResult = {
  valid: boolean;
  messages: string[];
};

function result(messages: string[]): ValidationResult {
  return { valid: messages.length === 0, messages };
}

export function validateTask(selectedTaskId?: string | null, customDescription?: string | null): ValidationResult {
  return result(
    selectedTaskId || customDescription?.trim()
      ? []
      : ["Select a task card or describe what you need."],
  );
}

export function validateOpportunityAudience(input: {
  sourceMode: "existing" | "new";
  opportunityId?: string | null;
  extractionConfirmed?: boolean;
  audienceId?: string | null;
  intendedOutcome?: string | null;
  selectedOutputs: OutputType[];
}): ValidationResult {
  const messages: string[] = [];
  if (input.sourceMode === "existing" && !input.opportunityId) {
    messages.push("Select an opportunity.");
  }
  if (input.sourceMode === "new" && !input.extractionConfirmed) {
    messages.push("Review and confirm the extracted opportunity information.");
  }
  if (!input.audienceId) {
    messages.push("Select an audience or partner.");
  }
  if (!input.intendedOutcome) {
    messages.push("Select the intended meeting outcome.");
  }
  if (input.selectedOutputs.length < 1) {
    messages.push("Select at least one functional output.");
  }
  return result(messages);
}

export function validateExtraction(fields: ExtractedField[], confirmed: boolean): ValidationResult {
  const requiredUnverified = fields.filter((field) => field.metadata.required && !field.verified);
  const messages = [
    ...(requiredUnverified.length ? ["Verify each required extracted field."] : []),
    ...(!confirmed ? ["Confirm the extracted information before continuing."] : []),
  ];
  return result(messages);
}

export function validateReviewSetup(
  approachFields: FieldValue[],
  roles: ReviewRole[],
  confirmed: boolean,
  sourceReady: boolean,
): ValidationResult {
  const messages: string[] = [];
  if (approachFields.some((field) => field.metadata.required && !field.value.trim())) {
    messages.push("Complete all required review approach fields.");
  }
  if (!roles.some((role) => role.selected)) {
    messages.push("Select at least one planned review role.");
  }
  if (!sourceReady) {
    messages.push("Resolve blocking source-readiness issues before generation.");
  }
  if (!confirmed) {
    messages.push("Confirm the review setup.");
  }
  return result(messages);
}

export function canToggleOutput(current: OutputType[], output: OutputType): boolean {
  return current.includes(output) ? current.length > 1 : true;
}
