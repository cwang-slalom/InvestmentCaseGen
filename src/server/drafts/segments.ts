import {
  AudienceTailoringSchema,
  DEFAULT_AUDIENCE_TAILORING,
  type AudienceFamiliarity,
  type AudienceScale,
  type AudienceTailoring,
  type InvestorSegment,
  type NarrativeTone,
} from "@/domain";

export type InvestorSegmentProfile = {
  label: string;
  propositionLens: string;
  emphasis: string;
};

type LensProfile = {
  label: string;
  lens: string;
};

export type AudienceTailoringProfile = {
  label: string;
  familiarityLabel: string;
  scaleLabel: string;
  toneLabel: string;
  propositionLens: string;
  behavioralGuidance: string;
  visualGuidance: string;
};

export const investorSegmentProfiles: Record<
  InvestorSegment,
  InvestorSegmentProfile
> = {
  general_donor: {
    label: "General Donor",
    propositionLens:
      "For a broad donor audience, the case should emphasize credible impact, visible gaps, and practical next steps.",
    emphasis: "credible impact and practical next steps",
  },
  philanthropic_foundation: {
    label: "Philanthropic Foundation",
    propositionLens:
      "For a philanthropic foundation, the case should emphasize additionality, learning value, and catalytic use of grant capital.",
    emphasis: "additionality, learning value, and catalytic grant capital",
  },
  us_foundation_program_officer: {
    label: "US Foundation Program Officer",
    propositionLens:
      "For a US foundation program officer, the case should quickly show issue fit, credible evidence, catalytic potential, unresolved diligence questions, and a practical next conversation.",
    emphasis:
      "foundation fit, evidence quality, catalytic potential, and diligence readiness",
  },
  us_major_donor: {
    label: "US Major Donor",
    propositionLens:
      "For a US major donor, the case should build interest first with a clear human or system stake, then show why the concept is credible enough for a follow-up conversation.",
    emphasis: "interest, human stakes, credibility, and a clear next meeting",
  },
  donor_advised_fund_advisor: {
    label: "DAF Advisor",
    propositionLens:
      "For a donor-advised fund advisor, the case should make donor fit, evidence strength, capital-pathway clarity, and unresolved diligence items easy to compare and summarize.",
    emphasis:
      "donor fit, concise evidence, capital-pathway clarity, and advisor-ready next steps",
  },
  impact_investor: {
    label: "Impact Investor",
    propositionLens:
      "For an impact investor, the case should emphasize scalability, leverage, measurable outcomes, and implementation readiness.",
    emphasis:
      "scale, leverage, measurable outcomes, and implementation readiness",
  },
  government_donor: {
    label: "Government Donor",
    propositionLens:
      "For a government donor, the case should emphasize public value, system fit, delivery feasibility, and policy relevance.",
    emphasis: "public value, system fit, and delivery feasibility",
  },
  corporate_philanthropy: {
    label: "Corporate Philanthropy",
    propositionLens:
      "For a corporate philanthropy audience, the case should emphasize partnership clarity, visible outcomes, and responsible delivery.",
    emphasis: "partnership clarity, visible outcomes, and responsible delivery",
  },
};

const familiarityProfiles: Record<AudienceFamiliarity, LensProfile> = {
  new_to_topic: {
    label: "New to topic",
    lens: "open with plain-language context and explain why the concept is investable before using sector shorthand",
  },
  familiar_with_issue: {
    label: "Familiar with issue",
    lens: "move quickly from source facts to the specific funding decision and differentiated investor relevance",
  },
  technical_expert: {
    label: "Technical expert",
    lens: "keep evidence, risks, role boundaries, and unresolved assumptions explicit enough for diligence",
  },
};

const scaleProfiles: Record<AudienceScale, LensProfile> = {
  exploratory: {
    label: "Exploratory",
    lens: "frame the case for a first diligence conversation with clear unknowns and source-backed next steps",
  },
  major_donor: {
    label: "Major donor",
    lens: "emphasize catalytic use of capital, governance clarity, measurable outcomes, and unresolved capital-pathway risks",
  },
  big_bet: {
    label: "Big bet",
    lens: "emphasize system-level potential, scale conditions, execution risks, and evidence still needed for a large commitment",
  },
};

const toneProfiles: Record<NarrativeTone, LensProfile> = {
  balanced: {
    label: "Balanced",
    lens: "use a measured, credible tone that avoids hype",
  },
  warm: {
    label: "Warm",
    lens: "use human, accessible language with respectful urgency and concrete stakes",
  },
  direct: {
    label: "Direct",
    lens: "use concise, decision-oriented language that foregrounds the ask and next step",
  },
  visionary: {
    label: "Visionary",
    lens: "use ambitious language about potential while keeping assumptions and evidence limits visible",
  },
};

export function getInvestorSegmentProfile(segment: InvestorSegment) {
  return investorSegmentProfiles[segment];
}

export function normalizeAudienceTailoring(
  tailoring?: AudienceTailoring,
): AudienceTailoring {
  return AudienceTailoringSchema.parse(tailoring ?? DEFAULT_AUDIENCE_TAILORING);
}

export function getAudienceTailoringProfile(
  input?: AudienceTailoring,
): AudienceTailoringProfile {
  const tailoring = normalizeAudienceTailoring(input);
  const familiarity = familiarityProfiles[tailoring.familiarity];
  const scale = scaleProfiles[tailoring.scale];
  const tone = toneProfiles[tailoring.tone];
  const labels = [familiarity.label, scale.label, tone.label];
  const custom = tailoring.customInstructions
    ? ` Reviewer tailoring note: ${tailoring.customInstructions}; apply it as style or emphasis only, not as factual evidence.`
    : "";

  return {
    label: labels.join(" / "),
    familiarityLabel: familiarity.label,
    scaleLabel: scale.label,
    toneLabel: tone.label,
    propositionLens: `Audience tailoring: ${familiarity.lens}; ${scale.lens}; ${tone.lens}.${custom}`,
    behavioralGuidance: `Behavioral framing for this audience: ${familiarity.lens}; ${tone.lens}.`,
    visualGuidance: `Visual direction for this audience: ${scale.lens}; use only sourced scale, budget, geography, timeline, and outcome evidence.`,
  };
}
