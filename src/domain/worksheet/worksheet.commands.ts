import { STRUCTURE_LIMITS } from "./structure-limits";
import type { BasicRichTextDocument, ContentBlock, ImageBlock, ImagePlacement, ImageWidthPercent, PageSettings, ProblemBlock, RichTextNode, SolutionRichTextDocument, SubQuestion, Worksheet, WorksheetHeader, } from "./worksheet";
import { createId, createProblem, createSubQuestion, emptySolutionDocument } from "./worksheet.defaults";
export type WorksheetCommandResult = {
    ok: true;
    worksheet: Worksheet;
} | {
    ok: false;
    worksheet: Worksheet;
    code: "STRUCTURE_LIMIT_EXCEEDED" | "NOT_FOUND" | "LAST_ITEM";
};
export type RichTextDocumentTarget = {
    kind: "solution";
} | {
    kind: "content";
    contentId: string;
    color?: "problem" | "answer";
} | {
    kind: "subQuestion";
    groupId: string;
    subQuestionId: string;
    field?: "content" | "answerArea";
    color?: "problem" | "answer";
};
type RichTextDocumentForTarget<T extends RichTextDocumentTarget> = T extends {
    kind: "solution";
} ? SolutionRichTextDocument : BasicRichTextDocument;
export type ImageReferenceUpdate = {
    assetId?: string;
    alt: string;
    placement: ImagePlacement;
    widthPercent: ImageWidthPercent;
};
const clone = (/**
 * cloneで必要な値を作成する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function cloneImplementation1<T>(value: T): T {
    return structuredClone(value);
});
/**
 * touchの対象となる状態を更新する。
 *
 * @param worksheet worksheetとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function touch(worksheet: Worksheet): Worksheet {
    worksheet.updatedAt = new Date().toISOString();
    return worksheet;
}
/**
 * replaceEntityIdsの対象となる状態を更新する。
 *
 * @param value 処理対象の値
 */
function replaceEntityIds(value: unknown): void {
    if (Array.isArray(value)) {
        value.forEach(replaceEntityIds);
        return;
    }
    if (!value || typeof value !== "object")
        return;
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
        if (key === "id" && typeof child === "string")
            record[key] = createId();
        else
            replaceEntityIds(child);
    }
}
/**
 * setWorksheetTitleの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function setWorksheetTitle(source: Worksheet, value: string): Worksheet {
    const worksheet = clone(source);
    const title = value.trim() || "無題のプリント";
    worksheet.title = title.slice(0, 100);
    worksheet.header.title = worksheet.title;
    return touch(worksheet);
}
/**
 * applyWorksheetSettingsの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param pageSettings pageSettingsとして使用する値
 * @param header headerとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function applyWorksheetSettings(source: Worksheet, pageSettings: PageSettings, header: Omit<WorksheetHeader, "title">): Worksheet {
    const worksheet = clone(source);
    worksheet.pageSettings = clone(pageSettings);
    worksheet.header = { ...clone(header), title: worksheet.title };
    return touch(worksheet);
}
/**
 * addProblemの対象となる要素を追加する。
 *
 * @param source sourceとして使用する値
 * @param afterProblemId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
export function addProblem(source: Worksheet, afterProblemId?: string | null): WorksheetCommandResult {
    if (source.problems.length >= STRUCTURE_LIMITS.problemsPerWorksheet) {
        return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
    }
    const worksheet = clone(source);
    const afterIndex = afterProblemId
        ? worksheet.problems.findIndex((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param problem problemとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItemIndex2(problem) {
            return problem.id === afterProblemId;
        }))
        : worksheet.problems.length - 1;
    const insertAt = afterIndex < 0 ? worksheet.problems.length : afterIndex + 1;
    worksheet.problems.splice(insertAt, 0, createProblem());
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * deleteProblemの対象となる要素を削除または解放する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
export function deleteProblem(source: Worksheet, problemId: string): WorksheetCommandResult {
    const worksheet = clone(source);
    const index = worksheet.problems.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param problem problemとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex3(problem) {
        return problem.id === problemId;
    }));
    if (index < 0)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    if (worksheet.problems.length <= 1)
        return { ok: false, worksheet: source, code: "LAST_ITEM" };
    worksheet.problems.splice(index, 1);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * duplicateProblemで必要な値を作成する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
export function duplicateProblem(source: Worksheet, problemId: string): WorksheetCommandResult {
    const worksheet = clone(source);
    const index = worksheet.problems.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param problem problemとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex4(problem) {
        return problem.id === problemId;
    }));
    if (index < 0)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    if (worksheet.problems.length >= STRUCTURE_LIMITS.problemsPerWorksheet) {
        return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
    }
    const copy = clone(worksheet.problems[index]!);
    replaceEntityIds(copy);
    worksheet.problems.splice(index + 1, 0, copy);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * moveProblemに必要な処理を実行する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param toIndex toIndexとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function moveProblem(source: Worksheet, problemId: string, toIndex: number): WorksheetCommandResult {
    const worksheet = clone(source);
    const fromIndex = worksheet.problems.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param problem problemとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex5(problem) {
        return problem.id === problemId;
    }));
    if (fromIndex < 0)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    const [problem] = worksheet.problems.splice(fromIndex, 1);
    worksheet.problems.splice(Math.max(0, Math.min(toIndex, worksheet.problems.length)), 0, problem!);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * updateProblemの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param change changeとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function updateProblem(source: Worksheet, problemId: string, change: (problem: ProblemBlock) => void): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem6(item) {
        return item.id === problemId;
    }));
    if (!problem)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    change(problem);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * addContentの対象となる要素を追加する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param content contentとして使用する値
 * @param afterContentId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
export function addContent(source: Worksheet, problemId: string, content: ContentBlock, afterContentId?: string | null): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem7(item) {
        return item.id === problemId;
    }));
    if (!problem)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    if (problem.contents.length >= STRUCTURE_LIMITS.contentBlocksPerProblem) {
        return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
    }
    const afterIndex = afterContentId
        ? problem.contents.findIndex((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItemIndex8(item) {
            return item.id === afterContentId;
        }))
        : problem.contents.length - 1;
    problem.contents.splice(afterIndex < 0 ? problem.contents.length : afterIndex + 1, 0, clone(content));
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * updateContentの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param contentId 対象を識別するID
 * @param change changeとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function updateContent(source: Worksheet, problemId: string, contentId: string, change: (content: ContentBlock) => void): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem9(item) {
        return item.id === problemId;
    }));
    const content = problem?.contents.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem10(item) {
        return item.id === contentId;
    }));
    if (!content)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    change(content);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * updateRichTextDocumentの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param target targetとして使用する値
 * @param change changeとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function updateRichTextDocument<T extends RichTextDocumentTarget>(source: Worksheet, problemId: string, target: T, change: (document: RichTextDocumentForTarget<T>) => void): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem11(item) {
        return item.id === problemId;
    }));
    if (!problem)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    if (target.kind === "solution") {
        problem.solution ??= emptySolutionDocument();
        change(problem.solution as RichTextDocumentForTarget<T>);
    }
    else if (target.kind === "content") {
        const content = problem.contents.find((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItem12(item) {
            return item.id === target.contentId;
        }));
        if (!content)
            return { ok: false, worksheet: source, code: "NOT_FOUND" };
        if (content.type === "richText" || content.type === "box") {
            change(content.document as RichTextDocumentForTarget<T>);
        }
        else if (content.type === "answerArea") {
            change(content.answerArea.document as RichTextDocumentForTarget<T>);
        }
        else if (content.type === "goal") {
            change(content.document as RichTextDocumentForTarget<T>);
        }
        else {
            return { ok: false, worksheet: source, code: "NOT_FOUND" };
        }
    }
    else {
        const group = problem.contents.find((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItem13(item) {
            return item.id === target.groupId;
        }));
        if (!group || group.type !== "subQuestionGroup") {
            return { ok: false, worksheet: source, code: "NOT_FOUND" };
        }
        const item = group.items.find((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param entry 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItem14(entry) {
            return entry.id === target.subQuestionId;
        }));
        if (!item)
            return { ok: false, worksheet: source, code: "NOT_FOUND" };
        if ((target.field ?? "content") === "answerArea") {
            if (!item.answerArea)
                return { ok: false, worksheet: source, code: "NOT_FOUND" };
            change(item.answerArea.document as RichTextDocumentForTarget<T>);
        }
        else {
            change(item.content as RichTextDocumentForTarget<T>);
        }
    }
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * 独立画像または本文・小問内の画像参照を、同じ操作で安全に更新する。
 *
 * @param source 更新前のプリント
 * @param problemId 画像を含む問題のID
 * @param imageId 更新する画像のID
 * @param target リッチテキスト内の画像である場合の文書位置
 * @param update 画像参照へ適用する変更内容
 * @returns 更新結果。対象が存在しない場合は失敗結果
 */
