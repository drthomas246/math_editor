import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CURRENT_SCHEMA_VERSION } from "../src/domain/worksheet/worksheet.schema";
const rootSchemaPath = fileURLToPath(new URL("../schemas/math-worksheet.schema.json", import.meta.url));
const skillSchemaPath = fileURLToPath(new URL("../AI/skills/sugaku-jitate-textbook-import/schemas/math-worksheet.schema.json", import.meta.url));
const manifestPath = fileURLToPath(new URL("../AI/skills/sugaku-jitate-textbook-import/schemas/schema-manifest.json", import.meta.url));
const rootManifestPath = fileURLToPath(new URL("../schemas/math-worksheet.schema-manifest.json", import.meta.url));
const validatorPath = fileURLToPath(new URL("../AI/skills/sugaku-jitate-textbook-import/scripts/validate_math_worksheet.mjs", import.meta.url));
const EXPECTED_SOURCE = "src/domain/worksheet/worksheet.schema.ts";
const EXPECTED_GENERATED_SCHEMA = "schemas/math-worksheet.schema.json";
const EXPECTED_VALIDATOR_PATH = "scripts/validate_math_worksheet.mjs";
const VALIDATOR_METADATA_PATTERN = /^\/\* sugaku-jitate-validator-metadata (\{[^\r\n]+\}) \*\/$/mu;
type JsonObject = Record<string, unknown>;
/**
 * Objectが仕様上の条件を満たすか判定する。
 *
 * @param value is・Objectで判定または変換する入力値
 * 値が配列とnullを除くJSONオブジェクトか判定する。
  * @returns 変換・検証・保存の対象となる値の型が「object」と一致するかつ変換・検証・保存の対象となる値が対象が存在しないことを示すnullと異なるかつis・Arrayの結果が存在しない場合はtrue
 */
function isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * 環境差による比較失敗を避けるため、改行コードをLFへ統一する。
 *
 * @param contents 検証または変換するファイル内容
 * @returns replaceの結果として得た文字列。変換できない場合は関数固有の既定値
 */
function normalizeNewlines(contents: string): string {
    return contents.replace(/\r\n?/gu, "\n");
}
/**
 * shaをto・Upper・Caseで処理し、その結果を呼び出し元へ反映する。
 *
 * @param contents 検証または変換するファイル内容
 * @returns to・Upper・Caseの結果として得た文字列。変換できない場合は関数固有の既定値
 */
function sha256(contents: string): string {
    return createHash("sha256").update(contents, "utf8").digest("hex").toUpperCase();
}
/**
 * Jsonを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param contents 検証または変換するファイル内容
 * @param label 画面表示やテスト識別に使う名称
 * @param errors 検出した不整合の追加先
 * @returns スキーマ検証済みのデータ
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
 * expect・Equalをpushで処理し、その結果を呼び出し元へ反映する。
 *
 * @param actual 実際に生成された内容
 * @param expected 検証で期待する値
 * @param message 失敗時に表示する説明
 * @param errors 検出した不整合の追加先
 */
function expectEqual(actual: unknown, expected: unknown, message: string, errors: string[]): void {
    if (actual !== expected) {
        errors.push(`${message}（期待値: ${String(expected)}、実際: ${String(actual)}）`);
    }
}
/**
 * Validator・Schema・Versionを入力データまたは現在の状態から取り出す。
 *
 * @param errors 検出した不整合の追加先
 * @returns Validator・Schema・Versionを入力データまたは現在の状態から取り出す処理の完了時に解決するPromise
 */
async function readValidatorSchemaVersion(errors: string[]): Promise<unknown> {
    const result = await new Promise<{
        stdout: string;
        stderr: string;
    }>((/**
     * コールバック型APIの完了と失敗を、呼び出し側がawaitできるPromiseへ変換する。
     *
     * @param resolve 非同期処理を正常完了させるPromise関数
     * @param reject 非同期処理を失敗として終了させるPromise関数
     */
    function settlePromise1(resolve, reject) {
        const child = spawn(process.execPath, [validatorPath], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (/**
         * onの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
         *
         * @param chunk ハッシュ計算へ順番に入力するデータ断片
         */
        function onCallback2(chunk: string) {
            stdout += chunk;
        }));
        child.stderr.on("data", (/**
         * onの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
         *
         * @param chunk ハッシュ計算へ順番に入力するデータ断片
         */
        function onCallback3(chunk: string) {
            stderr += chunk;
        }));
        child.on("error", reject);
        child.on("close", (/**
         * onの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
         *
         */
        function onCallback4() {
            return resolve({ stdout, stderr });
        }));
    })).catch((/**
     * 非同期処理の失敗を利用者向けのエラー状態または終了コードへ変換する。
     *
     * @param error 処理中に発生したエラー
     * @returns 対象が存在しないことを示すnull
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
    if (!Array.isArray(output.errors)) {
        errors.push("Validator実行結果にerrors配列がありません。");
    } else {
        for (const issue of output.errors) {
            if (!isObject(issue) || issue.code !== "AI_SCHEMA_VALIDATION_FAILED"
                || issue.message !== "候補JSONファイルを1件指定してください。") {
                errors.push("Validatorの起動時検査に失敗しました。Schemaまたは実行環境を確認してください。");
            }
        }
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
const rootManifest = parseJson(await readFile(rootManifestPath, "utf8"), "root schema manifest", errors);
if (isObject(rootManifest) && isObject(manifest)) {
    for (const key of ["format", "schemaVersion", "source", "generatedSchema", "sha256", "generatedAt"]) {
        expectEqual(manifest[key], rootManifest[key], `root/Skill manifestの${key}が不一致です`, errors);
    }
} else {
    errors.push("root/Skill manifestはJSON objectである必要があります。");
}
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
    errors.push("Validatorにsugaku-jitate-validator-metadataがありません。");
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
     * 各エラーについてエラーを実行し、対応関係または検証状態を更新する。
     *
     * @param error 処理中に発生したエラー
     */
    function processItem6(error) {
        return console.error(`- ${error}`);
    }));
    process.exitCode = 1;
}
else {
    console.log(`AI SkillのSchema同梱物は同期されています（schemaVersion: ${CURRENT_SCHEMA_VERSION}, schema SHA-256: ${schemaSha256}）。`);
}
