import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_REPORT, REQUIRED_INPUTS, sha256, writeEvidence } from "./comment-evidence.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "export const answer = 1;\n";
const ENV = Object.fromEntries(Object.entries(process.env).filter(function localEnvironment(entry) {
  return !/^(?:GITHUB_|COMMENT_SCOPE_|GIT_)/u.test(entry[0]);
}));
let root;
let baseline;
let commit;

/**
 * 一時リポジトリでコマンドを実行する。
 * @param command 実行ファイル
 * @param args コマンド引数
 * @param env テスト固有の環境変数
 * @returns 終了コードと標準出力
 */
function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: root, env: { ...ENV, ...env }, encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

/**
 * CLIを実行する。
 * @param script scripts内のファイル名
 * @param args CLI引数
 * @param env テスト固有の環境変数
 * @returns 終了コードと標準出力
 */
function cli(script, args = [], env = {}) {
  return run(process.execPath, [path.join(root, "scripts", script), ...args], env);
}

/**
 * 証跡を読み込む。
 * @returns 保存済み証跡
 */
function readReport() {
  return JSON.parse(fs.readFileSync(path.join(root, DEFAULT_REPORT), "utf8"));
}

/**
 * 一時リポジトリだけを安全に再帰削除する。
 */
function removeTemporaryRepository() {
  if (!root) return;
  const absolute = path.resolve(root);
  if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith("comment-evidence-test-")) {
    throw new Error("一時ディレクトリ外の削除を拒否しました");
  }
  const modules = path.join(absolute, "node_modules");
  if (fs.existsSync(modules)) fs.unlinkSync(modules);
  fs.rmSync(absolute, { recursive: true, force: true });
}

beforeAll(function createRepository() {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "comment-evidence-test-"));
  for (const file of REQUIRED_INPUTS) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(PROJECT_ROOT, file), path.join(root, file));
  }
  fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/\nreports/\n");
  fs.writeFileSync(path.join(root, "source.ts"), SOURCE);
  fs.writeFileSync(path.join(root, "日本語 空白.ts"), SOURCE);
  fs.symlinkSync(path.join(PROJECT_ROOT, "node_modules"), path.join(root, "node_modules"), "junction");
  const commands = [
    ["init", "-q"], ["config", "core.autocrlf", "false"],
    ["config", "user.name", "Evidence Test"], ["config", "user.email", "evidence@example.invalid"],
    ["add", "."], ["-c", "commit.gpgSign=false", "commit", "-qm", "fixture"],
  ];
  for (const args of commands) {
    const result = run("git", args);
    expect(result.status, result.stderr).toBe(0);
  }
  commit = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  const result = cli("create-comment-evidence.mjs");
  expect(result.status, result.stdout + result.stderr).toBe(0);
  baseline = readReport();
}, 60000);

afterEach(function restoreFixture() {
  fs.writeFileSync(path.join(root, "source.ts"), SOURCE);
  fs.rmSync(path.join(root, "added.ts"), { force: true });
  fs.copyFileSync(path.join(PROJECT_ROOT, "scripts/check-comment-rules.mjs"), path.join(root, "scripts/check-comment-rules.mjs"));
  if (commit && run("git", ["rev-parse", "HEAD"]).stdout.trim() !== commit) {
    expect(run("git", ["update-ref", "HEAD", commit]).status).toBe(0);
    expect(run("git", ["read-tree", commit]).status).toBe(0);
  }
  if (baseline) writeEvidence(path.join(root, DEFAULT_REPORT), baseline);
});

afterAll(removeTemporaryRepository);

