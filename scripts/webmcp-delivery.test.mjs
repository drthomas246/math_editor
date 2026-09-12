import { describe, expect, it } from "vitest";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { planCapabilities, planImport, planValidation } from "../AI/skills/math-editor-textbook-import/scripts/plan_webmcp_delivery.mjs";

const hash = "a".repeat(64);
const capabilities = {
  app: "math-editor",
  integrationVersion: 1,
  worksheetFormat: "math-worksheet",
  worksheetFileVersion: 1,
  schemaVersion: 1,
  schemaSha256: hash.toUpperCase(),
  validationAvailable: true,
  directImportAvailable: true,
  writeConsentGranted: false,
  maxDirectImportBytes: 1024,
};

describe("SkillのWebMCP配送判断", function deliveryPlanner() {
  it("互換能力ではConsent前でも事前検証へ進む", function compatible() {
    expect(planCapabilities({ capabilities, skillSchemaSha256: hash, payloadBytes: 1024, directImportToolAvailable: true }))
      .toEqual({ action: "validate", consentRequired: true });
  });
  it("Schema不一致、上限超過、import tool不在は完成JSONを保持して手動配送する", function capabilityFallbacks() {
    expect(planCapabilities({ capabilities: { ...capabilities, schemaSha256: "b".repeat(64) }, skillSchemaSha256: hash, payloadBytes: 1 })).toMatchObject({ action: "manual-import", code: "SCHEMA_MISMATCH", preservePayload: true });
    expect(planCapabilities({ capabilities, skillSchemaSha256: hash, payloadBytes: 1025 })).toMatchObject({ action: "manual-import", code: "DIRECT_IMPORT_TOO_LARGE" });
    expect(planCapabilities({ capabilities, skillSchemaSha256: hash, payloadBytes: 1, directImportToolAvailable: false })).toMatchObject({ action: "manual-import", code: "WEBMCP_UNAVAILABLE" });
  });
  it("検証結果のpayload hashをローカル計算値と照合してからimportへ進む", function validatedCandidate() {
    expect(planValidation({ result: { valid: true, candidateToken: "candidate", payloadSha256: hash.toUpperCase() }, localPayloadSha256: hash }))
      .toEqual({ action: "import", candidateToken: "candidate", payloadSha256: hash });
    expect(planValidation({ result: { valid: true, candidateToken: "candidate", payloadSha256: "b".repeat(64) }, localPayloadSha256: hash }))
      .toMatchObject({ action: "stop-direct-import", code: "PAYLOAD_HASH_MISMATCH", automaticRetry: false });
  });
  it("内容不正は手動配送で隠さず候補修正へ戻す", function invalidCandidate() {
    expect(planValidation({ result: { valid: false, error: { code: "INVALID_ASSET" } }, localPayloadSha256: hash }))
      .toEqual({ action: "repair-candidate", code: "INVALID_ASSET" });
  });
  it("Consentと上限解消後は同じrequestIdで再試行する", function userAction() {
    expect(planImport({ success: false, error: { code: "CONSENT_REQUIRED" } })).toEqual({ action: "await-user", code: "CONSENT_REQUIRED", reuseRequestId: true });
    expect(planImport({ success: false, error: { code: "WORKSHEET_LIMIT_REACHED" } })).toEqual({ action: "await-user", code: "WORKSHEET_LIMIT_REACHED", reuseRequestId: true });
  });
  it("candidate消失時は同じpayloadを再検証し同じrequestIdを維持する", function revalidation() {
    for (const code of ["REVALIDATION_REQUIRED", "CANDIDATE_NOT_FOUND", "CANDIDATE_EXPIRED", "CANDIDATE_ALREADY_CONSUMED"]) {
      expect(planImport({ success: false, error: { code } })).toEqual({ action: "revalidate", code, reuseRequestId: true, samePayloadRequired: true });
    }
  });
  it("不明応答とhash不一致では自動再試行しない", function fatalResponses() {
    expect(planImport({ success: false, error: { code: "PAYLOAD_HASH_MISMATCH" } })).toMatchObject({ action: "stop-direct-import", automaticRetry: false });
    expect(planImport({ arbitrary: true })).toMatchObject({ action: "stop-direct-import", code: "UNKNOWN_RESPONSE" });
  });
  it("成功時だけ保存先情報を完了結果として返す", function completed() {
    expect(planImport({ success: true, worksheetId: "worksheet", title: "確認済み", editorPath: "/worksheets/worksheet" }))
      .toEqual({ action: "completed", worksheetId: "worksheet", title: "確認済み", editorPath: "/worksheets/worksheet" });
  });
  it("CLIも配送状態をJSONで判定し、不正入力を安全に停止する", function cli() {
    const directory = mkdtempSync(join(tmpdir(), "math-editor-delivery-test-"));
    const input = join(directory, "state.json");
    const script = fileURLToPath(new URL("../AI/skills/math-editor-textbook-import/scripts/plan_webmcp_delivery.mjs", import.meta.url));
    try {
      writeFileSync(input, JSON.stringify({ stage: "import", result: { success: false, error: { code: "REVALIDATION_REQUIRED" } } }));
      const success = spawnSync(process.execPath, [script, "--input", input], { encoding: "utf8" });
      expect(success.status).toBe(0);
      expect(JSON.parse(success.stdout)).toMatchObject({ action: "revalidate", reuseRequestId: true });
      const failed = spawnSync(process.execPath, [script, "--input", join(directory, "missing.json")], { encoding: "utf8" });
      expect(failed.status).toBe(1);
      expect(JSON.parse(failed.stdout)).toMatchObject({ action: "stop-direct-import", code: "INVALID_DELIVERY_STATE" });
    } finally {
      unlinkSync(input);
      rmdirSync(directory);
    }
  });
});
