#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access, mkdtemp, open, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_MODULES = ["PIL", "pypdf", "fitz", "pypdfium2"];

/**
 * シェルを経由せず、検査コマンドを時間・出力上限付きで実行する。
 * @param executable 実行ファイル名または明示パス
 * @param args 検査用引数の配列
 * @returns 終了状態と標準出力
 */
export function runCommand(executable, args) {
  return spawnSync(executable, args, {
    encoding: "utf8", timeout: 5000, maxBuffer: 256 * 1024,
    windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * 指定入力の読取りと、指定出力ディレクトリへの書込みを実測する。
 * @param inputPath 読み取る元ファイルまたは既定のSkill本体
 * @param outputDir 実際の成果物を保存する既存ディレクトリ
 * @returns 読取り・書込みの成否
 */
export async function checkFilesystem(inputPath, outputDir) {
  let readable = false;
  let writable = false;
  try {
    await access(inputPath, constants.R_OK);
    const input = await open(inputPath, "r");
    try {
      if (!(await input.stat()).isFile()) throw new Error("入力は通常ファイルが必要です。");
      await input.read(Buffer.alloc(1), 0, 1, 0);
      readable = true;
    } finally { await input.close(); }
  } catch { readable = false; }
  let temp;
  try {
    temp = await mkdtemp(path.join(outputDir, ".sugaku-jitate-probe-"));
    const file = path.join(temp, "check");
    await writeFile(file, "sugaku-jitate-runtime", { flag: "wx" });
    writable = await readFile(file, "utf8") === "sugaku-jitate-runtime";
    await unlink(file);
  } catch { writable = false; }
  finally {
    if (temp) {
      // 自分が作った既知のファイルと空ディレクトリだけを削除する。
      try { await unlink(path.join(temp, "check")); } catch { /* 削除済みなら処理不要。 */ }
      try { await rmdir(temp); } catch { writable = false; }
    }
  }
  return { readable, writable };
}

/**
 * 検出した能力から実行可能な経路と停止条件を決定する。
 * @param capabilities 実環境またはテストで検出した能力
 * @param figuresRequired 採用問題に図版が必須かどうか
 * @returns 経路、Warning、Fatalと処理継続可否
 */
export function selectRuntime(capabilities, figuresRequired = false) {
  const errors = [];
  const warnings = [];
  const backends = [];
  const modules = capabilities.pythonModules;
  const python = capabilities.runtime.python.available;
  if (python && modules.PIL && modules.pypdf && capabilities.commands.pdftoppm) backends.push("poppler");
  if (python && modules.PIL && modules.fitz) backends.push("pymupdf");
  if (python && modules.PIL && modules.pypdfium2) backends.push("pypdfium2");
  if (python && modules.PIL && modules.pypdf && capabilities.commands.mutool) backends.push("mutool");
  if (!capabilities.ok || !capabilities.filesystem.readable || !capabilities.filesystem.writable) {
    errors.push("RUNTIME_CAPABILITY_CHECK_FAILED");
  }
  if (!capabilities.scripts.builder) errors.push("BUILDER_RUNTIME_UNAVAILABLE");
  if (!capabilities.scripts.validator) errors.push("VALIDATOR_RUNTIME_UNAVAILABLE");
  if (figuresRequired && backends[0] !== "poppler") warnings.push("FIGURE_PRIMARY_RUNTIME_UNAVAILABLE");
  if (figuresRequired && backends.length === 0) errors.push("FIGURE_RUNTIME_UNAVAILABLE");
  return {
    state: errors.length ? "blocked" : "ready",
    figureBackend: figuresRequired ? backends[0] ?? null : null,
    availableFigureBackends: backends,
    requiresHostFigureCheck: figuresRequired && backends.length === 0,
    errors, warnings,
  };
}

/**
 * 起動できたプロセスの成功を判定する。
 * @param result コマンド実行結果
 * @returns 正常終了の場合はtrue
 */
function succeeded(result) {
  return !result.error && !result.signal && result.status === 0;
}

/**
 * 能力検査を実行し、依存不足もJSONとして返す。
 * @param options 明示実行パス、入出力先、図版の必要性
 * @param dependencies 検出処理をテストで差し替えるための依存
 * @returns 実環境の検査結果と経路判断
 */
export async function probeRuntime(options = {}, dependencies = {}) {
  const run = dependencies.run ?? runCommand;
  const filesystem = dependencies.filesystem ?? checkFilesystem;
  const node = dependencies.node ?? { executable: process.execPath, version: process.versions.node };
  const result = {
    ok: true,
    runtime: { node: { available: false, version: node.version }, python: { available: false, version: null, executable: null, args: [] } },
    pythonModules: { PIL: false, pypdf: false, fitz: false, pypdfium2: false },
    commands: { pdftoppm: false, mutool: false },
    commandPaths: { pdftoppm: options.pdftoppm ?? process.env.PDFTOPPM_PATH ?? "pdftoppm", mutool: options.mutool ?? "mutool" },
    filesystem: { readable: false, writable: false },
    scripts: { builder: false, validator: false },
  };
  try {
    const nodeCheck = run(node.executable, ["--version"]);
    result.runtime.node.available = succeeded(nodeCheck) && Number(node.version.split(".")[0]) >= 24;
    const pythonCandidates = options.python ? [[options.python, []]] : [["python3", []], ["python", []], ["py", ["-3"]]];
    const pythonCode = "import sys, json; print(json.dumps({'version':sys.version.split()[0], 'supported':sys.version_info >= (3, 10), 'executable':sys.executable}))";
    for (const [executable, args] of pythonCandidates) {
      const checked = run(executable, [...args, "-c", pythonCode]);
      if (!succeeded(checked)) continue;
      const metadata = JSON.parse(checked.stdout);
      if (!metadata.supported || typeof metadata.executable !== "string") continue;
      result.runtime.python = { available: true, version: metadata.version, executable: metadata.executable, args: [] };
      break;
    }
    if (result.runtime.python.available) {
      for (const module of PYTHON_MODULES) {
        // import成功まで確かめ、壊れたネイティブ依存を利用可能と報告しない。
        const code = module === "fitz" ? "import fitz; assert callable(fitz.open) and hasattr(fitz, 'Matrix')"
          : module === "PIL" ? "from PIL import Image; assert callable(Image.open)"
          : module === "pypdf" ? "from pypdf import PdfReader; assert callable(PdfReader)"
          : "import pypdfium2; assert callable(pypdfium2.PdfDocument)";
        result.pythonModules[module] = succeeded(run(result.runtime.python.executable, ["-c", code]));
      }
    }
    result.commands.pdftoppm = succeeded(run(result.commandPaths.pdftoppm, ["-v"]));
    result.commands.mutool = succeeded(run(result.commandPaths.mutool, ["-v"]));
    result.filesystem = await filesystem(options.input ?? path.join(SCRIPT_DIR, "../SKILL.md"), options.outputDir ?? process.cwd());
    if (result.runtime.node.available) {
      result.scripts.builder = succeeded(run(node.executable, ["--check", path.join(SCRIPT_DIR, "build_math_worksheet_file.mjs")]));
      const validation = run(node.executable, [path.join(SCRIPT_DIR, "validate_math_worksheet.mjs")]);
      if (!validation.error && !validation.signal && validation.status === 1) {
        const report = JSON.parse(validation.stdout);
        result.scripts.validator = report.valid === false && report.schemaVersion === 1 && Array.isArray(report.errors)
          && report.errors.length === 1 && report.errors[0].code === "AI_SCHEMA_VALIDATION_FAILED"
          && report.errors[0].message === "候補JSONファイルを1件指定してください。";
      }
    }
  } catch {
    result.ok = false;
  }
  return { ...result, decision: selectRuntime(result, options.figuresRequired ?? false) };
}

/**
 * 許可されたCLI引数だけを受け取り、診断JSONを出力する。
 * @param argv 実行時引数
 * @returns 出力完了時に解決するPromise
 */
async function main(argv) {
  try {
    const options = {};
    const valueOptions = { "--python": "python", "--pdftoppm": "pdftoppm", "--mutool": "mutool", "--input": "input", "--output-dir": "outputDir" };
    for (let index = 0; index < argv.length; index += 1) {
      const flag = argv[index];
      if (flag === "--figures-required") { options.figuresRequired = true; continue; }
      if (!Object.hasOwn(valueOptions, flag) || !argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error("検査引数が不正です。");
      options[valueOptions[flag]] = argv[++index];
    }
    const report = await probeRuntime(options);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode = report.decision.state === "ready" ? 0 : 1;
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, decision: { state: "blocked", errors: ["RUNTIME_CAPABILITY_CHECK_FAILED"] } })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
