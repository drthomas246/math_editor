import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const ROOT = process.cwd();
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx)$/u;
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage", ".git"]);
const SKIPPED_PROJECT_PATHS = ["scripts/fixtures/comment-rules/", "scripts/fixtures/comment-change-scope/"];
const HOOK_NAMES = new Set(["useEffect", "useLayoutEffect", "useMemo", "useCallback", "useImperativeHandle"]);

/**
 * 文字列のSHA-256を計算する。
 *
 * @param value ハッシュ対象の文字列
 * @returns 64文字のSHA-256ダイジェスト
 */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * 文字列を環境に依存しない順序へ並べる。
 *
 * @param left 左側の文字列
 * @param right 右側の文字列
 * @returns 左を先に並べる場合は負、同順なら0、右を先に並べる場合は正の値
 */
function compareStrings(left, right) {
  return left.localeCompare(right);
}

/**
 * CLI引数から指定オプションの値を取得する。
 *
 * @param args CLI引数
 * @param name 取得するオプション名
 * @returns 指定値。オプションがない場合はnull
 */
function optionValue(args, name) {
  const inline = args.find(function findInlineOption(argument) {
    return argument.startsWith(`${name}=`);
  });
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name}には値を指定してください`);
  return value;
}

/**
 * 対象がTypeScriptまたはTSXファイルか判定する。
 *
 * @param filePath 判定対象パス
 * @returns 検査対象ならtrue
 */
function isSourceFile(filePath) {
  return SOURCE_FILE_PATTERN.test(filePath);
}

/**
 * プロジェクト内で検査対象外とするfixtureか判定する。
 *
 * @param filePath Git形式の相対パス
 * @returns fixtureならtrue
 */
function isSkippedProjectPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  return SKIPPED_PROJECT_PATHS.some(function matchesSkippedPath(prefix) {
    return normalized.startsWith(prefix);
  });
}

/**
 * ディレクトリ内のTypeScriptファイルを相対パスと内容のMapへ読み込む。
 *
 * @param directory 読み込み元ディレクトリ
 * @returns 相対パスをキーとするソースMap
 */
function readDirectorySources(directory) {
  const absoluteRoot = path.resolve(ROOT, directory);
  const sources = new Map();

  /**
   * 子ディレクトリを再帰走査する。
   *
   * @param currentDirectory 現在の絶対ディレクトリ
   */
  function visitDirectory(currentDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) visitDirectory(path.join(currentDirectory, entry.name));
        continue;
      }
      if (!isSourceFile(entry.name)) continue;
      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(absoluteRoot, absolutePath).replaceAll("\\", "/");
      sources.set(relativePath, fs.readFileSync(absolutePath, "utf8"));
    }
  }

  visitDirectory(absoluteRoot);
  return sources;
}

/**
 * Nodeがexport修飾子を持つか判定する。
 *
 * @param node 調査対象ノード
 * @returns exportされていればtrue
 */
function isExported(node) {
  return node.modifiers?.some(function isExportModifier(modifier) {
    return modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword;
  }) ?? false;
}

/**
 * 式を囲む括弧を除き、実体の式を取得する。
 *
 * @param expression 調査対象の式
 * @returns 括弧の内側にある式
 */
function unwrapParentheses(expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

/**
 * this等の字句束縛を考慮し、比較に使う関数形式を決定する。
 *
 * @param rootFunction 調査対象関数
 * @returns 通常関数、字句束縛関数、メソッドを区別する識別子
 */
function canonicalFunctionForm(rootFunction) {
  let usesDirectLexicalBinding = false;
  let usesCapturedThis = false;

  /**
   * 入れ子の関数も含め、退避したthisを参照しているか調べる。
   *
   * @param node 現在確認しているノード
   */
  function visitCapturedThis(node) {
    if (usesCapturedThis) return;
    if (ts.isIdentifier(node) && node.text === "__COMMENT_SCOPE_LEXICAL_THIS__") {
      usesCapturedThis = true;
      return;
    }
    ts.forEachChild(node, visitCapturedThis);
  }

  /**
   * 関数内を走査し、字句束縛へ依存する構文を探す。
   *
   * @param node 現在確認しているノード
   */
  function visit(node) {
    if (usesDirectLexicalBinding) return;
    if (node !== rootFunction && ts.isFunctionLike(node) && !ts.isArrowFunction(node)) return;
    if (node.kind === ts.SyntaxKind.ThisKeyword) usesDirectLexicalBinding = true;
    if (node.kind === ts.SyntaxKind.SuperKeyword) usesDirectLexicalBinding = true;
    if (ts.isIdentifier(node) && node.text === "arguments") usesDirectLexicalBinding = true;
    if (ts.isMetaProperty(node)) usesDirectLexicalBinding = true;
    ts.forEachChild(node, visit);
  }

  if (rootFunction.body) {
    visit(rootFunction.body);
    visitCapturedThis(rootFunction.body);
  }
  if (!usesDirectLexicalBinding && !usesCapturedThis) return "callable";
  if (ts.isMethodDeclaration(rootFunction)) return "MethodDeclaration";
  if (ts.isArrowFunction(rootFunction) || (usesCapturedThis && !usesDirectLexicalBinding)) return "lexical-callable";
  return ts.SyntaxKind[rootFunction.kind];
}

/**
 * 引数ノードを型注釈に依存しない形式へ変換する。
 *
 * @param parameter 引数ノード
 * @param sourceFile 解析元ファイル
 * @param inlineFunctions インライン化する関数Map
 * @returns 正規化した引数表現
 */
function canonicalParameter(parameter, sourceFile, inlineFunctions) {
  const rest = parameter.dotDotDotToken ? "rest:" : "";
  const initializer = parameter.initializer
    ? `=${canonicalNode(parameter.initializer, sourceFile, inlineFunctions)}`
    : "";
  return `${rest}${canonicalNode(parameter.name, sourceFile, inlineFunctions)}${initializer}`;
}

/**
 * 文リスト内で1回だけコールバックとして参照される関数を抽出する。
 *
 * @param statements 同一スコープの文一覧
 * @returns インライン化対象と除去対象文
 */
function findInlineableFunctions(statements) {
  const candidates = [];
  for (const statement of statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body && !isExported(statement)) {
      candidates.push({ name: statement.name.text, callable: statement, statement });
      continue;
    }
    if (ts.isVariableStatement(statement) && !isExported(statement) && statement.declarationList.declarations.length === 1) {
      const declaration = statement.declarationList.declarations[0];
      const initializer = declaration?.initializer ? unwrapParentheses(declaration.initializer) : null;
      if (
        declaration
        && ts.isIdentifier(declaration.name)
        && initializer
        && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
      ) {
        candidates.push({ name: declaration.name.text, callable: initializer, statement });
      }
    }
  }

  const inlineFunctions = new Map();
  const skippedStatements = new Set();
  for (const candidate of candidates) {
    const references = [];

    /**
     * 候補関数名への参照を列挙する。
     *
     * @param node 現在確認しているノード
     */
    function collectReferences(node) {
      if (node === candidate.statement) return;
      if (ts.isIdentifier(node) && node.text === candidate.name && node !== candidate.callable.name) references.push(node);
      ts.forEachChild(node, collectReferences);
    }

    ts.forEachChild(candidate.callable, collectReferences);
    for (const statement of statements) collectReferences(statement);
    const reference = references[0];
    const call = reference?.parent;
    const isDirectArgument = Boolean(
      reference
      && references.length === 1
      && (ts.isCallExpression(call) || ts.isNewExpression(call))
      && (call.arguments ?? []).includes(reference),
    );
    if (isDirectArgument) {
      inlineFunctions.set(candidate.name, candidate.callable);
      skippedStatements.add(candidate.statement);
    }
  }
  return { inlineFunctions, skippedStatements };
}

/**
 * 文一覧を、1回だけ使われるコールバックを呼出位置へ戻した形式で直列化する。
 *
 * @param statements 直列化する文一覧
 * @param sourceFile 解析元ファイル
 * @param inheritedInlineFunctions 外側スコープのインライン関数Map
 * @returns 正規化済み文一覧
 */
function canonicalStatements(statements, sourceFile, inheritedInlineFunctions = new Map()) {
  const local = findInlineableFunctions(statements);
  const inlineFunctions = new Map(inheritedInlineFunctions);
  for (const [name, callable] of local.inlineFunctions) inlineFunctions.set(name, callable);
  return statements.filter(function keepStatement(statement) {
    return !local.skippedStatements.has(statement);
  }).map(function canonicalStatement(statement) {
    return canonicalNode(statement, sourceFile, inlineFunctions);
  }).join("|");
}

/**
 * 関数をアローとfunctionの表記差に影響されない形式へ変換する。
 *
 * @param node 関数ノード
 * @param sourceFile 解析元ファイル
 * @param inlineFunctions インライン化する関数Map
 * @returns 正規化済み関数表現
 */
function canonicalFunction(node, sourceFile, inlineFunctions) {
  let parameters = Array.from(node.parameters);
  let bodyStatements = node.body && ts.isBlock(node.body) ? Array.from(node.body.statements) : null;
  let movedBinding = null;

  if (parameters.length === 1 && bodyStatements?.length) {
    const parameter = parameters[0];
    const firstStatement = bodyStatements[0];
    if (
      parameter
      && ts.isIdentifier(parameter.name)
      && !parameter.initializer
      && !parameter.dotDotDotToken
      && ts.isVariableStatement(firstStatement)
      && firstStatement.declarationList.declarations.length === 1
    ) {
      const declaration = firstStatement.declarationList.declarations[0];
      if (
        declaration
        && (ts.isObjectBindingPattern(declaration.name) || ts.isArrayBindingPattern(declaration.name))
        && declaration.initializer
        && ts.isIdentifier(declaration.initializer)
        && declaration.initializer.text === parameter.name.text
      ) {
        movedBinding = declaration.name;
        bodyStatements = bodyStatements.slice(1);
      }
    }
  }

  const parameterText = parameters.map(function serializeFunctionParameter(parameter, index) {
    if (index === 0 && movedBinding) return canonicalNode(movedBinding, sourceFile, inlineFunctions);
    return canonicalParameter(parameter, sourceFile, inlineFunctions);
  }).join(",");
  const bodyText = bodyStatements
    ? canonicalStatements(bodyStatements, sourceFile, inlineFunctions)
    : `return:${canonicalNode(node.body, sourceFile, inlineFunctions)}`;
  const asyncFlag = node.modifiers?.some(function isAsyncModifier(modifier) {
    return modifier.kind === ts.SyntaxKind.AsyncKeyword;
  }) ? "async" : "sync";
  const generatorFlag = node.asteriskToken ? "generator" : "regular";
  const form = canonicalFunctionForm(node);
  return `function(${form};${asyncFlag};${generatorFlag};${parameterText};${bodyText})`;
}

/**
 * ASTノードをコメント・書式・許可された関数形式に依存しない文字列へ変換する。
 *
 * @param node 変換するASTノード
 * @param sourceFile 解析元ファイル
 * @param inlineFunctions インライン化する関数Map
 * @returns 正規化済みAST表現
 */
function canonicalNode(node, sourceFile, inlineFunctions = new Map()) {
  if (!node) return "";
  if (ts.isParenthesizedExpression(node)) return canonicalNode(node.expression, sourceFile, inlineFunctions);
  if (ts.isNumericLiteral(node)) return `number:${String(Number(node.text.replaceAll("_", "")))}`;
  if (ts.isBigIntLiteral(node)) return `bigint:${node.text.replaceAll("_", "").toLowerCase()}`;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return `string:${JSON.stringify(node.text)}`;
  if (ts.isSourceFile(node)) return canonicalStatements(Array.from(node.statements), sourceFile, inlineFunctions);
  if (ts.isBlock(node)) return `{${canonicalStatements(Array.from(node.statements), sourceFile, inlineFunctions)}}`;
  if (ts.isFunctionDeclaration(node)) {
    return `declaration:${node.name?.text ?? "default"}:${canonicalFunction(node, sourceFile, inlineFunctions)}`;
  }
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    return canonicalFunction(node, sourceFile, inlineFunctions);
  }
  if (ts.isMethodDeclaration(node)) {
    return `method:${canonicalNode(node.name, sourceFile, inlineFunctions)}:${canonicalFunction(node, sourceFile, inlineFunctions)}`;
  }
  if (ts.isReturnStatement(node)) {
    return `return:${canonicalNode(node.expression, sourceFile, inlineFunctions)}`;
  }
  if (ts.isIdentifier(node)) {
    if (node.text === "__COMMENT_SCOPE_LEXICAL_THIS__") return "ThisKeyword:this";
    const callable = inlineFunctions.get(node.text);
    const parent = node.parent;
    if (
      callable
      && (ts.isCallExpression(parent) || ts.isNewExpression(parent))
      && (parent.arguments ?? []).includes(node)
    ) {
      return canonicalFunction(callable, sourceFile, inlineFunctions);
    }
    return `identifier:${node.text}`;
  }
  if (node.getChildCount(sourceFile) === 0) {
    return `${ts.SyntaxKind[node.kind]}:${node.getText(sourceFile)}`;
  }
  return `${ts.SyntaxKind[node.kind]}(${node.getChildren(sourceFile).map(function canonicalChild(child) {
    return canonicalNode(child, sourceFile, inlineFunctions);
  }).join(",")})`;
}

/**
 * 外部公開関数の戻り値型とasync属性を収集する。
 *
 * @param sourceFile TypeScriptソースファイル
 * @returns 公開関数の型シグネチャ一覧
 */
function exportedFunctionSignatures(sourceFile) {
  const signatures = [];

  /**
   * 型表現から書式だけの差を除去する。
   *
   * @param typeNode 戻り値型ノード
   * @returns 空白を除去した型表現
   */
  function returnTypeText(typeNode) {
    return typeNode
      ? typeNode.getText(sourceFile).replace(/\s+/gu, "").replace(/;(?=[}>])/gu, "")
      : "inferred";
  }

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
      const asyncFlag = statement.modifiers?.some(function isAsyncModifier(modifier) {
        return modifier.kind === ts.SyntaxKind.AsyncKeyword;
      }) ? "async" : "sync";
      signatures.push(`${statement.name?.text ?? "default"}:${asyncFlag}:${returnTypeText(statement.type)}`);
    }
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer ? unwrapParentheses(declaration.initializer) : null;
        if (
          ts.isIdentifier(declaration.name)
          && initializer
          && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          const asyncFlag = initializer.modifiers?.some(function isAsyncModifier(modifier) {
            return modifier.kind === ts.SyntaxKind.AsyncKeyword;
          }) ? "async" : "sync";
          signatures.push(`${declaration.name.text}:${asyncFlag}:${returnTypeText(initializer.type)}`);
        }
      }
    }
  }
  return signatures.sort(compareStrings);
}

/**
 * 変更理由の表示に使う危険箇所シグネチャを収集する。
 *
 * @param sourceFile JavaScriptへ変換後のソースファイル
 * @returns 検査観点ごとのシグネチャ
 */
function collectRiskSignals(sourceFile) {
  const signals = {
    hookDependencies: [],
    hookOrder: [],
    returns: [],
    conditions: [],
    calls: [],
    stateUpdates: [],
    events: [],
    awaits: [],
    functionModes: [],
  };

  /**
   * 呼出式から末尾の関数名またはメソッド名を取得する。
   *
   * @param expression 呼出対象式
   * @returns 呼出名
   */
  function callName(expression) {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return expression.getText(sourceFile);
  }

  /**
   * 危険箇所を再帰的に収集する。
   *
   * @param node 現在確認しているノード
   */
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = callName(node.expression);
      const argumentsText = node.arguments.map(function argumentText(argument) {
        return argument.getText(sourceFile).replace(/\s+/gu, "");
      }).join(",");
      signals.calls.push(`${name}(${argumentsText})`);
      if (/^use[A-Z]/u.test(name)) signals.hookOrder.push(name);
      if (HOOK_NAMES.has(name)) {
        signals.hookDependencies.push(`${name}:${node.arguments.at(-1)?.getText(sourceFile).replace(/\s+/gu, "") ?? ""}`);
      }
      if (/^set[A-Z]/u.test(name)) signals.stateUpdates.push(`${name}(${argumentsText})`);
      if (name === "addEventListener" || name === "removeEventListener") signals.events.push(`${name}(${argumentsText})`);
    }
    if (ts.isReturnStatement(node)) signals.returns.push(node.expression?.getText(sourceFile).replace(/\s+/gu, "") ?? "void");
    if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
      signals.conditions.push(node.expression.getText(sourceFile).replace(/\s+/gu, ""));
    }
    if (ts.isConditionalExpression(node)) signals.conditions.push(node.condition.getText(sourceFile).replace(/\s+/gu, ""));
    if (ts.isForStatement(node)) signals.conditions.push(node.condition?.getText(sourceFile).replace(/\s+/gu, "") ?? "");
    if (ts.isAwaitExpression(node)) signals.awaits.push(node.expression.getText(sourceFile).replace(/\s+/gu, ""));
    if (ts.isFunctionLike(node)) {
      const asyncFlag = node.modifiers?.some(function isAsyncModifier(modifier) {
        return modifier.kind === ts.SyntaxKind.AsyncKeyword;
      }) ? "async" : "sync";
      signals.functionModes.push(`${asyncFlag}:${node.asteriskToken ? "generator" : "regular"}`);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return signals;
}

/**
 * TypeScriptソースを実行コード比較用に解析・正規化する。
 *
 * @param text ソース全文
 * @param filePath 表示とTSX判定に使うパス
 * @returns 正規化コード、型シグネチャ、危険箇所、構文エラー
 */
function analyzeSource(text, filePath) {
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const typedSource = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);
  const syntaxIssues = typedSource.parseDiagnostics.map(function diagnosticText(diagnostic) {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  });
  const transpiled = ts.transpileModule(text, {
    fileName: filePath,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      removeComments: true,
    },
    reportDiagnostics: true,
  });
  const lexicalAliases = [];
  const runtimeTextWithoutCaptures = transpiled.outputText.replace(/\bconst\s+(instanceContext\d+)\s*=\s*this;\s*/gu, function removeLexicalCapture(_match, alias) {
    lexicalAliases.push(alias);
    return "";
  });
  let normalizedRuntimeText = runtimeTextWithoutCaptures;
  for (const alias of lexicalAliases) {
    normalizedRuntimeText = normalizedRuntimeText.replace(new RegExp(`\\b${alias}\\b`, "gu"), "__COMMENT_SCOPE_LEXICAL_THIS__");
  }
  const runtimeSource = ts.createSourceFile(`${filePath}.js`, normalizedRuntimeText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return {
    canonical: canonicalNode(runtimeSource, runtimeSource),
    exportedSignatures: exportedFunctionSignatures(typedSource),
    risks: collectRiskSignals(runtimeSource),
    syntaxIssues,
  };
}

/**
 * 変更された危険観点を人が読める名称で列挙する。
 *
 * @param before 変更前の解析結果
 * @param after 変更後の解析結果
 * @returns 変化した観点名
 */
function changedRiskNames(before, after) {
  const risks = [];
  const comparisons = [
    ["React Hookの依存配列", "hookDependencies"],
    ["Hook呼出順序", "hookOrder"],
    ["return式", "returns"],
    ["条件式", "conditions"],
    ["関数呼出と引数", "calls"],
    ["State更新", "stateUpdates"],
    ["イベント登録・解除", "events"],
    ["await順序", "awaits"],
    ["関数のasyncまたはgenerator属性", "functionModes"],
  ];
  for (const [label, key] of comparisons) {
    if (JSON.stringify(before.risks[key]) !== JSON.stringify(after.risks[key])) risks.push(label);
  }
  if (JSON.stringify(before.exportedSignatures) !== JSON.stringify(after.exportedSignatures)) {
    risks.push("公開関数の戻り値型またはasync属性");
  }
  return risks;
}

/**
 * 二つの正規化文字列が最初に異なる周辺を抽出する。
 *
 * @param before 変更前の正規化文字列
 * @param after 変更後の正規化文字列
 * @returns 最初の差分位置と前後の断片
 */
function firstCanonicalDifference(before, after) {
  let index = 0;
  const limit = Math.min(before.length, after.length);
  while (index < limit && before[index] === after[index]) index += 1;
  const start = Math.max(0, index - 80);
  return {
    index,
    before: before.slice(start, index + 160),
    after: after.slice(start, index + 160),
  };
}

/**
 * 変更前後のソースMapを比較する。
 *
 * @param beforeSources 変更前ソースMap
 * @param afterSources 変更後ソースMap
 * @returns ファイル単位の検査結果
 */
function compareSourceMaps(beforeSources, afterSources) {
  const paths = [...new Set([...beforeSources.keys(), ...afterSources.keys()])].sort(compareStrings);
  const results = [];
  for (const filePath of paths) {
    const beforeText = beforeSources.get(filePath);
    const afterText = afterSources.get(filePath);
    if (beforeText === undefined) {
      results.push({ file: filePath, status: "failed", issue: "file-added", detail: "TypeScriptファイルが追加されています" });
      continue;
    }
    if (afterText === undefined) {
      results.push({ file: filePath, status: "failed", issue: "file-removed", detail: "TypeScriptファイルが削除されています" });
      continue;
    }

    const before = analyzeSource(beforeText, filePath);
    const after = analyzeSource(afterText, filePath);
    if (before.syntaxIssues.length || after.syntaxIssues.length) {
      results.push({
        file: filePath,
        status: "failed",
        issue: "syntax",
        detail: [...before.syntaxIssues, ...after.syntaxIssues].join("; "),
      });
      continue;
    }

    const runtimeMatches = before.canonical === after.canonical;
    const signatureMatches = JSON.stringify(before.exportedSignatures) === JSON.stringify(after.exportedSignatures);
    if (runtimeMatches && signatureMatches) {
      results.push({
        file: filePath,
        status: "allowed",
        beforeSha256: sha256(beforeText),
        afterSha256: sha256(afterText),
        runtimeSha256: sha256(after.canonical),
      });
      continue;
    }

    results.push({
      file: filePath,
      status: "failed",
      issue: "logic-change",
      detail: "コメントおよび許可された構造変更を除いたコードが一致しません",
      risks: changedRiskNames(before, after),
      canonicalDifference: firstCanonicalDifference(before.canonical, after.canonical),
      beforeSignatures: before.exportedSignatures,
      afterSignatures: after.exportedSignatures,
      beforeSha256: sha256(beforeText),
      afterSha256: sha256(afterText),
      beforeRuntimeSha256: sha256(before.canonical),
      afterRuntimeSha256: sha256(after.canonical),
    });
  }
  return results;
}

/**
 * Gitコマンドを実行して標準出力を取得する。
 *
 * @param args gitへ渡す引数
 * @returns 標準出力
 */
function runGit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} に失敗しました`);
  return result.stdout;
}

