import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CURRENT_SCHEMA_VERSION } from "../src/domain/worksheet/worksheet.schema";
const rootSchemaPath = fileURLToPath(new URL("../schemas/math-worksheet.schema.json", import.meta.url));
const skillSchemaPath = fileURLToPath(new URL("../AI/skills/math-editor-textbook-import/schemas/math-worksheet.schema.json", import.meta.url));
const manifestPath = fileURLToPath(new URL("../AI/skills/math-editor-textbook-import/schemas/schema-manifest.json", import.meta.url));
const validatorPath = fileURLToPath(new URL("../AI/skills/math-editor-textbook-import/scripts/validate_math_worksheet.mjs", import.meta.url));
const EXPECTED_SOURCE = "src/domain/worksheet/worksheet.schema.ts";
const EXPECTED_GENERATED_SCHEMA = "schemas/math-worksheet.schema.json";
const EXPECTED_VALIDATOR_PATH = "scripts/validate_math_worksheet.mjs";
const VALIDATOR_METADATA_PATTERN = /^\/\* math-editor-validator-metadata (\{[^\r\n]+\}) \*\/$/mu;
type JsonObject = Record<string, unknown>;
/**
 * isObjectで表される条件を判定する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * normalizeNewlinesの入力値を必要な形式へ変換する。
 *
 * @param contents contentsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function normalizeNewlines(contents: string): string {
    return contents.replace(/\r\n?/gu, "\n");
}
/**
 * sha256に必要な処理を実行する。
 *
 * @param contents contentsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function sha256(contents: string): string {
    return createHash("sha256").update(contents, "utf8").digest("hex").toUpperCase();
}
/**
 * parseJsonの入力値を必要な形式へ変換する。
 *
 * @param contents contentsとして使用する値
 * @param label labelとして使用する値
 * @param errors errorsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function parseJson(contents: string, label: string, errors: string[]): unknown {
    try {
        return JSON.parse(contents) as unknown;
    }
    catch (error) {
        errors.push(`${label}をJSONとして読み取れません: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
/**
 * expectEqualに必要な処理を実行する。
 *
 * @param actual actualとして使用する値
 * @param expected expectedとして使用する値
 * @param message messageとして使用する値
 * @param errors errorsとして使用する値
 */
function expectEqual(actual: unknown, expected: unknown, message: string, errors: string[]): void {
    if (actual !== expected) {
        errors.push(`${message}（期待値: ${String(expected)}、実際: ${String(actual)}）`);
    }
}
/**
 * readValidatorSchemaVersionで必要な値を取得する。
 *
 * @param errors errorsとして使用する値
 * @returns 非同期処理の結果
 */
