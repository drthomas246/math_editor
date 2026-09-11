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
};

export interface AiImportCandidateStore {
  /**
   * 検証済みデータを一時保持し、本文を含まない要約を返す。
   * @param item 検証と識別子の再割当てが完了したプリント
   * @param payloadSha256 受信したJSON文字列のハッシュ
   * @returns 候補の識別情報と期限
   */
  create(item: WorksheetWithAssets, payloadSha256: string): ValidatedCandidateSummary;
}

export interface AiImportService {
  /**
   * 単一プリントを検証してメモリ上の候補にする。
   * @param input 完成JSONとSkill同梱Schemaのハッシュ
   * @param signal 中断を通知する任意のシグナル
   * @returns 永続保存を伴わない検証結果
   */
  validateCandidate(input: unknown, signal?: AbortSignal): Promise<ValidatedCandidateSummary>;
}
