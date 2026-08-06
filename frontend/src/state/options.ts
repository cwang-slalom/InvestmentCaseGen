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
    description: "Create a deck or briefing for a donor",
  },
  {
    id: "donor_deck",
    title: "Create a donor deck",
    description: "Full presentation for donor engagement",
  },
  {
    id: "opportunity_brief",
    title: "Draft an opportunity brief",
    description: "Program summary and rationale",
  },
  {
    id: "proposal",
    title: "Develop a proposal",
    description: "Response to RFP or funding request",
  },
  {
    id: "rfp_package",
    title: "Create an RFP package",
    description: "Comprehensive proposal materials",
  },
  {
    id: "update_work",
    title: "Update existing work",
    description: "Refresh or expand previous materials",
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
    label: "Donor deck",
    description: "10-12 slides",
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
    description: "Conversation guide",
    defaultSelected: true,
  },
  {
    id: "source_appendix",
    label: "Source appendix",
    description: "Evidence boundary and citation list.",
    defaultSelected: true,
  },
];

export const futureOutputs = ["Executive summary", "Follow-up email draft", "Technical annex (Internal)"];

export const defaultSelectedOutputs = functionalOutputs
  .filter((output) => output.defaultSelected)
  .map((output) => output.id);

export const generationStages = [
  "Preparing request",
  "Retrieving and synthesizing sources",
  "Writing first draft",
  "Building slides and visuals",
  "Compiling output package",
  "Final checks",
];
