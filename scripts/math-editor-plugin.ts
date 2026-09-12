import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SKILL_NAME = "math-editor-textbook-import";
export const PLUGIN_NAME = "math-editor-ai";
const SKIPPED_NAMES = new Set(["node_modules", "__pycache__", "Thumbs.db", "desktop.ini"]);
const REQUIRED_SKILL_FILES = [
  "SKILL.md", "agents/openai.yaml", "references/runtime-fallback-rules.md",
  "references/figure-cropping-rules.md", "references/validation-rules.md",
  "references/webmcp-integration.md",
  "scripts/resolve_math_editor_target.mjs",
  "scripts/plan_webmcp_delivery.mjs",
  "scripts/check_runtime_capabilities.mjs", "scripts/crop_pdf_figure.py",
  "scripts/build_math_worksheet_file.mjs", "scripts/validate_math_worksheet.mjs",
  "schemas/math-worksheet.schema.json", "schemas/schema-manifest.json",
];

/**
 * ロケールに依存しないパス順に並べる。
 * @param left 比較する左のパス
 * @param right 比較する右のパス
 * @returns 左が先なら負、同一なら0、右が先なら正
 */
function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * 配布対象外の一時ファイルと隠しファイルを判定する。
 * @param name ファイルまたはディレクトリ名
 * @returns 配布から除外する場合はtrue
 */
function isTemporary(name: string): boolean {
  return name.startsWith(".") || SKIPPED_NAMES.has(name) || /(?:\.py[co]|\.tmp|\.log|\.bak|~)$/u.test(name);
}

/**
 * シンボリックリンクを拒否し、通常ファイルを決定論的に列挙する。
 * @param root 列挙するディレクトリ
 * @param filterTemporary 正本からのコピー時だけ一時ファイルを除外する指定
 * @returns ルートからの相対パス一覧
 */
export async function listPackageFiles(root: string, filterTemporary = false): Promise<string[]> {
  if (!(await lstat(root)).isDirectory()) throw new Error(`通常のディレクトリではありません: ${root}`);
  const files: string[] = [];
  /**
   * 配布ディレクトリ内をリンクを追跡せず走査する。
   * @param relative ルートからの相対ディレクトリ
   * @returns 走査が完了すると解決するPromise
   */
  async function visit(relative: string): Promise<void> {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`配布物にリンクを含められません: ${file}`);
      if (filterTemporary && isTemporary(entry.name)) continue;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
      else throw new Error(`通常ファイルではありません: ${file}`);
    }
  }
  await visit("");
  return files.sort(comparePaths);
}

/**
 * 改行を含むバイト列全体のハッシュを計算する。
 * @param contents 対象バイト列
 * @returns SHA-256の十六進文字列
 */
