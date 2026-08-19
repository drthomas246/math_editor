import { describe, expect, it } from "vitest";

import { paginateMeasuredItems, type MeasuredPaginationItem } from "./pagination";

const item = (key: string, height: number, startsProblem = true): MeasuredPaginationItem => ({
  key,
  height,
  startsProblem,
  breakBefore: false,
  breakAfter: false,
});

describe("paginateMeasuredItems", () => {
  it("moves overflowing problems to following pages", () => {
    expect(paginateMeasuredItems([
      item("p1", 40), item("p2", 40), item("p3", 40),
    ], 100, 100, 10)).toEqual([["p1", "p2"], ["p3"]]);
  });

  it("does not add a problem gap between continuation fragments", () => {
    expect(paginateMeasuredItems([
      item("p1:a", 55), item("p1:b", 45, false), item("p2", 10),
    ], 100, 100, 10)).toEqual([["p1:a", "p1:b"], ["p2"]]);
  });

  it("honors explicit page breaks", () => {
    expect(paginateMeasuredItems([
      item("p1", 20),
      { ...item("p2", 20), breakBefore: true },
      { ...item("p3", 20), breakAfter: true },
      item("p4", 20),
    ], 100, 100, 10)).toEqual([["p1"], ["p2", "p3"], ["p4"]]);
  });

  it("uses the header-free capacity after the first page", () => {
    expect(paginateMeasuredItems([
      item("p1", 70), item("p2", 100),
    ], 80, 110, 10)).toEqual([["p1"], ["p2"]]);
  });
});
