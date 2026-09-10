import type { ManualChapterSlug } from "./manual-manifest";
// 画面上の操作対象から、案内すべきマニュアル章を特定するための対応表。
export type ManualTopic = "overview" | "editorBasics" | "worksheetSettings" | "pdf" | "formula" | "image" | "table" | "answers" | "saving" | "backup" | "trash" | "troubleshooting";
export const MANUAL_TOPIC_CHAPTERS = {
    overview: "overview",
    editorBasics: "editor-basics",
    worksheetSettings: "preview-and-pdf",
    pdf: "preview-and-pdf",
    formula: "formulas",
    image: "images-and-tables",
    table: "images-and-tables",
    answers: "answers",
    saving: "saving-and-history",
    backup: "backup-and-trash",
    trash: "backup-and-trash",
    troubleshooting: "troubleshooting",
} as const satisfies Record<ManualTopic, ManualChapterSlug>;
