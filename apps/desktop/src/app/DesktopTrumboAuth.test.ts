import { assert, describe, it } from "@effect/vitest";

import { toPublicTrumboAuthState, toTrumboDeviceCodeRequest } from "./DesktopTrumboAuth.ts";

describe("DesktopTrumboAuth mappers", () => {
  it("maps OAuth device-code responses to renderer contract shape", () => {
    assert.deepEqual(
      toTrumboDeviceCodeRequest({
        device_code: "device-secret",
        user_code: "ABCD-1234",
        verification_uri: "https://platform.trumbo.dev/device",
        verification_uri_complete: "https://platform.trumbo.dev/device?user_code=ABCD-1234",
        expires_in: 600,
        interval: 5,
      }),
      {
        deviceCode: "device-secret",
        userCode: "ABCD-1234",
        verificationUri: "https://platform.trumbo.dev/device",
        verificationUriComplete: "https://platform.trumbo.dev/device?user_code=ABCD-1234",
        expiresIn: 600,
        interval: 5,
      },
    );
  });

  it("projects pending device codes into public auth state", () => {
    assert.deepEqual(
      toPublicTrumboAuthState({
        status: "signing-in",
        pendingDeviceCode: {
          device_code: "device-secret",
          user_code: "WXYZ-5678",
          verification_uri: "https://platform.trumbo.dev/device",
          expires_in: 600,
          interval: 5,
        },
      }),
      {
        status: "signing-in",
        deviceCode: {
          deviceCode: "device-secret",
          userCode: "WXYZ-5678",
          verificationUri: "https://platform.trumbo.dev/device",
          expiresIn: 600,
          interval: 5,
        },
      },
    );
  });
});
