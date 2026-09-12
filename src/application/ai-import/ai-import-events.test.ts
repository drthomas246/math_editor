import { afterEach, expect, it, vi } from "vitest";
import { publishAiImportCompleted, subscribeAiImportCompleted } from "./ai-import-events";

const unsubscribers: Array<() => void> = [];

/** テストで残ったイベント購読とモックを解除する。 */
function cleanup(): void {
  for (const unsubscribe of unsubscribers) unsubscribe();
  unsubscribers.length = 0;
  vi.restoreAllMocks();
}
afterEach(cleanup);

it("本文を含まない完了イベントだけを購読者へ配信して解除できる", /**
 * イベント配信、購読解除、購読者例外の隔離を確認する。
 */
function publishesAndUnsubscribes() {
  const received: unknown[] = [];
  /** 最初の購読者の失敗を再現する。 */
  function failingListener(): never { throw new Error("UI failure"); }
  /**
   * 二番目の購読者が受け取った完了イベントを記録する。
   * @param event 配信された完了イベント
   */
  function recordingListener(event: unknown): void { received.push(event); }
  unsubscribers.push(subscribeAiImportCompleted(failingListener));
  const unsubscribe = subscribeAiImportCompleted(recordingListener);
  const event = { type: "ai-import-completed" as const, worksheetId: "worksheet-1", title: "正負の数", requestId: "request-1" };
  /** 完了イベントを発行し、購読者例外が外へ漏れないことを確認する。 */
  function publishEvent(): void { publishAiImportCompleted(event); }
  expect(publishEvent).not.toThrow();
  expect(received).toEqual([event]);
  unsubscribe();
  publishAiImportCompleted(event);
  expect(received).toHaveLength(1);
});
