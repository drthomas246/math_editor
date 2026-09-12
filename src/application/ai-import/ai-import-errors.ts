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
  | "CONSENT_REQUIRED"
  | "CANDIDATE_ALREADY_CONSUMED"
  | "REVALIDATION_REQUIRED"
  | "WORKSHEET_LIMIT_REACHED"
  | "IMPORT_FAILED"
  | "IMPORT_ABORTED"
  | "VALIDATION_ABORTED"
  | "VALIDATION_FAILED";

export type AiImportErrorDetail = {
  code: AiImportErrorCode;
  message: string;
  recoverable: boolean;
  fallbackRecommended: boolean;
};

const ERROR_MESSAGES: Record<AiImportErrorCode, string> = {
  INVALID_INPUT: "ツールの入力項目が正しくありません。必要な項目と形式を確認してください。",
  SCHEMA_MISMATCH: "SkillとMath EditorのSchemaが一致しません。互換性を確認してください。",
  DIRECT_IMPORT_TOO_LARGE: "WebMCPの上限は2 MiBです。検証済みJSONを通常のインポートから読み込んでください。",
  INVALID_JSON: "JSONを解析できませんでした。完成ファイルを修正してください。",
  INVALID_WORKSHEET_FILE: "Math Editorの単一プリント形式に適合しません。内容を修正してください。",
  INVALID_ASSET: "画像の形式・内容・寸法を検証できませんでした。画像を修正してください。",
  CANDIDATE_NOT_FOUND: "候補が見つかりません。同じJSONを再検証してください。",
  CANDIDATE_EXPIRED: "候補の有効期限が切れました。同じJSONを再検証してください。",
  PAYLOAD_HASH_MISMATCH: "検証したJSONとハッシュが一致しません。同じrequestIdでは続行できません。",
  CONSENT_REQUIRED: "Math Editorで、このページセッションのAI連携を許可してください。",
  CANDIDATE_ALREADY_CONSUMED: "この検証候補はすでに使用されています。JSONを再検証してください。",
  REVALIDATION_REQUIRED: "保存済みデータを確認できませんでした。同じJSONを再検証して、同じrequestIdで再試行してください。",
  WORKSHEET_LIMIT_REACHED: "プリント数の上限に達しています。不要なプリントを完全に削除してから再試行してください。",
  IMPORT_FAILED: "プリントを保存できませんでした。Math Editorの状態を確認してください。",
  IMPORT_ABORTED: "プリントの保存を開始する前に直接取込が中断されました。同じ要求を再試行できます。",
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
    recoverable: code !== "PAYLOAD_HASH_MISMATCH"
      && code !== "INVALID_WORKSHEET_FILE"
      && code !== "INVALID_ASSET",
    fallbackRecommended: code === "SCHEMA_MISMATCH"
      || code === "DIRECT_IMPORT_TOO_LARGE"
      || code === "CANDIDATE_EXPIRED"
      || code === "IMPORT_FAILED",
  };
}
