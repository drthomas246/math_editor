import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CURRENT_SCHEMA_VERSION, MathWorksheetFileSchema } from "../src/domain/worksheet/worksheet.schema";
const outputPath = fileURLToPath(new URL("../schemas/math-worksheet.schema.json", import.meta.url));
const generated = z.toJSONSchema(MathWorksheetFileSchema, {
    target: "draft-2020-12",
    reused: "ref",
    cycles: "ref",
});
const jsonSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://example.local/schemas/math-worksheet.schema.json",
    ...generated,
    title: "MathWorksheetFile",
    description: "ZodのMathWorksheetFileSchemaから生成した、単一プリントと全体バックアップ共通のJSON Schema。",
    $comment: "Entity IDの全体一意性、header.titleの一致、表の論理グリッド、Asset参照整合性、RichTextの総ノード数・深度、LaTeX禁止commandはZodの実行時検証も必要です。",
};
const nextContents = `${JSON.stringify(jsonSchema, null, 2)}\n`;
const manifestPath = fileURLToPath(new URL("../schemas/math-worksheet.schema-manifest.json", import.meta.url));
const skillManifestPath = fileURLToPath(new URL("../AI/skills/sujita-textbook-import/schemas/schema-manifest.json", import.meta.url));
const skillSchemaPath = fileURLToPath(new URL("../AI/skills/sujita-textbook-import/schemas/math-worksheet.schema.json", import.meta.url));
const skillManifest = JSON.parse(await readFile(skillManifestPath, "utf8"));
const sha256 = createHash("sha256").update(nextContents).digest("hex").toUpperCase();
let previousManifest = skillManifest;
try {
    previousManifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const manifest = {
    format: "math-worksheet",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    source: "src/domain/worksheet/worksheet.schema.ts",
    generatedSchema: "schemas/math-worksheet.schema.json",
    sha256,
    generatedAt: previousManifest.sha256 === sha256 && typeof previousManifest.generatedAt === "string"
        && !Number.isNaN(Date.parse(previousManifest.generatedAt))
        ? previousManifest.generatedAt : new Date().toISOString(),
};
const nextManifest = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes("--check")) {
    const currentContents = await readFile(outputPath, "utf8").catch((/**
     * 非同期処理の失敗を利用者向けのエラー状態または終了コードへ変換する。
     *
     * @returns ファイルを読み込めなかった場合の空文字列
     */
    function handleRejectedValue1() {
        return "";
    }));
    if (currentContents !== nextContents) {
        console.error("math-worksheet.schema.jsonがworksheet.schema.tsと一致しません。npm run schema:generateを実行してください。");
        process.exitCode = 1;
    }
    else {
        console.log("math-worksheet.schema.jsonはZod Schemaと一致しています。");
    }
    let currentManifest = "";
    try {
        currentManifest = await readFile(manifestPath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (currentManifest.replace(/\r\n?/gu, "\n") !== nextManifest) {
        console.error("Schema manifestが正本と一致しません。npm run schema:generateを実行してください。");
        process.exitCode = 1;
    }
}
else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, nextContents, "utf8");
    await writeFile(manifestPath, nextManifest, "utf8");
    await writeFile(skillSchemaPath, nextContents, "utf8");
    // Validatorのhashは自動追認せず、再bundleした場合にだけ明示的に更新する。
    await writeFile(skillManifestPath, `${JSON.stringify({ ...skillManifest, ...manifest }, null, 2)}\n`, "utf8");
    console.log(`Generated: ${outputPath}`);
}
