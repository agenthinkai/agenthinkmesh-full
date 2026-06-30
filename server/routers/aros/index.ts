/**
 * aros/index.ts — AROS router barrel
 * Exports all AROS sub-routers for wiring into the main router.
 */

export { arosDiscoveryRouter } from "./discovery";
export { arosIntelligenceRouter } from "./intelligence";
export { arosDecisionDetectionRouter } from "./decisionDetection";
export { arosExecutiveIntelligenceFactoryRouter } from "./executiveIntelligenceFactory";
// Backward-compat alias so existing router wiring compiles without changes
export { arosExecutiveIntelligenceFactoryRouter as arosOutreachFactoryRouter } from "./executiveIntelligenceFactory";
export { arosTokenLedgerRouter } from "./tokenLedger";
export { arosPipelineRouter } from "./pipeline";
export { arosCalibrationRouter } from "./calibration";
export { arosHiddenVariableRouter } from "./hiddenVariable";
export { arosMonitoringRouter } from "./monitoring";
export { constitutionRouter } from "./constitution";
export { significanceConfigRouter } from "./significanceConfig";
export { executiveMemoryRouter } from "./executiveMemory";
export { editorBriefsRouter } from "./editorBriefs";
export { morningReviewRouter } from "./morningReview";
export { institutionalProofRouter } from "./institutionalProof";
export { boardPackRouter } from "./boardPack";