describe("コメント検査証跡", function describeEvidence() {
  it("全対象の生バイト列、検査入力、版、コミットを記録する", function recordsIdentity() {
    expect(baseline.schemaVersion).toBe(1);
    expect(baseline.commitSha).toBe(commit);
    expect(baseline.commitMatches).toBe(true);
    expect(baseline.checkerVersion).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(baseline.files).toHaveLength(3);
    expect(baseline.files).toContainEqual({ file: "source.ts", sha256: sha256(Buffer.from(SOURCE)) });
    expect(baseline.files).toContainEqual({ file: "日本語 空白.ts", sha256: sha256(Buffer.from(SOURCE)) });
    expect(baseline.inputs.map(function fileName(entry) { return entry.file; })).toEqual(expect.arrayContaining(REQUIRED_INPUTS));
    expect(baseline.checks.rules.status).toBe("passed");
    expect(baseline.checks.scope.status).toBe("skipped");
    expect(baseline.runtime.typescript).toBeTruthy();
  });

  it("作業ファイルと明示コミットの両方へ再照合できる", function verifiesBothModes() {
    for (const args of [[], ["--commit", commit]]) {
      const result = cli("verify-comment-evidence.mjs", args);
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).identity).toBe("verified");
    }
  });

  it.each(["change", "add", "delete", "crlf"])("対象の%sを拒否する", function detectsSourceChange(kind) {
    if (kind === "change") fs.writeFileSync(path.join(root, "source.ts"), "export const answer = 2;\n");
    if (kind === "add") fs.writeFileSync(path.join(root, "added.ts"), SOURCE);
    if (kind === "delete") fs.unlinkSync(path.join(root, "source.ts"));
    if (kind === "crlf") fs.writeFileSync(path.join(root, "source.ts"), SOURCE.replaceAll("\n", "\r\n"));
    expect(cli("verify-comment-evidence.mjs").status).toBe(1);
    expect(cli("verify-comment-evidence.mjs", ["--commit", commit]).status).toBe(0);
  });

  it("検査器の変更も検出する", function detectsCheckerChange() {
    fs.appendFileSync(path.join(root, "scripts/check-comment-rules.mjs"), "\n// 検査器の変更\n");
    const result = cli("verify-comment-evidence.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("scripts/check-comment-rules.mjs");
  });

  it("JSON破損とダイジェスト欠落を拒否する", function rejectsCorruption() {
    fs.appendFileSync(path.join(root, DEFAULT_REPORT), " ");
    expect(cli("verify-comment-evidence.mjs").stderr).toContain("証跡JSONのSHA-256");
    fs.unlinkSync(path.join(root, `${DEFAULT_REPORT}.sha256`));
    expect(cli("verify-comment-evidence.mjs").status).toBe(1);
  });

  it.each(["missing", "duplicate", "hash", "path", "version", "commit", "checker", "status", "count"])(
    "ダイジェストを再計算しても不正な%s記録を拒否する", function rejectsInvalidManifest(kind) {
      const report = structuredClone(baseline);
      if (kind === "missing") {
        report.files.pop();
        report.checks.rules.report.files.pop();
        report.checks.rules.report.summary.files -= 1;
      }
      if (kind === "duplicate") report.files.push(report.files[0]);
      if (kind === "hash") report.files[0].sha256 = "a".repeat(64);
      if (kind === "path") report.files[0].file = "../../outside.ts";
      if (kind === "version") report.schemaVersion = 999;
      if (kind === "commit") report.commitSha = "b".repeat(40);
      if (kind === "checker") report.checkerVersion = `sha256:${"a".repeat(64)}`;
      if (kind === "status") report.checks.rules.status = "failed";
      if (kind === "count") report.checks.rules.report.summary.issues = { "missing-jsdoc": 1 };
      writeEvidence(path.join(root, DEFAULT_REPORT), report);
      expect(cli("verify-comment-evidence.mjs", ["--commit", commit]).status).toBe(1);
    },
  );

  it("未コミットの実体をコミット一致と報告しない", function recordsDirtyWorktree() {
    fs.writeFileSync(path.join(root, "source.ts"), "export const answer = 2;\n");
    expect(cli("create-comment-evidence.mjs").status).toBe(0);
    expect(readReport().commitMatches).toBe(false);
    expect(cli("verify-comment-evidence.mjs").status).toBe(0);
    expect(cli("verify-comment-evidence.mjs", ["--commit", commit]).status).toBe(1);
  }, 30000);

  it("違反時も完全な証跡を保存し終了コード1を保つ", function preservesRuleFailure() {
    fs.writeFileSync(path.join(root, "source.ts"), "export function answer() { return 1; }\n");
    expect(cli("create-comment-evidence.mjs").status).toBe(1);
    const report = readReport();
    expect(report.checks.rules.status).toBe("failed");
    expect(report.checks.rules.report.summary.issues["missing-jsdoc"]).toBe(1);
    const verified = cli("verify-comment-evidence.mjs");
    expect(verified.status, verified.stderr).toBe(0);
    expect(JSON.parse(verified.stdout).rules).toBe("failed");
  }, 30000);

  it("実行エラーを成功にせず古い証跡を置換する", function preservesCheckerError() {
    fs.writeFileSync(path.join(root, "scripts/check-comment-rules.mjs"), "throw new Error('checker failed');\n");
    expect(cli("create-comment-evidence.mjs").status).toBe(2);
    expect(readReport().checks.rules.status).toBe("error");
    expect(readReport().checks.rules.stderr).toContain("checker failed");
    expect(cli("verify-comment-evidence.mjs").status).toBe(1);
  }, 30000);

  it("PRのbase/headと実際の検査コミットを区別し変更範囲レポートも保存する", function recordsPullRequest() {
    const eventPath = path.join(root, "reports", "event.json");
    fs.writeFileSync(eventPath, JSON.stringify({ pull_request: {
      base: { sha: commit }, head: { sha: "b".repeat(40) }, labels: [{ name: "comment-only" }],
    } }));
    const result = cli("create-comment-evidence.mjs", [], {
      GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "example/repo",
      GITHUB_SHA: commit, GITHUB_REF: "refs/pull/42/merge", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2",
    });
    expect(result.status, result.stderr).toBe(0);
    const report = readReport();
    expect(report.repository).toBe("example/repo");
    expect(report.commitSha).toBe(commit);
    expect(report.baseSha).toBe(commit);
    expect(report.headSha).toBe("b".repeat(40));
    expect(report.ref).toBe("refs/pull/42/merge");
    expect(report.ci.runAttempt).toBe("2");
    expect(report.checks.scope.status).toBe("passed");
    expect(report.checks.scope.report.target).toBe(commit);
    expect(cli("verify-comment-evidence.mjs", ["--commit", commit]).status).toBe(0);
  }, 30000);

  it("範囲検査違反でも両方の検査結果を保存する", function preservesScopeFailure() {
    fs.writeFileSync(path.join(root, "source.ts"), "export const answer = 2;\n");
    expect(run("git", ["add", "source.ts"]).status).toBe(0);
    expect(run("git", ["-c", "commit.gpgSign=false", "commit", "-qm", "logic change"]).status).toBe(0);
    const result = cli("create-comment-evidence.mjs", ["--base", commit]);
    expect(result.status, result.stderr).toBe(1);
    const report = readReport();
    expect(report.checks.rules.status).toBe("passed");
    expect(report.checks.scope.status).toBe("failed");
    expect(report.checks.scope.report.summary.failed).toBe(1);
    expect(cli("verify-comment-evidence.mjs", ["--commit", report.commitSha]).status).toBe(0);
  }, 30000);
});
