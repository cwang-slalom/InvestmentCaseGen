import type {
  AudienceFamiliarity,
  AudienceScale,
  InvestorSegment,
  NarrativeAngle,
  NarrativeTone,
  OutputType,
} from "@/domain";
import {
  donorAudienceOptions,
  narrativeAngleProfiles,
  outputFormatLibrary,
} from "@/domain";

export const outputOptions = outputFormatLibrary.map((format) => ({
  value: format.value,
  label: format.label,
  description: format.description,
})) satisfies Array<{ value: OutputType; label: string; description: string }>;

export const investorSegments = donorAudienceOptions.map((audience) => ({
  value: audience.value,
  label: audience.label,
  description: audience.description,
})) satisfies Array<{
  value: InvestorSegment;
  label: string;
  description: string;
}>;

export const audienceFamiliarityOptions = [
  { value: "new_to_topic", label: "New to topic" },
  { value: "familiar_with_issue", label: "Familiar with issue" },
  { value: "technical_expert", label: "Technical expert" },
] satisfies Array<{ value: AudienceFamiliarity; label: string }>;

export const audienceScaleOptions = [
  { value: "exploratory", label: "Exploratory" },
  { value: "major_donor", label: "Major donor" },
  { value: "big_bet", label: "Big bet" },
] satisfies Array<{ value: AudienceScale; label: string }>;

export const narrativeToneOptions = [
  { value: "balanced", label: "Balanced" },
  { value: "warm", label: "Warm" },
  { value: "direct", label: "Direct" },
  { value: "visionary", label: "Visionary" },
] satisfies Array<{ value: NarrativeTone; label: string }>;

export const narrativeAngleOptions = Object.values(narrativeAngleProfiles).map(
  (profile) => ({
    value: profile.value,
    label: profile.label,
    description: profile.lens,
  }),
) satisfies Array<{
  value: NarrativeAngle;
  label: string;
  description: string;
}>;
