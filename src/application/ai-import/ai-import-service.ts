import { z } from "zod";
import { MathWorksheetFileSchema } from "../../domain/worksheet/worksheet";
import { hydrateBackup } from "../backup/backup";
import { AiImportError } from "./ai-import-errors";
import {
  MAX_WEBMCP_DIRECT_IMPORT_BYTES,
  type AiImportDependencies,
  type AiImportCandidateStore,
  type AiImportResult,
  type AiImportService,
  type ImportAiCandidateInput,
  type ImportReceipt,
  type ValidatedCandidateSummary,
} from "./ai-import-types";

export const ValidateAiImportInputSchema = z.strictObject({
  payloadText: z.string(),
  skillSchemaSha256: z.string().regex(/^[a-fA-F0-9]{64}$/u),
});

export const ImportAiCandidateInputSchema = z.strictObject({
  candidateToken: z.string().min(1).max(256),
  requestId: z.string().min(1).max(256),
  expectedPayloadSha256: z.string().regex(/^[a-fA-F0-9]{64}$/u),
});

/**
 * JSONの空白や改行も含むUTF-8バイト列を小文字SHA-256へ変換する。
 * @param text 受信した元の文字列
 * @returns 正規化や再直列化を行わないハッシュ
 */
export async function sha256Utf8(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let result = "";
  for (const byte of new Uint8Array(digest)) result += byte.toString(16).padStart(2, "0");
  return result;
}

/**
 * 中断後に検証済み候補が作られることを防ぐ。
 * @param signal 呼出元の中断シグナル
 */
function assertActive(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AiImportError("VALIDATION_ABORTED");
}

/**
 * 中断後にReceipt作成やRepository保存が始まることを防ぐ。
 * @param signal 呼出元の中断シグナル
 */
function assertImportActive(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AiImportError("IMPORT_ABORTED");
}

/**
 * 保存先へ依存しない事前検証サービスを組み立てる。
 * @param candidateStore ページ内で検証済み候補を保持するストア
 * @param schemaSha256 ビルドに同梱されたSchema正本のハッシュ
 * @param dependencies Repository、Receipt、Consent、完了通知の依存関係
 * @returns 単一プリントの事前検証サービス
 */
