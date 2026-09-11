import schemaManifest from "../../../schemas/math-worksheet.schema-manifest.json" with { type: "json" };
import { CURRENT_SCHEMA_VERSION, MATH_WORKSHEET_FILE_FORMAT } from "../../domain/worksheet/worksheet.schema";
import { MAX_WEBMCP_CANDIDATES, MAX_WEBMCP_DIRECT_IMPORT_BYTES, WEBMCP_CANDIDATE_TTL_MS } from "../../application/ai-import/ai-import-types";

export const APP_SCHEMA_SHA256 = schemaManifest.sha256.toLowerCase();
export const MATH_EDITOR_AI_INTEGRATION_VERSION = 1;

/**
 * 実装済みの読取・検証機能と、同梱Schemaの識別情報を返す。
 * @returns Phase 2で利用可能な機能と候補の保持条件
 */
export function getMathEditorCapabilities() {
  return {
    app: "math-editor" as const,
    integrationVersion: MATH_EDITOR_AI_INTEGRATION_VERSION,
    worksheetFormat: MATH_WORKSHEET_FILE_FORMAT,
    worksheetFileVersion: 1 as const,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    schemaSha256: APP_SCHEMA_SHA256,
    validationAvailable: true,
    directImportAvailable: false,
    writeConsentGranted: false,
    maxDirectImportBytes: MAX_WEBMCP_DIRECT_IMPORT_BYTES,
    candidateTtlMs: WEBMCP_CANDIDATE_TTL_MS,
    maxCandidates: MAX_WEBMCP_CANDIDATES,
    availableTools: ["math_editor_get_capabilities", "math_editor_validate_import"],
  };
}