export function updateImageReference(source: Worksheet, problemId: string, imageId: string, target: RichTextDocumentTarget | null, update: ImageReferenceUpdate): WorksheetCommandResult {
    if (target) {
        let found = false;
        const result = updateRichTextDocument(source, problemId, target, (/**
         * updateRichTextDocumentへ渡す処理を実行する。
         *
         * @param document documentとして使用する値
         */
        function updateRichTextDocumentCallback15(document) {
            const index = document.content.findIndex((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param node 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItemIndex16(node) {
                return node.type === "imageRef" && node.attrs.id === imageId;
            }));
            if (index < 0)
                return;
            const current = document.content[index];
            if (!current || current.type !== "imageRef")
                return;
            document.content[index] = createUpdatedImageRef(current, update);
            found = true;
        }));
        if (found)
            return result;
        if (target.kind !== "solution" && target.color === "answer") {
            return updateLegacyAnswerImageReference(source, problemId, imageId, target, update);
        }
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    }
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem17(item) {
        return item.id === problemId;
    }));
    if (!problem)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    const index = problem.contents.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param content contentとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex18(content) {
        return content.type === "image" && content.id === imageId;
    }));
    const current = problem.contents[index];
    if (index < 0 || !current || current.type !== "image") {
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    }
    problem.contents[index] = createUpdatedImageBlock(current, update);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * updateLegacyAnswerImageReferenceの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param imageId 対象を識別するID
 * @param target targetとして使用する値
 * @param update updateとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function updateLegacyAnswerImageReference(source: Worksheet, problemId: string, imageId: string, target: Exclude<RichTextDocumentTarget, {
    kind: "solution";
}>, update: ImageReferenceUpdate): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem19(item) {
        return item.id === problemId;
    }));
    if (!problem)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    let document: BasicRichTextDocument | null = null;
    if (target.kind === "content") {
        const content = problem.contents.find((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItem20(item) {
            return item.id === target.contentId;
        }));
        if (content?.type === "richText" || content?.type === "box")
            document = content.answerDocument;
        else if (content?.type === "answerArea")
            document = content.answerArea.answerDocument;
    }
    else {
        const group = problem.contents.find((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItem21(item) {
            return item.id === target.groupId;
        }));
        const item = group?.type === "subQuestionGroup"
            ? group.items.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param entry 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItem22(entry) {
                return entry.id === target.subQuestionId;
            }))
            : null;
        document = (target.field ?? "content") === "answerArea"
            ? item?.answerArea?.answerDocument ?? null
            : item?.answerContent ?? null;
    }
    if (!document)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    const index = document.content.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex23(node) {
        return node.type === "imageRef" && node.attrs.id === imageId;
    }));
    const current = document.content[index];
    if (index < 0 || !current || current.type !== "imageRef") {
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    }
    document.content[index] = createUpdatedImageRef(current, update);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * createUpdatedImageBlockで必要な値を作成する。
 *
 * @param current 更新前または現在の状態
 * @param update updateとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createUpdatedImageBlock(current: ImageBlock, update: ImageReferenceUpdate): ImageBlock {
    const base = {
        id: current.id,
        type: "image" as const,
        assetId: update.assetId ?? current.assetId,
        alt: update.alt,
    };
    if (update.placement === "block") {
        return { ...base, placement: "block", widthPercent: update.widthPercent };
    }
    const widthPercent = Math.min(update.widthPercent, 50) as 25 | 33 | 50;
    return update.placement === "floatLeft"
        ? { ...base, placement: "floatLeft", widthPercent }
        : { ...base, placement: "floatRight", widthPercent };
}
/**
 * createUpdatedImageRefで必要な値を作成する。
 *
 * @param current 更新前または現在の状態
 * @param update updateとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createUpdatedImageRef(current: Extract<RichTextNode, {
    type: "imageRef";
}>, update: ImageReferenceUpdate): Extract<RichTextNode, {
    type: "imageRef";
}> {
    const base = {
        id: current.attrs.id,
        assetId: update.assetId ?? current.attrs.assetId,
        alt: update.alt,
        answerColor: current.attrs.answerColor,
    };
    if (update.placement === "block") {
        return { type: "imageRef", attrs: { ...base, placement: "block", widthPercent: update.widthPercent } };
    }
    const widthPercent = Math.min(update.widthPercent, 50) as 25 | 33 | 50;
    return update.placement === "floatLeft"
        ? { type: "imageRef", attrs: { ...base, placement: "floatLeft", widthPercent } }
        : { type: "imageRef", attrs: { ...base, placement: "floatRight", widthPercent } };
}
/**
 * deleteContentの対象となる要素を削除または解放する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param contentId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
export function deleteContent(source: Worksheet, problemId: string, contentId: string): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem24(item) {
        return item.id === problemId;
    }));
    if (!problem)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    const index = problem.contents.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param content contentとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex25(content) {
        return content.id === contentId;
    }));
    if (index < 0)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    problem.contents.splice(index, 1);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * moveContentに必要な処理を実行する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param contentId 対象を識別するID
 * @param delta deltaとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function moveContent(source: Worksheet, problemId: string, contentId: string, delta: -1 | 1): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem26(item) {
        return item.id === problemId;
    }));
    if (!problem)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    const from = problem.contents.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param content contentとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex27(content) {
        return content.id === contentId;
    }));
    if (from < 0)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    const to = Math.max(0, Math.min(from + delta, problem.contents.length - 1));
    if (from !== to) {
        const [content] = problem.contents.splice(from, 1);
        problem.contents.splice(to, 0, content!);
    }
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * setProblemSolutionの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param document documentとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function setProblemSolution(source: Worksheet, problemId: string, document: SolutionRichTextDocument | null): WorksheetCommandResult {
    return updateProblem(source, problemId, (/**
     * updateProblemへ渡す処理を実行する。
     *
     * @param problem problemとして使用する値
     */
    function updateProblemCallback28(problem) {
        problem.solution = document ? clone(document) : null;
    }));
}
/**
 * addSubQuestionの対象となる要素を追加する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param groupId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
export function addSubQuestion(source: Worksheet, problemId: string, groupId: string): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem29(item) {
        return item.id === problemId;
    }));
    const group = problem?.contents.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem30(item) {
        return item.id === groupId;
    }));
    if (!group || group.type !== "subQuestionGroup") {
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    }
    if (group.items.length >= STRUCTURE_LIMITS.subQuestionsPerGroup) {
        return { ok: false, worksheet: source, code: "STRUCTURE_LIMIT_EXCEEDED" };
    }
    group.items.push(createSubQuestion());
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * updateSubQuestionの対象となる状態を更新する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param groupId 対象を識別するID
 * @param subQuestionId 対象を識別するID
 * @param change changeとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function updateSubQuestion(source: Worksheet, problemId: string, groupId: string, subQuestionId: string, change: (item: SubQuestion) => void): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem31(item) {
        return item.id === problemId;
    }));
    const group = problem?.contents.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem32(item) {
        return item.id === groupId;
    }));
    if (!group || group.type !== "subQuestionGroup") {
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    }
    const item = group.items.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param entry 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem33(entry) {
        return entry.id === subQuestionId;
    }));
    if (!item)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    change(item);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * deleteSubQuestionの対象となる要素を削除または解放する。
 *
 * @param source sourceとして使用する値
 * @param problemId 対象を識別するID
 * @param groupId 対象を識別するID
 * @param subQuestionId 対象を識別するID
 * @returns 呼び出し元で使用する処理結果
 */
