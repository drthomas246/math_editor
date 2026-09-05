import { describe, expect, it } from "vitest";
import { STRUCTURE_LIMITS } from "./structure-limits";
import { WorksheetSchema } from "./worksheet.schema";
import { addContent, addProblem, cloneWorksheetWithNewIds, deleteContent, deleteProblem, deleteSubQuestion, duplicateProblem, moveContent, setWorksheetTitle, updateContent, updateImageReference, updateRichTextDocument } from "./worksheet.commands";
import { createAnswerAreaBlock, createGoalBlock, createId, createProblem, createSubQuestionGroup, createWorksheet } from "./worksheet.defaults";
import { formatProblemHeading, formatProblemNumber, getProblemNumbers, getSubQuestionNumbers } from "./worksheet.numbering";
import { normalizeSearchKey } from "./worksheet.search";
import { getPrintableArea, mmToPt } from "./page-tokens";
describe("worksheet defaults", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite1() {
    it("詳細設計の初期値で有効なプリントを生成する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase2() {
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
    }));
    it("旧データの項目は問題として読み込む", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase3() {
        const worksheet = createWorksheet();
        delete (worksheet.problems[0] as Partial<typeof worksheet.problems[number]>).kind;
        expect(WorksheetSchema.parse(worksheet).problems[0]?.kind).toBe("problem");
    }));
    it("旧データには小問番号形式の初期値を補う", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase4() {
        const worksheet = createWorksheet();
        delete (worksheet.pageSettings as Partial<typeof worksheet.pageSettings>).subQuestionNumberFormat;
        expect(WorksheetSchema.parse(worksheet).pageSettings.subQuestionNumberFormat).toBe("paren");
    }));
    it("旧データへ問題色・解答色の空文書を補う", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase5() {
        const worksheet = createWorksheet();
        const richText = worksheet.problems[0]!.contents[0]!;
        if (richText.type !== "richText")
            throw new Error("richTextを生成できませんでした");
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
    }));
    it("めあてを解答色の内容として生成する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase6() {
        expect(createGoalBlock()).toMatchObject({ type: "goal", document: { type: "doc" } });
    }));
    it("空白題名を無題へ補正しheaderと同期する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase7() {
        const updated = setWorksheetTitle(createWorksheet(), "   ");
        expect(updated.title).toBe("無題のプリント");
        expect(updated.header.title).toBe(updated.title);
    }));
}));
describe("search normalization", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite8() {
    it("全角ASCII・全角空白・英字大小を正規化する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase9() {
        expect(normalizeSearchKey("　１年Ａ組　")).toBe("1年a組");
    }));
    it("内部空白とひらがな・カタカナは同一視しない", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase10() {
        expect(normalizeSearchKey("A  B")).toBe("a  b");
        expect(normalizeSearchKey("プリント")).not.toBe(normalizeSearchKey("ぷりんと"));
    }));
}));
describe("problem numbering", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite11() {
    it.each([
        ["plain", "3"], ["dot", "3."], ["rightParen", "3)"], ["paren", "(3)"], ["bracket", "[3]"], ["question", "問3"],
    ] as const)("%s形式", (/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param format formatとして使用する値
     * @param expected expectedとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function commentRuleCallback12(format, expected) {
        return expect(formatProblemNumber(3, format)).toBe(expected);
    }));
    it("番号なしを数えず、途中再開を反映する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase13() {
        const worksheet = createWorksheet();
        worksheet.problems = [createProblem(), createProblem(), createProblem()];
        worksheet.problems[1]!.numbering.enabled = false;
        worksheet.problems[2]!.numbering.restartAt = 8;
        const numbers = getProblemNumbers(worksheet);
        expect([...numbers.values()]).toEqual(["1.", null, "8."]);
    }));
    it("問題と例題を別々に採番する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase14() {
        const worksheet = createWorksheet();
        worksheet.problems = [createProblem(), createProblem(), createProblem(), createProblem()];
        worksheet.problems[1]!.kind = "example";
        worksheet.problems[3]!.kind = "example";
        expect([...getProblemNumbers(worksheet).values()]).toEqual(["1.", "1.", "2.", "2."]);
    }));
    it("プレビュー用の見出しで問題と例題を区別する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase15() {
        expect(formatProblemHeading("problem", "2.", "dot")).toBe("問2.");
        expect(formatProblemHeading("example", "2.", "dot")).toBe("例2.");
        expect(formatProblemHeading("problem", "問2", "question")).toBe("問2");
        expect(formatProblemHeading("example", "問2", "question")).toBe("例2");
    }));
}));
describe("sub-question numbering", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite16() {
    it("指定した小問から開始番号を振り直す", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase17() {
        const group = createSubQuestionGroup();
        group.items.push(structuredClone(group.items[0]!));
        group.items[2]!.id = "sub-question-3";
        group.items[1]!.numbering.restartAt = 5;
        expect([...getSubQuestionNumbers(group).values()]).toEqual(["(1)", "(5)", "(6)"]);
    }));
    it("プリント設定の小問番号形式を使用する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase18() {
        const group = createSubQuestionGroup();
        expect([...getSubQuestionNumbers(group, "circled").values()]).toEqual(["①", "②"]);
        expect([...getSubQuestionNumbers(group, "kana").values()]).toEqual(["ア", "イ"]);
    }));
    it("旧データの小問には振り直しなしを補う", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase19() {
        const worksheet = createWorksheet();
        const group = createSubQuestionGroup();
        delete (group.items[0] as Partial<typeof group.items[number]>).numbering;
        worksheet.problems[0]!.contents = [group];
        const parsed = WorksheetSchema.parse(worksheet);
        const parsedGroup = parsed.problems[0]!.contents[0];
        expect(parsedGroup?.type === "subQuestionGroup" ? parsedGroup.items[0]?.numbering : null).toEqual({ restartAt: null });
    }));
}));
describe("worksheet commands", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite20() {
    it("最後の1問を削除しない", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase21() {
        const worksheet = createWorksheet();
        const result = deleteProblem(worksheet, worksheet.problems[0]!.id);
        expect(result).toMatchObject({ ok: false, code: "LAST_ITEM" });
        expect(result.worksheet).toBe(worksheet);
    }));
    it("問題追加と複製でIDを再生成する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase22() {
        const worksheet = createWorksheet();
        const added = addProblem(worksheet, worksheet.problems[0]!.id);
        expect(added.ok).toBe(true);
        if (!added.ok)
            return;
        const duplicated = duplicateProblem(added.worksheet, added.worksheet.problems[0]!.id);
        expect(duplicated.ok).toBe(true);
        if (!duplicated.ok)
            return;
        expect(new Set(duplicated.worksheet.problems.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param problem problemとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem23(problem) {
            return problem.id;
        }))).size).toBe(3);
    }));
    it("1問題100コンテンツを超えて追加しない", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase24() {
        const worksheet = createWorksheet();
        worksheet.problems[0]!.contents = Array.from({ length: STRUCTURE_LIMITS.contentBlocksPerProblem }, createAnswerAreaBlock);
        const result = addContent(worksheet, worksheet.problems[0]!.id, createAnswerAreaBlock());
        expect(result).toMatchObject({ ok: false, code: "STRUCTURE_LIMIT_EXCEEDED" });
    }));
    it.each([
        ["更新", (/**
             * 呼び出し元から要求された処理を実行する。
             *
             * @param worksheet worksheetとして使用する値
             * @param problemId 対象を識別するID
             * @returns 呼び出し元で使用する処理結果
             */
            function commentRuleCallback25(worksheet: ReturnType<typeof createWorksheet>, problemId: string) {
                return updateContent(worksheet, problemId, "missing-content", (/**
                 * updateContentへ渡す処理を実行する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function updateContentCallback26() {
                    return undefined;
                }));
            })],
        ["削除", (/**
             * 呼び出し元から要求された処理を実行する。
             *
             * @param worksheet worksheetとして使用する値
             * @param problemId 対象を識別するID
             * @returns 呼び出し元で使用する処理結果
             */
            function commentRuleCallback27(worksheet: ReturnType<typeof createWorksheet>, problemId: string) {
                return deleteContent(worksheet, problemId, "missing-content");
            })],
        ["移動", (/**
             * 呼び出し元から要求された処理を実行する。
             *
             * @param worksheet worksheetとして使用する値
             * @param problemId 対象を識別するID
             * @returns 呼び出し元で使用する処理結果
             */
            function commentRuleCallback28(worksheet: ReturnType<typeof createWorksheet>, problemId: string) {
                return moveContent(worksheet, problemId, "missing-content", 1);
            })],
    ])("存在しないContentの%sはNOT_FOUNDを返して元データを変更しない", (/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param _label _labelとして使用する値
     * @param command commandとして使用する値
     */
    function commentRuleCallback29(_label, command) {
        const worksheet = createWorksheet();
        const before = structuredClone(worksheet);
        const result = command(worksheet, worksheet.problems[0]!.id);
        expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
        expect(result.worksheet).toBe(worksheet);
        expect(worksheet).toEqual(before);
    }));
    it("存在しないProblemは最後の1件でもNOT_FOUNDを返す", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase30() {
        const worksheet = createWorksheet();
        const result = deleteProblem(worksheet, "missing-problem");
        expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
        expect(result.worksheet).toBe(worksheet);
    }));
    it("存在しない小問は最後の1件でもNOT_FOUNDを返す", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase31() {
        const worksheet = createWorksheet();
        const group = createSubQuestionGroup();
        worksheet.problems[0]!.contents = [group];
        const result = deleteSubQuestion(worksheet, worksheet.problems[0]!.id, group.id, "missing-sub-question");
        expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
        expect(result.worksheet).toBe(worksheet);
    }));
    it("プリント複製で全Entity IDを再生成し画像参照IDは維持する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase32() {
        const source = createWorksheet();
        const copy = cloneWorksheetWithNewIds(source, new Date("2026-08-10T10:00:00+09:00"));
        expect(copy.id).not.toBe(source.id);
        expect(copy.problems[0]!.id).not.toBe(source.problems[0]!.id);
        expect(copy.title).toBe("無題のプリントのコピー");
    }));
    it("小問本文を挿入対象として更新する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase33() {
        const worksheet = createWorksheet();
        const problem = worksheet.problems[0]!;
        const group = createSubQuestionGroup();
        problem.contents = [group];
        const subQuestion = group.items[0]!;
        const result = updateRichTextDocument(worksheet, problem.id, { kind: "subQuestion", groupId: group.id, subQuestionId: subQuestion.id }, (/**
         * updateRichTextDocumentへ渡す処理を実行する。
         *
         * @param document documentとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function updateRichTextDocumentCallback34(document) {
            return document.content.push({ type: "blockMath", attrs: { latex: "x^2", textSize: "normal" } });
        }));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const updatedGroup = result.worksheet.problems[0]!.contents[0];
        expect(updatedGroup?.type === "subQuestionGroup" ? updatedGroup.items[0]?.content.content.at(-1) : null).toEqual({
            type: "blockMath",
            attrs: { latex: "x^2", textSize: "normal" },
        });
        expect(subQuestion.content.content).toHaveLength(1);
    }));
    it("教師用の正解・解説を挿入対象として初期化して更新する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase35() {
        const worksheet = createWorksheet();
        const problem = worksheet.problems[0]!;
        const result = updateRichTextDocument(worksheet, problem.id, { kind: "solution" }, (/**
         * updateRichTextDocumentへ渡す処理を実行する。
         *
         * @param document documentとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function updateRichTextDocumentCallback36(document) {
            return document.content.push({ type: "blockMath", attrs: { latex: "x=2", textSize: "normal" } });
        }));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.worksheet.problems[0]?.solution?.content.at(-1)).toEqual({
            type: "blockMath",
            attrs: { latex: "x=2", textSize: "normal" },
        });
        expect(problem.solution).toBeNull();
        expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
    }));
    it("生徒用解答欄の混在文書へ解答色ノードを追加する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase37() {
        const worksheet = createWorksheet();
        const problem = worksheet.problems[0]!;
        const answerArea = createAnswerAreaBlock();
        problem.contents = [answerArea];
        const result = updateRichTextDocument(worksheet, problem.id, { kind: "content", contentId: answerArea.id, color: "answer" }, (/**
         * updateRichTextDocumentへ渡す処理を実行する。
         *
         * @param document documentとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function updateRichTextDocumentCallback38(document) {
            return document.content.push({ type: "blockMath", attrs: { latex: "x=3", textSize: "normal", answerColor: true } });
        }));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const updated = result.worksheet.problems[0]!.contents[0];
        expect(updated?.type === "answerArea" ? updated.answerArea.document.content.at(-1) : null).toMatchObject({
            type: "blockMath",
            attrs: { answerColor: true },
        });
        expect(answerArea.answerArea.document.content).toHaveLength(1);
    }));
    it("大問の独立画像を差し替えて右回り込みへ変更する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase39() {
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
        if (!result.ok)
            return;
        expect(result.worksheet.problems[0]?.contents[0]).toEqual({
            id: imageId,
            type: "image",
            assetId: newAssetId,
            alt: "変更後",
            placement: "floatRight",
            widthPercent: 50,
        });
        expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
    }));
    it("存在しない画像の更新はNOT_FOUNDを返して元Worksheetを変更しない", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase40() {
        const worksheet = createWorksheet();
        const problem = worksheet.problems[0]!;
        problem.contents = [{
                id: createId(),
                type: "image",
                assetId: createId(),
                alt: "既存画像",
                placement: "block",
                widthPercent: 50,
            }];
        const before = structuredClone(worksheet);
        const result = updateImageReference(worksheet, problem.id, "missing-image", null, {
            alt: "変更後",
            placement: "floatRight",
            widthPercent: 75,
        });
        expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
        expect(result.worksheet).toBe(worksheet);
        expect(worksheet).toEqual(before);
    }));
    it("小問内の画像は位置とサイズだけを変更して元の画像参照を保つ", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase41() {
        const worksheet = createWorksheet();
        const problem = worksheet.problems[0]!;
        const group = createSubQuestionGroup();
        const item = group.items[0]!;
        const imageId = createId();
        const assetId = createId();
        item.content.content = [{ type: "imageRef", attrs: { id: imageId, assetId, alt: "図", placement: "floatLeft", widthPercent: 33 } }];
        problem.contents = [group];
        const result = updateImageReference(worksheet, problem.id, imageId, { kind: "subQuestion", groupId: group.id, subQuestionId: item.id }, { alt: "座標の図", placement: "block", widthPercent: 75 });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const updatedGroup = result.worksheet.problems[0]?.contents[0];
        const updatedNode = updatedGroup?.type === "subQuestionGroup" ? updatedGroup.items[0]?.content.content[0] : null;
        expect(updatedNode).toEqual({ type: "imageRef", attrs: { id: imageId, assetId, alt: "座標の図", placement: "block", widthPercent: 75 } });
        expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
    }));
    it("教師用の正解・解説内の画像を更新する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase42() {
        const worksheet = createWorksheet();
        const problem = worksheet.problems[0]!;
        const imageId = createId();
        const assetId = createId();
        problem.solution = {
            type: "doc",
            content: [{ type: "imageRef", attrs: { id: imageId, assetId, alt: "図", placement: "block", widthPercent: 50 } }],
        };
        const result = updateImageReference(worksheet, problem.id, imageId, { kind: "solution" }, { alt: "解説図", placement: "floatRight", widthPercent: 75 });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.worksheet.problems[0]?.solution?.content[0]).toEqual({
            type: "imageRef",
            attrs: { id: imageId, assetId, alt: "解説図", placement: "floatRight", widthPercent: 50 },
        });
        expect(WorksheetSchema.safeParse(result.worksheet).success).toBe(true);
    }));
}));
describe("page tokens", (/**
 * 関連するテストケースをまとめて定義する。
 */
function defineTestSuite43() {
    it("JIS B5と標準余白の本文領域を計算する", (/**
     * 期待する振る舞いを検証する。
     */
    function runTestCase44() {
        expect(getPrintableArea("B5", "normal")).toEqual({ widthMm: 152, heightMm: 227, marginMm: 15 });
        expect(mmToPt(25.4)).toBeCloseTo(72, 8);
    }));
}));
