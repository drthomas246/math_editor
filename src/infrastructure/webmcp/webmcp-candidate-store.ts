import { AiImportError } from "../../application/ai-import/ai-import-errors";
import { MAX_WEBMCP_CANDIDATES, WEBMCP_CANDIDATE_TTL_MS, type ValidatedCandidateSummary, type ValidatedImportCandidate } from "../../application/ai-import/ai-import-types";
import type { WorksheetWithAssets } from "../../application/repositories/worksheet-repository";

/**
 * ページメモリだけに候補を保持する。期限・容量・破棄時に画像も解放する。
 * @returns 候補の作成、一致検査、終了処理
 */
export function createWebMcpCandidateStore() {
  const candidates = new Map<string, ValidatedImportCandidate>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const expiredTokens = new Set<string>();
  let disposed = false;

  /**
   * 候補とタイマーを解放する。
   * @param token 解放する候補の識別子
   */
  function remove(token: string): void {
    clearTimeout(timers.get(token));
    timers.delete(token);
    candidates.delete(token);
  }

  /**
   * 期限切れの本文を解放し、直近の失効理由だけを少量保持する。
   * @param token 期限切れ候補の識別子
   */
  function expire(token: string): void {
    remove(token);
    expiredTokens.add(token);
    if (expiredTokens.size > MAX_WEBMCP_CANDIDATES * 4) {
      expiredTokens.delete(expiredTokens.values().next().value!);
    }
  }

  /**
   * 外部からの変更を遮断した候補を保持する。
   * @param item 検証済みのプリントと画像
   * @param payloadSha256 検証した文字列のハッシュ
   * @returns 本文を含まない検証要約
   */
  function create(item: WorksheetWithAssets, payloadSha256: string): ValidatedCandidateSummary {
    if (disposed) throw new AiImportError("VALIDATION_ABORTED");
    const copy = structuredClone(item);
    if (candidates.size >= MAX_WEBMCP_CANDIDATES) remove(candidates.keys().next().value!);
    const token = crypto.randomUUID();
    const createdAtMs = Date.now();
    const expiresAtMs = createdAtMs + WEBMCP_CANDIDATE_TTL_MS;
    candidates.set(token, { token, payloadSha256, item: copy, createdAtMs, expiresAtMs, consumed: false });
    /** 候補の期限が到来したら画像を含めて解放する。 */
    function expireCandidate(): void { expire(token); }
    timers.set(token, setTimeout(expireCandidate, WEBMCP_CANDIDATE_TTL_MS));
    let problemCount = 0;
    for (const block of copy.worksheet.problems) if (block.type === "problem") problemCount++;
    return {
      valid: true, candidateToken: token, payloadSha256,
      worksheetId: copy.worksheet.id, title: copy.worksheet.title,
      problemCount, assetCount: copy.assets.length,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  /**
   * トークン・期限・ハッシュが一致した候補の独立コピーを返す。
   * @param token 検証時に受け取ったトークン
   * @param expectedPayloadSha256 利用する予定のJSONのハッシュ
   * @returns 外部からストアを書き換えられない候補のコピー
   */
  function get(token: string, expectedPayloadSha256: string): ValidatedImportCandidate {
    if (expiredTokens.has(token)) throw new AiImportError("CANDIDATE_EXPIRED");
    const candidate = candidates.get(token);
    if (!candidate) throw new AiImportError("CANDIDATE_NOT_FOUND");
    if (Date.now() >= candidate.expiresAtMs) {
      expire(token);
      throw new AiImportError("CANDIDATE_EXPIRED");
    }
    if (candidate.payloadSha256 !== expectedPayloadSha256) throw new AiImportError("PAYLOAD_HASH_MISMATCH");
    if (candidate.consumed) throw new AiImportError("CANDIDATE_ALREADY_CONSUMED");
    return structuredClone(candidate);
  }

  /**
   * 保存が完了した候補を消費済みにし、別requestIdでの再利用を拒否する。
   * @param token 消費済みにする候補トークン
   */
  function consume(token: string): void {
    const candidate = candidates.get(token);
    if (!candidate) return;
    candidate.consumed = true;
  }

  /** ページ終了後の非同期処理による再保持も禁止し、すべての候補を破棄する。 */
  function dispose(): void {
    disposed = true;
    for (const token of candidates.keys()) remove(token);
    expiredTokens.clear();
  }
  return { create, get, consume, dispose };
}
