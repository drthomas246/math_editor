export type MeasuredPaginationItem = {
  key: string;
  height: number;
  startsProblem: boolean;
  breakBefore: boolean;
  breakAfter: boolean;
};

export type MeasuredPaginationPlan = {
  pages: string[][];
  oversizedItemKeys: string[];
};

/** Places measured preview fragments on fixed-height pages. */
export function paginateMeasuredItems(
  items: readonly MeasuredPaginationItem[],
  firstPageCapacity: number,
  followingPageCapacity: number,
  problemGap: number,
): string[][] {
  return planMeasuredPagination(
    items,
    firstPageCapacity,
    followingPageCapacity,
    problemGap,
  ).pages;
}

/** Plans pages and reports fragments that cannot fit on any available page. */
export function planMeasuredPagination(
  items: readonly MeasuredPaginationItem[],
  firstPageCapacity: number,
  followingPageCapacity: number,
  problemGap: number,
): MeasuredPaginationPlan {
  const pages: string[][] = [];
  const oversizedItemKeys: string[] = [];
  let current: string[] = [];
  let used = 0;

  const capacity = () => pages.length === 0 ? firstPageCapacity : followingPageCapacity;
  const finishPage = (allowEmpty = false) => {
    if (current.length > 0 || allowEmpty) pages.push(current);
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

    // The first page includes the worksheet header. When a fragment fits on a
    // header-free page, preserve it by advancing instead of clipping it below
    // the first page. The resulting first page intentionally contains only the
    // header.
    if (
      current.length === 0
      && pages.length === 0
      && item.height > firstPageCapacity + 0.5
      && followingPageCapacity > firstPageCapacity
    ) {
      finishPage(true);
    }

    if (item.height > capacity() + 0.5) oversizedItemKeys.push(item.key);

    current.push(item.key);
    used += gap + item.height;

    if (item.breakAfter) finishPage();
  }

  finishPage();
  return {
    pages: pages.length > 0 ? pages : [[]],
    oversizedItemKeys,
  };
}
