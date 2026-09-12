import { z } from "zod";
import type { AiImportReceiptStore, ImportReceipt } from "../../application/ai-import/ai-import-types";

const RECEIPT_KEY_PREFIX = "sugaku-jitate:webmcp-import:";
const ImportReceiptSchema = z.strictObject({
  requestId: z.string().min(1).max(256),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  worksheetId: z.string().min(1),
  title: z.string(),
  status: z.enum(["pending", "completed"]),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
});

/**
 * Receiptの読書きに使用できるsessionStorageを安全に検出する。
 * @returns 読書き可能な保存先。アクセス拒否または容量エラー時はundefined
 */
export function detectWebMcpSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  const probeKey = "sugaku-jitate:webmcp-storage-probe";
  try {
    const storage = window.sessionStorage;
    const previous = storage.getItem(probeKey);
    storage.setItem(probeKey, "1");
    if (previous === null) storage.removeItem(probeKey);
    else storage.setItem(probeKey, previous);
    return storage;
  } catch {
    return undefined;
  }
}

/**
 * requestIdを他のsessionStorage項目と衝突しないキーへ変換する。
 * @param requestId インポート要求の識別子
 * @returns Receipt専用のsessionStorageキー
 */
function receiptKey(requestId: string): string {
  return `${RECEIPT_KEY_PREFIX}${encodeURIComponent(requestId)}`;
}

/**
 * 同一タブの再読込をまたいで冪等性を回復するReceiptストアを作る。
 * @param storage Receiptを保持するsessionStorage互換の保存先
 * @returns Receiptの読込・保存・昇格・削除操作
 */
export function createWebMcpImportReceiptStore(storage: Storage = sessionStorage): AiImportReceiptStore {
  /**
   * requestIdに対応する検証済みReceiptを読み込む。
   * @param requestId インポート要求の識別子
   * @returns 正しい形式のReceipt。未保存または破損時はnull
   */
  function read(requestId: string): ImportReceipt | null {
    const key = receiptKey(requestId);
    const value = storage.getItem(key);
    if (value === null) return null;
    try {
      const parsed = ImportReceiptSchema.safeParse(JSON.parse(value));
      if (parsed.success && parsed.data.requestId === requestId) return parsed.data;
    } catch {
      // 破損した受領記録は保存結果として信用しない。
    }
    storage.removeItem(key);
    return null;
  }

  /**
   * Repository保存前の受領記録を作成する。
   * @param value 要求と候補を結び付ける最小情報
   * @returns sessionStorageへ保存したpending Receipt
   */
  function writePending(value: Omit<ImportReceipt, "status" | "createdAt" | "completedAt">): ImportReceipt {
    const receipt = ImportReceiptSchema.parse({ ...value, status: "pending", createdAt: new Date().toISOString() });
    storage.setItem(receiptKey(receipt.requestId), JSON.stringify(receipt));
    return receipt;
  }

  /**
   * Repositoryに実体があるReceiptを完了状態へ昇格する。
   * @param value pendingまたは回復対象のReceipt
   * @returns 完了日時を付与して保存したReceipt
   */
  function complete(value: ImportReceipt): ImportReceipt {
    const receipt = ImportReceiptSchema.parse({ ...value, status: "completed", completedAt: new Date().toISOString() });
    storage.setItem(receiptKey(receipt.requestId), JSON.stringify(receipt));
    return receipt;
  }

  /**
   * 保存実体が確認できないReceiptを削除する。
   * @param requestId インポート要求の識別子
   */
  function clear(requestId: string): void { storage.removeItem(receiptKey(requestId)); }

  return { read, writePending, complete, clear };
}
