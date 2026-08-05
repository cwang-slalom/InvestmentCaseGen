import type { OutputType } from "../types";

export type TaskOption = {
  id: string;
  title: string;
  description: string;
};

export const wizardSteps = [
  { id: "task", label: "Describe task", path: "task" },
  { id: "opportunity-audience", label: "Opportunity & audience", path: "opportunity-audience" },
  { id: "review-setup", label: "Review setup", path: "review-setup" },
  { id: "generate", label: "Generate", path: "generate" },
] as const;

export const taskOptions: TaskOption[] = [
  {
    id: "donor_meeting",
    title: "Prepare for a donor meeting",
    description: "Create a briefing package for a partner conversation.",
  },
  {
    id: "donor_deck",
    title: "Create a donor deck",
    description: "Shape a source-grounded presentation outline.",
  },
  {
    id: "opportunity_brief",
    title: "Draft an opportunity brief",
    description: "Summarize the concept, evidence, and open questions.",
  },
  {
    id: "proposal",
    title: "Develop a proposal",
    description: "Prepare a more detailed concept narrative.",
  },
  {
    id: "rfp_package",
    title: "Create an RFP package",
    description: "Draft a structured funder-response package.",
  },
  {
    id: "update_work",
    title: "Update existing work",
    description: "Refresh prior materials with current source evidence.",
  },
];

export const intendedOutcomes = [
  "Explore a co-funding partnership",
  "Agree to another conversation",
  "Introduce to leadership",
  "Review the opportunity in more detail",
  "Other",
];

export const functionalOutputs: Array<{
  id: OutputType;
  label: string;
  description: string;
  defaultSelected: boolean;
}> = [
  {
    id: "investment_case",
    label: "Investment case draft",
    description: "Structured investor-ready narrative draft.",
    defaultSelected: true,
  },
  {
    id: "one_page",
    label: "1-page opportunity summary",
    description: "Concise pre-read for the conversation.",
    defaultSelected: true,
  },
  {
    id: "talking_points",
    label: "Meeting talking points",
    description: "Conversation guide for a donor meeting.",
    defaultSelected: false,
  },
  {
    id: "source_appendix",
    label: "Source appendix",
    description: "Evidence boundary and citation list.",
    defaultSelected: true,
  },
];

export const futureOutputs = ["Donor deck", "Follow-up email", "Technical annex"];

export const defaultSelectedOutputs = functionalOutputs
  .filter((output) => output.defaultSelected)
  .map((output) => output.id);

export const generationStages = [
  "Preparing request",
  "Validating approved facts",
  "Synthesizing sources",
  "Writing first draft",
  "Running integrity checks",
  "Compiling results",
];
