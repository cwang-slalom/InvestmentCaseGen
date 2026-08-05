import {
  DEFAULT_PROSPECTUS_BUILDER,
  ProspectusBuilderSchema,
  type InvestorSegment,
  type NarrativeAngle,
  type OutputType,
  type ProspectusBuilder,
} from "./schemas";

export type OutputFormatProfile = {
  value: OutputType;
  label: string;
  shortLabel: string;
  description: string;
  primaryUse: string;
  defaultVariantLabel: string;
  sectionBlueprint: string[];
  promptGuidance: string;
};

export type NarrativeAngleProfile = {
  value: NarrativeAngle;
  label: string;
  lens: string;
};

export type AudienceOption = {
  value: InvestorSegment;
  label: string;
  description: string;
};

export const outputFormatLibrary = [
  {
    value: "investment_prospectus",
    label: "Investment Prospectus",
    shortLabel: "Prospectus",
    description:
      "A donor-first narrative that attracts interest before asking for full proposal review.",
    primaryUse: "Warm donor meeting, US foundation cultivation, funder teaser",
    defaultVariantLabel: "Prospectus variant",
    sectionBlueprint: [
      "Interest thesis",
      "Investable concept",
      "Why this fits the audience",
      "Prospectus snapshot",
      "Evidence and open questions",
      "Next conversation",
    ],
    promptGuidance:
      "Lead with why a donor should keep reading, then move into source-backed concept, role boundaries, funding-pathway clarity, and unresolved diligence items.",
  },
  {
    value: "donor_deck",
    label: "Donor Deck Outline",
    shortLabel: "Donor Deck",
    description:
      "A presentation-ready outline with slide headlines, speaker notes, visual guidance, and source guardrails.",
    primaryUse: "Cultivation meeting, donor presentation, partner discussion",
    defaultVariantLabel: "Donor deck variant",
    sectionBlueprint: [
      "Deck strategy",
      "Slide narrative",
      "Opportunity at a glance",
      "Audience fit",
      "Evidence and claims",
      "Speaker notes and next step",
    ],
    promptGuidance:
      "Structure the output as a donor deck outline with slide-level headlines, talking points, suggested visuals, and citation-aware evidence notes.",
  },
  {
    value: "donor_one_pager",
    label: "Donor One-Pager",
    shortLabel: "One-Pager",
    description:
      "A concise, skimmable donor teaser for first outreach or internal champion sharing.",
    primaryUse: "Intro email attachment, meeting pre-read, quick cultivation",
    defaultVariantLabel: "One-pager variant",
    sectionBlueprint: [
      "Hook",
      "The concept",
      "Why now",
      "Funding pathway",
      "Evidence guardrails",
      "Suggested next step",
    ],
    promptGuidance:
      "Keep it short, concrete, and meeting-oriented. Preserve citations and keep unresolved capital-pathway fields visible.",
  },
  {
    value: "meeting_talking_points",
    label: "Meeting Talking Points",
    shortLabel: "Talking Points",
    description:
      "A concise guide for relationship managers to lead a donor conversation without drifting from source evidence.",
    primaryUse: "Cultivation meeting, follow-up call, internal prep",
    defaultVariantLabel: "Talking points variant",
    sectionBlueprint: [
      "Opening frame",
      "Core points",
      "Evidence caveats",
      "Questions to ask",
      "Suggested next step",
    ],
    promptGuidance:
      "Prepare speaker-ready points with clear asks, donor-fit language, cautions, and open questions that should be answered by the donor or PST.",
  },
  {
    value: "source_appendix",
    label: "Source Appendix",
    shortLabel: "Source Appendix",
    description:
      "An internal evidence package that lists source-backed facts, unresolved claims, review needs, and citation references.",
    primaryUse: "PST review, communications review, export QA",
    defaultVariantLabel: "Source appendix variant",
    sectionBlueprint: [
      "Source inventory",
      "Supported facts",
      "Unresolved claims",
      "External-use readiness",
      "Citation list",
    ],
    promptGuidance:
      "Prioritize traceability, unsupported-claim visibility, external-use caution, and reviewer handoff over persuasive narrative.",
  },
  {
    value: "concept_note",
    label: "Concept Note",
    shortLabel: "Concept Note",
    description:
      "A structured concept-first note that can become a deeper proposal after diligence.",
    primaryUse: "Internal review, funder diligence kickoff, partner alignment",
    defaultVariantLabel: "Concept note variant",
    sectionBlueprint: [
      "Concept summary",
      "Source-backed need",
      "Proposed approach",
      "Roles and funding pathway",
      "Evidence gaps",
      "Human review needs",
    ],
    promptGuidance:
      "Make the concept easy to evaluate without sounding like a full grant proposal. Keep source facts separate from generated framing.",
  },
  {
    value: "board_brief",
    label: "Board Brief",
    shortLabel: "Board Brief",
    description:
      "A decision-oriented brief for donor boards, trustees, or internal investment committees.",
    primaryUse: "Board memo, trustee preview, investment committee discussion",
    defaultVariantLabel: "Board brief variant",
    sectionBlueprint: [
      "Decision context",
      "Investment thesis",
      "Evidence base",
      "Risks and open issues",
      "Role and capital-pathway clarity",
      "Recommended discussion",
    ],
    promptGuidance:
      "Prioritize the decision to be made, diligence questions, risks, governance clarity, and evidence strength.",
  },
  {
    value: "hnwi_donor_teaser",
    label: "High-Net-Worth Donor Teaser",
    shortLabel: "HNWI Teaser",
    description:
      "A warm, interest-building narrative for individual US donors or family philanthropy.",
    primaryUse: "Individual donor cultivation, family office follow-up",
    defaultVariantLabel: "HNWI teaser variant",
    sectionBlueprint: [
      "Human hook",
      "The opportunity",
      "Why this donor could matter",
      "What is known",
      "What remains unresolved",
      "Invitation",
    ],
    promptGuidance:
      "Use warm, plain language and a clear invitation while avoiding hype, invented beneficiaries, or unsupported scale claims.",
  },
  {
    value: "executive_investment_case",
    label: "Executive Investment Case",
    shortLabel: "Investment Case",
    description:
      "A fuller executive draft for human review after the concept has enough evidence.",
    primaryUse: "Detailed donor pre-read, investment case development",
    defaultVariantLabel: "Executive case variant",
    sectionBlueprint: [
      "Investment proposition",
      "Problem",
      "Opportunity",
      "Ask",
      "Implementation",
      "Risk",
      "Evidence gaps",
    ],
    promptGuidance:
      "Develop a fuller donor-facing case while preserving claim-level citations and unresolved fields.",
  },
  {
    value: "opportunity_spotlight",
    label: "Opportunity Spotlight",
    shortLabel: "Spotlight",
    description:
      "A structured spotlight that summarizes a candidate opportunity and its evidence state.",
    primaryUse: "Portfolio scan, opportunity review, internal comparison",
    defaultVariantLabel: "Spotlight variant",
    sectionBlueprint: [
      "Problem",
      "Activities",
      "Outcomes",
      "Funding",
      "Risks",
      "Supporting evidence",
    ],
    promptGuidance:
      "Keep the opportunity compact and source-grounded, with funding and implementation unknowns plainly marked.",
  },
] satisfies OutputFormatProfile[];

