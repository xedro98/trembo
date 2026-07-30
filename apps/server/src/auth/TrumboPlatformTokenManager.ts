import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as ServerSecretStore from "./ServerSecretStore.ts";

export const TRUMBO_PLATFORM_TOKEN_SECRET = "trumbo-platform-token";

const PersistedToken = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.String,
  expiresAtEpochMs: Schema.Number,
});
type PersistedToken = typeof PersistedToken.Type;

const PersistedTokenJson = Schema.fromJsonString(PersistedToken);
const decodePersistedToken = Schema.decodeUnknownEffect(PersistedTokenJson);

function bytesToString(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

export class TrumboPlatformTokenManager extends Context.Service<
  TrumboPlatformTokenManager,
  {
    readonly getAccessToken: Effect.Effect<Option.Option<string>>;
    readonly hasCredential: Effect.Effect<boolean>;
  }
>()("trumbo-code/auth/TrumboPlatformTokenManager") {}

export const make = Effect.gen(function* () {
  const secrets = yield* ServerSecretStore.ServerSecretStore;

  const readPersisted = Effect.gen(function* () {
    const encoded = yield* secrets.get(TRUMBO_PLATFORM_TOKEN_SECRET);
    if (Option.isNone(encoded)) {
      return Option.none<PersistedToken>();
    }
    return Option.some(yield* decodePersistedToken(bytesToString(encoded.value)));
  }).pipe(Effect.orElseSucceed(() => Option.none<PersistedToken>()));

  const getAccessToken = Effect.gen(function* () {
    const fromEnv = process.env.TRUMBO_PLATFORM_ACCESS_TOKEN?.trim();
    if (fromEnv) {
      return Option.some(fromEnv);
    }

    const token = yield* readPersisted;
    if (Option.isNone(token)) {
      return Option.none();
    }

    const now = yield* Clock.currentTimeMillis;
    if (token.value.expiresAtEpochMs <= now) {
      return Option.none();
    }

    return Option.some(token.value.accessToken);
  });

  const hasCredential = getAccessToken.pipe(Effect.map(Option.isSome));

  return TrumboPlatformTokenManager.of({
    getAccessToken,
    hasCredential,
  });
});

export const layer = Layer.effect(TrumboPlatformTokenManager, make);
