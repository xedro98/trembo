import * as NodeAssert from "node:assert/strict";
import { describe, it } from "@effect/vitest";

import { isStaticAssetRequestPath, resolveStaticFileCacheControl } from "./http.ts";

describe("static asset routing helpers", () => {
  it("treats hashed bundles as static assets", () => {
    NodeAssert.equal(isStaticAssetRequestPath("/assets/FilePreviewPanel-DctLyZzu.js"), true);
    NodeAssert.equal(isStaticAssetRequestPath("/settings"), false);
  });

  it("uses no-cache for the SPA shell and immutable caching for hashed assets", () => {
    NodeAssert.equal(resolveStaticFileCacheControl("/"), "no-cache");
    NodeAssert.equal(
      resolveStaticFileCacheControl("/assets/index-ABC123.js"),
      "public, max-age=31536000, immutable",
    );
  });
});
