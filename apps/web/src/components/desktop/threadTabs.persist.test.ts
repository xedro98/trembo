import { describe, expect, it } from "vite-plus/test";

import {
  openThreadTab,
  closeThreadTab,
  closeAllThreadTabs,
  parsePersistedState,
} from "../../uiStateStore";

describe("desktop tabs layout store wiring", () => {
  it("round-trips openThreadTabKeys through persistence parse", () => {
    const opened = openThreadTab(
      {
        projectExpandedById: {},
        projectOrder: [],
        threadLastVisitedAtById: {},
        threadChangedFilesExpandedById: {},
        openThreadTabKeys: [],
        threadTabGroups: [],
        threadTabGroupByKey: {},
        defaultAdvertisedEndpointKey: null,
      },
      "env:thread-a",
    );
    const withSecond = openThreadTab(opened, "draft:draft-1");
    const closed = closeThreadTab(withSecond, "env:thread-a");

    expect(closed.openThreadTabKeys).toEqual(["draft:draft-1"]);
    expect(closeAllThreadTabs(closed).openThreadTabKeys).toEqual([]);

    const parsed = parsePersistedState({
      openThreadTabKeys: ["env:thread-a", "", "env:thread-a", "draft:draft-1"],
    });
    expect(parsed.openThreadTabKeys).toEqual(["env:thread-a", "draft:draft-1"]);
  });
});
