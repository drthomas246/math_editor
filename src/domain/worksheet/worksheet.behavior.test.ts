import { describe, expect, it } from "vitest";

import { STRUCTURE_LIMITS } from "./structure-limits";
import { WorksheetSchema } from "./worksheet.schema";
import { addContent, addProblem, cloneWorksheetWithNewIds, deleteProblem, duplicateProblem, setWorksheetTitle, updateImageReference, updateRichTextDocument } from "./worksheet.commands";
import { createAnswerAreaBlock, createGoalBlock, createId, createProblem, createSubQuestionGroup, createWorksheet } from "./worksheet.defaults";
import { formatProblemHeading, formatProblemNumber, getProblemNumbers, getSubQuestionNumbers } from "./worksheet.numbering";
import { normalizeSearchKey } from "./worksheet.search";
import { getPrintableArea, mmToPt } from "./page-tokens";

describe("worksheet defaults", () => {
  it("詳細設計の初期値で有効なプリントを生成する", () => {
    const worksheet = createWorksheet(new Date("2026-08-10T09:00:00+09:00"));
    expect(WorksheetSchema.safeParse(worksheet).success).toBe(true);
    expect(worksheet).toMatchObject({
      title: "無題のプリント",
      pageSettings: { size: "B5", margin: "normal", fontFamily: "biz-udp-gothic", problemNumberFormat: "dot", subQuestionNumberFormat: "paren" },
      header: { gradeField: true, classField: true, numberField: true, nameField: true },
    });
    expect(worksheet.problems).toHaveLength(1);
    expect(worksheet.problems[0]?.kind).toBe("problem");
    expect(worksheet.problems[0]?.contents[0]?.type).toBe("richText");
  });

  it("旧データの項目は問題として読み込む", () => {
    const worksheet = createWorksheet();
    delete (worksheet.problems[0] as Partial<typeof worksheet.problems[number]>).kind;

    expect(WorksheetSchema.parse(worksheet).problems[0]?.kind).toBe("problem");
  });

  it("旧データには小問番号形式の初期値を補う", () => {
    const worksheet = createWorksheet();
    delete (worksheet.pageSettings as Partial<typeof worksheet.pageSettings>).subQuestionNumberFormat;

    expect(WorksheetSchema.parse(worksheet).pageSettings.subQuestionNumberFormat).toBe("paren");
  });

  it("旧データへ問題色・解答色の空文書を補う", () => {
    const worksheet = createWorksheet();
    const richText = worksheet.problems[0]!.contents[0]!;
    if (richText.type !== "richText") throw new Error("richTextを生成できませんでした");
    delete (richText as Partial<typeof richText>).answerDocument;

    const answerArea = createAnswerAreaBlock();
    delete (answerArea.answerArea as Partial<typeof answerArea.answerArea>).document;
    delete (answerArea.answerArea as Partial<typeof answerArea.answerArea>).answerDocument;
    const subQuestions = createSubQuestionGroup();
    delete (subQuestions.items[0] as Partial<typeof subQuestions.items[number]>).answerContent;
    worksheet.problems[0]!.contents.push(answerArea, subQuestions);

    const parsed = WorksheetSchema.parse(worksheet);
    const parsedRichText = parsed.problems[0]!.contents[0];
    const parsedAnswerArea = parsed.problems[0]!.contents[1];
    const parsedSubQuestions = parsed.problems[0]!.contents[2];
    expect(parsedRichText?.type === "richText" ? parsedRichText.answerDocument.content : null).toHaveLength(1);
    expect(parsedAnswerArea?.type === "answerArea" ? parsedAnswerArea.answerArea.answerDocument.content : null).toHaveLength(1);
    expect(parsedSubQuestions?.type === "subQuestionGroup" ? parsedSubQuestions.items[0]?.answerContent.content : null).toHaveLength(1);
  });

  it("めあてを解答色の内容として生成する", () => {
    expect(createGoalBlock()).toMatchObject({ type: "goal", document: { type: "doc" } });
  });

  it("空白題名を無題へ補正しheaderと同期する", () => {
    const updated = setWorksheetTitle(createWorksheet(), "   ");
    expect(updated.title).toBe("無題のプリント");
    expect(updated.header.title).toBe(updated.title);
  });
});

describe("search normalization", () => {
  it("全角ASCII・全角空白・英字大小を正規化する", () => {
    expect(normalizeSearchKey("　１年Ａ組　")).toBe("1年a組");
  });

  it("内部空白とひらがな・カタカナは同一視しない", () => {
    expect(normalizeSearchKey("A  B")).toBe("a  b");
    expect(normalizeSearchKey("プリント")).not.toBe(normalizeSearchKey("ぷりんと"));
  });
});

