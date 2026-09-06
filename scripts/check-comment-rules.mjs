import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);
const GENERIC_PATTERNS = [
  /呼び出し元で使用する処理結果/u,
  /として使用する値/u,
  /に必要な処理を実行する/u,
  /に必要な値を取得する/u,
  /期待する振る舞いを検証する/u,
  /呼び出し元から要求された処理を実行する/u,
  /commentRuleCallback/u,
  /commentRuleThis/u,
  /parameter1/u,
  /処理対象の値/u,
  /表示や操作に必要な設定/u,
  /呼び出し元が画面へ組み込むReact要素/u,
  /必要な入力を渡し/u,
  /式から計算した値/u,
  /関数内の演算から導出した値/u,
  /後続処理が一貫して扱える結果/u,
  /不変条件を保つ/u,
  /子要素へ渡す編集操作/u,
  /・Callback/u,
  /更新前の状態から処理済みの要素を作り/u,
  /保留中だった非同期処理/u,
  /画面要素から(?:画面操作|クリック操作|入力変更|終了要求|挿入要求)/u,
  /作成または検証する要素種別.*一つの結果/u,
  /の変更を対象の編集データへ反映/u,
  /visitで定義された一連の処理/u,
  /renderの内容と操作/u,
  /条件成立後に実行する処理をsuper/u,
  /に必要な値を確定/u,
  /操作結果と一致する最新状態/u,
  /measureをレイアウトまたは性能判定/u,
  /現在の状態からrelease・Resources/u,
];
const ENGLISH_SECTION_NAMES = new Set([
  "State",
  "State and refs",
  "Store",
  "Effects",
  "Event handlers",
  "Render",
  "Asset operations",
  "Save and navigation",
  "Derived values",
  "Derived values and handlers",
  "Scroll sync",
  "Preview",
  "Helpers",
]);

/**
 * 検査対象ディレクトリを再帰走査し、TypeScriptソースだけを列挙する。
 *
 * @param directory 探索を開始する絶対ディレクトリ
 * @returns 除外ディレクトリを含まないTypeScriptファイルの絶対パス
 */
function collectTypeScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name) && entry.name !== ".git") {
        files.push(...collectTypeScriptFiles(path.join(directory, entry.name)));
      }
      continue;
    }
    if (/\.(?:ts|tsx)$/u.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files.sort(compareFilePaths);
}

/**
 * 検査対象ファイルを環境に依存しない順序へ並べる。
 *
 * @param left 左側のファイルパス
 * @param right 右側のファイルパス
 * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
 */
function compareFilePaths(left, right) {
  return left.localeCompare(right);
}

/**
 * ASTノードの開始位置を、一行目を1とするソース位置へ変換する。
 *
 * @param sourceFile 位置計算に使うソースファイル
 * @param node 行番号を取得するASTノード
 * @returns 報告へ表示する一行目基準の行番号
 */
function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * JSDocの@param名をTypeScript ASTの表現から文字列として取得する。
 *
 * @param tag 調査するJSDoc @paramタグ
 * @returns タグに書かれた引数名。名前を取得できない場合は空文字列
 */
function jsDocParameterName(tag) {
  return tag.name?.getText() ?? "";
}

/**
 * 関数引数を厳格比較できる単一の識別子名として取得する。
 *
 * @param parameter 調査する関数引数
 * @returns 引数名または分割代入で導入される識別子一覧
 */
function parameterNames(parameter) {
  /**
   * 引数の束縛名から実際に関数内へ導入される識別子を列挙する。
   *
   * @param name 調査する識別子または分割代入パターン
   * @returns 関数内で参照できる識別子一覧
   */
  function collectBindingNames(name) {
    if (ts.isIdentifier(name)) return [name.text];
    return name.elements.flatMap(function expandBindingElement(element) {
      if (ts.isOmittedExpression(element)) return [];
      return collectBindingNames(element.name);
    });
  }
  return collectBindingNames(parameter.name);
}

/**
 * 関数を直接引数として受け取る呼び出し名を取得する。
 *
 * @param node 呼び出し文脈を調べる関数ノード
 * @returns testやuseEffectなどの呼び出し名。該当しない場合は空文字列
 */
