import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { checkFilesystem, probeRuntime } from "../AI/skills/sujita-textbook-import/scripts/check_runtime_capabilities.mjs";

/**
 * CIのインストール状態に依存しない検出用スタブを作る。
 * @param options 利用不可にする能力
 * @returns コマンドとファイル操作の差し替え
 */
function environment(options = {}) {
  return {
    node: { executable: "test-node", version: "24.0.0" },
    /**
     * 指定された依存だけを利用可能として返す。
     * @param executable 実行ファイル
     * @param args 起動引数
     * @returns 模擬終了結果
     */
    run(executable, args) {
      if (options.throws) throw new Error("検査不能");
      const failed = { status: 1, stdout: "", stderr: "" };
      const success = { status: 0, stdout: "24.0.0", stderr: "" };
      if (executable === "test-node") {
        if (options.noNode) return { ...failed, error: new Error("起動不可") };
        if (args[0].endsWith("validate_math_worksheet.mjs")) {
          return { ...failed, stdout: JSON.stringify({ valid: false, schemaVersion: 1, errors: options.noValidator ? [] : [{ code: "AI_SCHEMA_VALIDATION_FAILED", message: "候補JSONファイルを1件指定してください。" }] }) };
        }
        if (args[0] === "--check" && options.noBuilder) return failed;
        return success;
      }
      if (["python3", "python", "py", "resolved-python"].includes(executable)) {
        if (options.noPython) return failed;
        const code = args.at(-1);
        if (code.includes("sys.version")) return { ...success, stdout: JSON.stringify({ version: "3.12.0", supported: true, executable: "resolved-python" }) };
        if ((code.includes("PIL") && options.noPillow) || (code.includes("pypdf import") && options.noPypdf)) return failed;
        if (code.includes("fitz") && !options.fitz) return failed;
        if (code.includes("pypdfium2") && !options.pdfium) return failed;
        return success;
      }
      if (executable === "pdftoppm") return options.noPoppler ? failed : success;
      if (executable === "mutool") return options.mutool ? success : failed;
      return failed;
    },
    /**
     * ファイルアクセスの検出結果を返す。
     * @returns 読取り・書込みの成否
     */
    async filesystem() { return { readable: !options.noRead, writable: !options.noWrite }; },
  };
}

describe("Runtime能力検査", function runtimeTests() {
  it("主依存が揃う環境はPopplerを選ぶ", async function primary() {
    const result = await probeRuntime({ figuresRequired: true }, environment({ pdfium: true }));
    expect(result.decision).toMatchObject({ state: "ready", figureBackend: "poppler", warnings: [], errors: [] });
  });
  it("pdftoppmがなければ利用可能なPDFiumへ切り替える", async function alternativeCommand() {
    const result = await probeRuntime({ figuresRequired: true }, environment({ noPoppler: true, pdfium: true }));
    expect(result.decision).toMatchObject({ state: "ready", figureBackend: "pypdfium2", warnings: ["FIGURE_PRIMARY_RUNTIME_UNAVAILABLE"] });
  });
  it("pypdfがなければPyMuPDFを利用する", async function alternativeModule() {
    const result = await probeRuntime({ figuresRequired: true }, environment({ noPypdf: true, fitz: true }));
    expect(result.decision.figureBackend).toBe("pymupdf");
    expect(result.pythonModules.pypdf).toBe(false);
  });
  it("Python不要の図版なし処理を許可する", async function textOnly() {
    const result = await probeRuntime({}, environment({ noPython: true, noPoppler: true }));
    expect(result.decision.state).toBe("ready");
    expect(result.decision.figureBackend).toBeNull();
  });
  it("必須図版があれば全経路不在をblockedとする", async function requiredFigure() {
    const result = await probeRuntime({ figuresRequired: true }, environment({ noPython: true }));
    expect(result.decision).toMatchObject({ state: "blocked", requiresHostFigureCheck: true, errors: ["FIGURE_RUNTIME_UNAVAILABLE"] });
  });
  it("Pillowなしを不完全な代替経路で利用可能扱いしない", async function missingImageDecoder() {
    const result = await probeRuntime({ figuresRequired: true }, environment({ noPillow: true, pdfium: true, fitz: true }));
    expect(result.decision.errors).toContain("FIGURE_RUNTIME_UNAVAILABLE");
  });
  it("Validatorの起動結果が不正なら停止する", async function missingValidator() {
    const result = await probeRuntime({}, environment({ noValidator: true }));
    expect(result.decision.errors).toEqual(["VALIDATOR_RUNTIME_UNAVAILABLE"]);
  });
  it("Builderが実行できなければ停止する", async function missingBuilder() {
    const result = await probeRuntime({}, environment({ noBuilder: true }));
    expect(result.decision.errors).toEqual(["BUILDER_RUNTIME_UNAVAILABLE"]);
  });
  it("Nodeが起動しなければ両スクリプトを実行可能扱いしない", async function missingNode() {
    const result = await probeRuntime({}, environment({ noNode: true }));
    expect(result.decision.errors).toEqual(["BUILDER_RUNTIME_UNAVAILABLE", "VALIDATOR_RUNTIME_UNAVAILABLE"]);
  });
  it("probe内部の例外を構造化して停止する", async function failedProbe() {
    const result = await probeRuntime({}, environment({ throws: true }));
    expect(result.ok).toBe(false);
    expect(result.decision.errors).toContain("RUNTIME_CAPABILITY_CHECK_FAILED");
  });
  it("出力先へ書き込めなければ停止する", async function deniedOutput() {
    const result = await probeRuntime({}, environment({ noWrite: true }));
    expect(result.decision.errors).toContain("RUNTIME_CAPABILITY_CHECK_FAILED");
  });
  it("不正なCLI引数でもJSONを返す", function invalidCli() {
    const result = spawnSync(process.execPath, ["AI/skills/sujita-textbook-import/scripts/check_runtime_capabilities.mjs", "--unknown"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).decision.errors).toEqual(["RUNTIME_CAPABILITY_CHECK_FAILED"]);
  });
  it("実際の入力を変更せず書込みを検査し一時物を残さない", async function actualFilesystem() {
    const root = await mkdtemp(path.join(os.tmpdir(), "sujita-runtime-test-"));
    try {
      const source = path.join(root, "source.pdf");
      await writeFile(source, "original-input");
      expect(await checkFilesystem(source, root)).toEqual({ readable: true, writable: true });
      expect(await readFile(source, "utf8")).toBe("original-input");
      expect(await readdir(root)).toEqual(["source.pdf"]);
      expect(await checkFilesystem(path.join(root, "missing"), path.join(root, "missing"))).toEqual({ readable: false, writable: false });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