describe("problem numbering", () => {
  it.each([
    ["plain", "3"], ["dot", "3."], ["rightParen", "3)"], ["paren", "(3)"], ["bracket", "[3]"], ["question", "問3"],
  ] as const)("%s形式", (format, expected) => expect(formatProblemNumber(3, format)).toBe(expected));

  it("番号なしを数えず、途中再開を反映する", () => {
    const worksheet = createWorksheet();
    worksheet.problems = [createProblem(), createProblem(), createProblem()];
    worksheet.problems[1]!.numbering.enabled = false;
    worksheet.problems[2]!.numbering.restartAt = 8;
    const numbers = getProblemNumbers(worksheet);
    expect([...numbers.values()]).toEqual(["1.", null, "8."]);
  });

  it("問題と例題を別々に採番する", () => {
    const worksheet = createWorksheet();
    worksheet.problems = [createProblem(), createProblem(), createProblem(), createProblem()];
    worksheet.problems[1]!.kind = "example";
    worksheet.problems[3]!.kind = "example";

    expect([...getProblemNumbers(worksheet).values()]).toEqual(["1.", "1.", "2.", "2."]);
  });

  it("プレビュー用の見出しで問題と例題を区別する", () => {
    expect(formatProblemHeading("problem", "2.", "dot")).toBe("問2.");
    expect(formatProblemHeading("example", "2.", "dot")).toBe("例2.");
    expect(formatProblemHeading("problem", "問2", "question")).toBe("問2");
    expect(formatProblemHeading("example", "問2", "question")).toBe("例2");
  });
});

describe("sub-question numbering", () => {
  it("指定した小問から開始番号を振り直す", () => {
    const group = createSubQuestionGroup();
    group.items.push(structuredClone(group.items[0]!));
    group.items[2]!.id = "sub-question-3";
    group.items[1]!.numbering.restartAt = 5;

    expect([...getSubQuestionNumbers(group).values()]).toEqual(["(1)", "(5)", "(6)"]);
  });

  it("プリント設定の小問番号形式を使用する", () => {
    const group = createSubQuestionGroup();

    expect([...getSubQuestionNumbers(group, "circled").values()]).toEqual(["①", "②"]);
    expect([...getSubQuestionNumbers(group, "kana").values()]).toEqual(["ア", "イ"]);
  });

  it("旧データの小問には振り直しなしを補う", () => {
    const worksheet = createWorksheet();
    const group = createSubQuestionGroup();
    delete (group.items[0] as Partial<typeof group.items[number]>).numbering;
    worksheet.problems[0]!.contents = [group];

    const parsed = WorksheetSchema.parse(worksheet);
    const parsedGroup = parsed.problems[0]!.contents[0];
    expect(parsedGroup?.type === "subQuestionGroup" ? parsedGroup.items[0]?.numbering : null).toEqual({ restartAt: null });
  });
});

