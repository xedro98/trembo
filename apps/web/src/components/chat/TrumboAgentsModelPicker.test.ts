import { describe, expect, it } from "vitest";

import { tierAllowsHyper } from "./TrumboAgentsModelPicker";

describe("tierAllowsHyper", () => {
  it("allows max, ultra, and enterprise tiers", () => {
    expect(tierAllowsHyper("max")).toBe(true);
    expect(tierAllowsHyper("ultra")).toBe(true);
    expect(tierAllowsHyper("enterprise")).toBe(true);
  });

  it("blocks pro, free, and unknown tiers", () => {
    expect(tierAllowsHyper("pro")).toBe(false);
    expect(tierAllowsHyper("free")).toBe(false);
    expect(tierAllowsHyper(null)).toBe(false);
  });
});
