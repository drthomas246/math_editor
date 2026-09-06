import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { comparePaths, isCommentTarget, listProjectFiles } from "./comment-targets.mjs";

export const SCHEMA_VERSION = 1;
export const DEFAULT_REPORT = "reports/comment-evidence/report.json";
export const REQUIRED_INPUTS = [
  "scripts/check-comment-rules.mjs",
  "scripts/check-comment-change-scope.mjs",
  "scripts/comment-targets.mjs",
  "scripts/comment-evidence.mjs",
  "scripts/create-comment-evidence.mjs",
  "scripts/verify-comment-evidence.mjs",
  "package.json",
  "package-lock.json",
  "コメントルール.md",
  ".github/workflows/verify.yml",
  "vite.config.ts",
];

/**
 * 改行変換を行わず生バイト列のSHA-256を取得する。
 * @param bytes ハッシュ対象
 * @returns 64桁の16進ダイジェスト
 */
export function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * シェルを経由せずGitを実行する。
 * @param root リポジトリルート
 * @param args Git引数
 * @param input 標準入力へ渡すバイト列
 * @returns 標準出力の生バイト列
 */
export function git(root, args, input) {
  const result = spawnSync("git", args, { cwd: root, input, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.toString("utf8").trim());
  return result.stdout;
}

/**
 * refを不変のコミットIDへ解決する。
 * @param root リポジトリルート
 * @param ref 解決するref
 * @returns 完全長コミットSHA
 */
export function resolveCommit(root, ref) {
  return git(root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).toString("utf8").trim();
}

/**
 * 検査手順・依存関係・テスト・fixtureを検査器の版へ含める。
 * @param file リポジトリ内の相対パス
 * @returns 検査環境の記録対象ならtrue
 */
function isEvidenceInput(file) {
  return REQUIRED_INPUTS.includes(file) || file.startsWith("scripts/") || file === ".gitattributes";
}

/**
 * マニフェストが対象と検査入力を漏れなく列挙できることを確認する。
 * @param paths リポジトリ内の全ファイル
 * @returns 対象ソースと検査入力のパス一覧
 */
function selectPaths(paths) {
  for (const file of REQUIRED_INPUTS) {
    if (!paths.includes(file)) throw new Error(`検査入力がありません: ${file}`);
  }
  const files = paths.filter(isCommentTarget).sort(comparePaths);
  if (files.length === 0) throw new Error("コメント検査対象が0ファイルです");
  return { files, inputs: paths.filter(isEvidenceInput).sort(comparePaths) };
}

/**
 * 作業ファイルを再読込し、対象と検査器の全ハッシュを記録する。
 * @param root リポジトリルート
 * @returns ソースと検査入力のマニフェスト
 */
export function snapshotWorktree(root) {
  const selected = selectPaths(listProjectFiles(root));
  /**
   * 通常ファイルの実体をハッシュする。
   * @param file 相対パス
   * @returns ファイル名とSHA-256
   */
  function entry(file) {
    const absolute = path.join(root, file);
    if (!fs.lstatSync(absolute).isFile()) throw new Error(`通常ファイルではありません: ${file}`);
    return { file, sha256: sha256(fs.readFileSync(absolute)) };
  }
  return { files: selected.files.map(entry), inputs: selected.inputs.map(entry) };
}

/**
 * コミットのツリーとblobを一括で読み、改行変換の影響を受けないマニフェストを作る。
 * @param root リポジトリルート
 * @param commit 完全長コミットSHA
 * @returns ソースと検査入力のマニフェスト
 */
export function snapshotCommit(root, commit) {
  const tree = new Map();
  for (const record of git(root, ["ls-tree", "-rz", "--full-tree", commit]).toString("utf8").split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    tree.set(record.slice(tab + 1), { mode, type, oid });
  }
  const selected = selectPaths([...tree.keys()]);
  const paths = [...new Set([...selected.files, ...selected.inputs])];
  const oids = paths.map(function objectId(file) {
    const entry = tree.get(file);
    if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) {
      throw new Error(`コミット内の通常ファイルではありません: ${file}`);
    }
    return entry.oid;
  });
  const output = git(root, ["cat-file", "--batch"], `${oids.join("\n")}\n`);
  const hashes = new Map();
  let offset = 0;
  for (const file of paths) {
    const end = output.indexOf(10, offset);
    const [oid, type, sizeText] = output.subarray(offset, end).toString("utf8").split(" ");
    const size = Number(sizeText);
    if (end < 0 || oid !== tree.get(file).oid || type !== "blob" || !Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Git blobを読み取れません: ${file}`);
    }
    offset = end + 1;
    if (offset + size >= output.length) throw new Error(`Git blobが途中で切れています: ${file}`);
    hashes.set(file, sha256(output.subarray(offset, offset + size)));
    offset += size + 1;
  }
  /**
   * blobのハッシュをマニフェスト形式へ変換する。
   * @param file 相対パス
   * @returns ファイル名とSHA-256
   */
  function entry(file) {
    return { file, sha256: hashes.get(file) };
  }
  return { files: selected.files.map(entry), inputs: selected.inputs.map(entry) };
}

/**
 * パス集合とバイト列の差を説明する。報告パスをディスク読込には使用しない。
 * @param expected 信頼する作業ツリーまたはコミットのマニフェスト
 * @param actual 証跡に記録されたマニフェスト
 * @returns 追加・欠落・重複・ハッシュ不一致の一覧
 */
export function manifestDifferences(expected, actual) {
  const issues = [];
  for (const kind of ["files", "inputs"]) {
    if (!Array.isArray(actual?.[kind])) throw new Error(`証跡の${kind}が不正です`);
    const entries = new Map();
    for (const entry of actual[kind]) {
      if (typeof entry?.file !== "string" || !/^[a-f0-9]{64}$/u.test(entry.sha256)) {
        throw new Error(`証跡の${kind}に不正なハッシュ記録があります`);
      }
      if (entries.has(entry.file)) issues.push(`${kind}: 重複 ${entry.file}`);
      entries.set(entry.file, entry.sha256);
    }
    for (const entry of expected[kind]) {
      if (!entries.has(entry.file)) issues.push(`${kind}: 記録なし ${entry.file}`);
      else if (entries.get(entry.file) !== entry.sha256) issues.push(`${kind}: SHA-256不一致 ${entry.file}`);
      entries.delete(entry.file);
    }
    for (const file of entries.keys()) issues.push(`${kind}: 対象に存在しないファイル ${file}`);
  }
  return issues;
}

/**
 * 検査器の版を全入力ファイルのダイジェストから識別する。
 * @param inputs 順序を固定した検査入力マニフェスト
 * @returns SHA-256に基づく検査器識別子
 */
export function checkerVersion(inputs) {
  return `sha256:${sha256(JSON.stringify(inputs))}`;
}

/**
 * JSON保存後に再読込したバイト列から照合用ダイジェストを保存する。
 * @param reportPath 保存先
 * @param report 証跡全体
 */
export function writeEvidence(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(`${reportPath}.sha256`, `${sha256(fs.readFileSync(reportPath))}\n`, "utf8");
}

/**
 * CLIで許可する値付きオプションのみを読み取る。
 * @param args CLI引数
 * @param allowed 許可するオプション名
 * @returns 指定値の辞書
 */
export function parseOptions(args, allowed) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const [name, ...inline] = args[index].split("=");
    if (!allowed.includes(name) || Object.hasOwn(options, name)) throw new Error(`不正なオプション: ${name}`);
    const value = inline.length ? inline.join("=") : args[++index];
    if (!value || value.startsWith("--")) throw new Error(`${name}には値を指定してください`);
    options[name] = value;
  }
  return options;
}