export const narrativeAngleProfiles: Record<
  NarrativeAngle,
  NarrativeAngleProfile
> = {
  catalytic_philanthropy: {
    value: "catalytic_philanthropy",
    label: "Catalytic Philanthropy",
    lens: "Frame the concept around what early donor capital could unlock, without inventing leverage, co-funding, or scale figures.",
  },
  systems_change: {
    value: "systems_change",
    label: "Systems Change",
    lens: "Emphasize credible system effects already present in the source material and keep execution dependencies explicit.",
  },
  scale_pathway: {
    value: "scale_pathway",
    label: "Scale Pathway",
    lens: "Highlight the path from concept to broader reach only where the source supports it; surface scale conditions as diligence questions.",
  },
  innovation: {
    value: "innovation",
    label: "Innovation",
    lens: "Position novelty, product, model, or approach advantages when source evidence supports them.",
  },
  policy_leverage: {
    value: "policy_leverage",
    label: "Policy Leverage",
    lens: "Connect the concept to policy or public-system influence only when the source materials establish that pathway.",
  },
  proof_of_concept: {
    value: "proof_of_concept",
    label: "Proof of Concept",
    lens: "Present the concept as a credible learning or validation opportunity and identify evidence still needed before scale.",
  },
  evidence_and_diligence: {
    value: "evidence_and_diligence",
    label: "Evidence and Diligence",
    lens: "Lead with what is supported, what is unresolved, and what a donor would need to learn next.",
  },
  beneficiary_urgency: {
    value: "beneficiary_urgency",
    label: "Beneficiary Urgency",
    lens: "Make the human stakes clear using only source-supported beneficiary, geography, and problem evidence.",
  },
};

