import { randomUUID } from "node:crypto";

import {
  DonorFollowUpUpdateSchema,
  ValidatedDraftSchema,
  type DonorFollowUpAction,
  type DonorFollowUpTopic,
  type DonorFollowUpUpdate,
  type DraftSection,
  type EvidenceGap,
  type OpportunityClaim,
  type ValidatedDraft,
} from "@/domain";

import { evaluateDraftQuality } from "./evaluation";
import { validateDraftClaims } from "./validation";

const followUpSectionKey = "donor_followup_updates";

const topicDefinitions: Array<{
  topic: DonorFollowUpTopic;
  label: string;
  keywords: string[];
  sectionKeys: string[];
}> = [
  {
    topic: "funding_pathway",
    label: "funding pathway",
    keywords: [
      "recipient",
      "vehicle",
      "funding pathway",
      "investment manager",
      "fiscal sponsor",
      "pooled fund",
      "who receives",
      "where does the money go",
    ],
    sectionKeys: [
      "investment_vehicle_or_funding_recipient",
      "investment_ask",
      "use_of_funds",
      "funding_gap",
      "total_cost",
      "current_funding",
    ],
  },
  {
    topic: "budget",
    label: "budget",
    keywords: [
      "budget",
      "cost",
      "costs",
      "funding gap",
      "amount",
      "usd",
      "dollar",
      "grant size",
      "ask",
    ],
    sectionKeys: [
      "investment_ask",
      "use_of_funds",
      "total_cost",
      "current_funding",
      "funding_gap",
    ],
  },
  {
    topic: "impact_metrics",
    label: "impact metrics",
    keywords: [
      "impact",
      "outcome",
      "metric",
      "measure",
      "kpi",
      "beneficiary",
      "beneficiaries",
      "lives",
      "reach",
      "scale",
    ],
    sectionKeys: [
      "expected_outcomes_and_impact",
      "why_this_matters",
      "impact",
      "problem_and_opportunity",
    ],
  },
  {
    topic: "evidence",
    label: "evidence",
    keywords: [
      "evidence",
      "citation",
      "source",
      "proof",
      "study",
      "data",
      "validate",
      "back up",
    ],
    sectionKeys: ["evidence_and_sources", "evidence_gaps"],
  },
  {
    topic: "risk",
    label: "risk",
    keywords: [
      "risk",
      "risks",
      "mitigation",
      "assumption",
      "barrier",
      "challenge",
      "regulatory",
    ],
    sectionKeys: [
      "risk_profile",
      "scientific_technical_risk",
      "regulatory_risk",
      "organizational_operational_risk",
      "commercial_demand_risk",
      "reputational_stakeholder_risk",
    ],
  },
  {
    topic: "implementation",
    label: "implementation",
    keywords: [
      "implement",
      "implementation",
      "partner",
      "delivery",
      "deliver",
      "operations",
      "capacity",
      "operating model",
    ],
    sectionKeys: [
      "implementation_delivery_model",
      "implementing_organizations",
      "the_opportunity",
      "proposed_intervention",
    ],
  },
  {
    topic: "timeline",
    label: "timeline",
    keywords: [
      "timeline",
      "milestone",
      "milestones",
      "when",
      "date",
      "launch",
      "delay",
      "start",
      "end",
    ],
    sectionKeys: ["timeline", "why_now"],
  },
  {
    topic: "audience_fit",
    label: "audience fit",
    keywords: [
      "donor",
      "investor",
      "fit",
      "priority",
      "strategy",
      "strategic",
      "catalytic",
      "additionality",
      "leverage",
    ],
    sectionKeys: [
      "investment_proposition",
      "why_this_is_investable",
      "investor_relevance",
      "donor_language_and_behavioral_framing",
    ],
  },
];

const highEvidenceNeedTopics = new Set<DonorFollowUpTopic>([
  "funding_pathway",
  "budget",
  "impact_metrics",
  "timeline",
]);

const stopWords = new Set([
  "about",
  "after",
  "also",
  "and",
  "based",
  "been",
  "can",
  "could",
  "does",
  "donor",
  "from",
  "have",
  "into",
  "more",
  "need",
  "needs",
  "our",
  "please",
  "show",
  "that",
  "the",
  "their",
  "this",
  "want",
  "what",
  "when",
  "where",
  "which",
  "will",
  "with",
]);

