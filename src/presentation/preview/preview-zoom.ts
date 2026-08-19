export const MIN_PREVIEW_ZOOM = 0.25;
export const MAX_PREVIEW_ZOOM = 2;
export const PREVIEW_ZOOM_STEP = 0.05;
export const PREVIEW_PAGE_BASE_WIDTH_PX = 520;

const PAGE_COUNTER_HEIGHT_PX = 24;

export function getNextPreviewZoom(currentZoom: number, direction: -1 | 1): number {
  const currentStep = currentZoom / PREVIEW_ZOOM_STEP;
  const nextStep = direction === 1
    ? Math.floor(currentStep + 1e-8) + 1
    : Math.ceil(currentStep - 1e-8) - 1;

  return clampZoom(Number((nextStep * PREVIEW_ZOOM_STEP).toFixed(2)));
}

export function calculateFittedPreviewZoom({
  mode,
  viewportWidth,
  viewportHeight,
  horizontalPadding,
  verticalPadding,
  pageAspectRatio,
}: {
  mode: "fitWidth" | "fitPage";
  viewportWidth: number;
  viewportHeight: number;
  horizontalPadding: number;
  verticalPadding: number;
  pageAspectRatio: number;
}): number {
  const availableWidth = Math.max(1, viewportWidth - horizontalPadding);
  const widthZoom = availableWidth / PREVIEW_PAGE_BASE_WIDTH_PX;

  if (mode === "fitWidth") return clampZoom(widthZoom);

  const availableHeight = Math.max(1, viewportHeight - verticalPadding - PAGE_COUNTER_HEIGHT_PX);
  const pageHeight = PREVIEW_PAGE_BASE_WIDTH_PX * pageAspectRatio;
  return clampZoom(Math.min(widthZoom, availableHeight / pageHeight));
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, zoom));
}
