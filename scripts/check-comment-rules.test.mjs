import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CHECKER_PATH = path.join(SCRIPT_DIRECTORY, "check-comment-rules.mjs");
const FIXTURE_ROOT = path.join(SCRIPT_DIRECTORY, "fixtures", "comment-rules");

/**
 * 指定fixtureを検査し、CLI終了状態とJSONレポートを返す。
 *
 * @param fixturePath fixtureルートからの相対パス
 * @param extraArguments チェッカーへ追加で渡す引数
 * @returns CLIの終了状態と解析済みレポート
 */
function runChecker(fixturePath, extraArguments = []) {
  const result = spawnSync(process.execPath, [CHECKER_PATH, "--json", ...extraArguments], {
    cwd: path.join(FIXTURE_ROOT, fixturePath),
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stderr: result.stderr,
    report: JSON.parse(result.stdout),
  };
}

describe("check-comment-rules", function describeCommentRuleChecker() {
  it("日本語コメントと完全なJSDocを受理し、安定したSHA-256を報告する", function acceptsValidFixture() {
    const first = runChecker("valid/complete");
    const second = runChecker("valid/complete");
    const checkedFile = first.report.files[0];
    const fixtureContents = fs.readFileSync(path.join(FIXTURE_ROOT, "valid", "complete", "source.ts"));

    expect(first.status).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.report.summary.issues).toEqual({});
    expect(checkedFile.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(checkedFile.sha256).toBe(crypto.createHash("sha256").update(fixtureContents).digest("hex"));
    expect(second.report.files[0].sha256).toBe(checkedFile.sha256);
  });

  it("JSONレポートを指定したファイルへ保存する", function writesJsonReport() {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "comment-rules-report-"));
    const reportPath = path.join(temporaryDirectory, "report.json");
    try {
      const checked = runChecker("valid/complete", ["--report", reportPath]);
      const savedReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      expect(checked.status).toBe(0);
      expect(savedReport.summary).toEqual(checked.report.summary);
      expect(savedReport.files).toEqual(checked.report.files);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  const invalidCases = [
    ["英語の通常コメント", "non-japanese-comment", "non-japanese-comment"],
    ["空のJSDoc本文", "empty-jsdoc-description", "empty-jsdoc-description"],
    ["英語のJSDoc本文", "non-japanese-jsdoc-description", "non-japanese-jsdoc-description"],
    ["説明が空の@param", "empty-param-description", "empty-param-description"],
    ["英語の@param説明", "non-japanese-param-description", "non-japanese-param-description"],
    ["説明が空の@returns", "empty-returns-description", "empty-returns-description"],
    ["英語の@returns説明", "non-japanese-returns-description", "non-japanese-returns-description"],
    ["JSDocへ重複したTypeScript型", "jsdoc-type-duplication", "jsdoc-type-duplication"],
    ["日本語理由がない@ts-expect-error", "ts-expect-error", "ts-expect-error-missing-japanese-reason"],
    ["コメントアウトされたコード", "commented-out-code", "commented-out-code"],
    ["JSDocがない関数", "missing-jsdoc", "missing-jsdoc"],
    ["匿名関数", "anonymous-function", "anonymous-function"],
    ["不足した@param", "missing-param", "missing-param"],
    ["余分な@param", "extra-param", "extra-param"],
    ["実引数と異なる@param名", "param-name-mismatch", "param-name-mismatch"],
    ["不足した@returns", "missing-returns", "missing-returns"],
    ["英語のセクション名", "english-section", "english-section"],
    ["TypeScript構文エラー", "syntax", "syntax"],
  ];

  it.each(invalidCases)("%sを検出する", function detectsInvalidFixture(_label, fixturePath, issueKind) {
    const checked = runChecker(`invalid/${fixturePath}`);
    const issueKinds = checked.report.files.flatMap(function collectIssueKinds(file) {
      return file.issues.map(function issueKindOf(issue) {
        return issue.kind;
      });
    });

    expect(checked.status).toBe(1);
    expect(issueKinds).toContain(issueKind);
  });
});