/**
 * Git refにあるファイル内容を読み込む。
 *
 * @param ref Git ref
 * @param filePath Git相対パス
 * @returns ref上のファイル内容
 */
function readGitSource(ref, filePath) {
  return runGit(["show", `${ref}:${filePath}`]);
}

/**
 * Git差分から変更前後のソースMapを構築する。
 *
 * @param baseRef 比較元ref
 * @param headRef 比較先refまたはWORKTREE
 * @returns 変更前後のソースMap
 */
function readGitChangedSources(baseRef, headRef) {
  runGit(["rev-parse", "--verify", `${baseRef}^{commit}`]);
  if (headRef !== "WORKTREE") runGit(["rev-parse", "--verify", `${headRef}^{commit}`]);
  const diffArguments = ["diff", "--name-status", "--find-renames", baseRef];
  if (headRef !== "WORKTREE") diffArguments.push(headRef);
  diffArguments.push("--", "*.ts", "*.tsx");
  const lines = runGit(diffArguments).split(/\r?\n/u).filter(Boolean);
  const beforeSources = new Map();
  const afterSources = new Map();

  for (const line of lines) {
    const [status, firstPath, secondPath] = line.split("\t");
    if (!status || !firstPath) continue;
    if (status.startsWith("R")) {
      if (!isSkippedProjectPath(firstPath)) beforeSources.set(firstPath, readGitSource(baseRef, firstPath));
      if (secondPath && !isSkippedProjectPath(secondPath)) {
        const afterText = headRef === "WORKTREE"
          ? fs.readFileSync(path.join(ROOT, secondPath), "utf8")
          : readGitSource(headRef, secondPath);
        afterSources.set(secondPath, afterText);
      }
      continue;
    }
    if (isSkippedProjectPath(firstPath)) continue;
    if (!status.startsWith("A")) beforeSources.set(firstPath, readGitSource(baseRef, firstPath));
    if (!status.startsWith("D")) {
      const afterText = headRef === "WORKTREE"
        ? fs.readFileSync(path.join(ROOT, firstPath), "utf8")
        : readGitSource(headRef, firstPath);
      afterSources.set(firstPath, afterText);
    }
  }

  if (headRef === "WORKTREE") {
    const untracked = runGit(["ls-files", "--others", "--exclude-standard", "--", "*.ts", "*.tsx"])
      .split(/\r?\n/u)
      .filter(Boolean);
    for (const filePath of untracked) {
      if (isSkippedProjectPath(filePath)) continue;
      afterSources.set(filePath, fs.readFileSync(path.join(ROOT, filePath), "utf8"));
    }
  }

  return { beforeSources, afterSources };
}

