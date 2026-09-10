import fs from "node:fs";
import path from "node:path";

export const TARGET_POLICY = {
  extensions: [".ts", ".tsx"],
  excludedDirectories: [".git", "node_modules", "dist", "coverage"],
  excludedPaths: ["scripts/fixtures/comment-rules", "scripts/fixtures/comment-change-scope"],
};

/**
 * OSの言語設定に依存せずパスの順序を固定する。
 * @param left 左側のパス
 * @param right 右側のパス
 * @returns 左が先なら負、同一なら0、右が先なら正
 */
export function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * 検査器と証跡検証で共通の対象条件を適用する。
 * @param file リポジトリ内の相対パス
 * @returns コメント検査対象ならtrue
 */
export function isCommentTarget(file) {
  const parts = file.split("/");
  return TARGET_POLICY.extensions.includes(path.posix.extname(file))
    && !parts.slice(0, -1).some(function isExcluded(part) {
      return TARGET_POLICY.excludedDirectories.includes(part);
    })
    && !TARGET_POLICY.excludedPaths.some(function isFixture(prefix) {
      return file.startsWith(`${prefix}/`);
    });
}

/**
 * 生成物と依存関係を除いてファイルを列挙する。リンク先は追跡しない。
 * @param root 探索するルートディレクトリ
 * @returns スラッシュ区切りの相対パス一覧
 */
export function listProjectFiles(root) {
  const files = [];
  /**
   * 子ディレクトリを走査する。
   * @param relative ルートからの相対ディレクトリ
   */
  function visit(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!TARGET_POLICY.excludedDirectories.includes(entry.name)) visit(file);
      } else {
        files.push(file);
      }
    }
  }
  visit("");
  return files.sort(comparePaths);
}

/**
 * 検査対象を絶対パスで列挙する。
 * @param root 探索するルートディレクトリ
 * @returns 対象TypeScriptファイルの絶対パス一覧
 */
export function collectTypeScriptFiles(root) {
  return listProjectFiles(root).filter(isCommentTarget).map(function absoluteFile(file) {
    const absolute = path.join(root, file);
    if (!fs.lstatSync(absolute).isFile()) throw new Error(`通常ファイルではありません: ${file}`);
    return absolute;
  });
}
