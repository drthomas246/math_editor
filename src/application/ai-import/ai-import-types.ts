import type { WorksheetWithAssets } from "../repositories/worksheet-repository";

export const MAX_WEBMCP_DIRECT_IMPORT_BYTES = 2 * 1024 * 1024;
export const WEBMCP_CANDIDATE_TTL_MS = 10 * 60 * 1000;
export const MAX_WEBMCP_CANDIDATES = 8;

export type ValidateAiImportInput = {
  payloadText: string;
  skillSchemaSha256: string;
};

export type ValidatedCandidateSummary = {
  valid: true;
  candidateToken: string;
  payloadSha256: string;
  worksheetId: string;
  title: string;
  problemCount: number;
  assetCount: number;
  expiresAt: string;
};

export type ValidatedImportCandidate = {
  token: string;
  payloadSha256: string;
  item: WorksheetWithAssets;
  createdAtMs: number;
  expiresAtMs: number;
  consumed: boolean;
};

export type ImportAiCandidateInput = {
  candidateToken: string;
  requestId: string;
  expectedPayloadSha256: string;
};

export type AiImportResult = {
  success: true;
  worksheetId: string;
  title: string;
  editorPath: string;
};

export type ImportReceipt = {
  requestId: string;
  payloadSha256: string;
  worksheetId: string;
  title: string;
  status: "pending" | "completed";
  createdAt: string;
  completedAt?: string | undefined;
};

export interface AiImportCandidateStore {
  /**
   * 検証済みデータを一時保持し、本文を含まない要約を返す。
   * @param item 検証と識別子の再割当てが完了したプリント
   * @param payloadSha256 受信したJSON文字列のハッシュ
   * @returns 候補の識別情報と期限
   */
  create(item: WorksheetWithAssets, payloadSha256: string): ValidatedCandidateSummary;
  /**
   * トークン・期限・ハッシュ・消費状態を検査して候補の独立コピーを返す。
   * @param token 検証時に発行した候補トークン
   * @param expectedPayloadSha256 利用するJSONの想定ハッシュ
   * @returns 保存へ渡せる検証済み候補
   */
  get(token: string, expectedPayloadSha256: string): ValidatedImportCandidate;
  /**
   * 保存済み候補を再利用できない状態へ変更する。
   * @param token 消費済みにする候補トークン
   */
  consume(token: string): void;
}

export interface AiImportReceiptStore {
  /**
   * requestIdに対応する受領記録を読み込む。
   * @param requestId インポート要求の識別子
   * @returns 保存済みの受領記録。存在しない場合はnull
   */
  read(requestId: string): ImportReceipt | null;
  /**
   * Repository保存前の受領記録を保持する。
   * @param receipt pending状態で保存する受領情報
   * @returns 保存した受領記録
   */
  writePending(receipt: Omit<ImportReceipt, "status" | "createdAt" | "completedAt">): ImportReceipt;
  /**
   * 受領記録を保存完了状態へ昇格する。
   * @param receipt 昇格元となる受領記録
   * @returns 完了日時を付与した受領記録
   */
  complete(receipt: ImportReceipt): ImportReceipt;
  /**
   * 保存実体がない受領記録を削除する。
   * @param requestId 削除するインポート要求の識別子
   */
  clear(requestId: string): void;
}

export type AiImportCompletedEvent = {
  type: "ai-import-completed";
  worksheetId: string;
  title: string;
  requestId: string;
};

export type AiImportDependencies = {
  repository: {
    get(id: string): Promise<WorksheetWithAssets | null>;
    create(data: WorksheetWithAssets): Promise<void>;
  };
  receiptStore: AiImportReceiptStore;
  isWriteConsentGranted: () => boolean;
  publishCompleted: (event: AiImportCompletedEvent) => void;
};

export interface AiImportService {
  /**
   * 単一プリントを検証してメモリ上の候補にする。
   * @param input 完成JSONとSkill同梱Schemaのハッシュ
   * @param signal 中断を通知する任意のシグナル
   * @returns 永続保存を伴わない検証結果
   */
  validateCandidate(input: unknown, signal?: AbortSignal): Promise<ValidatedCandidateSummary>;
  /**
   * 検証済み候補を冪等に新規保存する。
   * @param input 候補トークン、要求ID、想定payloadハッシュ
   * @returns 保存したプリントへの参照情報
   */
  importCandidate(input: unknown): Promise<AiImportResult>;
}
