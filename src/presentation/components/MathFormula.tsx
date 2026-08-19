import { convertLatexToMarkup, convertLatexToSpeakableText } from "mathlive/ssr";

type Props = {
  latex: string;
  block?: boolean;
  textSize?: "small" | "normal" | "large" | "xLarge";
  className?: string;
};

export function renderMathMarkup(latex: string, block: boolean): string {
  try {
    return convertLatexToMarkup(latex, {
      defaultMode: block ? "math" : "inline-math",
    });
  } catch {
    return "";
  }
}

export function getMathAriaLabel(latex: string): string {
  try {
    return convertLatexToSpeakableText(latex) || `数式 ${latex}`;
  } catch {
    return `数式 ${latex}`;
  }
}

export function MathFormula({ latex, block = false, textSize = "normal", className = "" }: Props) {
  const markup = renderMathMarkup(latex, block);
  const Tag = block ? "div" : "span";
  const classes = ["math-formula", block ? "math-formula-block" : "math-formula-inline", `math-size-${textSize}`, className]
    .filter(Boolean)
    .join(" ");

  if (!markup) {
    return <Tag className={`${classes} math-formula-fallback`} role="math" aria-label={getMathAriaLabel(latex)}>{latex}</Tag>;
  }

  return <Tag className={classes} role="math" aria-label={getMathAriaLabel(latex)} dangerouslySetInnerHTML={{ __html: markup }} />;
}
