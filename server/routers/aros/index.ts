/**
 * aros/index.ts — AROS router barrel
 * Exports all AROS sub-routers for wiring into the main router.
 */

export { arosDiscoveryRouter } from "./discovery";
export { arosIntelligenceRouter } from "./intelligence";
export { arosDecisionDetectionRouter } from "./decisionDetection";
export { arosOutreachFactoryRouter } from "./outreachFactory";
export { arosTokenLedgerRouter } from "./tokenLedger";
export { arosPipelineRouter } from "./pipeline";
export { arosCalibrationRouter } from "./calibration";