function hash(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

/**
 * 配布先の親と対象がリポジトリ外へのリンクでないことを確認する。
 * @param root プロジェクトルート
 * @returns 検証済みの配布先絶対パス
 */
async function resolveOutput(root: string): Promise<string> {
  const canonicalRoot = await realpath(root);
  const dist = path.join(canonicalRoot, "dist");
  try {
    const info = await lstat(dist);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(dist) !== dist) {
      throw new Error("distが通常のプロジェクト内ディレクトリではありません。");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const output = path.join(dist, PLUGIN_NAME);
  if (path.relative(canonicalRoot, output) !== path.join("dist", PLUGIN_NAME)) {
    throw new Error("Pluginの出力先がプロジェクト内ではありません。");
  }
  return output;
}

/**
 * 正本manifestとSkillの必要ファイル・埋め込み値を検査する。
 * @param root プロジェクトルート
 * @returns 配布する相対パスと正本の絶対パスの対応
 */
async function sourceFiles(root: string): Promise<Map<string, string>> {
  root = await realpath(root);
  const manifestPath = path.join(root, "AI/plugin/plugin.json");
  if (!(await lstat(manifestPath)).isFile() || await realpath(manifestPath) !== manifestPath) throw new Error("manifestはリンクを経由しない通常ファイルにしてください。");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const keys = Object.keys(manifest).sort(comparePaths).join(",");
  if (keys !== "$schema,description,name,version"
    || manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
    || manifest.name !== PLUGIN_NAME || !/^\d+\.\d+\.\d+$/u.test(manifest.version)
    || typeof manifest.description !== "string" || !manifest.description.trim()) {
    throw new Error("portable Plugin manifestが不正です。");
  }
  const skillRoot = path.join(root, "AI/skills", SKILL_NAME);
  if (await realpath(skillRoot) !== skillRoot) throw new Error("Skill正本へのリンクは許可しません。");
  const skillFiles = await listPackageFiles(skillRoot, true);
  for (const required of REQUIRED_SKILL_FILES) {
    if (!skillFiles.includes(required)) throw new Error(`Skillの必須ファイルがありません: ${required}`);
  }
  const files = new Map([["plugin.json", manifestPath]]);
  for (const relative of skillFiles) files.set(`skills/${SKILL_NAME}/${relative}`, path.join(skillRoot, relative));
  for (const [relative, file] of files) {
    const contents = await readFile(file, "utf8");
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/u.test(contents)) {
      throw new Error(`秘密情報と思われる値があります: ${relative}`);
    }
    if (/[A-Za-z]:[\\/]Users[\\/]|\/(?:Users|home)\/[^\s/]+\/|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/u.test(contents)) {
      throw new Error(`環境固有の絶対パスまたは接続URLがあります: ${relative}`);
    }
  }
  const entrypoint = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  if (!new RegExp(`^---\\r?\\nname: ${SKILL_NAME}\\r?\\ndescription: .+\\r?\\n---`, "u").test(entrypoint)) {
    throw new Error("Skill frontmatterが不正です。");
  }
  const rootManifest = JSON.parse(await readFile(path.join(root, "schemas/math-worksheet.schema-manifest.json"), "utf8"));
  const skillManifest = JSON.parse(await readFile(path.join(skillRoot, "schemas/schema-manifest.json"), "utf8"));
  for (const key of ["format", "schemaVersion", "source", "generatedSchema", "sha256", "generatedAt"]) {
    if (rootManifest[key] !== skillManifest[key]) throw new Error(`Schema manifestが不一致です: ${key}`);
  }
  for (const schemaPath of [path.join(root, "schemas/math-worksheet.schema.json"), path.join(skillRoot, "schemas/math-worksheet.schema.json")]) {
    const normalized = (await readFile(schemaPath, "utf8")).replace(/\r\n?/gu, "\n");
    if (hash(Buffer.from(normalized)).toUpperCase() !== rootManifest.sha256) throw new Error("Schemaのハッシュが不一致です。");
  }
  return files;
}

/**
 * 正本から配布物だけを安全に再生成する。
 * @param root プロジェクトルート
 * @returns 生成したファイル数と出力先
 */
export async function buildPlugin(root = PROJECT_ROOT): Promise<{ fileCount: number; output: string }> {
  const files = await sourceFiles(root);
  const output = await resolveOutput(root);
  try {
    await listPackageFiles(output);
    await rm(output, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const [relative, source] of files) {
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  return { fileCount: files.size, output };
}

/**
 * 配布物の不足・余剰・手編集をバイト単位で検出する。
 * @param root プロジェクトルート
 * @returns 検証済みのファイル数
 */
export async function verifyPlugin(root = PROJECT_ROOT): Promise<number> {
  const files = await sourceFiles(root);
  const output = await resolveOutput(root);
  const actual = await listPackageFiles(output);
  const expected = [...files.keys()].sort(comparePaths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("配布物と正本の相対パス集合が不一致です。");
  for (const [relative, source] of files) {
    if (hash(await readFile(source)) !== hash(await readFile(path.join(output, relative)))) {
      throw new Error(`配布物が正本と異なります: ${relative}`);
    }
  }
  return files.size;
}
