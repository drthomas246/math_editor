import schemaManifest from "../../../schemas/math-worksheet.schema-manifest.json" with { type: "json" };
import { CURRENT_SCHEMA_VERSION, MATH_WORKSHEET_FILE_FORMAT } from "../../domain/worksheet/worksheet.schema";
import { MAX_WEBMCP_CANDIDATES, MAX_WEBMCP_DIRECT_IMPORT_BYTES, WEBMCP_CANDIDATE_TTL_MS } from "../../application/ai-import/ai-import-types";
import { webMcpSession } from "./webmcp-session";

export const APP_SCHEMA_SHA256 = schemaManifest.sha256.toLowerCase();
export const MATH_EDITOR_AI_INTEGRATION_VERSION = 1;

/**
 * 実装済みの直接取込機能、同梱Schema、現在の書込許可を返す。
 * @returns Phase 3で利用可能な機能と候補の保持条件
 */
export function getMathEditorCapabilities() {
  const session = webMcpSession.getSnapshot();
  const availableTools = ["math_editor_get_capabilities", "math_editor_validate_import"];
  if (session.directImportAvailable) availableTools.push("math_editor_import_worksheet");
  return {
    app: "math-editor" as const,
    integrationVersion: MATH_EDITOR_AI_INTEGRATION_VERSION,
    worksheetFormat: MATH_WORKSHEET_FILE_FORMAT,
    worksheetFileVersion: 1 as const,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    schemaSha256: APP_SCHEMA_SHA256,
    validationAvailable: true,
    directImportAvailable: session.directImportAvailable,
    writeConsentGranted: session.writeConsentGranted,
    maxDirectImportBytes: MAX_WEBMCP_DIRECT_IMPORT_BYTES,
    candidateTtlMs: WEBMCP_CANDIDATE_TTL_MS,
    maxCandidates: MAX_WEBMCP_CANDIDATES,
    availableTools,
  };
}
