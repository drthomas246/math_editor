import fs from "node:fs";
import path from "node:path";
import { TARGET_POLICY } from "./comment-targets.mjs";
import {
  SCHEMA_VERSION, DEFAULT_REPORT, sha256, resolveCommit, snapshotWorktree, snapshotCommit,
  manifestDifferences, checkerVersion, parseOptions,
} from "./comment-evidence.mjs";

/**
 * 保存済み証跡を現在の作業ファイル、または明示した信頼済みコミットと照合する。
 * 同一性の合格とコメント規則への適合結果は独立して表示する。
 */
function main() {
  const root = process.cwd();
  const options = parseOptions(process.argv.slice(2), ["--report", "--commit"]);
  const reportPath = path.resolve(root, options["--report"] ?? DEFAULT_REPORT);
  const bytes = fs.readFileSync(reportPath);
  const digest = fs.readFileSync(`${reportPath}.sha256`, "utf8").trim();
  if (!/^[a-f0-9]{64}$/u.test(digest) || sha256(bytes) !== digest) throw new Error("証跡JSONのSHA-256が一致しません");
  const report = JSON.parse(bytes.toString("utf8"));
  if (report.schemaVersion !== SCHEMA_VERSION || report.hashAlgorithm !== "SHA-256") throw new Error("未対応の証跡形式です");
  if (JSON.stringify(report.targetPolicy) !== JSON.stringify(TARGET_POLICY)) throw new Error("検査対象ポリシーが異なります");
  if (!Array.isArray(report.captureErrors) || report.captureErrors.length) throw new Error("証跡生成時にエラーが記録されています");
  const commit = resolveCommit(root, options["--commit"] ?? "HEAD");
  if (report.commitSha !== commit) throw new Error(`コミットSHA不一致: expected=${commit} report=${report.commitSha}`);
  const expected = options["--commit"] ? snapshotCommit(root, commit) : snapshotWorktree(root);
  const differences = manifestDifferences(expected, report);
  if (report.checkerVersion !== checkerVersion(report.inputs)) differences.push("検査器の版が入力ハッシュと一致しません");
  const rules = report.checks?.rules;
  if (!rules?.report || !["passed", "failed"].includes(rules.status)) throw new Error("コメント検査が完了していません");
  differences.push(...manifestDifferences(expected, { files: rules.report.files, inputs: report.inputs }));
  if (rules.report.summary?.files !== expected.files.length) differences.push("検査件数が一致しません");
  const issueCounts = {};
  for (const file of rules.report.files) {
    if (!Array.isArray(file.issues)) throw new Error("違反一覧が不正です");
    for (const issue of file.issues) issueCounts[issue.kind] = (issueCounts[issue.kind] ?? 0) + 1;
  }
  const summaryIssues = rules.report.summary.issues;
  if (!summaryIssues || Object.keys(summaryIssues).length !== Object.keys(issueCounts).length
    || Object.entries(issueCounts).some(function differentCount(entry) { return summaryIssues[entry[0]] !== entry[1]; })) {
    differences.push("違反件数の集計が一致しません");
  }
  const failed = Object.keys(issueCounts).length > 0;
  if (rules.status !== (failed ? "failed" : "passed") || rules.exitCode !== (failed ? 1 : 0)) differences.push("コメント検査の終了状態が矛盾しています");
  const scope = report.checks?.scope;
  if (report.scopeBase) {
    if (!scope?.report || !["passed", "failed"].includes(scope.status)
      || scope.report.mode !== "git" || scope.report.source !== report.scopeBase || scope.report.target !== commit) {
      differences.push("変更範囲検査の比較コミットまたは結果が不正です");
    } else {
      const scopeFailed = scope.report.results.filter(function isFailed(result) { return result.status === "failed"; }).length;
      if (scope.report.summary.files !== scope.report.results.length || scope.report.summary.failed !== scopeFailed
        || scope.report.summary.allowed !== scope.report.results.length - scopeFailed
        || scope.status !== (scopeFailed ? "failed" : "passed") || scope.exitCode !== (scopeFailed ? 1 : 0)) {
        differences.push("変更範囲検査の終了状態が矛盾しています");
      }
    }
  } else if (scope?.status !== "skipped" || typeof scope.reason !== "string" || !scope.reason) {
    differences.push("変更範囲検査の未実行理由がありません");
  }
  if (differences.length) throw new Error(differences.join("\n"));
  process.stdout.write(`${JSON.stringify({
    identity: "verified",
    mode: options["--commit"] ? "git-commit" : "worktree",
    commitSha: commit,
    files: expected.files.length,
    checkerInputs: expected.inputs.length,
    rules: rules.status,
    scope: scope.status,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
