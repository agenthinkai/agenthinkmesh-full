/**
 * Standalone script to generate the sample PDF to disk for preview.
 * Run with: npx tsx server/generateSamplePdf.ts
 */
import { writeFileSync } from "fs";
import { generateSampleProofReportPdf } from "./sampleProofReportPdf";

(async () => {
  console.log("Generating sample Proof Report PDF...");
  const buf = await generateSampleProofReportPdf();
  const outPath = "/home/ubuntu/sample_proof_report_preview.pdf";
  writeFileSync(outPath, buf);
  console.log(`PDF written: ${outPath} (${buf.length} bytes)`);
  // Count pages
  const text = buf.toString("latin1");
  const pages = (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
  console.log(`Page count: ${pages}`);
})();
