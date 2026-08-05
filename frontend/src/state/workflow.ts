import type {
  AudienceProfile,
  ExtractedField,
  FieldValue,
  Opportunity,
  OutputType,
  ReviewRole,
} from "../types";
import { defaultSelectedOutputs } from "./options";
import { validateExtraction, validateOpportunityAudience, validateReviewSetup, validateTask } from "./validation";

export function suggestionFromSelection(opportunity: Opportunity, audience: AudienceProfile): FieldValue[] {
  const citation = {
    sourceId: opportunity.sourceList[0]?.id || "demo-source",
    label: opportunity.sourceList[0]?.title || "Demo source",
    locator: opportunity.sourceList[0]?.locator || "",
    excerpt: opportunity.sourceList[0]?.excerpt || "",
  };
  return [
    suggestion("relationship_stage", "Relationship stage", audience.relationshipStage, "audience_profile", "Suggested from demo profile"),
    suggestion(
      "geography_lens",
      "Geography lens",
      `${opportunity.geography}; audience lens: ${audience.geography}`,
      "ai_suggestion",
      "Suggested from demo opportunity and profile",
      [citation],
    ),
    suggestion("donor_persona", "Donor persona", audience.donorPersona, "audience_profile", "Suggested from demo profile"),
    suggestion("technical_familiarity", "Technical familiarity", audience.technicalFamiliarity, "audience_profile", "Suggested from demo profile"),
    suggestion("narrative_approach", "Narrative approach", audience.narrativeApproach, "ai_suggestion", "Suggested from AI using demo data", [citation]),
  ];
}

export function suggestion(
  id: string,
  label: string,
  value: string,
  source: FieldValue["metadata"]["source"],
  provenanceLabel: string,
  citations = [] as FieldValue["metadata"]["citations"],
): FieldValue {
  return {
    id,
    label,
    value,
    provenanceLabel,
    metadata: {
      source,
      required: true,
      editable: true,
      confirmed: false,
      confidence: 0.82,
      citations,
    },
  };
}

export function editField(fields: FieldValue[], id: string, value: string): FieldValue[] {
  return fields.map((field) =>
    field.id === id
      ? {
          ...field,
          value,
          provenanceLabel: field.provenanceLabel.includes("edited")
            ? field.provenanceLabel
            : `${field.provenanceLabel}; user edited`,
          metadata: { ...field.metadata, source: "user", confirmed: true },
        }
      : field,
  );
}

export function editExtractedField(fields: ExtractedField[], id: string, patch: Partial<ExtractedField>): ExtractedField[] {
  return fields.map((field) =>
    field.id === id
      ? {
          ...field,
          ...patch,
          metadata: {
            ...field.metadata,
            source: patch.value === undefined ? field.metadata.source : "user",
            confirmed: patch.verified ?? field.verified,
          },
        }
      : field,
  );
}

export function toggleOutput(current: OutputType[], output: OutputType): OutputType[] {
  if (current.includes(output)) {
    return current.length === 1 ? current : current.filter((item) => item !== output);
  }
  return [...current, output];
}

export function defaultReviewRoles(): ReviewRole[] {
  return [
    { id: "technical", label: "Technical or program review", selected: true, status: "Planned", notes: "Generic role; no notifications sent." },
    { id: "communications", label: "Communications review", selected: true, status: "Planned", notes: "Generic role; no notifications sent." },
    { id: "legal", label: "Legal and policy review", selected: false, status: "Optional", notes: "Use when external language or policy claims need review." },
    { id: "partner", label: "Partner review", selected: false, status: "Optional", notes: "Use when an implementing partner should review facts." },
  ];
}

export function simulateExistingOpportunitySmoke(opportunity: Opportunity, audience: AudienceProfile): string[] {
  const outputs = defaultSelectedOutputs;
  const suggestions = editField(suggestionFromSelection(opportunity, audience), "narrative_approach", "Lead with implementation proof and open diligence questions.");
  const checks = [
    validateTask("donor_meeting", "").valid,
    validateOpportunityAudience({
      sourceMode: "existing",
      opportunityId: opportunity.id,
      audienceId: audience.id,
      intendedOutcome: "Explore a co-funding partnership",
      selectedOutputs: outputs,
    }).valid,
    suggestions.some((field) => field.id === "narrative_approach" && field.metadata.source === "user"),
    validateReviewSetup(suggestions, defaultReviewRoles(), true, true).valid,
  ];
  return checks.map((passed, index) => `existing-step-${index + 1}:${passed ? "pass" : "fail"}`);
}

export function simulateNewOpportunitySmoke(fields: ExtractedField[]): string[] {
  const lockedFields = editExtractedField(
    fields.map((field) => ({ ...field, verified: true })),
    "funding_range",
    { locked: true, verified: true },
  );
  const checks = [
    validateTask("donor_meeting", "").valid,
    validateExtraction(lockedFields, true).valid,
    lockedFields.some((field) => field.id === "funding_range" && field.locked),
  ];
  return checks.map((passed, index) => `new-step-${index + 1}:${passed ? "pass" : "fail"}`);
}