export const donorAudienceOptions = [
  {
    value: "general_donor",
    label: "General Donor",
    description: "Broad donor language with clear evidence and next steps.",
  },
  {
    value: "philanthropic_foundation",
    label: "Philanthropic Foundation",
    description: "Foundation-style framing around additionality and learning.",
  },
  {
    value: "us_foundation_program_officer",
    label: "US Foundation Program Officer",
    description:
      "US foundation cultivation with evidence, fit, risks, and a clear diligence path.",
  },
  {
    value: "us_major_donor",
    label: "US Major Donor",
    description:
      "Interest-first language for an individual donor or family philanthropy audience.",
  },
  {
    value: "donor_advised_fund_advisor",
    label: "DAF Advisor",
    description:
      "Advisor-friendly summary that makes donor fit and unresolved items easy to scan.",
  },
  {
    value: "impact_investor",
    label: "Impact Investor",
    description:
      "Scale, leverage, measurable outcomes, and implementation readiness.",
  },
  {
    value: "government_donor",
    label: "Government Donor",
    description:
      "Public value, system fit, delivery feasibility, and policy relevance.",
  },
  {
    value: "corporate_philanthropy",
    label: "Corporate Philanthropy",
    description:
      "Partnership clarity, visible outcomes, and responsible delivery.",
  },
] satisfies AudienceOption[];

export function getOutputFormatProfile(outputType: OutputType) {
  return (
    outputFormatLibrary.find((format) => format.value === outputType) ??
    outputFormatLibrary[0]
  );
}

export function getNarrativeAngleProfile(angle: NarrativeAngle) {
  return narrativeAngleProfiles[angle];
}

export function normalizeProspectusBuilder(
  builder?: ProspectusBuilder,
): ProspectusBuilder {
  return ProspectusBuilderSchema.parse(builder ?? DEFAULT_PROSPECTUS_BUILDER);
}

export function generationRunTypeForOutput(outputType: OutputType) {
  switch (outputType) {
    case "executive_investment_case":
      return "render_executive_investment_case";
    case "opportunity_spotlight":
      return "render_opportunity_spotlight";
    case "investment_prospectus":
      return "render_investment_prospectus";
    case "donor_deck":
      return "render_donor_deck";
    case "donor_one_pager":
      return "render_donor_one_pager";
    case "meeting_talking_points":
      return "render_meeting_talking_points";
    case "source_appendix":
      return "render_source_appendix";
    case "concept_note":
      return "render_concept_note";
    case "board_brief":
      return "render_board_brief";
    case "hnwi_donor_teaser":
      return "render_hnwi_donor_teaser";
  }
}

export function formatVariantLabel({
  outputType,
  audienceLabel,
  prospectusBuilder,
}: {
  outputType: OutputType;
  audienceLabel: string;
  prospectusBuilder: ProspectusBuilder;
}) {
  const format = getOutputFormatProfile(outputType);
  const angle = getNarrativeAngleProfile(prospectusBuilder.narrativeAngle);

  return (
    prospectusBuilder.variantLabel ??
    `${audienceLabel} ${format.shortLabel}: ${angle.label}`
  );
}
