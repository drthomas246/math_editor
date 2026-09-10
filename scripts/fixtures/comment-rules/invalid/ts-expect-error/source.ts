/**
 * 型定義にない外部値を取得する。
 *
 * @returns 外部値を示す文字列
 */
export function readExternalValue(): string {
  // @ts-expect-error
  return globalThis.commentRuleFixtureValue;
}
