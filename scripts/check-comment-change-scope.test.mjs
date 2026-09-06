import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CHECKER_PATH = path.join(SCRIPT_DIRECTORY, "check-comment-change-scope.mjs");
const FIXTURE_ROOT = path.join(SCRIPT_DIRECTORY, "fixtures", "comment-change-scope");

/**
 * 変更範囲fixtureをCLIで比較する。
 *
 * @param category validまたはinvalid
 * @param fixtureName fixture名
 * @returns CLI終了状態とJSONレポート
 */
function runScopeChecker(category, fixtureName) {
  const fixtureRoot = path.join(FIXTURE_ROOT, category, fixtureName);
  const result = spawnSync(process.execPath, [
    CHECKER_PATH,
    "--before", path.join(fixtureRoot, "before"),
    "--after", path.join(fixtureRoot, "after"),
    "--json",
  ], { encoding: "utf8" });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stderr: result.stderr,
    report: JSON.parse(result.stdout),
  };
}

describe("check-comment-change-scope", function describeChangeScopeChecker() {
  const validCases = [
    ["コメントだけの追加", "comments-only"],
    ["匿名コールバックのインライン名前付き化", "named-callback"],
    ["コールバックの名前付き関数への切り出し", "extracted-callback"],
    ["Props分割代入の関数本体への移動", "props-destructuring"],
    ["数値区切りだけの書式変更", "numeric-format"],
    ["thisを退避した名前付きコールバック化", "captured-this"],
  ];

  it.each(validCases)("%sを許可する", function acceptsAllowedChange(_label, fixtureName) {
    const checked = runScopeChecker("valid", fixtureName);
    expect(checked.status).toBe(0);
    expect(checked.stderr).toBe("");
    expect(checked.report.summary.failed).toBe(0);
    expect(checked.report.summary.allowed).toBe(1);
  });

  const invalidCases = [
    ["Hook依存配列の変更", "hook-dependencies", "React Hookの依存配列"],
    ["return式の変更", "return-expression", "return式"],
    ["if条件の変更", "condition", "条件式"],
    ["関数引数順序の変更", "call-arguments", "関数呼出と引数"],
    ["公開関数の戻り値型変更", "return-type", "公開関数の戻り値型またはasync属性"],
    ["関数のasync属性変更", "async-function", "関数のasyncまたはgenerator属性"],
    ["thisを退避しない関数形式変更", "lexical-this", "return式"],
  ];

  it.each(invalidCases)("%sを拒否する", function rejectsLogicChange(_label, fixtureName, expectedRisk) {
    const checked = runScopeChecker("invalid", fixtureName);
    expect(checked.status).toBe(1);
    expect(checked.report.summary.failed).toBe(1);
    expect(checked.report.results[0].issue).toBe("logic-change");
    expect(checked.report.results[0].risks).toContain(expectedRisk);
  });
});
