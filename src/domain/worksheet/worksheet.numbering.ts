import type { ProblemKind, ProblemNumberFormat, SubQuestionGroupBlock, SubQuestionNumberFormat, Worksheet } from "./worksheet";
/**
 * 問題・番号を比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value 表示形式・問題・番号で判定または変換する入力値
 * @param format 問題番号へ適用する表示形式
 * @returns Stringの結果として得た文字列。変換できない場合は関数固有の既定値
 */
export function formatProblemNumber(value: number, format: ProblemNumberFormat): string {
    switch (format) {
        case "plain":
            return String(value);
        case "dot":
            return `${value}.`;
        case "rightParen":
            return `${value})`;
        case "paren":
            return `(${value})`;
        case "bracket":
            return `[${value}]`;
        case "question":
            return `問${value}`;
    }
}
/**
 * 問題・Numbersを入力データまたは現在の状態から取り出す。
 *
 * @param worksheet 処理対象となるプリント
 * @returns 結果として得た文字列。変換できない場合は関数固有の既定値
 */
export function getProblemNumbers(worksheet: Worksheet): Map<string, string | null> {
    const current: Record<ProblemKind, number> = { problem: 0, example: 0 };
    const result = new Map<string, string | null>();
    for (const problem of worksheet.problems) {
        if (!problem.numbering.enabled) {
            result.set(problem.id, null);
            continue;
        }
        current[problem.kind] = problem.numbering.restartAt ?? current[problem.kind] + 1;
        result.set(problem.id, formatProblemNumber(current[problem.kind], worksheet.pageSettings.problemNumberFormat));
    }
    return result;
}
/**
 * 問題・Headingを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param kind 問題または例題の種別
 * @param number 表示やデータ生成に使う通し番号
 * @param format 問題番号へ適用する表示形式
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
export function formatProblemHeading(kind: ProblemKind, number: string, format: ProblemNumberFormat): string {
    if (format === "question") {
        return kind === "example" ? number.replace(/^問/u, "例") : number;
    }
    return `${kind === "example" ? "例" : "問"}${number}`;
}
/**
 * Sub・Question・番号を比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value 表示形式・Sub・Question・番号で判定または変換する入力値
 * @param format 問題番号へ適用する表示形式
 * @returns 値を埋め込んだ表示文字列として得た文字列。変換できない場合は関数固有の既定値
 */
export function formatSubQuestionNumber(value: number, format: SubQuestionNumberFormat): string {
    if (format === "dot")
        return `${value}.`;
    if (format === "circled" && value <= 20)
        return String.fromCodePoint(0x245f + value);
    if (format === "kana") {
        const kana = "アイウエオカキクケコサシスセソタチツテトナニヌネノ";
        return kana[value - 1] ?? `(${value})`;
    }
    return `(${value})`;
}
/**
 * Sub・Question・Numbersを入力データまたは現在の状態から取り出す。
 *
 * @param group 採番または表示をまとめる問題グループ
 * @param format 問題番号へ適用する表示形式
 * @returns 結果として得た文字列。変換できない場合は関数固有の既定値
 */
export function getSubQuestionNumbers(group: SubQuestionGroupBlock, format: SubQuestionNumberFormat = group.numbering.format): Map<string, string> {
    let current = 0;
    const result = new Map<string, string>();
    for (const item of group.items) {
        current = item.numbering.restartAt ?? current + 1;
        result.set(item.id, formatSubQuestionNumber(current, format));
    }
    return result;
}
