import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_UI_PREFERENCES, loadUiPreferences, UI_PREFERENCES_KEY } from "./ui-preferences";

describe("UI preferences", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads manual zoom values set in 5% increments", () => {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
      ...DEFAULT_UI_PREFERENCES,
      zoom: 1.05,
    }));

    expect(loadUiPreferences().zoom).toBe(1.05);
  });

  it("rejects manual zoom values outside 5% increments", () => {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
      ...DEFAULT_UI_PREFERENCES,
      zoom: 1.03,
    }));

    expect(loadUiPreferences()).toEqual(DEFAULT_UI_PREFERENCES);
  });

  it("以前の問題＋解答プレビュー設定を問題のみに移行する", () => {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
      ...DEFAULT_UI_PREFERENCES,
      paneRatio: 0.6,
      zoom: "fitWidth",
      previewMode: "questionsAndAnswers",
    }));

    expect(loadUiPreferences()).toEqual({
      ...DEFAULT_UI_PREFERENCES,
      paneRatio: 0.6,
      zoom: "fitWidth",
      previewMode: "questions",
    });
  });
});
