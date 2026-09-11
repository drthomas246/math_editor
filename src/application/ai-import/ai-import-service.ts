import { z } from "zod";
import { MathWorksheetFileSchema } from "../../domain/worksheet/worksheet";
import { hydrateBackup } from "../backup/backup";
import { AiImportError } from "./ai-import-errors";
import { MAX_WEBMCP_DIRECT_IMPORT_BYTES, type AiImportCandidateStore, type AiImportService, type ValidatedCandidateSummary } from "./ai-import-types";

export const ValidateAiImportInputSchema = z.strictObject({
  payloadText: z.string(),
  skillSchemaSha256: z.string().regex(/^[a-fA-F0-9]{64}$/u),
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
 * 保存先へ依存しない事前検証サービスを組み立てる。
 * @param candidateStore ページ内で検証済み候補を保持するストア
 * @param schemaSha256 ビルドに同梱されたSchema正本のハッシュ
 * @returns 単一プリントの事前検証サービス
 */
export function createAiImportService(candidateStore: AiImportCandidateStore, schemaSha256: string): AiImportService {
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
  return { validateCandidate };
}
