import { describe, expect, it } from "vitest";

import { MANUAL_TOPIC_CHAPTERS } from "./manual-context";
import { isManualChapterSlug } from "./manual-chapters";

describe("manual context", () => {
  it("すべてのTopicを有効な章へ割り当てる", () => {
    expect(Object.values(MANUAL_TOPIC_CHAPTERS).every(isManualChapterSlug)).toBe(true);
  });
});
