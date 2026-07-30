import { describe, expect, it } from "vite-plus/test";

import {
  closeOtherThreadTabs,
  closeThreadTab,
  closeThreadTabsToRight,
  draftThreadTabKey,
  MAX_OPEN_THREAD_TABS,
  openThreadTab,
  parseDraftThreadTabKey,
  resolveNeighborThreadTab,
  threadTabKeyFromRouteTarget,
} from "./threadTabs";

describe("threadTabs", () => {
  it("opens new tabs and is idempotent for existing keys", () => {
    const first = openThreadTab([], "env:thread-1");
    expect(first).toEqual(["env:thread-1"]);
    expect(openThreadTab(first, "env:thread-1")).toEqual(["env:thread-1"]);
    expect(openThreadTab(first, "env:thread-2")).toEqual(["env:thread-1", "env:thread-2"]);
  });

  it("caps open tabs by dropping least-recently-visited keys", () => {
    const keys = Array.from({ length: MAX_OPEN_THREAD_TABS }, (_, index) => `env:thread-${index}`);
    const visitedAtById = Object.fromEntries(
      keys.map((key, index) => [key, new Date(1_700_000_000_000 + index * 1_000).toISOString()]),
    );
    const next = openThreadTab(keys, "env:thread-new", { visitedAtById });
    expect(next).toHaveLength(MAX_OPEN_THREAD_TABS);
    expect(next).toContain("env:thread-new");
    expect(next).not.toContain("env:thread-0");
  });

  it("closes tabs and resolves neighbors for active-tab close", () => {
    const keys = ["a", "b", "c"];
    expect(closeThreadTab(keys, "b")).toEqual(["a", "c"]);
    expect(resolveNeighborThreadTab(keys, "b")).toBe("c");
    expect(resolveNeighborThreadTab(keys, "c")).toBe("b");
    expect(resolveNeighborThreadTab(["only"], "only")).toBeNull();
  });

  it("supports close others and close to the right", () => {
    const keys = ["a", "b", "c", "d"];
    expect(closeOtherThreadTabs(keys, "b")).toEqual(["b"]);
    expect(closeThreadTabsToRight(keys, "b")).toEqual(["a", "b"]);
  });

  it("encodes draft tab keys and route targets", () => {
    expect(draftThreadTabKey("draft-1")).toBe("draft:draft-1");
    expect(parseDraftThreadTabKey("draft:draft-1")).toBe("draft-1");
    expect(parseDraftThreadTabKey("env:thread-1")).toBeNull();
    expect(
      threadTabKeyFromRouteTarget({
        kind: "draft",
        draftId: "draft-9" as never,
      }),
    ).toBe("draft:draft-9");
    expect(
      threadTabKeyFromRouteTarget({
        kind: "server",
        threadRef: { environmentId: "env" as never, threadId: "thread" as never },
      }),
    ).toBe("env:thread");
  });
});
