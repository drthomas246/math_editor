import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildPlugin, listPackageFiles, PROJECT_ROOT, SKILL_NAME, verifyPlugin } from "./sujita-plugin";

let root;
let output;
beforeEach(async function createIsolatedSource() {
  root = await mkdtemp(path.join(os.tmpdir(), "sujita-plugin-test-"));
  await cp(path.join(PROJECT_ROOT, "AI"), path.join(root, "AI"), { recursive: true });
  await cp(path.join(PROJECT_ROOT, "schemas"), path.join(root, "schemas"), { recursive: true });
  output = path.join(root, "dist/sujita-ai");
});
afterEach(async function removeIsolatedSource() {
  // mkdtempで作った専用ディレクトリ以外は削除しない。
  if (root && path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("sujita-plugin-test-")) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("portable Plugin配布物", function packageTests() {
  it("再生成しても一覧・全バイトが一致し他のdistを保持する", async function deterministicBuild() {
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/index.html"), "app");
    const built = await buildPlugin(root);
    expect(await verifyPlugin(root)).toBe(built.fileCount);
    const before = await listPackageFiles(output);
    const contents = [];
    for (const file of before) contents.push(await readFile(path.join(output, file)));
    await buildPlugin(root);
    expect(await listPackageFiles(output)).toEqual(before);
    for (const [index, file] of before.entries()) expect(await readFile(path.join(output, file))).toEqual(contents[index]);
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe("app");
  });
  it("ビルド後の手編集を検知しverifyでは修復しない", async function tampering() {
    await buildPlugin(root);
    const file = path.join(output, "skills", SKILL_NAME, "SKILL.md");
    await writeFile(file, "tampered");
    await expect(verifyPlugin(root)).rejects.toThrow("正本と異なります");
    expect(await readFile(file, "utf8")).toBe("tampered");
  });
  it("配布物の不足と余剰を検出する", async function differentFileSet() {
    await buildPlugin(root);
    await writeFile(path.join(output, "extra.txt"), "extra");
    await expect(verifyPlugin(root)).rejects.toThrow("パス集合");
    await buildPlugin(root);
    await rm(path.join(output, "plugin.json"));
    await expect(verifyPlugin(root)).rejects.toThrow("パス集合");
  });
  it("隠しファイルや一時ファイルをコピーしない", async function temporaryFiles() {
    const skill = path.join(root, "AI/skills", SKILL_NAME);
    await writeFile(path.join(skill, ".env"), "unused");
    await mkdir(path.join(skill, "__pycache__"));
    await writeFile(path.join(skill, "__pycache__/cache.pyc"), "unused");
    await buildPlugin(root);
    expect(await listPackageFiles(output)).not.toContain(`skills/${SKILL_NAME}/.env`);
    await verifyPlugin(root);
  });
  it("主Schemaの変更を古いmanifestで配布しない", async function schemaDrift() {
    await writeFile(path.join(root, "schemas/math-worksheet.schema.json"), "{}");
    await expect(buildPlugin(root)).rejects.toThrow("ハッシュ");
  });
  it("秘密情報を含む正本を配布しない", async function secretSource() {
    await writeFile(path.join(root, "AI/skills", SKILL_NAME, "references/private.md"), `sk-proj-${"a".repeat(40)}`);
    await expect(buildPlugin(root)).rejects.toThrow("秘密情報");
  });
  it("正式URLの代わりに固定されたlocalhostを配布しない", async function hardcodedTarget() {
    await writeFile(path.join(root, "AI/skills", SKILL_NAME, "references/target.md"), "http://localhost:5173");
    await expect(buildPlugin(root)).rejects.toThrow("接続URL");
  });
  it("外部ディレクトリへのsourceリンクを追跡しない", async function sourceLink() {
    await symlink(path.join(root, "schemas"), path.join(root, "AI/skills", SKILL_NAME, "linked"), "junction");
    await expect(buildPlugin(root)).rejects.toThrow("リンク");
  });
  it("distのリンクを通じて外部ファイルを削除しない", async function outputLink() {
    const outside = path.join(root, "other");
    await mkdir(outside);
    await writeFile(path.join(outside, "keep"), "keep");
    await symlink(outside, path.join(root, "dist"), "junction");
    await expect(buildPlugin(root)).rejects.toThrow("dist");
    expect(await readFile(path.join(outside, "keep"), "utf8")).toBe("keep");
    expect((await lstat(path.join(root, "dist"))).isSymbolicLink()).toBe(true);
  });
  it("配布ディレクトリだけでValidatorとRuntime検査が動く", async function standaloneRuntime() {
    await buildPlugin(root);
    const skill = path.join(output, "skills", SKILL_NAME);
    const validation = spawnSync(process.execPath, [path.join(skill, "scripts/validate_math_worksheet.mjs")], { cwd: os.tmpdir(), encoding: "utf8" });
    expect(validation.status).toBe(1);
    expect(JSON.parse(validation.stdout).errors).toHaveLength(1);
    const probe = spawnSync(process.execPath, [path.join(skill, "scripts/check_runtime_capabilities.mjs"), "--python", "unavailable-python", "--output-dir", root], { cwd: os.tmpdir(), encoding: "utf8", timeout: 30000 });
    expect(probe.status).toBe(0);
    expect(JSON.parse(probe.stdout).decision.state).toBe("ready");
    const deliveryState = path.join(root, "delivery-state.json");
    await writeFile(deliveryState, JSON.stringify({ stage: "import", result: { success: false, error: { code: "REVALIDATION_REQUIRED" } } }));
    const delivery = spawnSync(process.execPath, [path.join(skill, "scripts/plan_webmcp_delivery.mjs"), "--input", deliveryState], { cwd: os.tmpdir(), encoding: "utf8" });
    expect(delivery.status).toBe(0);
    expect(JSON.parse(delivery.stdout)).toMatchObject({ action: "revalidate", reuseRequestId: true });
  }, 40000);
  it("配布Builderの完成JSONを検証でき、未確定Draftは拒否する", async function standaloneBuild() {
    await buildPlugin(root);
    const skill = path.join(output, "skills", SKILL_NAME);
    const draft = JSON.parse(await readFile(path.join(PROJECT_ROOT, "scripts/fixtures/ai-plugin/confirmed-draft.json"), "utf8"));
    const draftPath = path.join(root, "draft.json");
    const candidatePath = path.join(root, "candidate.json");
    await writeFile(draftPath, JSON.stringify(draft));
    const build = spawnSync(process.execPath, [path.join(skill, "scripts/build_math_worksheet_file.mjs"), "--draft", draftPath, "--output", candidatePath], { cwd: os.tmpdir(), encoding: "utf8" });
    expect(build.status, build.stdout).toBe(0);
    const validation = spawnSync(process.execPath, [path.join(skill, "scripts/validate_math_worksheet.mjs"), candidatePath], { cwd: os.tmpdir(), encoding: "utf8" });
    expect(validation.status, validation.stdout).toBe(0);
    expect(JSON.parse(validation.stdout)).toMatchObject({ valid: true, errors: [], summary: { problemCount: 1, assetCount: 0 } });
    draft.state = "review-required";
    await writeFile(draftPath, JSON.stringify(draft));
    const rejected = spawnSync(process.execPath, [path.join(skill, "scripts/build_math_worksheet_file.mjs"), "--draft", draftPath, "--output", path.join(root, "rejected.json")], { encoding: "utf8" });
    expect(rejected.status).toBe(1);
    expect(JSON.parse(rejected.stdout).code).toBe("AI_DRAFT_NOT_CONFIRMED");
  });
});
