import { z } from "zod";
export const UI_PREFERENCES_KEY = "math-worksheet:ui-preferences:v1";
const UiPreferencesSchema = z.strictObject({
    version: z.literal(1),
    paneRatio: z.number().min(0.35).max(0.65),
    zoom: z.union([
        z.number().min(0.25).max(2).refine((/**
         * refineをabsで処理し、その結果を呼び出し元へ反映する。
         *
         * @param value refineで判定または変換する入力値
         * @returns 二つの値を比較した結果
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
 * Ui・Preferencesを取得して利用可能な状態へ反映する。
 *
 * @returns 既定・UI・PREFERENCES
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
 * 要素をユーザー操作または非同期処理の結果に合わせて更新する。
 *
 * @param value 保存・Ui・Preferencesで判定または変換する入力値
 * @returns この実装では常にtrue
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
