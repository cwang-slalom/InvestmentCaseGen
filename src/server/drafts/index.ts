export { draftToDocxBuffer } from "./docx";
export { evaluateDraftQuality } from "./evaluation";
export { applyDonorFollowUpToDraft } from "./followups";
export { createDraftForOpportunity } from "./generate";
export { loadOpportunityCitations } from "./evidence";
export { applyModelAuthoredDraft, generateDraftWithModel } from "./model-draft";
export {
  applyModelNarrativeStrengthening,
  strengthenDraftNarrativeWithModel,
} from "./model-strengthen";
export {
  regenerateDraftSection,
  renderDraft,
  renderDraftMarkdown,
} from "./render";
export { getInvestorSegmentProfile, investorSegmentProfiles } from "./segments";
export { strengthenDraftNarrative } from "./strengthen";
export { validateDraftClaims } from "./validation";