async function readValidatorSchemaVersion(errors: string[]): Promise<unknown> {
    const result = await new Promise<{
        stdout: string;
        stderr: string;
    }>((/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param resolve resolveとして使用する値
     * @param reject rejectとして使用する値
     */
    function commentRuleCallback1(resolve, reject) {
        const child = spawn(process.execPath, [validatorPath], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (/**
         * onへ渡す処理を実行する。
         *
         * @param chunk chunkとして使用する値
         */
        function onCallback2(chunk: string) {
            stdout += chunk;
        }));
        child.stderr.on("data", (/**
         * onへ渡す処理を実行する。
         *
         * @param chunk chunkとして使用する値
         */
        function onCallback3(chunk: string) {
            stderr += chunk;
        }));
        child.on("error", reject);
        child.on("close", (/**
         * onへ渡す処理を実行する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function onCallback4() {
            return resolve({ stdout, stderr });
        }));
    })).catch((/**
     * 非同期処理で発生した失敗を処理する。
     *
     * @param error 処理中に発生したエラー
     * @returns 呼び出し元で使用する処理結果
     */
    function handleRejectedValue5(error: unknown) {
        errors.push(`Validatorを実行できません: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }));
    if (!result) {
        return null;
    }
    const output = parseJson(result.stdout.trim(), "Validator出力", errors);
    if (!isObject(output)) {
        if (result.stderr.trim()) {
            errors.push(`Validator標準エラー: ${result.stderr.trim()}`);
        }
        return null;
    }
    return output.schemaVersion;
}
const [rootSchemaRaw, skillSchemaRaw, manifestRaw, validatorRaw] = await Promise.all([
    readFile(rootSchemaPath, "utf8"),
    readFile(skillSchemaPath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(validatorPath, "utf8"),
]);
const errors: string[] = [];
const rootSchema = normalizeNewlines(rootSchemaRaw);
const skillSchema = normalizeNewlines(skillSchemaRaw);
const validator = normalizeNewlines(validatorRaw);
const schemaSha256 = sha256(rootSchema);
const validatorSha256 = sha256(validator);
const validatorSchemaVersion = await readValidatorSchemaVersion(errors);
expectEqual(validatorSchemaVersion, CURRENT_SCHEMA_VERSION, "Validator実行結果のschemaVersionがCURRENT_SCHEMA_VERSIONと一致しません", errors);
if (rootSchema !== skillSchema) {
    errors.push("ルートSchemaとSkill同梱Schemaが一致しません。Schema生成後にSkill側へコピーしてください。");
}
const manifest = parseJson(manifestRaw, "schema-manifest.json", errors);
if (!isObject(manifest)) {
    errors.push("schema-manifest.jsonはJSON objectである必要があります。");
}
else {
    expectEqual(manifest.format, "math-worksheet", "manifest.formatが不正です", errors);
    expectEqual(manifest.schemaVersion, CURRENT_SCHEMA_VERSION, "manifest.schemaVersionがCURRENT_SCHEMA_VERSIONと一致しません", errors);
    expectEqual(manifest.source, EXPECTED_SOURCE, "manifest.sourceが不正です", errors);
    expectEqual(manifest.generatedSchema, EXPECTED_GENERATED_SCHEMA, "manifest.generatedSchemaが不正です", errors);
    expectEqual(typeof manifest.sha256 === "string" ? manifest.sha256.toUpperCase() : manifest.sha256, schemaSha256, "manifest.sha256がルートSchemaのSHA-256と一致しません", errors);
    if (!isObject(manifest.validator)) {
        errors.push("manifest.validatorがありません。");
    }
    else {
        expectEqual(manifest.validator.path, EXPECTED_VALIDATOR_PATH, "manifest.validator.pathが不正です", errors);
        expectEqual(manifest.validator.schemaVersion, CURRENT_SCHEMA_VERSION, "manifest.validator.schemaVersionがCURRENT_SCHEMA_VERSIONと一致しません", errors);
        expectEqual(typeof manifest.validator.schemaSha256 === "string"
            ? manifest.validator.schemaSha256.toUpperCase()
            : manifest.validator.schemaSha256, schemaSha256, "manifest.validator.schemaSha256がルートSchemaのSHA-256と一致しません", errors);
        expectEqual(typeof manifest.validator.sha256 === "string"
            ? manifest.validator.sha256.toUpperCase()
            : manifest.validator.sha256, validatorSha256, "manifest.validator.sha256がValidatorのSHA-256と一致しません", errors);
    }
}
const metadataMatch = validator.match(VALIDATOR_METADATA_PATTERN);
if (!metadataMatch?.[1]) {
    errors.push("Validatorにmath-editor-validator-metadataがありません。");
}
else {
    const metadata = parseJson(metadataMatch[1], "Validator metadata", errors);
    if (!isObject(metadata)) {
        errors.push("Validator metadataはJSON objectである必要があります。");
    }
    else {
        expectEqual(metadata.schemaVersion, CURRENT_SCHEMA_VERSION, "Validator metadataのschemaVersionがCURRENT_SCHEMA_VERSIONと一致しません", errors);
        expectEqual(typeof metadata.schemaSha256 === "string"
            ? metadata.schemaSha256.toUpperCase()
            : metadata.schemaSha256, schemaSha256, "Validator metadataのschemaSha256がルートSchemaのSHA-256と一致しません", errors);
    }
}
if (errors.length > 0) {
    console.error("AI SkillのSchema同梱物が同期されていません:");
    errors.forEach((/**
     * 各要素へ必要な処理を適用する。
     *
     * @param error 処理中に発生したエラー
     * @returns 呼び出し元で使用する処理結果
     */
    function processItem6(error) {
        return console.error(`- ${error}`);
    }));
    process.exitCode = 1;
}
else {
    console.log(`AI SkillのSchema同梱物は同期されています（schemaVersion: ${CURRENT_SCHEMA_VERSION}, schema SHA-256: ${schemaSha256}）。`);
}
