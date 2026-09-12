import type { AiImportCompletedEvent } from "./ai-import-types";

type AiImportCompletedListener = (event: AiImportCompletedEvent) => void;

const listeners = new Set<AiImportCompletedListener>();

/**
 * 保存完了を購読中の画面へ通知する。画面側の失敗は保存結果へ波及させない。
 * @param event 本文や画像を含まない保存結果
 */
export function publishAiImportCompleted(event: AiImportCompletedEvent): void {
  for (const listener of listeners) {
    try { listener(event); } catch {
      // UI通知の失敗をRepositoryへ保存済みの結果から隔離する。
    }
  }
}

/**
 * AI直接取込の保存完了を購読する。
 * @param listener 保存完了ごとに呼び出す画面側の処理
 * @returns 購読を解除する処理
 */
export function subscribeAiImportCompleted(listener: AiImportCompletedListener): () => void {
  listeners.add(listener);
  /** 保存完了イベントの購読を解除する。 */
  function unsubscribe(): void { listeners.delete(listener); }
  return unsubscribe;
}
