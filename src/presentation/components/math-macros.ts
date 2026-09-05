const reverseNotEqual = "\\mathrel{\\rlap{\\mkern2mu \\backslash}=}";
// MathLiveとプレビューで同じ見た目になるよう独自の数式マクロを共有する。
export const mathMacros = {
    ne: reverseNotEqual,
    neq: reverseNotEqual,
} as const;