/**
 * 検査結果を集計する。
 *
 * @param mode 実行モード
 * @param sourceLabel 比較元の表示名
 * @param targetLabel 比較先の表示名
 * @param results ファイル単位結果
 * @returns JSON出力用レポート
 */
function createReport(mode, sourceLabel, targetLabel, results) {
  const failed = results.filter(function isFailed(result) {
    return result.status === "failed";
  });
  const issueCounts = new Map();
  for (const result of failed) issueCounts.set(result.issue, (issueCounts.get(result.issue) ?? 0) + 1);
  return {
    mode,
    source: sourceLabel,
    target: targetLabel,
    summary: {
      files: results.length,
      allowed: results.length - failed.length,
      failed: failed.length,
      issues: Object.fromEntries([...issueCounts.entries()].sort(function compareIssueEntries(left, right) {
        return compareStrings(left[0], right[0]);
      })),
    },
    results,
  };
}

/**
 * CLIを実行する。
 */
function main() {
  const args = process.argv.slice(2);
  const beforeDirectory = optionValue(args, "--before");
  const afterDirectory = optionValue(args, "--after");
  let report;

  if (beforeDirectory || afterDirectory) {
    if (!beforeDirectory || !afterDirectory) throw new Error("ディレクトリ比較には--beforeと--afterの両方が必要です");
    const results = compareSourceMaps(readDirectorySources(beforeDirectory), readDirectorySources(afterDirectory));
    report = createReport("directory", beforeDirectory, afterDirectory, results);
  } else {
    const baseRef = optionValue(args, "--base") ?? process.env.COMMENT_SCOPE_BASE;
    const headRef = optionValue(args, "--head") ?? "WORKTREE";
    if (!baseRef) {
      throw new Error("Git比較には--base <ref>またはCOMMENT_SCOPE_BASEが必要です");
    }
    const sources = readGitChangedSources(baseRef, headRef);
    const results = compareSourceMaps(sources.beforeSources, sources.afterSources);
    report = createReport("git", baseRef, headRef, results);
  }

  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
    for (const result of report.results.filter(function hasFailure(entry) {
      return entry.status === "failed";
    })) {
      const risks = result.risks?.length ? ` (${result.risks.join("、")})` : "";
      process.stdout.write(`${result.file} [${result.issue}] ${result.detail}${risks}\n`);
    }
  }
  if (report.summary.failed > 0) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error
    ? process.argv.includes("--debug") ? error.stack ?? error.message : error.message
    : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
