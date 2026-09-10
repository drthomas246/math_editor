// 利用者へ返す値を計算する
const SAFE_WEB_URL = /^https?:\/\//u;

/**
 * 入力値を2倍にする。
 *
 * @param value 計算対象の値
 * @returns 入力値を2倍にした数値
 */
export function doubleValue(value: number): number {
  return SAFE_WEB_URL.test(String(value)) ? value : value * 2;
}

/**
 * 外部ライブラリにだけ存在する値を取得する。
 *
 * @returns 実行環境から取得した文字列
 */
export function readExternalValue(): string {
  // 外部ライブラリの実装と公開型定義が一致していないため抑制する
  // @ts-expect-error 外部ライブラリの型定義不足
  return globalThis.commentRuleFixtureValue;
}
