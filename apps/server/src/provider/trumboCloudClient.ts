// @effect-diagnostics globalFetchInEffect:off globalErrorInEffectCatch:off globalErrorInEffectFailure:off preferSchemaOverJson:off
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as TrumboPlatformTokenManager from "../auth/TrumboPlatformTokenManager.ts";
import { resolveTrumboApiBaseUrl } from "./trumboRecommendedModels.ts";

export function resolveTrumboProviderBaseUrl(): string {
  return `${resolveTrumboApiBaseUrl()}/api/v1`;
}

export interface TrumboChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface TrumboChatCompletionInput {
  readonly model: string;
  readonly messages: ReadonlyArray<TrumboChatMessage>;
  readonly stream?: boolean;
  readonly signal?: AbortSignal;
}

interface OpenAiChatCompletionChunk {
  readonly choices?: ReadonlyArray<{
    readonly delta?: {
      readonly content?: string | null;
    };
    readonly message?: {
      readonly content?: string | null;
    };
  }>;
}

const readAccessToken = Effect.gen(function* () {
  const tokens = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
  const accessToken = yield* tokens.getAccessToken;
  if (Option.isNone(accessToken)) {
    return yield* Effect.fail(new Error("Trumbo platform access token is not available."));
  }
  return accessToken.value;
});

async function* readSseDataLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trimEnd();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.startsWith("data:")) {
          const data = line.slice(5).trimStart();
          if (data.length > 0) {
            yield data;
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }
    const trailing = buffer.trim();
    if (trailing.startsWith("data:")) {
      const data = trailing.slice(5).trimStart();
      if (data.length > 0) {
        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function deltaFromChunk(payload: OpenAiChatCompletionChunk): string {
  const choice = payload.choices?.[0];
  const delta = choice?.delta?.content ?? choice?.message?.content;
  return typeof delta === "string" ? delta : "";
}

function messageFromCompletion(payload: OpenAiChatCompletionChunk): string {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content;
  return typeof content === "string" ? content : "";
}

const postChatCompletion = (input: TrumboChatCompletionInput) =>
  Effect.gen(function* () {
    const accessToken = yield* readAccessToken;
    const url = `${resolveTrumboProviderBaseUrl()}/chat/completions`;
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: input.stream ? "text/event-stream" : "application/json",
          },
          body: JSON.stringify({
            model: input.model,
            messages: input.messages,
            stream: input.stream ?? false,
          }),
          signal: input.signal ?? null,
        }),
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error("Trumbo chat completion request failed.", { cause }),
    });

    if (!response.ok) {
      const detail = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => "Unknown Trumbo chat completion error.",
      }).pipe(Effect.orElseSucceed(() => "Unknown Trumbo chat completion error."));
      return yield* Effect.fail(
        new Error(
          `Trumbo chat completion failed (${response.status}): ${detail.slice(0, 500)}`.trim(),
        ),
      );
    }

    return response;
  });

export const streamTrumboChatCompletion = (input: {
  readonly model: string;
  readonly messages: ReadonlyArray<TrumboChatMessage>;
  readonly onDelta: (delta: string) => void | Promise<void>;
  readonly signal?: AbortSignal;
}) =>
  Effect.gen(function* () {
    const response = yield* postChatCompletion({
      ...input,
      stream: true,
    });
    const body = response.body;
    if (!body) {
      return yield* Effect.fail(
        new Error("Trumbo chat completion returned an empty response body."),
      );
    }

    yield* Effect.tryPromise({
      try: async () => {
        for await (const data of readSseDataLines(body)) {
          if (input.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          if (data === "[DONE]") {
            return;
          }
          const parsed = JSON.parse(data) as OpenAiChatCompletionChunk;
          const delta = deltaFromChunk(parsed);
          if (delta.length > 0) {
            await input.onDelta(delta);
          }
        }
      },
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error("Failed to read Trumbo chat completion stream.", { cause }),
    });
  });

export const completeTrumboChat = (input: {
  readonly model: string;
  readonly messages: ReadonlyArray<TrumboChatMessage>;
  readonly signal?: AbortSignal;
}) =>
  Effect.gen(function* () {
    const response = yield* postChatCompletion({
      ...input,
      stream: false,
    });
    const payload = (yield* Effect.tryPromise({
      try: () => response.json() as Promise<OpenAiChatCompletionChunk>,
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error("Failed to decode Trumbo chat completion response.", { cause }),
    })) as OpenAiChatCompletionChunk;
    return messageFromCompletion(payload);
  });
