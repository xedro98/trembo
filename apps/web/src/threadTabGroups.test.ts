import { describe, expect, it } from "vite-plus/test";

import {
  createThreadTabGroupId,
  segmentThreadTabsByGroup,
  pruneThreadTabGroups,
  type ThreadTabGroup,
} from "./threadTabGroups";

describe("segmentThreadTabsByGroup", () => {
  it("clusters consecutive tabs in the same group", () => {
    const segments = segmentThreadTabsByGroup(["a", "b", "c", "d"], {
      a: "g1",
      b: "g1",
      c: "g2",
      d: "g2",
    });
    expect(segments).toEqual([
      { kind: "group", groupId: "g1", tabKeys: ["a", "b"] },
      { kind: "group", groupId: "g2", tabKeys: ["c", "d"] },
    ]);
  });

  it("keeps ungrouped runs separate from grouped runs", () => {
    const segments = segmentThreadTabsByGroup(["a", "b", "c"], { b: "g1" });
    expect(segments).toEqual([
      { kind: "ungrouped", tabKeys: ["a"] },
      { kind: "group", groupId: "g1", tabKeys: ["b"] },
      { kind: "ungrouped", tabKeys: ["c"] },
    ]);
  });
});

describe("pruneThreadTabGroups", () => {
  it("drops groups with no assigned tabs", () => {
    const groups: ThreadTabGroup[] = [
      { id: "g1", name: "One", colorId: "blue", collapsed: false },
      { id: "g2", name: "Two", colorId: "green", collapsed: false },
    ];
    const pruned = pruneThreadTabGroups(groups, { "env:thread": "g1" });
    expect(pruned.threadTabGroups.map((group) => group.id)).toEqual(["g1"]);
    expect(pruned.threadTabGroupByKey).toEqual({ "env:thread": "g1" });
  });
});

describe("createThreadTabGroupId", () => {
  it("returns non-empty ids", () => {
    expect(createThreadTabGroupId().length).toBeGreaterThan(0);
  });
});