export function createAiImportService(
  candidateStore: AiImportCandidateStore,
  schemaSha256: string,
  dependencies?: AiImportDependencies,
): AiImportService {
  const pendingImports = new Map<string, {
    payloadSha256: string;
    promise: Promise<AiImportResult>;
  }>();

  /**
   * サイズ、Schema、画像を順に検証して候補を保持する。
   * @param input 信頼しないツール入力
   * @param signal 検証中断の通知
   * @returns 検証済み候補の要約
   */
  async function validateCandidate(input: unknown, signal?: AbortSignal): Promise<ValidatedCandidateSummary> {
    assertActive(signal);
    const parsedInput = ValidateAiImportInputSchema.safeParse(input);
    if (!parsedInput.success) throw new AiImportError("INVALID_INPUT");
    const { payloadText, skillSchemaSha256 } = parsedInput.data;
    // 巨大文字列ではエンコード用の追加メモリ確保より先に拒否する。
    if (payloadText.length > MAX_WEBMCP_DIRECT_IMPORT_BYTES
      || new TextEncoder().encode(payloadText).byteLength > MAX_WEBMCP_DIRECT_IMPORT_BYTES) {
      throw new AiImportError("DIRECT_IMPORT_TOO_LARGE");
    }
    if (skillSchemaSha256.toLowerCase() !== schemaSha256.toLowerCase()) {
      throw new AiImportError("SCHEMA_MISMATCH");
    }
    let value: unknown;
    try {
      value = JSON.parse(payloadText);
    } catch {
      throw new AiImportError("INVALID_JSON");
    }
    let file;
    try {
      file = MathWorksheetFileSchema.parse(value);
    } catch {
      throw new AiImportError("INVALID_WORKSHEET_FILE");
    }
    if (file.kind !== "single") throw new AiImportError("INVALID_WORKSHEET_FILE");
    let items;
    try {
      // 通常インポートと同じ画像検証とID再割当てを使う。DBへの保存は行わない。
      items = await hydrateBackup(file);
    } catch {
      throw new AiImportError("INVALID_ASSET");
    }
    assertActive(signal);
    const payloadSha256 = await sha256Utf8(payloadText);
    assertActive(signal);
    return candidateStore.create(items[0]!, payloadSha256);
  }

  /**
   * Receiptから保存成功時と同じ公開結果を再構成する。
   * @param receipt 保存済みまたは回復済みの受領記録
   * @returns 保存したプリントの識別情報と編集画面パス
   */
  function successFromReceipt(receipt: ImportReceipt): AiImportResult {
    return {
      success: true,
      worksheetId: receipt.worksheetId,
      title: receipt.title,
      editorPath: `/worksheets/${encodeURIComponent(receipt.worksheetId)}`,
    };
  }

  /**
   * 保存完了イベントをApplication層の購読者へ安全に通知する。
   * @param receipt 通知へ必要な識別情報だけを持つ受領記録
   */
  function publishCompletion(receipt: ImportReceipt): void {
    try {
      dependencies?.publishCompleted({
        type: "ai-import-completed",
        worksheetId: receipt.worksheetId,
        title: receipt.title,
        requestId: receipt.requestId,
      });
    } catch {
      // 表示同期の失敗を、完了済みのRepository保存から隔離する。
    }
  }

  /**
   * Repository例外を公開用の安定したエラーコードへ変換する。
   * @param error Repository保存時に発生した内部例外
   * @returns 件数上限または一般的な保存失敗
   */
  function normalizeRepositoryError(error: unknown): AiImportError {
    if (error && typeof error === "object" && "code" in error
      && error.code === "WORKSHEET_LIMIT_EXCEEDED") {
      return new AiImportError("WORKSHEET_LIMIT_REACHED");
    }
    return new AiImportError("IMPORT_FAILED");
  }

  /**
   * 同じrequestIdの直列化後に、Receiptを候補より先に確認して保存する。
   * @param input 実行時検証済みの直接取込入力
   * @param signal 保存開始前の中断通知
   * @returns 新規保存または過去の保存から回復した結果
   */
  async function importCandidateOnce(input: ImportAiCandidateInput, signal?: AbortSignal): Promise<AiImportResult> {
    assertImportActive(signal);
    if (!dependencies) throw new AiImportError("IMPORT_FAILED");
    if (!dependencies.isWriteConsentGranted()) throw new AiImportError("CONSENT_REQUIRED");

    let previous: ImportReceipt | null;
    try {
      previous = dependencies.receiptStore.read(input.requestId);
    } catch {
      throw new AiImportError("IMPORT_FAILED");
    }
    let stalePending = false;
    if (previous) {
      if (previous.payloadSha256.toLowerCase() !== input.expectedPayloadSha256.toLowerCase()) {
        throw new AiImportError("PAYLOAD_HASH_MISMATCH");
      }
      if (previous.status === "completed") return successFromReceipt(previous);
      let saved;
      try {
        saved = await dependencies.repository.get(previous.worksheetId);
      } catch {
        throw new AiImportError("IMPORT_FAILED");
      }
      assertImportActive(signal);
      if (saved) {
        let recovered;
        try {
          recovered = dependencies.receiptStore.complete(previous);
        } catch {
          throw new AiImportError("IMPORT_FAILED");
        }
        publishCompletion(recovered);
        return successFromReceipt(recovered);
      }
      try {
        dependencies.receiptStore.clear(input.requestId);
      } catch {
        throw new AiImportError("IMPORT_FAILED");
      }
      stalePending = true;
    }

    assertImportActive(signal);
    let candidate;
    try {
      candidate = candidateStore.get(input.candidateToken, input.expectedPayloadSha256.toLowerCase());
    } catch (error) {
      if (stalePending && error instanceof AiImportError
        && (error.code === "CANDIDATE_NOT_FOUND" || error.code === "CANDIDATE_EXPIRED")) {
        throw new AiImportError("REVALIDATION_REQUIRED");
      }
      throw error;
    }

    assertImportActive(signal);
    let pendingReceipt;
    try {
      pendingReceipt = dependencies.receiptStore.writePending({
        requestId: input.requestId,
        payloadSha256: candidate.payloadSha256,
        worksheetId: candidate.item.worksheet.id,
        title: candidate.item.worksheet.title,
      });
    } catch {
      throw new AiImportError("IMPORT_FAILED");
    }

    assertImportActive(signal);
    try {
      await dependencies.repository.create(candidate.item);
    } catch (error) {
      try { dependencies.receiptStore.clear(input.requestId); } catch {
        // 保存失敗を正本とし、後始末の失敗よりRepositoryエラーを優先する。
      }
      throw normalizeRepositoryError(error);
    }

    let completedReceipt;
    try {
      completedReceipt = dependencies.receiptStore.complete(pendingReceipt);
    } catch {
      // pendingを残せば、再試行時にRepository実体との照合で回復できる。
      throw new AiImportError("IMPORT_FAILED");
    }
    candidateStore.consume(candidate.token);
    publishCompletion(completedReceipt);
    return successFromReceipt(completedReceipt);
  }

  /**
   * 信頼しない入力を検証し、同時に届いた同一要求も一つの保存へまとめる。
   * @param input 候補トークン、要求ID、想定payloadハッシュ
   * @param signal 保存開始前の中断通知
   * @returns 保存済みプリントへの参照情報
   */
  async function importCandidate(input: unknown, signal?: AbortSignal): Promise<AiImportResult> {
    assertImportActive(signal);
    const parsedInput = ImportAiCandidateInputSchema.safeParse(input);
    if (!parsedInput.success) throw new AiImportError("INVALID_INPUT");
    const parsed = {
      ...parsedInput.data,
      expectedPayloadSha256: parsedInput.data.expectedPayloadSha256.toLowerCase(),
    };
    const current = pendingImports.get(parsed.requestId);
    if (current) {
      if (current.payloadSha256 !== parsed.expectedPayloadSha256) {
        throw new AiImportError("PAYLOAD_HASH_MISMATCH");
      }
      return current.promise;
    }
    const execution = importCandidateOnce(parsed, signal);
    pendingImports.set(parsed.requestId, { payloadSha256: parsed.expectedPayloadSha256, promise: execution });
    try {
      return await execution;
    } finally {
      if (pendingImports.get(parsed.requestId)?.promise === execution) pendingImports.delete(parsed.requestId);
    }
  }

  return { validateCandidate, importCandidate };
}
