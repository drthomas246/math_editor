import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA256_PATTERN = /^[a-f0-9]{64}$/iu;
const CONTENT_ERROR_CODES = new Set(["INVALID_JSON", "INVALID_WORKSHEET_FILE", "INVALID_ASSET"]);
const REVALIDATION_CODES = new Set(["REVALIDATION_REQUIRED", "CANDIDATE_NOT_FOUND", "CANDIDATE_EXPIRED", "CANDIDATE_ALREADY_CONSUMED"]);
const USER_ACTION_CODES = new Set(["CONSENT_REQUIRED", "WORKSHEET_LIMIT_REACHED"]);
const TRANSIENT_IMPORT_CODES = new Set(["IMPORT_ABORTED", "IMPORT_FAILED"]);

/**
 * WebMCP固有障害から通常のJSONインポートへ安全に戻す判断を作る。
 * @param code フォールバック理由を示す安定したコード
 * @returns 検証済みJSONを変更せず手動配送する判断
 */
function manualImport(code) {
  return { action: "manual-import", code, preservePayload: true };
}

/**
 * 不明または整合しない応答で直接取込を停止する判断を作る。
 * @param code 停止理由を示す安定したコード
 * @returns 自動再試行や暗黙の書込みを禁止する判断
 */
function stopDirectImport(code) {
  return { action: "stop-direct-import", code, automaticRetry: false };
}

/**
 * 公開ツールの応答から安定したエラーコードだけを取得する。
 * @param result WebMCPツールから受け取った不信頼な応答
 * @returns 文字列のエラーコード。不明ならUNKNOWN_RESPONSE
 */
function errorCode(result) {
  return typeof result?.error?.code === "string" ? result.error.code : "UNKNOWN_RESPONSE";
}

/**
 * 配送状態に保存した自動再試行回数を安全に読み取る。
 * @param input 配送状態
 * @param name 回数を保持するプロパティ名
 * @returns 0以上の安全な整数。不正ならnull
 */