describe("worksheet commands", () => {
  it("最後の1問を削除しない", () => {
    const worksheet = createWorksheet();
    const result = deleteProblem(worksheet, worksheet.problems[0]!.id);
    expect(result).toMatchObject({ ok: false, code: "LAST_ITEM" });
    expect(result.worksheet).toBe(worksheet);
  });

  it("問題追加と複製でIDを再生成する", () => {
    const worksheet = createWorksheet();
    const added = addProblem(worksheet, worksheet.problems[0]!.id);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const duplicated = duplicateProblem(added.worksheet, added.worksheet.problems[0]!.id);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;
    expect(new Set(duplicated.worksheet.problems.map((problem) => problem.id)).size).toBe(3);
  });

  it("1問題100コンテンツを超えて追加しない", () => {
    const worksheet = createWorksheet();
    worksheet.problems[0]!.contents = Array.from({ length: STRUCTURE_LIMITS.contentBlocksPerProblem }, createAnswerAreaBlock);
    const result = addContent(worksheet, worksheet.problems[0]!.id, createAnswerAreaBlock());
    expect(result).toMatchObject({ ok: false, code: "STRUCTURE_LIMIT_EXCEEDED" });
  });

  it("プリント複製で全Entity IDを再生成し画像参照IDは維持する", () => {
    const source = createWorksheet();
    const copy = cloneWorksheetWithNewIds(source, new Date("2026-08-10T10:00:00+09:00"));
    expect(copy.id).not.toBe(source.id);
    expect(copy.problems[0]!.id).not.toBe(source.problems[0]!.id);
    expect(copy.title).toBe("無題のプリントのコピー");
  });

  it("小問本文を挿入対象として更新する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const group = createSubQuestionGroup();
    problem.contents = [group];
    const subQuestion = group.items[0]!;

    const result = updateRichTextDocument(
      worksheet,
      problem.id,
      { kind: "subQuestion", groupId: group.id, subQuestionId: subQuestion.id },
      (document) => document.content.push({ type: "blockMath", attrs: { latex: "x^2", textSize: "normal" } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updatedGroup = result.worksheet.problems[0]!.contents[0];
    expect(updatedGroup?.type === "subQuestionGroup" ? updatedGroup.items[0]?.content.content.at(-1) : null).toEqual({
      type: "blockMath",
      attrs: { latex: "x^2", textSize: "normal" },
    });
    expect(subQuestion.content.content).toHaveLength(1);
  });

  it("教師用の正解・解説を挿入対象として初期化して更新する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;

    const result = updateRichTextDocument(
      worksheet,
      problem.id,
      { kind: "solution" },
      (document) => document.content.push({ type: "blockMath", attrs: { latex: "x=2", textSize: "normal" } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.worksheet.problems[0]?.solution?.content.at(-1)).toEqual({
      type: "blockMath",
      attrs: { latex: "x=2", textSize: "normal" },
    });
    expect(problem.solution).toBeNull();
    expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
  });

  it("生徒用解答欄の混在文書へ解答色ノードを追加する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const answerArea = createAnswerAreaBlock();
    problem.contents = [answerArea];

    const result = updateRichTextDocument(
      worksheet,
      problem.id,
      { kind: "content", contentId: answerArea.id, color: "answer" },
      (document) => document.content.push({ type: "blockMath", attrs: { latex: "x=3", textSize: "normal", answerColor: true } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updated = result.worksheet.problems[0]!.contents[0];
    expect(updated?.type === "answerArea" ? updated.answerArea.document.content.at(-1) : null).toMatchObject({
      type: "blockMath",
      attrs: { answerColor: true },
    });
    expect(answerArea.answerArea.document.content).toHaveLength(1);
  });

  it("大問の独立画像を差し替えて右回り込みへ変更する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const imageId = createId();
    const oldAssetId = createId();
    const newAssetId = createId();
    problem.contents = [{ id: imageId, type: "image", assetId: oldAssetId, alt: "変更前", placement: "block", widthPercent: 75 }];

    const result = updateImageReference(worksheet, problem.id, imageId, null, {
      assetId: newAssetId,
      alt: "変更後",
      placement: "floatRight",
      widthPercent: 75,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.worksheet.problems[0]?.contents[0]).toEqual({
      id: imageId,
      type: "image",
      assetId: newAssetId,
      alt: "変更後",
      placement: "floatRight",
      widthPercent: 50,
    });
    expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
  });

  it("小問内の画像は位置とサイズだけを変更して元の画像参照を保つ", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const group = createSubQuestionGroup();
    const item = group.items[0]!;
    const imageId = createId();
    const assetId = createId();
    item.content.content = [{ type: "imageRef", attrs: { id: imageId, assetId, alt: "図", placement: "floatLeft", widthPercent: 33 } }];
    problem.contents = [group];

    const result = updateImageReference(
      worksheet,
      problem.id,
      imageId,
      { kind: "subQuestion", groupId: group.id, subQuestionId: item.id },
      { alt: "座標の図", placement: "block", widthPercent: 75 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updatedGroup = result.worksheet.problems[0]?.contents[0];
    const updatedNode = updatedGroup?.type === "subQuestionGroup" ? updatedGroup.items[0]?.content.content[0] : null;
    expect(updatedNode).toEqual({ type: "imageRef", attrs: { id: imageId, assetId, alt: "座標の図", placement: "block", widthPercent: 75 } });
    expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
  });

  it("教師用の正解・解説内の画像を更新する", () => {
    const worksheet = createWorksheet();
    const problem = worksheet.problems[0]!;
    const imageId = createId();
    const assetId = createId();
    problem.solution = {
      type: "doc",
      content: [{ type: "imageRef", attrs: { id: imageId, assetId, alt: "図", placement: "block", widthPercent: 50 } }],
    };

    const result = updateImageReference(
      worksheet,
      problem.id,
      imageId,
      { kind: "solution" },
      { alt: "解説図", placement: "floatRight", widthPercent: 75 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.worksheet.problems[0]?.solution?.content[0]).toEqual({
      type: "imageRef",
      attrs: { id: imageId, assetId, alt: "解説図", placement: "floatRight", widthPercent: 50 },
    });
    expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
  });
});

describe("page tokens", () => {
  it("JIS B5と標準余白の本文領域を計算する", () => {
    expect(getPrintableArea("B5", "normal")).toEqual({ widthMm: 152, heightMm: 227, marginMm: 15 });
    expect(mmToPt(25.4)).toBeCloseTo(72, 8);
  });
});