function containingCallName(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isCallExpression(current) && current.arguments.some(function containsFunction(argument) {
      return argument.pos <= node.pos && node.end <= argument.end;
    })) {
      if (ts.isIdentifier(current.expression)) return current.expression.text;
      if (ts.isPropertyAccessExpression(current.expression)) return current.expression.name.text;
      return "";
    }
    if (ts.isFunctionLike(current)) break;
    current = current.parent;
  }
  return "";
}

/**
 * 関数本体に値を伴うreturnがあるかを、入れ子の関数へ入らず判定する。
 *
 * @param node 調査する関数ノード
 * @returns 呼び出し元へ値を返す経路がある場合はtrue
 */
function returnsValue(node) {
  if (node.type?.getText() === "void") return false;
  let currentParent = node.parent;
  let caller = "";
  let isJsxHandler = false;
  while (currentParent && !ts.isSourceFile(currentParent)) {
    if (ts.isJsxAttribute(currentParent) && /^on[A-Z]/u.test(currentParent.name.getText())) isJsxHandler = true;
    if ((ts.isCallExpression(currentParent) || ts.isNewExpression(currentParent)) && (currentParent.arguments ?? []).some((argument) => argument.pos <= node.pos && node.end <= argument.end)) {
      caller = ts.isPropertyAccessExpression(currentParent.expression)
        ? currentParent.expression.name.text
        : ts.isIdentifier(currentParent.expression) ? currentParent.expression.text : "";
      break;
    }
    if (ts.isFunctionLike(currentParent)) break;
    currentParent = currentParent.parent;
  }
  const isAsync = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  if (["test", "it"].includes(caller) && isAsync) return true;
  if (isJsxHandler || ["test", "it", "describe", "beforeEach", "beforeAll", "afterEach", "afterAll", "forEach", "Promise", "setTimeout", "requestAnimationFrame", "addEventListener"].includes(caller)) return false;
  /**
   * return式が、説明を要する値ではなくvoid操作の短縮記法か判定する。
   *
   * @param expression return文が返す式
   * @returns 戻り値の意味をJSDocで説明すべき場合はtrue
   */
  function isMeaningful(expression) {
    let current = expression;
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) current = current.expression;
    if (ts.isIdentifier(current) && current.text === "undefined") return false;
    if (ts.isVoidExpression(current)) return false;
    if (ts.isCallExpression(current)) {
      const called = ts.isPropertyAccessExpression(current.expression)
        ? current.expression.name.text
        : ts.isIdentifier(current.expression) ? current.expression.text : "";
      if (/^set[A-Z]/u.test(called) || /^(?:toBe|toHave|toMatch|toContain|toEqual|toThrow)/u.test(called) || ["resolve", "reject", "commit", "mutate", "navigate", "preventDefault", "stopPropagation", "focus", "click", "removeEventListener", "addEventListener", "revokeObjectURL", "clearTimeout"].includes(called)) return false;
    }
    return true;
  }
  if (ts.isArrowFunction(node) && node.body && !ts.isBlock(node.body)) {
    return isMeaningful(node.body);
  }
  let found = false;
  /**
   * 対象関数直下のreturnだけを探索し、内側の関数の戻り値を混同しない。
   *
   * @param child 現在確認している子ノード
   */
  function visitReturn(child) {
    if (found) return;
    if (child !== node && ts.isFunctionLike(child)) return;
    if (ts.isReturnStatement(child) && child.expression && isMeaningful(child.expression)) {
      found = true;
      return;
    }
    ts.forEachChild(child, visitReturn);
  }
  if (node.body) visitReturn(node.body);
  return found;
}

/**
 * ソースファイル内のコメントルール違反をASTとテキストの両面から集計する。
 *
 * @param filePath 検査するTypeScriptファイルの絶対パス
 * @returns ファイル単位の関数数と違反明細
 */
function inspectFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);
  const result = {
    file: relativePath,
    functions: 0,
    documentedFunctions: 0,
    functionsWithParameters: 0,
    sections: 0,
    issues: [],
  };

  for (const diagnostic of sourceFile.parseDiagnostics) {
    const line = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1;
    result.issues.push({ kind: "syntax", line, detail: ts.flattenDiagnosticMessageText(diagnostic.messageText, " ") });
  }

  const sectionPattern = /^\s*\/\/\s*-{3,}\s*\r?\n\s*\/\/\s*(.+?)\s*\r?\n\s*\/\/\s*-{3,}\s*$/gmu;
  for (const match of text.matchAll(sectionPattern)) {
    result.sections += 1;
    if (ENGLISH_SECTION_NAMES.has(match[1])) {
      const line = text.slice(0, match.index).split(/\r?\n/u).length + 1;
      result.issues.push({ kind: "english-section", line, detail: match[1] });
    }
  }

  for (const pattern of GENERIC_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern.source, "gu"))) {
      const line = text.slice(0, match.index).split(/\r?\n/u).length;
      result.issues.push({ kind: "generic-comment", line, detail: match[0] });
    }
  }

  /**
   * すべての関数形式を再帰的に調べ、JSDoc・引数・戻り値の対応を検証する。
   *
   * @param node 現在確認しているASTノード
   */
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      result.functions += 1;
      const line = lineOf(sourceFile, node);
      const docs = node.jsDoc ?? [];
      const doc = docs.at(-1);
      if (doc) {
        result.documentedFunctions += 1;
      } else {
        result.issues.push({ kind: "missing-jsdoc", line, detail: node.getText(sourceFile).slice(0, 80) });
      }

      if (ts.isArrowFunction(node) || (ts.isFunctionExpression(node) && !node.name)) {
        result.issues.push({ kind: "anonymous-function", line, detail: ts.SyntaxKind[node.kind] });
      }

      const actualNames = node.parameters.flatMap(parameterNames);
      if (actualNames.length > 0) result.functionsWithParameters += 1;
      const hasBindingParameter = node.parameters.some((parameter) => !ts.isIdentifier(parameter.name));
      if (hasBindingParameter && !["test", "it"].includes(containingCallName(node))) {
        result.issues.push({ kind: "binding-parameter", line, detail: node.parameters.map((parameter) => parameter.name.getText(sourceFile)).join(", ") });
      }

      const paramTags = doc?.tags ? Array.from(doc.tags).filter(ts.isJSDocParameterTag) : [];
      const documentedNames = paramTags.map(jsDocParameterName);
      if (paramTags.length < actualNames.length) {
        result.issues.push({ kind: "missing-param", line, detail: `actual=${actualNames.join(",")} documented=${documentedNames.join(",")}` });
      }
      if (paramTags.length > actualNames.length) {
        result.issues.push({ kind: "extra-param", line, detail: `actual=${actualNames.join(",")} documented=${documentedNames.join(",")}` });
      }
      if (actualNames.join("\0") !== documentedNames.join("\0")) {
        result.issues.push({ kind: "param-name-mismatch", line, detail: `actual=${actualNames.join(",")} documented=${documentedNames.join(",")}` });
      }

      const returnTags = doc?.tags ? Array.from(doc.tags).filter(ts.isJSDocReturnTag) : [];
      if (returnsValue(node) && returnTags.length === 0) {
        result.issues.push({ kind: "missing-returns", line, detail: "値を返す関数に@returnsがありません" });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return result;
}

const results = collectTypeScriptFiles(ROOT).map(inspectFile);
const counts = new Map();
for (const issue of results.flatMap((result) => result.issues)) {
  counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1);
}

/**
 * 違反種別の集計結果を種別名の順へ並べる。
 *
 * @param left 左側の違反種別と件数
 * @param right 右側の違反種別と件数
 * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
 */
function compareCountEntries(left, right) {
  return left[0].localeCompare(right[0]);
}

const summary = {
  files: results.length,
  functions: results.reduce((total, result) => total + result.functions, 0),
  documentedFunctions: results.reduce((total, result) => total + result.documentedFunctions, 0),
  functionsWithParameters: results.reduce((total, result) => total + result.functionsWithParameters, 0),
  sections: results.reduce((total, result) => total + result.sections, 0),
  issues: Object.fromEntries([...counts.entries()].sort(compareCountEntries)),
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify({ summary, results }, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  for (const result of results.filter((entry) => entry.issues.length > 0)) {
    for (const issue of result.issues) {
      process.stdout.write(`${result.file}:${issue.line} [${issue.kind}] ${issue.detail}\n`);
    }
  }
}

if (results.some((result) => result.issues.length > 0)) {
  process.exitCode = 1;
}
