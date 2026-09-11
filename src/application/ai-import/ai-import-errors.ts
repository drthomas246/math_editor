export type AiImportErrorCode =
  | "INVALID_INPUT"
  | "SCHEMA_MISMATCH"
  | "DIRECT_IMPORT_TOO_LARGE"
  | "INVALID_JSON"
  | "INVALID_WORKSHEET_FILE"
  | "INVALID_ASSET"
  | "CANDIDATE_NOT_FOUND"
  | "CANDIDATE_EXPIRED"
  | "PAYLOAD_HASH_MISMATCH"
  | "VALIDATION_ABORTED"
  | "VALIDATION_FAILED";

export type AiImportErrorDetail = {
  code: AiImportErrorCode;
  message: string;
  recoverable: boolean;
  fallbackRecommended: boolean;
};

const ERROR_MESSAGES: Record<AiImportErrorCode, string> = {
  INVALID_INPUT: "payloadTextとskillSchemaSha256を指定してください。",
  SCHEMA_MISMATCH: "SkillとMath EditorのSchemaが一致しません。互換性を確認してください。",
  DIRECT_IMPORT_TOO_LARGE: "WebMCPの上限は2 MiBです。検証済みJSONを通常のインポートから読み込んでください。",
  INVALID_JSON: "JSONを解析できませんでした。完成ファイルを修正してください。",
  INVALID_WORKSHEET_FILE: "Math Editorの単一プリント形式に適合しません。内容を修正してください。",
  INVALID_ASSET: "画像の形式・内容・寸法を検証できませんでした。画像を修正してください。",
  CANDIDATE_NOT_FOUND: "候補が見つかりません。同じJSONを再検証してください。",
  CANDIDATE_EXPIRED: "候補の有効期限が切れました。同じJSONを再検証してください。",
  PAYLOAD_HASH_MISMATCH: "検証したJSONとハッシュが一致しません。JSONを再検証してください。",
  VALIDATION_ABORTED: "検証が中断されました。対象ページで再検証してください。",
  VALIDATION_FAILED: "検証を完了できませんでした。対象ページの状態を確認してください。",
};

export class AiImportError extends Error {
  readonly code: AiImportErrorCode;

  /**
   * 内部例外の詳細を含めずに公開エラーを作る。
   * @param code 利用者の復旧手順を識別するコード
   */
  constructor(code: AiImportErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "AiImportError";
    this.code = code;
  }
}

/**
 * ライブラリの例外や入力本文を公開せず、復旧可能な失敗へ変換する。
 * @param error 検証中に発生した例外
 * @returns 安定したエラーコードと利用者向けの説明
 */
export function toAiImportErrorDetail(error: unknown): AiImportErrorDetail {
  const code = error instanceof AiImportError ? error.code : "VALIDATION_FAILED";
  return {
    code,
    message: ERROR_MESSAGES[code],
    recoverable: true,
    fallbackRecommended: code === "SCHEMA_MISMATCH" || code === "DIRECT_IMPORT_TOO_LARGE",
  };
}
