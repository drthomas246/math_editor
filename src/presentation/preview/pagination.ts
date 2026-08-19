export type MeasuredPaginationItem = {
  key: string;
  height: number;
  startsProblem: boolean;
  breakBefore: boolean;
  breakAfter: boolean;
};

/** Places measured preview fragments on fixed-height pages. */
export function paginateMeasuredItems(
  items: readonly MeasuredPaginationItem[],
  firstPageCapacity: number,
  followingPageCapacity: number,
  problemGap: number,
): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let used = 0;

  const capacity = () => pages.length === 0 ? firstPageCapacity : followingPageCapacity;
  const finishPage = () => {
    if (current.length > 0) pages.push(current);
    current = [];
    used = 0;
  };

  for (const item of items) {
    if (item.breakBefore && current.length > 0) finishPage();

    let gap = current.length > 0 && item.startsProblem ? problemGap : 0;
    if (current.length > 0 && used + gap + item.height > capacity() + 0.5) {
      finishPage();
      gap = 0;
    }

    current.push(item.key);
    used += gap + item.height;

    if (item.breakAfter) finishPage();
  }

  finishPage();
  return pages.length > 0 ? pages : [[]];
}
