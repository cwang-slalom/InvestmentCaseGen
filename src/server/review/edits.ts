import type {
  EvidenceBackedText,
  FieldStatus,
  Opportunity,
  OpportunityRecord,
} from "@/domain";

const editableTextFields = [
  "title",
  "summary",
  "problemStatement",
  "proposedIntervention",
  "whyNow",
  "investorRelevance",
] as const;

export type EditableOpportunityField = (typeof editableTextFields)[number];

export type OpportunityReviewInput = Partial<
  Record<EditableOpportunityField, string>
> &
  Partial<Record<`${EditableOpportunityField}Status`, FieldStatus>>;

function updateEvidenceField(
  field: EvidenceBackedText,
  value: string | undefined,
  status: FieldStatus | undefined,
): EvidenceBackedText {
  if (value === undefined && status === undefined) {
    return field;
  }

  return {
    ...field,
    value: value?.trim() || field.value,
    status: status ?? field.status,
    citationIds: field.citationIds,
    humanReviewed: true,
    reviewedAtIso: new Date().toISOString(),
    note: field.note
      ? `${field.note} Human-reviewed edit preserved existing citation metadata.`
      : "Human-reviewed edit preserved existing citation metadata.",
  };
}

export function applyOpportunityReviewEdits(
  record: OpportunityRecord,
  input: OpportunityReviewInput,
) {
  const opportunity: Opportunity = {
    ...record.opportunity,
  };
  const reviewedFields = new Set(
    record.reviewMetadata?.humanReviewedFields ?? [],
  );

  for (const fieldName of editableTextFields) {
    const value = input[fieldName];
    const status = input[`${fieldName}Status`];
    if (value !== undefined || status !== undefined) {
      opportunity[fieldName] = updateEvidenceField(
        opportunity[fieldName],
        value,
        status,
      );
      reviewedFields.add(fieldName);
    }
  }

  return {
    opportunity,
    title: opportunity.title.value ?? record.title,
    reviewMetadata: {
      humanReviewedFields: Array.from(reviewedFields).sort(),
      lastReviewedAtIso: new Date().toISOString(),
    },
  };
}