const numberPattern =
  /(?:\$\s?\d|\b\d+(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s?(?:%|percent|million|billion|thousand)\b)/i;

export type ApplyDonorFollowUpInput = {
  draft: ValidatedDraft;
  message: string;
  donorName?: string;
  receivedAtIso?: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function topicLabel(topic: DonorFollowUpTopic) {
  return (
    topicDefinitions.find((definition) => definition.topic === topic)?.label ??
    "other"
  );
}

function detectTopics(message: string): DonorFollowUpTopic[] {
  const lower = message.toLowerCase();
  const topics = topicDefinitions
    .filter((definition) =>
      definition.keywords.some((keyword) => lower.includes(keyword)),
    )
    .map((definition) => definition.topic);

  return topics.length > 0 ? topics : ["other"];
}

function topicKeywords(topics: DonorFollowUpTopic[]) {
  return topicDefinitions
    .filter((definition) => topics.includes(definition.topic))
    .flatMap((definition) => definition.keywords);
}

function definitionForTopic(topic: DonorFollowUpTopic) {
  return topicDefinitions.find((definition) => definition.topic === topic);
}

function messageTokens(message: string) {
  return Array.from(
    new Set(
      message
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((token) => token.length > 3 && !stopWords.has(token)) ?? [],
    ),
  );
}

function sourceBackedClaim(claim: OpportunityClaim) {
  return (
    claim.citationIds.length > 0 &&
    claim.status !== "unresolved" &&
    claim.status !== "generated_framing" &&
    claim.validationStatus !== "unsupported" &&
    claim.validationStatus !== "conflicting"
  );
}

function scoreClaim({
  claim,
  keywords,
  tokens,
}: {
  claim: OpportunityClaim;
  keywords: string[];
  tokens: string[];
}) {
  const lower = claim.statement.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      score += 3;
    }
  }

  for (const token of tokens) {
    if (lower.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function sourceClaimMatchesTopic({
  claim,
  topic,
  tokens,
}: {
  claim: OpportunityClaim;
  topic: DonorFollowUpTopic;
  tokens: string[];
}) {
  if (topic === "other") {
    return tokens.some((token) =>
      claim.statement.toLowerCase().includes(token),
    );
  }

  const lower = claim.statement.toLowerCase();
  const definition = definitionForTopic(topic);
  const hasTopicKeyword =
    definition?.keywords.some((keyword) => lower.includes(keyword)) ?? false;

  if (highEvidenceNeedTopics.has(topic)) {
    return hasTopicKeyword;
  }

  return hasTopicKeyword || tokens.some((token) => lower.includes(token));
}

function matchingSourceClaims(
  draft: ValidatedDraft,
  topics: DonorFollowUpTopic[],
  message: string,
) {
  const keywords = topicKeywords(topics);
  const tokens = messageTokens(message);

  return draft.claims
    .filter(sourceBackedClaim)
    .filter((claim) =>
      topics.some((topic) => sourceClaimMatchesTopic({ claim, topic, tokens })),
    )
    .map((claim) => ({
      claim,
      score: scoreClaim({ claim, keywords, tokens }),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.claim);
}

function impactedSectionKeys(
  draft: ValidatedDraft,
  topics: DonorFollowUpTopic[],
) {
  const existingSectionKeys = new Set(
    draft.sections.map((section) => section.sectionKey),
  );
  const keys = topicDefinitions
    .filter((definition) => topics.includes(definition.topic))
    .flatMap((definition) => definition.sectionKeys)
    .filter((sectionKey) => existingSectionKeys.has(sectionKey));

  return Array.from(new Set(keys));
}

function citationLabels(draft: ValidatedDraft) {
  return new Map(
    draft.citations.map((citation, index) => [citation.id, `[S${index + 1}]`]),
  );
}

function claimLine(claim: OpportunityClaim, labels: Map<string, string>) {
  const citations = claim.citationIds
    .map((citationId) => labels.get(citationId) ?? "[S?]")
    .join(" ");

  return `- ${claim.statement}${citations ? ` ${citations}` : ""}`;
}

function unresolvedGap({
  draftId,
  topic,
  severity,
  description,
}: {
  draftId: string;
  topic: DonorFollowUpTopic;
  severity: EvidenceGap["severity"];
  description: string;
}): EvidenceGap {
  return {
    id: `${draftId}-followup-gap-${randomUUID()}`,
    fieldKey: `donor_followup.${topic}`,
    description,
    severity,
    suggestedNextStep:
      "Attach source material or reviewer-verified evidence before using this as an outward-facing claim.",
  };
}

function unresolvedRequests({
  draft,
  message,
  topics,
  sourceClaims,
}: {
  draft: ValidatedDraft;
  message: string;
  topics: DonorFollowUpTopic[];
  sourceClaims: OpportunityClaim[];
}) {
  const gaps: EvidenceGap[] = [];
  const tokens = messageTokens(message);
  const coveredTopics = new Set(
    topics.filter((topic) =>
      sourceClaims.some((claim) =>
        sourceClaimMatchesTopic({ claim, topic, tokens }),
      ),
    ),
  );

  for (const topic of topics) {
    if (!coveredTopics.has(topic)) {
      gaps.push(
        unresolvedGap({
          draftId: draft.id,
          topic,
          severity: highEvidenceNeedTopics.has(topic) ? "high" : "medium",
          description: `Donor asked about ${topicLabel(topic)}, but the current draft has no directly matching source-backed claim.`,
        }),
      );
    }
  }

  if (numberPattern.test(message)) {
    gaps.push(
      unresolvedGap({
        draftId: draft.id,
        topic: "evidence",
        severity: "high",
        description:
          "Donor follow-up includes a numerical detail; it must be supported by uploaded source material before the draft treats it as fact.",
      }),
    );
  }

  return gaps;
}

function proposedResponse({
  draft,
  message,
  donorName,
  receivedAtIso,
  topics,
  impactedKeys,
  sourceClaims,
  gaps,
}: {
  draft: ValidatedDraft;
  message: string;
  donorName?: string;
  receivedAtIso: string;
  topics: DonorFollowUpTopic[];
  impactedKeys: string[];
  sourceClaims: OpportunityClaim[];
  gaps: EvidenceGap[];
}) {
  const labels = citationLabels(draft);
  const sectionTitles = impactedKeys
    .map(
      (sectionKey) =>
        draft.sections.find((section) => section.sectionKey === sectionKey)
          ?.title ?? sectionKey.replaceAll("_", " "),
    )
    .join(", ");
  const recipient = donorName ? ` to ${donorName}` : "";
  const sourceLines =
    sourceClaims.length > 0
      ? sourceClaims.map((claim) => claimLine(claim, labels))
      : [
          "- No directly matching source-backed claim is available in the current draft.",
        ];
  const gapLines =
    gaps.length > 0
      ? gaps.map((gap) => `- ${gap.description}`)
      : [
          "- No new evidence need was detected, but human review is still required before donor outreach.",
        ];

  return [
    `### Suggested donor response${recipient}`,
    `Follow-up received ${receivedAtIso.slice(0, 10)}. The donor asked about ${topics.map(topicLabel).join(", ")}.`,
    `Donor note: "${message}"`,
    `Current source-supported points:\n${sourceLines.join("\n")}`,
    `Open items before outward-facing use:\n${gapLines.join("\n")}`,
    sectionTitles
      ? `Draft areas to review: ${sectionTitles}.`
      : "Draft areas to review: evidence gaps.",
  ].join("\n\n");
}

function generatedFollowUpClaim(statement: string): OpportunityClaim {
  return {
    id: randomUUID(),
    statement,
    kind: "narrative_framing",
    status: "generated_framing",
    validationStatus: "not_checked",
    citationIds: [],
    derivedFromClaimIds: [],
  };
}

function followUpSectionMarkdown(updates: DonorFollowUpUpdate[]) {
  return updates
    .map((update, index) =>
      [
        `### Follow-up ${index + 1}: ${update.topics.map(topicLabel).join(", ")}`,
        update.proposedResponseMarkdown,
      ].join("\n\n"),
    )
    .join("\n\n---\n\n");
}

function addUnique(values: string[]) {
  return Array.from(new Set(values));
}

function upsertFollowUpSection({
  sections,
  updates,
}: {
  sections: DraftSection[];
  updates: DonorFollowUpUpdate[];
}) {
  const existing = sections.find(
    (section) => section.sectionKey === followUpSectionKey,
  );
  const claimIds = addUnique(
    updates.flatMap((update) => [
      ...update.sourceClaimIds,
      ...update.createdClaimIds,
    ]),
  );
  const evidenceGapIds = addUnique(
    updates.flatMap((update) => update.unresolvedRequests.map((gap) => gap.id)),
  );
  const warningText = addUnique(updates.flatMap((update) => update.warnings));
  const renderedMarkdown = followUpSectionMarkdown(updates);

  if (existing) {
    return sections.map((section) =>
      section.id === existing.id
        ? {
            ...section,
            renderedMarkdown,
            claimIds,
            evidenceGapIds,
            warningText,
          }
        : section,
    );
  }

  const nextOrderIndex =
    sections.reduce(
      (highest, section) => Math.max(highest, section.orderIndex),
      -1,
    ) + 1;

  return [
    ...sections,
    {
      id: `${updates.at(-1)?.id ?? randomUUID()}-section`,
      sectionKey: followUpSectionKey,
      title: "Donor Follow-Up Updates",
      renderedMarkdown,
      claimIds,
      evidenceGapIds,
      warningText,
      orderIndex: nextOrderIndex,
      regenerationCount: 0,
    },
  ];
}

function markImpactedSections({
  sections,
  impactedKeys,
  topics,
}: {
  sections: DraftSection[];
  impactedKeys: string[];
  topics: DonorFollowUpTopic[];
}) {
  const impacted = new Set(impactedKeys);
  const warning = `Donor follow-up asks about ${topics.map(topicLabel).join(", ")}; review this section against the follow-up update before outreach.`;

  return sections.map((section) => {
    if (!impacted.has(section.sectionKey)) {
      return section;
    }

    return {
      ...section,
      warningText: addUnique([...section.warningText, warning]),
    };
  });
}

export function applyDonorFollowUpToDraft({
  draft,
  message,
  donorName,
  receivedAtIso = new Date().toISOString(),
}: ApplyDonorFollowUpInput): ValidatedDraft {
  const cleanedMessage = cleanText(message);

  if (!cleanedMessage) {
    throw new Error("Donor follow-up message is required.");
  }

  const cleanedDonorName = donorName ? cleanText(donorName) : undefined;
  const topics = detectTopics(cleanedMessage);
  const impactedKeys = impactedSectionKeys(draft, topics);
  const sourceClaims = matchingSourceClaims(draft, topics, cleanedMessage);
  const gaps = unresolvedRequests({
    draft,
    message: cleanedMessage,
    topics,
    sourceClaims,
  });
  const responseMarkdown = proposedResponse({
    draft,
    message: cleanedMessage,
    donorName: cleanedDonorName,
    receivedAtIso,
    topics,
    impactedKeys,
    sourceClaims,
    gaps,
  });
  const updateClaim = generatedFollowUpClaim(
    `A donor follow-up response was prepared for human review on ${topics.map(topicLabel).join(", ")}.`,
  );
  const actions: DonorFollowUpAction[] = [
    "draft_updated",
    "response_prepared",
    "human_review_required",
  ];

  if (gaps.length > 0) {
    actions.push("needs_source_evidence");
  }

  const update = DonorFollowUpUpdateSchema.parse({
    id: randomUUID(),
    draftId: draft.id,
    donorName: cleanedDonorName,
    message: cleanedMessage,
    receivedAtIso,
    topics,
    impactedSectionKeys: impactedKeys,
    sourceClaimIds: sourceClaims.map((claim) => claim.id),
    sourceBackedSummary:
      sourceClaims.length > 0
        ? `Prepared from ${sourceClaims.length} existing source-backed claim${sourceClaims.length === 1 ? "" : "s"}.`
        : undefined,
    proposedResponseMarkdown: responseMarkdown,
    unresolvedRequests: gaps,
    actions,
    createdClaimIds: [updateClaim.id],
    appliedAtIso: receivedAtIso,
    warnings: [
      "Donor follow-ups are not source evidence unless supporting material is uploaded or verified separately.",
    ],
  });
  const updates = [...draft.followUpUpdates, update];
  const sections = upsertFollowUpSection({
    sections: markImpactedSections({
      sections: draft.sections,
      impactedKeys,
      topics,
    }),
    updates,
  });
  const draftWithFollowUp = ValidatedDraftSchema.parse({
    ...draft,
    sectionOrder: addUnique([...draft.sectionOrder, followUpSectionKey]),
    sections,
    claims: [...draft.claims, updateClaim],
    evidenceGaps: [...draft.evidenceGaps, ...gaps],
    narrativeChanges: addUnique([
      ...draft.narrativeChanges,
      `Applied donor follow-up update: ${topics.map(topicLabel).join(", ")}.`,
    ]),
    followUpUpdates: updates,
  });
  const validation = validateDraftClaims(draftWithFollowUp);
  const productQualityEvaluation = evaluateDraftQuality({
    ...draftWithFollowUp,
    validation,
  });

  return ValidatedDraftSchema.parse({
    ...draftWithFollowUp,
    validation,
    productQualityEvaluation,
  });
}
