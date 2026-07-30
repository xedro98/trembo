// @effect-diagnostics preferSchemaOverJson:off globalFetchInEffect:off missingEffectContext:off unsafeEffectTypeAssertion:off

import { TextGenerationError } from "@trumbo-code/contracts";
import { sanitizeBranchFragment, sanitizeFeatureBranchName } from "@trumbo-code/shared/git";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { requireTrumboModelAccess } from "../auth/trumboSubscriptionAccess.ts";
import * as TrumboPlatformTokenManager from "../auth/TrumboPlatformTokenManager.ts";
import { completeTrumboChat } from "../provider/trumboCloudClient.ts";
import {
  buildBranchNamePrompt,
  buildCommitMessagePrompt,
  buildPrContentPrompt,
  buildThreadTitlePrompt,
} from "./TextGenerationPrompts.ts";
import * as TextGeneration from "./TextGeneration.ts";
import {
  sanitizeCommitSubject,
  sanitizePrTitle,
  sanitizeThreadTitle,
} from "./TextGenerationUtils.ts";

const DEFAULT_MODEL = "quartz-1.0-lite";

type TrumboTextOperation =
  | "generateCommitMessage"
  | "generatePrContent"
  | "generateBranchName"
  | "generateThreadTitle";

const runTrumboJson = <A>(
  operation: TrumboTextOperation,
  prompt: string,
  schema: Schema.Schema<A>,
  model?: string,
) =>
  Effect.gen(function* () {
    yield* requireTrumboModelAccess(operation);
    const resolvedModel = model?.trim() || DEFAULT_MODEL;
    const raw = yield* completeTrumboChat({
      model: resolvedModel,
      messages: [{ role: "user", content: prompt }],
    }).pipe(
      Effect.mapError(
        (cause) =>
          new TextGenerationError({
            operation,
            detail: cause instanceof Error ? cause.message : String(cause),
          }),
      ),
    );

    return yield* Schema.decodeUnknownEffect(schema)(
      JSON.parse(raw.match(/\{[\s\S]*\}/u)?.[0] ?? raw),
    ).pipe(
      Effect.mapError(
        () =>
          new TextGenerationError({
            operation,
            detail: `Trumbo returned an invalid ${operation} response.`,
          }),
      ),
    );
  });

export const makeTrumboTextGeneration = (): Effect.Effect<
  TextGeneration.TextGeneration["Service"],
  never,
  never
> =>
  Effect.sync(() => {
    const generateCommitMessage: TextGeneration.TextGeneration["Service"]["generateCommitMessage"] =
      (input) =>
        Effect.gen(function* () {
          const { prompt, outputSchema } = buildCommitMessagePrompt({
            branch: input.branch,
            stagedSummary: input.stagedSummary,
            stagedPatch: input.stagedPatch,
            includeBranch: input.includeBranch === true,
          });

          const generated = yield* runTrumboJson(
            "generateCommitMessage",
            prompt,
            outputSchema,
            input.modelSelection?.model,
          );

          return {
            subject: sanitizeCommitSubject(generated.subject),
            body: generated.body.trim(),
            ...("branch" in generated && typeof generated.branch === "string"
              ? { branch: sanitizeFeatureBranchName(generated.branch) }
              : {}),
          };
        }).pipe(Effect.withSpan("TrumboTextGeneration.generateCommitMessage")) as Effect.Effect<
          any,
          TextGenerationError,
          never
        >;

    const generatePrContent: TextGeneration.TextGeneration["Service"]["generatePrContent"] = (
      input,
    ) =>
      Effect.gen(function* () {
        const { prompt, outputSchema } = buildPrContentPrompt({
          baseBranch: input.baseBranch,
          headBranch: input.headBranch,
          commitSummary: input.commitSummary,
          diffSummary: input.diffSummary,
          diffPatch: input.diffPatch,
        });

        const generated = yield* runTrumboJson(
          "generatePrContent",
          prompt,
          outputSchema,
          input.modelSelection?.model,
        );

        return {
          title: sanitizePrTitle(generated.title),
          body: generated.body.trim(),
        };
      }).pipe(Effect.withSpan("TrumboTextGeneration.generatePrContent")) as Effect.Effect<
        any,
        TextGenerationError,
        never
      >;

    const generateBranchName: TextGeneration.TextGeneration["Service"]["generateBranchName"] = (
      input,
    ) =>
      Effect.gen(function* () {
        const { prompt, outputSchema } = buildBranchNamePrompt({
          message: input.message,
          attachments: input.attachments,
        });

        const generated = yield* runTrumboJson(
          "generateBranchName",
          prompt,
          outputSchema,
          input.modelSelection?.model,
        );

        return {
          branch: sanitizeBranchFragment(generated.branch),
        };
      }).pipe(Effect.withSpan("TrumboTextGeneration.generateBranchName")) as Effect.Effect<
        any,
        TextGenerationError,
        never
      >;

    const generateThreadTitle: TextGeneration.TextGeneration["Service"]["generateThreadTitle"] = (
      input,
    ) =>
      Effect.gen(function* () {
        const { prompt, outputSchema } = buildThreadTitlePrompt({
          message: input.message,
          attachments: input.attachments,
        });

        const generated = yield* runTrumboJson(
          "generateThreadTitle",
          prompt,
          outputSchema,
          input.modelSelection?.model,
        );

        return {
          title: sanitizeThreadTitle(generated.title),
        };
      }).pipe(Effect.withSpan("TrumboTextGeneration.generateThreadTitle")) as Effect.Effect<
        any,
        TextGenerationError,
        never
      >;

    return {
      generateCommitMessage,
      generatePrContent,
      generateBranchName,
      generateThreadTitle,
    } as TextGeneration.TextGeneration["Service"];
  });
