#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 10_000;
const MAX_IMAGE_PIXELS = 40_000_000;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BLOCK_WIDTHS = new Set([25, 33, 50, 66, 75, 100]);
const FLOAT_WIDTHS = new Set([25, 33, 50]);

class BuildError extends Error {
  constructor(code, message, errorPath = "") {
    super(message);
    this.name = "BuildError";
    this.code = code;
    this.path = errorPath;
  }
}

function emit(payload, exitCode) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!["--draft", "--output", "--asset-root"].includes(token)) {
      throw new BuildError("AI_SCHEMA_VALIDATION_FAILED", `未知の引数です: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new BuildError("AI_SCHEMA_VALIDATION_FAILED", `${token}には値が必要です。`);
    }
    values[token.slice(2)] = value;
    index += 1;
  }
  if (!values.draft || !values.output) {
    throw new BuildError(
      "AI_SCHEMA_VALIDATION_FAILED",
      "--draftと--outputは必須です。",
    );
  }
  return values;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expect(condition, code, message, errorPath = "") {
  if (!condition) throw new BuildError(code, message, errorPath);
}

function emptyDocument() {
  return {
    type: "doc",
    content: [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }],
  };
}

const usedIds = new Set();

function createId() {
  let value;
  do value = randomUUID(); while (usedIds.has(value));
  usedIds.add(value);
  return value;
}

function cloneWithFreshIds(value) {
  if (Array.isArray(value)) return value.map(cloneWithFreshIds);
  if (!isObject(value)) return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = key === "id" && typeof child === "string" ? createId() : cloneWithFreshIds(child);
  }
  return result;
}

function colorNodeAsAnswer(node) {
  if (Array.isArray(node)) return node.map(colorNodeAsAnswer);
  if (!isObject(node)) return node;
  const next = structuredClone(node);
  if (next.type === "text") {
    const marks = Array.isArray(next.marks) ? [...next.marks] : [];
    if (!marks.some((mark) => isObject(mark) && mark.type === "answerColor")) {
      marks.push({ type: "answerColor" });
    }
    next.marks = marks;
  } else if (["inlineMath", "blockMath", "imageRef", "richTable"].includes(next.type)) {
    next.attrs = { ...(isObject(next.attrs) ? next.attrs : {}), answerColor: true };
  }
  if (Array.isArray(next.content)) next.content = next.content.map(colorNodeAsAnswer);
  return next;
}

function hasVisibleContent(document) {
  if (!isObject(document) || !Array.isArray(document.content)) return false;
  const visit = (node) => {
    if (!isObject(node)) return false;
    if (node.type === "text") return typeof node.text === "string" && node.text.trim().length > 0;
    if (["inlineMath", "blockMath", "imageRef", "richTable", "spacer"].includes(node.type)) return true;
    return Array.isArray(node.content) && node.content.some(visit);
  };
  return document.content.some(visit);
}

function mergeColoredDocuments(problemDocument, answerDocument) {
  expect(isObject(problemDocument) && problemDocument.type === "doc", "AI_SCHEMA_VALIDATION_FAILED", "問題文書が不正です。");
  const problemContent = Array.isArray(problemDocument.content) ? structuredClone(problemDocument.content) : [];
  const answerContent = hasVisibleContent(answerDocument)
    ? colorNodeAsAnswer(answerDocument).content
    : [];
  const content = [...problemContent, ...answerContent];
  return cloneWithFreshIds({
    type: "doc",
    content: content.length ? content : emptyDocument().content,
  });
}

function normalizeSolution(document) {
  return hasVisibleContent(document) ? cloneWithFreshIds(document) : null;
}

function appendBlockNode(document, node) {
  const base = hasVisibleContent(document) ? structuredClone(document) : { type: "doc", content: [] };
  base.content.push(node);
  return base;
}

function validateGate(draft) {
  expect(isObject(draft), "AI_SCHEMA_VALIDATION_FAILED", "DraftはJSON objectである必要があります。", "/");
  expect(draft.draftVersion === 1, "AI_SCHEMA_VALIDATION_FAILED", "draftVersionは1である必要があります。", "/draftVersion");
  expect(Number.isInteger(draft.revision) && draft.revision >= 0, "AI_SCHEMA_VALIDATION_FAILED", "revisionが不正です。", "/revision");
  expect(draft.state === "confirmed", "AI_DRAFT_NOT_CONFIRMED", "Draftはconfirmedである必要があります。", "/state");
  expect(isObject(draft.source), "AI_SCHEMA_VALIDATION_FAILED", "sourceが不正です。", "/source");
  expect(draft.source.rightsConfirmed === true, "AI_DRAFT_NOT_CONFIRMED", "PDF利用権限の確認が必要です。", "/source/rightsConfirmed");
  expect(draft.source.externalProcessingAcknowledged === true, "AI_DRAFT_NOT_CONFIRMED", "外部送信の理解確認が必要です。", "/source/externalProcessingAcknowledged");
  expect(isObject(draft.range) && draft.range.status === "resolved", "AI_RANGE_PAGE_NOT_FOUND", "対象範囲が一意に解決されていません。", "/range/status");
  expect(isObject(draft.confirmation) && draft.confirmation.status === "confirmed", "AI_DRAFT_NOT_CONFIRMED", "明示確定されていません。", "/confirmation/status");
  expect(draft.confirmation.confirmedRevision === draft.revision, "AI_DRAFT_REVISION_MISMATCH", "確定revisionと現在のrevisionが一致しません。", "/confirmation/confirmedRevision");
  expect(typeof draft.confirmation.confirmedAt === "string" && !Number.isNaN(Date.parse(draft.confirmation.confirmedAt)), "AI_DRAFT_NOT_CONFIRMED", "confirmedAtが不正です。", "/confirmation/confirmedAt");
  expect(Array.isArray(draft.items), "AI_SCHEMA_VALIDATION_FAILED", "itemsは配列である必要があります。", "/items");
  expect(Array.isArray(draft.issues), "AI_SCHEMA_VALIDATION_FAILED", "issuesは配列である必要があります。", "/issues");

  const accepted = draft.items.filter((item) => isObject(item) && item.reviewDecision === "accepted");
  const excluded = draft.items.filter((item) => isObject(item) && item.reviewDecision === "excluded");
  const pending = draft.items.filter((item) => !isObject(item) || item.reviewDecision === "pending");
  expect(accepted.length > 0, "AI_SCHEMA_VALIDATION_FAILED", "採用項目が1件以上必要です。", "/items");
  expect(pending.length === 0, "AI_DRAFT_NOT_CONFIRMED", "採否未確認の項目が残っています。", "/items");

  const itemKeys = new Set();
  const orders = new Set();
  for (const [index, item] of draft.items.entries()) {
    expect(isObject(item), "AI_SCHEMA_VALIDATION_FAILED", "itemが不正です。", `/items/${index}`);
    expect(typeof item.itemKey === "string" && item.itemKey.length > 0 && !itemKeys.has(item.itemKey), "AI_SCHEMA_VALIDATION_FAILED", "itemKeyは一意の非空文字列である必要があります。", `/items/${index}/itemKey`);
    itemKeys.add(item.itemKey);
    expect(Number.isInteger(item.order) && !orders.has(item.order), "AI_SCHEMA_VALIDATION_FAILED", "item orderは一意の整数である必要があります。", `/items/${index}/order`);
    orders.add(item.order);
  }

  const acceptedKeys = new Set(accepted.map((item) => item.itemKey));
  const unresolvedFatal = draft.issues.find((issue) => isObject(issue) && issue.severity === "fatal" && issue.resolution !== "resolved");
  expect(!unresolvedFatal, "AI_SCHEMA_VALIDATION_FAILED", "未解決Fatalが残っています。", "/issues");
  const unseenWarning = draft.issues.find((issue) => isObject(issue)
    && issue.severity === "warning"
    && issue.resolution === "unresolved"
    && (issue.itemKey === null || acceptedKeys.has(issue.itemKey)));
  expect(!unseenWarning, "AI_DRAFT_NOT_CONFIRMED", "採用項目に未確認Warningが残っています。", "/issues");

  for (const [index, item] of accepted.entries()) {
    expect(item.recognitionStatus !== "blocked", "AI_SCHEMA_VALIDATION_FAILED", "採用項目がblockedです。", `/items/${index}/recognitionStatus`);
    expect(isObject(item.source) && Number.isInteger(item.source.pdfPageNumber), "AI_SCHEMA_VALIDATION_FAILED", "採用項目の出典ページが不正です。", `/items/${index}/source/pdfPageNumber`);
    expect(["problem", "example"].includes(item.kind), "AI_SCHEMA_VALIDATION_FAILED", "kindが不正です。", `/items/${index}/kind`);
    expect(Array.isArray(item.figures), "AI_SCHEMA_VALIDATION_FAILED", "figuresは配列である必要があります。", `/items/${index}/figures`);
    for (const [figureIndex, figure] of item.figures.entries()) {
      if (isObject(figure) && figure.accepted === true) {
        expect(isObject(figure.output), "AI_FIGURE_OUTPUT_INVALID", "採用図版に最終Cropがありません。", `/items/${index}/figures/${figureIndex}/output`);
      }
    }
    if (isObject(item.textbookAnswer) && item.textbookAnswer.status === "not-found") {
      const shown = draft.issues.some((issue) => isObject(issue)
        && issue.itemKey === item.itemKey
        && issue.code === "AI_TEXTBOOK_ANSWER_NOT_FOUND"
        && issue.resolution !== "unresolved");
      expect(shown, "AI_DRAFT_NOT_CONFIRMED", "解答未発見が利用者確認済みではありません。", `/items/${index}/textbookAnswer`);
    }
  }

  expect(isObject(draft.validationSummary), "AI_SCHEMA_VALIDATION_FAILED", "validationSummaryが不正です。", "/validationSummary");
  const warningCount = draft.issues.filter((issue) => isObject(issue) && issue.severity === "warning" && issue.resolution !== "resolved").length;
  const fatalCount = draft.issues.filter((issue) => isObject(issue) && issue.severity === "fatal" && issue.resolution !== "resolved").length;
  expect(draft.validationSummary.acceptedItems === accepted.length, "AI_DRAFT_REVISION_MISMATCH", "acceptedItems集計が一致しません。", "/validationSummary/acceptedItems");
  expect(draft.validationSummary.excludedItems === excluded.length, "AI_DRAFT_REVISION_MISMATCH", "excludedItems集計が一致しません。", "/validationSummary/excludedItems");
  expect(draft.validationSummary.pendingItems === pending.length, "AI_DRAFT_REVISION_MISMATCH", "pendingItems集計が一致しません。", "/validationSummary/pendingItems");
  expect(draft.validationSummary.warningCount === warningCount, "AI_DRAFT_REVISION_MISMATCH", "warningCount集計が一致しません。", "/validationSummary/warningCount");
  expect(draft.validationSummary.fatalCount === fatalCount, "AI_DRAFT_REVISION_MISMATCH", "fatalCount集計が一致しません。", "/validationSummary/fatalCount");
  expect(draft.validationSummary.lastValidatedRevision === draft.revision, "AI_DRAFT_REVISION_MISMATCH", "検証revisionが現在のrevisionと一致しません。", "/validationSummary/lastValidatedRevision");

  return accepted.sort((left, right) => left.order - right.order);
}

function validateOptions(draft) {
  const options = draft.options;
  expect(isObject(options), "AI_SCHEMA_VALIDATION_FAILED", "optionsが不正です。", "/options");
  expect(typeof options.title === "string" && /\S/u.test(options.title) && options.title.length <= 100, "AI_SCHEMA_VALIDATION_FAILED", "Worksheet題名が不正です。", "/options/title");
  const pageSettings = options.pageSettings;
  expect(isObject(pageSettings), "AI_SCHEMA_VALIDATION_FAILED", "pageSettingsが不正です。", "/options/pageSettings");
  const expectedPageSettings = {
    size: "B5",
    orientation: "portrait",
    margin: "normal",
    fontFamily: "biz-udp-gothic",
    problemNumberFormat: "dot",
    subQuestionNumberFormat: "paren",
  };
  for (const [key, value] of Object.entries(expectedPageSettings)) {
    expect(pageSettings[key] === value, "AI_SCHEMA_VALIDATION_FAILED", `pageSettings.${key}は${value}である必要があります。`, `/options/pageSettings/${key}`);
  }
  const header = options.header;
  expect(isObject(header), "AI_SCHEMA_VALIDATION_FAILED", "header optionsが不正です。", "/options/header");
  for (const key of ["gradeField", "classField", "numberField", "nameField", "firstPageOnly"]) {
    expect(header[key] === true, "AI_SCHEMA_VALIDATION_FAILED", `header.${key}はtrueである必要があります。`, `/options/header/${key}`);
  }
  return options;
}

function assertImageSignature(bytes, mimeType, errorPath) {
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const valid = mimeType === "image/png" ? png : mimeType === "image/jpeg" ? jpeg : webp;
  expect(valid, "AI_FIGURE_OUTPUT_INVALID", "図版ファイルの実体とMIMEが一致しません。", errorPath);
}

async function loadFigureAsset(figure, worksheetId, assetRoot, buildTimestamp, errorPath) {
  expect(isObject(figure.output), "AI_FIGURE_OUTPUT_INVALID", "採用図版にoutputがありません。", `${errorPath}/output`);
  const output = figure.output;
  expect(typeof output.storageKey === "string" && output.storageKey.length > 0, "AI_ASSET_REFERENCE_INVALID", "storageKeyが不正です。", `${errorPath}/output/storageKey`);
  expect(!path.isAbsolute(output.storageKey), "AI_ASSET_REFERENCE_INVALID", "storageKeyに絶対パスは使えません。", `${errorPath}/output/storageKey`);
  const candidate = path.resolve(assetRoot, output.storageKey);
  const actual = await realpath(candidate).catch(() => null);
  expect(actual, "AI_ASSET_REFERENCE_INVALID", "Cropファイルが見つかりません。", `${errorPath}/output/storageKey`);
  const relative = path.relative(assetRoot, actual);
  expect(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "AI_ASSET_REFERENCE_INVALID", "Cropファイルがasset-root外を参照しています。", `${errorPath}/output/storageKey`);
  const fileStat = await stat(actual);
  expect(fileStat.isFile(), "AI_ASSET_REFERENCE_INVALID", "storageKeyは通常ファイルを参照する必要があります。", `${errorPath}/output/storageKey`);
  const bytes = await readFile(actual);
  expect(bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES, "AI_FIGURE_OUTPUT_INVALID", "図版は非空かつ10MiB以下である必要があります。", errorPath);
  expect(output.byteLength === bytes.length, "AI_FIGURE_OUTPUT_INVALID", "図版byteLengthが実ファイルと一致しません。", `${errorPath}/output/byteLength`);
  expect(IMAGE_MIME_TYPES.has(output.mimeType), "AI_FIGURE_OUTPUT_INVALID", "図版MIMEが不正です。", `${errorPath}/output/mimeType`);
  assertImageSignature(bytes, output.mimeType, errorPath);
  expect(Number.isInteger(output.width) && output.width > 0 && output.width <= MAX_IMAGE_EDGE, "AI_FIGURE_OUTPUT_INVALID", "図版widthが不正です。", `${errorPath}/output/width`);
  expect(Number.isInteger(output.height) && output.height > 0 && output.height <= MAX_IMAGE_EDGE, "AI_FIGURE_OUTPUT_INVALID", "図版heightが不正です。", `${errorPath}/output/height`);
  expect(output.width * output.height <= MAX_IMAGE_PIXELS, "AI_FIGURE_OUTPUT_INVALID", "図版が40MP上限を超えています。", errorPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  expect(typeof output.sha256 === "string" && output.sha256.toLowerCase() === digest, "AI_FIGURE_OUTPUT_INVALID", "図版SHA-256が実ファイルと一致しません。", `${errorPath}/output/sha256`);
  const id = createId();
  return {
    asset: {
      id,
      worksheetId,
      mimeType: output.mimeType,
      dataBase64: bytes.toString("base64"),
      width: output.width,
      height: output.height,
      createdAt: buildTimestamp,
    },
    assetId: id,
  };
}

function validateFigurePlacement(figure, errorPath) {
  expect(["block", "floatLeft", "floatRight"].includes(figure.placement), "AI_FIGURE_OUTPUT_INVALID", "図版placementが不正です。", `${errorPath}/placement`);
  const widths = figure.placement === "block" ? BLOCK_WIDTHS : FLOAT_WIDTHS;
  expect(widths.has(figure.widthPercent), "AI_FIGURE_OUTPUT_INVALID", "placementに対するwidthPercentが不正です。", `${errorPath}/widthPercent`);
  expect(typeof figure.alt === "string", "AI_FIGURE_OUTPUT_INVALID", "図版altが不正です。", `${errorPath}/alt`);
}

async function buildProblem(item, worksheetId, assetRoot, buildTimestamp, itemIndex) {
  const textbookAnswer = isObject(item.textbookAnswer) && item.textbookAnswer.status === "found"
    ? item.textbookAnswer.document
    : null;
  const mainDocument = item.subQuestionGroup
    ? mergeColoredDocuments(item.problemDocument, null)
    : mergeColoredDocuments(item.problemDocument, textbookAnswer);

  const mainBlock = {
    id: createId(),
    type: "richText",
    document: mainDocument,
    answerDocument: emptyDocument(),
  };
  const contents = [mainBlock];

  if (item.subQuestionGroup !== null) {
    expect(isObject(item.subQuestionGroup) && Array.isArray(item.subQuestionGroup.items) && item.subQuestionGroup.items.length > 0, "AI_SCHEMA_VALIDATION_FAILED", "小問構造が不正です。", `/items/${itemIndex}/subQuestionGroup`);
    contents.push({
      id: createId(),
      type: "subQuestionGroup",
      numbering: { format: item.subQuestionGroup.format },
      columns: item.subQuestionGroup.columns,
      items: item.subQuestionGroup.items.map((subQuestion) => ({
        id: createId(),
        numbering: { restartAt: null },
        content: mergeColoredDocuments(subQuestion.content, subQuestion.answerContent),
        answerContent: emptyDocument(),
        answerArea: null,
        solution: normalizeSolution(subQuestion.solution),
        width: subQuestion.width,
      })),
    });
  }

  let solution = normalizeSolution(item.finalExplanation);
  const assets = [];
  for (const [figureIndex, figure] of item.figures.entries()) {
    if (!isObject(figure) || figure.accepted !== true) continue;
    const errorPath = `/items/${itemIndex}/figures/${figureIndex}`;
    validateFigurePlacement(figure, errorPath);
    expect(["problem", "answer", "explanation"].includes(figure.purpose), "AI_FIGURE_OUTPUT_INVALID", "図版purposeが不正です。", `${errorPath}/purpose`);
    const loaded = await loadFigureAsset(figure, worksheetId, assetRoot, buildTimestamp, errorPath);
    assets.push(loaded.asset);
    if (figure.purpose === "problem") {
      contents.push({
        id: createId(),
        type: "image",
        assetId: loaded.assetId,
        alt: figure.alt,
        placement: figure.placement,
        widthPercent: figure.widthPercent,
      });
    } else {
      const imageRef = {
        type: "imageRef",
        attrs: {
          id: createId(),
          assetId: loaded.assetId,
          alt: figure.alt,
          placement: figure.placement,
          widthPercent: figure.widthPercent,
          ...(figure.purpose === "answer" ? { answerColor: true } : {}),
        },
      };
      if (figure.purpose === "answer") {
        mainBlock.document = appendBlockNode(mainBlock.document, imageRef);
      } else {
        solution = appendBlockNode(solution, imageRef);
      }
    }
  }

  return {
    problem: {
      id: createId(),
      type: "problem",
      kind: item.kind,
      numbering: { enabled: true, restartAt: null },
      contents,
      solution,
      pageBreakBefore: false,
      pageBreakAfter: false,
    },
    assets,
  };
}

async function buildFile(draft, acceptedItems, options, assetRoot) {
  const buildTimestamp = new Date().toISOString();
  const worksheetId = createId();
  const problems = [];
  const assets = [];
  for (const [index, item] of acceptedItems.entries()) {
    const built = await buildProblem(item, worksheetId, assetRoot, buildTimestamp, index);
    problems.push(built.problem);
    assets.push(...built.assets);
  }
  return {
    format: "math-worksheet",
    kind: "single",
    version: 1,
    exportedAt: buildTimestamp,
    worksheet: {
      schemaVersion: 1,
      id: worksheetId,
      title: options.title,
      pageSettings: structuredClone(options.pageSettings),
      header: {
        title: options.title,
        gradeField: options.header.gradeField,
        classField: options.header.classField,
        numberField: options.header.numberField,
        nameField: options.header.nameField,
        firstPageOnly: options.header.firstPageOnly,
      },
      problems,
      createdAt: buildTimestamp,
      updatedAt: buildTimestamp,
      deletedAt: null,
    },
    assets,
  };
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const draftPath = path.resolve(argumentsMap.draft);
  const outputPath = path.resolve(argumentsMap.output);
  expect(draftPath !== outputPath, "AI_SCHEMA_VALIDATION_FAILED", "Draftを出力先として上書きできません。", "/output");
  const assetRoot = await realpath(path.resolve(argumentsMap["asset-root"] ?? path.dirname(draftPath))).catch(() => null);
  expect(assetRoot, "AI_ASSET_REFERENCE_INVALID", "asset-rootが見つかりません。", "/asset-root");
  const rootStat = await stat(assetRoot);
  expect(rootStat.isDirectory(), "AI_ASSET_REFERENCE_INVALID", "asset-rootはディレクトリである必要があります。", "/asset-root");
  const existingOutput = await stat(outputPath).catch(() => null);
  expect(!existingOutput, "AI_SCHEMA_VALIDATION_FAILED", "出力先が既に存在します。別のパスを指定してください。", "/output");

  let draft;
  try {
    draft = JSON.parse(await readFile(draftPath, "utf8"));
  } catch (error) {
    throw new BuildError("AI_SCHEMA_VALIDATION_FAILED", `Draft JSONを読み取れません: ${error.message}`, "/draft");
  }

  const acceptedItems = validateGate(draft);
  const options = validateOptions(draft);
  const result = await buildFile(draft, acceptedItems, options, assetRoot);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  const byteLength = Buffer.byteLength(serialized, "utf8");
  expect(byteLength <= MAX_OUTPUT_BYTES, "AI_OUTPUT_TOO_LARGE", "生成JSONが100MiB上限を超えています。", "/");

  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    throw new BuildError("AI_SCHEMA_VALIDATION_FAILED", `候補JSONを書き込めません: ${error.message}`, "/output");
  }

  emit({
    ok: true,
    outputPath,
    byteLength,
    problemCount: result.worksheet.problems.length,
    assetCount: result.assets.length,
  }, 0);
}

main().catch((error) => {
  if (error instanceof BuildError) {
    emit({ ok: false, code: error.code, path: error.path, message: error.message }, 1);
    return;
  }
  emit({
    ok: false,
    code: "AI_SCHEMA_VALIDATION_FAILED",
    path: "",
    message: error instanceof Error ? error.message : String(error),
  }, 1);
});