function retryAttempts(input, name) {
  const value = input?.[name] ?? 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * すうがく仕立ての能力情報と完成payloadから直接取込の開始可否を判定する。
 * @param input 能力情報、Skill Schemaハッシュ、payloadバイト数、ツール発見結果
 * @returns 事前検証またはJSONフォールバックの判断
 */
export function planCapabilities(input) {
  const capabilities = input?.capabilities;
  const skillSchemaSha256 = input?.skillSchemaSha256;
  const payloadBytes = input?.payloadBytes;
  if (!capabilities || typeof capabilities !== "object" || !SHA256_PATTERN.test(skillSchemaSha256 ?? "")
    || !Number.isSafeInteger(payloadBytes) || payloadBytes < 0) {
    return stopDirectImport("INVALID_DELIVERY_STATE");
  }
  if (capabilities.app !== "sujita" || capabilities.integrationVersion !== 1
    || capabilities.worksheetFormat !== "math-worksheet" || capabilities.worksheetFileVersion !== 1
    || capabilities.schemaVersion !== 1 || capabilities.validationAvailable !== true) {
    return manualImport("WEBMCP_INCOMPATIBLE");
  }
  if (typeof capabilities.schemaSha256 !== "string"
    || capabilities.schemaSha256.toLowerCase() !== skillSchemaSha256.toLowerCase()) {
    return manualImport("SCHEMA_MISMATCH");
  }
  if (capabilities.directImportAvailable !== true || input.directImportToolAvailable !== true) {
    return manualImport("WEBMCP_UNAVAILABLE");
  }
  if (!Number.isSafeInteger(capabilities.maxDirectImportBytes) || capabilities.maxDirectImportBytes < 0) {
    return manualImport("WEBMCP_INCOMPATIBLE");
  }
  if (payloadBytes > capabilities.maxDirectImportBytes) return manualImport("DIRECT_IMPORT_TOO_LARGE");
  return { action: "validate", consentRequired: capabilities.writeConsentGranted !== true };
}

/**
 * すうがく仕立て側の事前検証結果を、直接取込または安全な復旧判断へ変換する。
 * @param input 検証応答と送信した完成payloadのSHA-256
 * @returns import入力に使う候補情報、再試行、修正、停止の判断
 */
export function planValidation(input) {
  const result = input?.result;
  const localPayloadSha256 = input?.localPayloadSha256;
  if (!SHA256_PATTERN.test(localPayloadSha256 ?? "")) return stopDirectImport("INVALID_DELIVERY_STATE");
  if (result?.valid === true) {
    if (typeof result.candidateToken !== "string" || !result.candidateToken
      || !SHA256_PATTERN.test(result.payloadSha256 ?? "")
      || result.payloadSha256.toLowerCase() !== localPayloadSha256.toLowerCase()) {
      return stopDirectImport("PAYLOAD_HASH_MISMATCH");
    }
    return {
      action: "import",
      candidateToken: result.candidateToken,
      payloadSha256: result.payloadSha256.toLowerCase(),
    };
  }
  const code = errorCode(result);
  if (CONTENT_ERROR_CODES.has(code)) return { action: "repair-candidate", code };
  if (code === "SCHEMA_MISMATCH" || code === "DIRECT_IMPORT_TOO_LARGE") return manualImport(code);
  if (code === "VALIDATION_ABORTED" || code === "VALIDATION_FAILED") {
    const attempts = retryAttempts(input, "validationRetryAttempts");
    if (attempts === null) return stopDirectImport("INVALID_DELIVERY_STATE");
    if (attempts >= 1) return manualImport(code);
    return {
      action: "retry-validation",
      code,
      automaticRetryLimit: 1,
      nextValidationRetryAttempts: attempts + 1,
      samePayloadRequired: true,
    };
  }
  return stopDirectImport(code);
}

/**
 * 直接取込の結果を、receipt冪等性を壊さない次の操作へ分類する。
 * @param result すうがく仕立てのimport toolから受け取った応答
 * @param state 再検証とimport再試行の回数を含む配送状態
 * @returns 完了、利用者操作待ち、再検証、再試行、修正、停止の判断
 */
export function planImport(result, state = {}) {
  if (result?.success === true) {
    if (typeof result.worksheetId !== "string" || !result.worksheetId
      || typeof result.title !== "string" || typeof result.editorPath !== "string") {
      return stopDirectImport("UNKNOWN_RESPONSE");
    }
    return {
      action: "completed",
      worksheetId: result.worksheetId,
      title: result.title,
      editorPath: result.editorPath,
    };
  }
  const code = errorCode(result);
  if (USER_ACTION_CODES.has(code)) return { action: "await-user", code, reuseRequestId: true };
  if (REVALIDATION_CODES.has(code)) {
    const attempts = retryAttempts(state, "revalidationAttempts");
    if (attempts === null) return stopDirectImport("INVALID_DELIVERY_STATE");
    if (attempts >= 1) return manualImport(code);
    return {
      action: "revalidate",
      code,
      reuseRequestId: true,
      samePayloadRequired: true,
      automaticRetryLimit: 1,
      nextRevalidationAttempts: attempts + 1,
    };
  }
  if (TRANSIENT_IMPORT_CODES.has(code)) {
    const attempts = retryAttempts(state, "importRetryAttempts");
    if (attempts === null) return stopDirectImport("INVALID_DELIVERY_STATE");
    if (attempts >= 1) return manualImport(code);
    return {
      action: "retry-import",
      code,
      reuseRequestId: true,
      automaticRetryLimit: 1,
      nextImportRetryAttempts: attempts + 1,
    };
  }
  if (code === "SCHEMA_MISMATCH" || code === "DIRECT_IMPORT_TOO_LARGE") return manualImport(code);
  if (CONTENT_ERROR_CODES.has(code)) return { action: "repair-candidate", code };
  return stopDirectImport(code);
}

/**
 * 入力で指定された配送段階を対応する純粋な判定関数へ渡す。
 * @param input 能力取得、事前検証、直接取込のいずれかの状態
 * @returns Skillが次に実行する操作
 */
export function planWebMcpDelivery(input) {
  if (input?.stage === "capabilities") return planCapabilities(input);
  if (input?.stage === "validation") return planValidation(input);
  if (input?.stage === "import") return planImport(input.result, input);
  return stopDirectImport("INVALID_DELIVERY_STATE");
}

/**
 * 配送状態ファイルを読み、機械可読な次操作を標準出力へ返す。
 * @returns CLIの実行完了
 */
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--input") throw new Error("Usage: --input <delivery-state.json>");
  const input = JSON.parse(await readFile(process.argv[3], "utf8"));
  process.stdout.write(`${JSON.stringify(planWebMcpDelivery(input))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); } catch {
    process.stdout.write(`${JSON.stringify(stopDirectImport("INVALID_DELIVERY_STATE"))}\n`);
    process.exitCode = 1;
  }
}
