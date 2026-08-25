import type { ManualChapterManifestItem, ManualMetadata } from "./manual-types";

export const MANUAL_METADATA = {
  manualVersion: "1.1",
  targetAppVersion: "1.0.0",
  licenseName: "個人・非商用ソフトウェアライセンス",
  licenseVersion: "1.0",
  copyright: "Copyright © 2026 Yamahara Yoshihiro",
  licenseContact: "yoshihiro@yamahara.email",
  updatedAt: "2026-08-25",
} as const satisfies ManualMetadata;

export const MANUAL_CHAPTER_MANIFEST = [
  {
    slug: "overview",
    title: "はじめに・動作環境",
    summary: "このアプリでできること、利用できるパソコン、データの保存場所を説明します。",
    keywords: ["はじめに", "動作環境", "ブラウザ", "保存先", "クラウド", "PC", "初心者"],
    updatedAt: "2026-08-22",
  },
  {
    slug: "getting-started",
    title: "最初のプリントを作る",
    summary: "新規作成、解答欄、PDF保存、最初のバックアップを順番に説明します。",
    keywords: ["初心者", "新規作成", "使い方", "PDF", "手順", "クリック", "最初"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "worksheet-list",
    title: "プリント一覧",
    summary: "プリントの検索、新規作成、複製、JSON出力、ゴミ箱への移動を説明します。",
    keywords: ["一覧", "検索", "複製", "インポート", "エクスポート", "メニュー", "2000件"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "editor-basics",
    title: "編集の基本",
    summary: "編集画面の見方と、問題・内容・小問・教師用解説の操作を説明します。",
    keywords: ["編集", "問題", "例題", "小問", "解答欄", "改ページ", "並べ替え", "内容を追加"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "formulas",
    title: "数式",
    summary: "数式の入力、記号ボタン、文字サイズ、再編集、表セル内数式を説明します。",
    keywords: ["数式", "MathLive", "LaTeX", "分数", "平方根", "表セル", "行内数式", "独立数式"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "images-and-tables",
    title: "画像と表",
    summary: "画像の選び方・配置・差し替えと、表の作成・セル編集を説明します。",
    keywords: ["画像", "PNG", "JPEG", "WebP", "表", "セル結合", "行列", "行高", "列幅", "代替テキスト"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "answers",
    title: "問題色・解答色と教師用の解説",
    summary: "問題色・解答色、生徒用解答欄、教師用解説、3つの出力モードを説明します。",
    keywords: ["正解", "解答", "問題色", "解答色", "赤", "黒", "解説", "教師用", "生徒用", "解答欄"],
    updatedAt: "2026-08-23",
  },
  {
    slug: "preview-and-pdf",
    title: "プリント設定・プレビュー・PDF",
    summary: "用紙・氏名欄の設定、プレビュー、ページ分割、PDF保存と印刷を説明します。",
    keywords: ["用紙", "余白", "ヘッダー", "年組番名前", "プレビュー", "倍率", "PDF", "印刷", "ページ"],
    updatedAt: "2026-08-23",
  },
  {
    slug: "saving-and-history",
    title: "保存と操作履歴",
    summary: "自動保存の表示、保存失敗時の対応、元に戻す・やり直すを説明します。",
    keywords: ["保存", "自動保存", "未保存", "保存中", "再試行", "履歴", "元に戻す", "やり直す", "ショートカット"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "backup-and-trash",
    title: "バックアップとゴミ箱",
    summary: "JSONバックアップの保存と読込み、ゴミ箱からの復元、完全削除を説明します。",
    keywords: ["バックアップ", "JSON", "エクスポート", "インポート", "復元", "ゴミ箱", "完全削除", "データ移行", "ダウンロード"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "ai-skills",
    title: "AI Skillsの使い方",
    summary: "教科書PDFをAIで読み取り、確認後にMath Editor用JSONとして取り込む手順を説明します。",
    keywords: ["AI", "Skills", "Skill", "AIサービス", "AIエージェント", "ChatGPT", "Claude", "教科書", "PDF", "JSON", "取込", "インポート", "初心者", "math-editor-textbook-import"],
    updatedAt: "2026-08-25",
  },
  {
    slug: "troubleshooting",
    title: "トラブル対応・制約・ショートカット",
    summary: "開けない・保存できない・読込めない場合の対処、上限、キー操作をまとめます。",
    keywords: ["トラブル", "エラー", "制約", "上限", "ショートカット", "ページ切れ", "画像", "JSON", "見つからない"],
    updatedAt: "2026-08-21",
  },
  {
    slug: "version-and-license",
    title: "バージョンとライセンス",
    summary: "アプリ、マニュアル、ライセンスの版と、著作権・利用条件の確認先を説明します。",
    keywords: ["バージョン", "版", "ライセンス", "著作権", "Copyright", "商用利用", "組織利用", "再配布", "問い合わせ"],
    updatedAt: "2026-08-22",
  },
] as const satisfies readonly ManualChapterManifestItem[];

export type ManualChapterSlug = (typeof MANUAL_CHAPTER_MANIFEST)[number]["slug"];
