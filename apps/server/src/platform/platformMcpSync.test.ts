import * as NodeAssert from "node:assert/strict";
import { describe, it } from "@effect/vitest";

import { buildManagedPlatformMcpServer, hasStaticMcpAuthorization } from "./platformMcpSync.ts";

describe("platformMcpSync", () => {
  it("treats bearer headers as static authorization", () => {
    NodeAssert.equal(hasStaticMcpAuthorization({ Authorization: "Bearer token" }), true);
    NodeAssert.equal(hasStaticMcpAuthorization({}), false);
  });

  it("builds a managed platform server without oauth metadata", () => {
    const entry = buildManagedPlatformMcpServer("token-123");
    NodeAssert.equal(entry.metadata?.managedBy, "trumbo-platform");
    NodeAssert.equal(entry.transport?.headers?.Authorization, "Bearer token-123");
    NodeAssert.equal(entry.oauth, undefined);
  });
});
