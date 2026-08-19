import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import { MANUAL_TOPIC_CHAPTERS } from "../src/manual/manual-context";
import { MANUAL_CHAPTER_MANIFEST } from "../src/manual/manual-manifest";

const root = resolve(process.cwd(), "src/manual");
const contentDirectory = join(root, "content");
const assetsDirectory = join(root, "assets");
const slugs = new Set(MANUAL_CHAPTER_MANIFEST.map((chapter) => chapter.slug));
const errors: string[] = [];

if (slugs.size !== MANUAL_CHAPTER_MANIFEST.length) errors.push("章slugが重複しています。");

const registeredFiles = new Set<string>();
for (const chapter of MANUAL_CHAPTER_MANIFEST) {
  if (!/^[a-z][a-z0-9-]*$/u.test(chapter.slug)) errors.push(`${chapter.slug}: slug形式が不正です。`);
  if (!chapter.title.trim() || !chapter.summary.trim()) errors.push(`${chapter.slug}: 題名または概要が空です。`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(chapter.updatedAt)) errors.push(`${chapter.slug}: 更新日形式が不正です。`);
  if (new Set(chapter.keywords).size !== chapter.keywords.length || chapter.keywords.some((keyword) => !keyword.trim())) {
    errors.push(`${chapter.slug}: キーワードに空文字または重複があります。`);
  }

  const fileName = `${chapter.slug}.md`;
  registeredFiles.add(fileName);
  const filePath = join(contentDirectory, fileName);
  if (!existsSync(filePath)) {
    errors.push(`${fileName}: 本文ファイルがありません。`);
    continue;
  }
  const markdown = readFileSync(filePath, "utf8");
  if (!markdown.trim()) errors.push(`${fileName}: 本文が空です。`);
  if (/^#\s+/mu.test(markdown)) errors.push(`${fileName}: h1は使用できません。`);

  let previousDepth = 1;
  for (const match of markdown.matchAll(/^(#{2,6})\s+/gmu)) {
    const depth = match[1]?.length ?? 0;
    if (depth > previousDepth + 1) errors.push(`${fileName}: 見出し階層が飛んでいます。`);
    previousDepth = depth;
  }

  for (const match of markdown.matchAll(/\[[^\]]*\]\((\/help\/([a-z0-9-]+))\)/gu)) {
    const linkedSlug = match[2];
    if (linkedSlug && !slugs.has(linkedSlug as never)) errors.push(`${fileName}: 不明な章リンク ${match[1]} があります。`);
  }

  for (const match of markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/gu)) {
    const alt = match[1] ?? "";
    const source = match[2] ?? "";
    if (/^https?:\/\//iu.test(source)) errors.push(`${fileName}: 外部画像は使用できません。`);
    if (!source.startsWith("manual-assets/")) errors.push(`${fileName}: 画像参照形式が不正です。`);
    const assetName = basename(source);
    if (!/^[A-Za-z0-9._-]+$/u.test(assetName) || source.includes("..") || source.includes("\\")) {
      errors.push(`${fileName}: 安全でない画像名です。`);
    } else if (!existsSync(join(assetsDirectory, assetName))) {
      errors.push(`${fileName}: 画像 ${assetName} がありません。`);
    }
    if (!alt.trim()) errors.push(`${fileName}: 画像altを空にしないでください。`);
  }

  if (/<\/?(?:script|style|iframe|object|embed|div|span|img|a)\b[^>]*>/iu.test(markdown)) {
    errors.push(`${fileName}: 生HTMLまたは禁止タグがあります。`);
  }
}

const actualMarkdownFiles = readdirSync(contentDirectory)
  .filter((fileName) => extname(fileName).toLowerCase() === ".md");
for (const fileName of actualMarkdownFiles) {
  if (!registeredFiles.has(fileName)) errors.push(`${fileName}: マニフェストへ登録されていません。`);
}

for (const [topic, slug] of Object.entries(MANUAL_TOPIC_CHAPTERS)) {
  if (!slugs.has(slug)) errors.push(`${topic}: 文脈リンク先 ${slug} が存在しません。`);
}

if (errors.length > 0) {
  console.error(["マニュアル検証に失敗しました。", ...errors.map((error) => `- ${error}`)].join("\n"));
  process.exitCode = 1;
} else {
  console.log(`マニュアル${MANUAL_CHAPTER_MANIFEST.length}章の構成、リンク、本文を確認しました。`);
}
