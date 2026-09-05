import { z } from "zod";
export const UI_PREFERENCES_KEY = "math-worksheet:ui-preferences:v1";
const UiPreferencesSchema = z.strictObject({
    version: z.literal(1),
    paneRatio: z.number().min(0.35).max(0.65),
    zoom: z.union([
        z.number().min(0.25).max(2).refine((/**
         * refineへ渡す処理を実行する。
         *
         * @param value 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function refineCallback1(value) {
            return Math.abs(value * 20 - Math.round(value * 20)) < 1e-8;
        }), "Zoom must be set in 5% increments"),
        z.literal("fitWidth"),
        z.literal("fitPage"),
    ]),
    previewMode: z.enum(["questions", "withAnswers"]),
});
const LegacyUiPreferencesSchema = UiPreferencesSchema.extend({
    previewMode: z.literal("questionsAndAnswers"),
});
export type UiPreferences = z.infer<typeof UiPreferencesSchema>;
export const DEFAULT_UI_PREFERENCES: UiPreferences = {
    version: 1,
    paneRatio: 704 / 1440,
    zoom: 1,
    previewMode: "questions",
};
/**
 * loadUiPreferencesで必要な値を取得する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
export function loadUiPreferences(): UiPreferences {
    try {
        const value = localStorage.getItem(UI_PREFERENCES_KEY);
        if (!value)
            return DEFAULT_UI_PREFERENCES;
        const parsed = z.union([UiPreferencesSchema, LegacyUiPreferencesSchema]).safeParse(JSON.parse(value));
        if (!parsed.success)
            return DEFAULT_UI_PREFERENCES;
        return parsed.data.previewMode === "questionsAndAnswers"
            ? { ...parsed.data, previewMode: "questions" }
            : parsed.data;
    }
    catch {
        return DEFAULT_UI_PREFERENCES;
    }
}
/**
 * saveUiPreferencesの対象となるデータを保存または出力する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
export function saveUiPreferences(value: UiPreferences): boolean {
    try {
        localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(UiPreferencesSchema.parse(value)));
        return true;
    }
    catch {
        return false;
    }
}
