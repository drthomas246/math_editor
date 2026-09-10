import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { TARGET_POLICY } from "./comment-targets.mjs";
import {
  SCHEMA_VERSION, DEFAULT_REPORT, REQUIRED_INPUTS, git, resolveCommit, snapshotWorktree, snapshotCommit,
  manifestDifferences, checkerVersion, writeEvidence, parseOptions,
} from "./comment-evidence.mjs";

const ROOT = process.cwd();
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

/**
 * チェッカーの正常終了・違反・実行エラーを区別し、失敗時も出力を保持する。
 * @param script 実行する検査スクリプト
 * @param args CLI引数
 * @returns 終了状態と完全な検査レポート
 */
function runChecker(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(SCRIPT_DIRECTORY, script), "--json", ...args], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  let report = null;
  let error = result.error?.message ?? (result.signal ? `signal: ${result.signal}` : null);
  try {
    report = JSON.parse(result.stdout);
  } catch {
    error ??= "チェッカーがJSONレポートを生成しませんでした";
  }
  return {
    status: error || ![0, 1].includes(result.status) ? "error" : result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    report,
    error,
    stderr: result.stderr ?? "",
  };
}

/**
 * 実際のcheckoutとGitHubイベントのSHAを区別して記録する。
 * @param base 明示指定した変更範囲検査の比較元
 * @returns 実行コンテキストと変更範囲検査の比較元
 */
function executionContext(base) {
  const gitRoot = git(ROOT, ["rev-parse", "--show-toplevel"]).toString("utf8").trim();
  if (fs.realpathSync(gitRoot) !== fs.realpathSync(ROOT)) throw new Error("リポジトリルートで実行してください");
  const event = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : {};
  const pr = event.pull_request;
  const commentOnly = process.env.GITHUB_EVENT_NAME === "pull_request"
    && pr?.labels?.some(function isCommentOnly(label) { return label.name === "comment-only"; });
  const scopeBase = base || process.env.COMMENT_SCOPE_BASE || (commentOnly ? pr.base.sha : null);
  const commitSha = resolveCommit(ROOT, "HEAD");
  const resolvedBase = scopeBase ? resolveCommit(ROOT, scopeBase) : null;
  return {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    commitSha,
    ref: process.env.GITHUB_REF ?? git(ROOT, ["rev-parse", "--symbolic-full-name", "HEAD"]).toString("utf8").trim(),
    baseSha: resolvedBase ?? pr?.base?.sha ?? event.before ?? null,
    headSha: pr?.head?.sha ?? commitSha,
    scopeBase: resolvedBase,
    ci: {
      eventName: process.env.GITHUB_EVENT_NAME ?? null,
      githubSha: process.env.GITHUB_SHA ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      workflow: process.env.GITHUB_WORKFLOW ?? null,
      job: process.env.GITHUB_JOB ?? null,
      runUrl: process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY
        ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
    },
  };
}

/**
 * 検査前後の同一性を確認し、検査失敗を含む証跡を毎回上書き保存する。
 */
function main() {
  const options = parseOptions(process.argv.slice(2), ["--report", "--base"]);
  const reportPath = path.resolve(ROOT, options["--report"] ?? DEFAULT_REPORT);
  const relativeReport = path.relative(ROOT, reportPath).replaceAll("\\", "/");
  if (relativeReport.startsWith(".git/") || relativeReport.startsWith("scripts/") || REQUIRED_INPUTS.includes(relativeReport) || !reportPath.endsWith(".json")) {
    throw new Error("証跡は.gitとscripts以外のJSONファイルへ保存してください");
  }
  const evidence = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    hashAlgorithm: "SHA-256",
    targetPolicy: TARGET_POLICY,
    runtime: { node: process.version, typescript: ts.version, platform: process.platform, arch: process.arch },
    checks: { rules: { status: "error", report: null }, scope: { status: "skipped", reason: "比較元未指定・comment-only PR以外" } },
    captureErrors: [],
  };
  try {
    Object.assign(evidence, executionContext(options["--base"]));
    Object.assign(evidence, snapshotWorktree(ROOT));
    evidence.checkerVersion = checkerVersion(evidence.inputs);
    evidence.checks.rules = runChecker("check-comment-rules.mjs");
    if (evidence.scopeBase) {
      evidence.checks.scope = runChecker("check-comment-change-scope.mjs", ["--base", evidence.scopeBase, "--head", evidence.commitSha]);
    }
    evidence.captureErrors.push(...manifestDifferences(snapshotWorktree(ROOT), evidence));
    if (resolveCommit(ROOT, "HEAD") !== evidence.commitSha) evidence.captureErrors.push("検査中にHEADが変更されました");
    const ruleReport = evidence.checks.rules.report;
    if (ruleReport) {
      evidence.captureErrors.push(...manifestDifferences(evidence, { files: ruleReport.files, inputs: evidence.inputs }));
      if (ruleReport.summary.files !== evidence.files.length) evidence.captureErrors.push("検査件数が対象ファイル数と一致しません");
    }
    try {
      evidence.commitDifferences = manifestDifferences(snapshotCommit(ROOT, evidence.commitSha), evidence);
      evidence.commitMatches = evidence.commitDifferences.length === 0;
    } catch (error) {
      evidence.commitMatches = false;
      evidence.commitDifferences = [error.message];
    }
  } catch (error) {
    evidence.captureErrors.push(error.message);
  }
  writeEvidence(reportPath, evidence);
  process.stdout.write(`${JSON.stringify({
    report: relativeReport,
    commitSha: evidence.commitSha,
    checkerVersion: evidence.checkerVersion,
    files: evidence.files?.length ?? 0,
    rules: evidence.checks.rules.status,
    scope: evidence.checks.scope.status,
    commitMatches: evidence.commitMatches,
    captureErrors: evidence.captureErrors,
  }, null, 2)}\n`);
  const checks = Object.values(evidence.checks);
  if (evidence.captureErrors.length || checks.some(function isError(check) { return check.status === "error"; })) process.exitCode = 2;
  else if (checks.some(function isFailed(check) { return check.status === "failed"; })) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
