import type { ManualChapterManifestItem, ManualMetadata } from "./manual-types";

export const MANUAL_METADATA = {
  manualVersion: "1.0",
  targetAppVersion: "1.0.0",
  updatedAt: "2026-08-13",
} as const satisfies ManualMetadata;

export const MANUAL_CHAPTER_MANIFEST = [
  {
    slug: "overview",
    title: "はじめに・動作環境",
    summary: "保存場所と動作環境など、利用前に確認する内容です。",
    keywords: ["はじめに", "動作環境", "ブラウザ", "保存先", "クラウド", "PC"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "getting-started",
    title: "最初のプリントを作る",
    summary: "新規作成からPDF保存と最初のバックアップまでを順に説明します。",
    keywords: ["初心者", "新規作成", "使い方", "PDF", "手順"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "worksheet-list",
    title: "プリント一覧",
    summary: "プリントの検索、複製、入出力、ゴミ箱への移動を説明します。",
    keywords: ["一覧", "検索", "複製", "インポート", "エクスポート"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "editor-basics",
    title: "編集の基本",
    summary: "問題や内容の追加、編集、移動と、編集画面の基本操作を説明します。",
    keywords: ["編集", "問題", "小問", "解答欄", "改ページ", "Undo", "Redo"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "formulas",
    title: "数式",
    summary: "行内・独立数式の入力、再編集、表セル内数式を説明します。",
    keywords: ["数式", "MathLive", "LaTeX", "分数", "平方根", "表セル"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "images-and-tables",
    title: "画像と表",
    summary: "画像の制限と配置、表のテンプレートや構造編集を説明します。",
    keywords: ["画像", "PNG", "JPEG", "WebP", "表", "セル結合", "行列"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "answers",
    title: "問題色・解答色と教師用の解説",
    summary: "問題色・解答色、教師用の解説、生徒用解答欄や出力モードの違いを説明します。",
    keywords: ["正解", "解説", "教師用", "生徒用", "解答欄"],
    updatedAt: "2026-08-17",
  },
  {
    slug: "preview-and-pdf",
    title: "プリント設定・プレビュー・PDF",
    summary: "用紙設定、プレビューの確認方法、PDF出力を説明します。",
    keywords: ["用紙", "余白", "ヘッダー", "プレビュー", "倍率", "PDF", "印刷"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "saving-and-history",
    title: "保存と操作履歴",
    summary: "自動保存のタイミング、保存状態、元に戻す・やり直すを説明します。",
    keywords: ["保存", "自動保存", "履歴", "元に戻す", "やり直す", "ショートカット"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "backup-and-trash",
    title: "バックアップとゴミ箱",
    summary: "JSONバックアップ、インポート、復元、完全削除を説明します。",
    keywords: ["バックアップ", "JSON", "復元", "ゴミ箱", "完全削除", "データ移行"],
    updatedAt: "2026-08-13",
  },
  {
    slug: "troubleshooting",
    title: "トラブル対応・制約・ショートカット",
    summary: "よくある問題への対処、現在の制約、キーボード操作をまとめます。",
    keywords: ["トラブル", "エラー", "制約", "上限", "ショートカット", "ページ切れ"],
    updatedAt: "2026-08-13",
  },
] as const satisfies readonly ManualChapterManifestItem[];

export type ManualChapterSlug = (typeof MANUAL_CHAPTER_MANIFEST)[number]["slug"];
