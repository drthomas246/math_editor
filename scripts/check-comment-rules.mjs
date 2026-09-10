import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { collectTypeScriptFiles } from "./comment-targets.mjs";

const ROOT = process.cwd();
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
  /create・Memoized/u,
  /文字装飾・(?:Saving|Saved|Failed)/u,
  /seed・(?:Problems|負荷・Fixture|プリント)/u,
  /画像の読み込み完了と失敗イベントを、レイアウト処理がawaitできるPromiseへ変換/u,
  /現在のDOMまたは編集状態へ反映する/u,
  /let・\{/u,
];
const JAPANESE_CHARACTER_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const STRUCTURAL_DIVIDER_PATTERN = /^[-=*_]{3,}$/u;
const TOOLING_COMMENT_PATTERNS = [
  /^<reference\b/u,
  /^@ts-(?:expect-error|ignore|nocheck|check)\b/u,
  /^eslint(?:-disable|-enable|-disable-next-line|-disable-line)?\b/u,
  /^oxlint-disable\b/u,
  /^biome-ignore\b/u,
  /^prettier-ignore\b/u,
  /^c8\s+ignore\b/u,
  /^istanbul\s+ignore\b/u,
  /^@vite-ignore\b/u,
  /^webpack(?:Ignore|ChunkName|Mode|Prefetch|Preload)\b/u,
  /^#?__PURE__$/u,
  /^sourceMappingURL=/u,
  /^sourceURL=/u,
];
const COMMENTED_CODE_HINT_PATTERN = /^(?:const\s+|let\s+|var\s+|function\s+|class\s+|interface\s+|type\s+[A-Za-z_$]|enum\s+|namespace\s+|import\s+|export\s+|return(?:\s|;)|throw\s+|if\s*\(|for\s*\(|while\s*\(|switch\s*\(|try\s*\{|catch\s*\(|finally\s*\{|await\s+|async\s+|new\s+[A-Za-z_$]|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*=|<\/?[A-Za-z][^>]*>)/u;

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
 * 任意の文字位置を、一行目を1とするソース位置へ変換する。
 *
 * @param sourceFile 位置計算に使うソースファイル
 * @param position 行番号を取得する文字位置
 * @returns 報告へ表示する一行目基準の行番号
 */
function lineOfPosition(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

/**
 * ファイル内容のSHA-256を16進文字列で計算する。
 *
 * @param buffer ハッシュ対象の生バイト列
 * @returns 64文字のSHA-256ダイジェスト
 */
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
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
 * TypeScriptが保持するJSDoc説明を検査用の平文へ変換する。
 *
 * @param comment JSDoc本文またはタグ説明
 * @returns 前後の空白を除いた説明文
 */
function jsDocCommentText(comment) {
  if (typeof comment === "string") return comment.trim();
  if (!comment) return "";
  return Array.from(comment).map(function jsDocPartText(part) {
    if (typeof part === "string") return part;
    if (typeof part.text === "string") return part.text;
    if (part.name?.getText) return part.name.getText();
    if (part.getText) return part.getText();
    return "";
  }).join("").trim();
}

/**
 * コメントトークンから区切り記号を除き、本文だけを取得する。
 *
 * @param rawComment scannerが返したコメント全文
 * @returns 行頭のアスタリスクなどを除いたコメント本文
 */
function normalizeCommentText(rawComment) {
  let body = rawComment;
  if (body.startsWith("//")) {
    body = body.slice(2);
  } else if (body.startsWith("/*")) {
    body = body.slice(2, body.endsWith("*/") ? -2 : undefined);
  }
  return body.split(/\r?\n/u).map(function normalizeCommentLine(line) {
    return line.replace(/^\s*\*?\s?/u, "").trimEnd();
  }).join("\n").trim();
}

/**
 * コメントがJSDocか判定する。
 *
 * @param rawComment scannerが返したコメント全文
 * @returns JSDoc形式ならtrue
 */
function isJsDocComment(rawComment) {
  return rawComment.startsWith("/**") && !rawComment.startsWith("/**/");
}

/**
 * 日本語コメント検査から除外するツール指示か判定する。
 *
 * @param commentText 区切り記号を除いたコメント本文
 * @returns コンパイラやlint等の機械向け指示ならtrue
 */
function isToolingComment(commentText) {
  return TOOLING_COMMENT_PATTERNS.some(function matchesToolingPattern(pattern) {
    return pattern.test(commentText);
  });
}

/**
 * コメントがセクションの罫線など意味を持たない装飾行か判定する。
 *
 * @param commentText 区切り記号を除いたコメント本文
 * @returns 装飾だけの行ならtrue
 */
function isStructuralDivider(commentText) {
  return STRUCTURAL_DIVIDER_PATTERN.test(commentText);
}

/**
 * scannerを使い、文字列リテラル等を誤認せずコメント位置を列挙する。
 *
 * @param text ソース全文
 * @param sourceFile 行番号計算に使用するソースファイル
 * @param scriptKind TSXかTSかを表すScriptKind
 * @returns コメント本文と位置情報の一覧
 */
function collectComments(text, sourceFile, scriptKind) {
  const languageVariant = scriptKind === ts.ScriptKind.TSX ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, languageVariant, text);
  const regularExpressionRanges = [];

  /**
   * 正規表現リテラルの範囲を収集し、内部のスラッシュをコメントと誤認しないようにする。
   *
   * @param node 現在確認しているASTノード
   */
  function collectRegularExpressionRanges(node) {
    if (ts.isRegularExpressionLiteral(node)) {
      regularExpressionRanges.push({ start: node.getStart(sourceFile), end: node.end });
    }
    ts.forEachChild(node, collectRegularExpressionRanges);
  }
  collectRegularExpressionRanges(sourceFile);

  const comments = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const start = scanner.getTokenPos();
    const end = scanner.getTextPos();
    if (regularExpressionRanges.some(function regularExpressionContainsComment(range) {
      return range.start <= start && start < range.end;
    })) {
      continue;
    }
    const raw = text.slice(start, end);
    comments.push({
      start,
      end,
      startLine: lineOfPosition(sourceFile, start),
      endLine: lineOfPosition(sourceFile, Math.max(start, end - 1)),
      raw,
      text: normalizeCommentText(raw),
      jsDoc: isJsDocComment(raw),
    });
  }
  return comments;
}

/**
 * コメント本文がTypeScriptコードを無効化したものに見えるか判定する。
 *
 * @param commentText 区切り記号を除いたコメント本文
 * @returns コードとして解釈できる可能性が高い場合はtrue
 */
function looksLikeCommentedOutCode(commentText) {
  const candidates = [commentText, ...commentText.split(/\r?\n/u)].map(function trimCodeCandidate(candidate) {
    return candidate.trim();
  }).filter(Boolean);

  return candidates.some(function isCodeCandidate(candidate) {
    if (!COMMENTED_CODE_HINT_PATTERN.test(candidate)) return false;
    if (/^(?:if|for|while|switch|try|catch|finally)\b/u.test(candidate)) return true;
    const parsed = ts.createSourceFile("comment-check.ts", candidate, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (parsed.parseDiagnostics.length > 0 || parsed.statements.length === 0) return false;
    return parsed.statements.some(function hasCodeStatement(statement) {
      if (ts.isVariableStatement(statement) || ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) return true;
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) || ts.isReturnStatement(statement)) return true;
      if (ts.isThrowStatement(statement) || ts.isIfStatement(statement) || ts.isIterationStatement(statement, false)) return true;
      if (ts.isExpressionStatement(statement)) {
        const expression = statement.expression;
        return ts.isCallExpression(expression)
          || ts.isNewExpression(expression)
          || ts.isBinaryExpression(expression)
          || ts.isAwaitExpression(expression)
          || ts.isPostfixUnaryExpression(expression)
          || ts.isPrefixUnaryExpression(expression);
      }
      return false;
    });
  });
}

/**
 * @ts-expect-errorに同一行または直前行の日本語理由があるか確認する。
 *
 * @param comments ファイル内コメントの位置順一覧
 * @param index 調査する@ts-expect-errorコメントの位置
 * @returns 日本語理由を確認できた場合はtrue
 */
function hasJapaneseTsExpectErrorReason(comments, index) {
  const current = comments[index];
  const inlineReason = current.text.replace(/^@ts-expect-error\b/u, "").trim();
  if (JAPANESE_CHARACTER_PATTERN.test(inlineReason)) return true;

  const previous = comments[index - 1];
  if (!previous || previous.endLine !== current.startLine - 1) return false;
  if (previous.jsDoc || isToolingComment(previous.text) || isStructuralDivider(previous.text)) return false;
  return JAPANESE_CHARACTER_PATTERN.test(previous.text);
}

/**
 * 通常コメント・@ts-expect-error・コメントアウトコードを検査する。
 *
 * @param comments ファイル内コメントの位置順一覧
 * @param result 違反と件数を書き込むファイル単位結果
 */
function inspectComments(comments, result) {
  result.comments = comments.filter(function countNormalComment(comment) {
    return !comment.jsDoc;
  }).length;

  comments.forEach(function inspectComment(comment, index) {
    if (comment.jsDoc) return;
    if (/^@ts-expect-error\b/u.test(comment.text)) {
      result.tsExpectErrors += 1;
      if (!hasJapaneseTsExpectErrorReason(comments, index)) {
        result.issues.push({
          kind: "ts-expect-error-missing-japanese-reason",
          line: comment.startLine,
          detail: "@ts-expect-errorの直前または同一コメントに日本語の理由がありません",
        });
      }
      return;
    }
    if (!comment.text || isStructuralDivider(comment.text) || isToolingComment(comment.text)) return;

    result.checkedNormalComments += 1;
    if (!JAPANESE_CHARACTER_PATTERN.test(comment.text)) {
      result.issues.push({ kind: "non-japanese-comment", line: comment.startLine, detail: comment.text.slice(0, 120) });
    }
    if (looksLikeCommentedOutCode(comment.text)) {
      result.issues.push({ kind: "commented-out-code", line: comment.startLine, detail: comment.text.slice(0, 120) });
    }
  });
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
    if ((ts.isCallExpression(currentParent) || ts.isNewExpression(currentParent)) && (currentParent.arguments ?? []).some(function containsFunction(argument) {
      return argument.pos <= node.pos && node.end <= argument.end;
    })) {
      caller = ts.isPropertyAccessExpression(currentParent.expression)
        ? currentParent.expression.name.text
        : ts.isIdentifier(currentParent.expression) ? currentParent.expression.text : "";
      break;
    }
    if (ts.isFunctionLike(currentParent)) break;
    currentParent = currentParent.parent;
  }
  const isAsync = node.modifiers?.some(function isAsyncModifier(modifier) {
    return modifier.kind === ts.SyntaxKind.AsyncKeyword;
  }) ?? false;
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
 * JSDoc本文と各タグの説明内容を検査する。
 *
 * @param doc 対象関数へ関連付けられたJSDoc
 * @param line 関数の開始行
 * @param result 違反と件数を書き込むファイル単位結果
 */
function inspectJsDocContent(doc, line, result) {
  const description = jsDocCommentText(doc.comment);
  result.jsDocs += 1;
  if (!description) {
    result.issues.push({ kind: "empty-jsdoc-description", line, detail: "JSDoc本文が空です" });
  } else if (!JAPANESE_CHARACTER_PATTERN.test(description)) {
    result.issues.push({ kind: "non-japanese-jsdoc-description", line, detail: description.slice(0, 120) });
  }

  const tags = doc.tags ? Array.from(doc.tags) : [];
  for (const tag of tags) {
    if (ts.isJSDocParameterTag(tag)) {
      result.paramTags += 1;
      const name = jsDocParameterName(tag);
      const tagDescription = jsDocCommentText(tag.comment);
      if (!tagDescription) {
        result.issues.push({ kind: "empty-param-description", line, detail: `@param ${name} の説明が空です` });
      } else if (!JAPANESE_CHARACTER_PATTERN.test(tagDescription)) {
        result.issues.push({ kind: "non-japanese-param-description", line, detail: `@param ${name}: ${tagDescription.slice(0, 100)}` });
      }
      if (tag.typeExpression) {
        result.issues.push({ kind: "jsdoc-type-duplication", line, detail: `@param ${name} にJSDoc型指定があります` });
      }
    }
    if (ts.isJSDocReturnTag(tag)) {
      result.returnTags += 1;
      const tagDescription = jsDocCommentText(tag.comment);
      if (!tagDescription) {
        result.issues.push({ kind: "empty-returns-description", line, detail: "@returnsの説明が空です" });
      } else if (!JAPANESE_CHARACTER_PATTERN.test(tagDescription)) {
        result.issues.push({ kind: "non-japanese-returns-description", line, detail: tagDescription.slice(0, 120) });
      }
      if (tag.typeExpression) {
        result.issues.push({ kind: "jsdoc-type-duplication", line, detail: "@returnsにJSDoc型指定があります" });
      }
    }
  }
}

/**
 * ソースファイル内のコメントルール違反をASTとテキストの両面から集計する。
 *
 * @param filePath 検査するTypeScriptファイルの絶対パス
 * @returns ファイル単位の関数数・コメント数・SHA-256・違反明細
 */
function inspectFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = buffer.toString("utf8");
  const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);
  const result = {
    file: relativePath,
    sha256: sha256(buffer),
    functions: 0,
    documentedFunctions: 0,
    functionsWithParameters: 0,
    comments: 0,
    checkedNormalComments: 0,
    jsDocs: 0,
    paramTags: 0,
    returnTags: 0,
    tsExpectErrors: 0,
    sections: 0,
    issues: [],
  };

  for (const diagnostic of sourceFile.parseDiagnostics) {
    const line = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1;
    result.issues.push({ kind: "syntax", line, detail: ts.flattenDiagnosticMessageText(diagnostic.messageText, " ") });
  }

  const comments = collectComments(text, sourceFile, scriptKind);
  inspectComments(comments, result);

  const sectionPattern = /^\s*\/\/\s*-{3,}\s*\r?\n\s*\/\/\s*(.+?)\s*\r?\n\s*\/\/\s*-{3,}\s*$/gmu;
  for (const match of text.matchAll(sectionPattern)) {
    result.sections += 1;
    if (!JAPANESE_CHARACTER_PATTERN.test(match[1])) {
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
        inspectJsDocContent(doc, line, result);
      } else {
        result.issues.push({ kind: "missing-jsdoc", line, detail: node.getText(sourceFile).slice(0, 80) });
      }

      if (ts.isArrowFunction(node) || (ts.isFunctionExpression(node) && !node.name)) {
        result.issues.push({ kind: "anonymous-function", line, detail: ts.SyntaxKind[node.kind] });
      }

      const actualNames = node.parameters.flatMap(parameterNames);
      if (actualNames.length > 0) result.functionsWithParameters += 1;
      const hasBindingParameter = node.parameters.some(function hasBinding(parameter) {
        return !ts.isIdentifier(parameter.name);
      });
      if (hasBindingParameter && !["test", "it"].includes(containingCallName(node))) {
        result.issues.push({ kind: "binding-parameter", line, detail: node.parameters.map(function parameterText(parameter) {
          return parameter.name.getText(sourceFile);
        }).join(", ") });
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

/**
 * コマンドライン引数からJSONレポート保存先を取得する。
 *
 * @param args Node.jsへ渡されたコマンドライン引数
 * @returns 保存指定があれば絶対パス、指定がなければnull
 */
function reportPathFromArguments(args) {
  const inline = args.find(function findInlineReport(argument) {
    return argument.startsWith("--report=");
  });
  if (inline) {
    const value = inline.slice("--report=".length);
    if (!value) throw new Error("--reportには保存先を指定してください");
    return path.resolve(ROOT, value);
  }

  const index = args.indexOf("--report");
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--reportには保存先を指定してください");
  return path.resolve(ROOT, value);
}

const results = collectTypeScriptFiles(ROOT).map(inspectFile);
const counts = new Map();
for (const issue of results.flatMap(function collectIssues(result) {
  return result.issues;
})) {
  counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1);
}

const summary = {
  files: results.length,
  functions: results.reduce(function countFunctions(total, result) {
    return total + result.functions;
  }, 0),
  documentedFunctions: results.reduce(function countDocumentedFunctions(total, result) {
    return total + result.documentedFunctions;
  }, 0),
  functionsWithParameters: results.reduce(function countFunctionsWithParameters(total, result) {
    return total + result.functionsWithParameters;
  }, 0),
  comments: results.reduce(function countComments(total, result) {
    return total + result.comments;
  }, 0),
  checkedNormalComments: results.reduce(function countCheckedNormalComments(total, result) {
    return total + result.checkedNormalComments;
  }, 0),
  jsDocs: results.reduce(function countJsDocs(total, result) {
    return total + result.jsDocs;
  }, 0),
  paramTags: results.reduce(function countParamTags(total, result) {
    return total + result.paramTags;
  }, 0),
  returnTags: results.reduce(function countReturnTags(total, result) {
    return total + result.returnTags;
  }, 0),
  tsExpectErrors: results.reduce(function countTsExpectErrors(total, result) {
    return total + result.tsExpectErrors;
  }, 0),
  sections: results.reduce(function countSections(total, result) {
    return total + result.sections;
  }, 0),
  sha256Algorithm: "SHA-256",
  issues: Object.fromEntries([...counts.entries()].sort(compareCountEntries)),
};

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  files: results,
};
const reportPath = reportPathFromArguments(process.argv.slice(2));
if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (reportPath) {
    process.stdout.write(`検査レポート: ${path.relative(ROOT, reportPath).replaceAll("\\", "/")}\n`);
  }
  for (const result of results.filter(function hasIssues(entry) {
    return entry.issues.length > 0;
  })) {
    for (const issue of result.issues) {
      process.stdout.write(`${result.file}:${issue.line} [${issue.kind}] ${issue.detail}\n`);
    }
  }
}

if (results.some(function hasAnyIssue(result) {
  return result.issues.length > 0;
})) {
  process.exitCode = 1;
}