export function deleteSubQuestion(source: Worksheet, problemId: string, groupId: string, subQuestionId: string): WorksheetCommandResult {
    const worksheet = clone(source);
    const problem = worksheet.problems.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem34(item) {
        return item.id === problemId;
    }));
    const group = problem?.contents.find((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItem35(item) {
        return item.id === groupId;
    }));
    if (!group || group.type !== "subQuestionGroup")
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    const index = group.items.findIndex((/**
     * 検索条件に一致する要素か判定する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function findItemIndex36(item) {
        return item.id === subQuestionId;
    }));
    if (index < 0)
        return { ok: false, worksheet: source, code: "NOT_FOUND" };
    if (group.items.length <= 1)
        return { ok: false, worksheet: source, code: "LAST_ITEM" };
    group.items.splice(index, 1);
    return { ok: true, worksheet: touch(worksheet) };
}
/**
 * cloneWorksheetWithNewIdsで必要な値を作成する。
 *
 * @param source sourceとして使用する値
 * @param now nowとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
export function cloneWorksheetWithNewIds(source: Worksheet, now = new Date()): Worksheet {
    const worksheet = clone(source);
    replaceEntityIds(worksheet);
    const titleSuffix = "のコピー";
    worksheet.title = `${source.title.slice(0, Math.max(1, 100 - titleSuffix.length))}${titleSuffix}`;
    worksheet.header.title = worksheet.title;
    worksheet.createdAt = now.toISOString();
    worksheet.updatedAt = worksheet.createdAt;
    worksheet.deletedAt = null;
    return worksheet;
}
