import {
  DEFAULT_MODEL_BY_PROVIDER,
  type ModelSelection,
  ProviderDriverKind,
  ProviderInstanceId,
} from "@trumbo-code/contracts";
import { isNativeTrumboDesktopBuild } from "./nativeDesktop.ts";

const TRUMBO_DRIVER = ProviderDriverKind.make("trumbo");
export const NATIVE_DESKTOP_INSTANCE_ID = ProviderInstanceId.make(TRUMBO_DRIVER);

export function defaultNativeDesktopModelSelection(): ModelSelection {
  return {
    instanceId: NATIVE_DESKTOP_INSTANCE_ID,
    model: DEFAULT_MODEL_BY_PROVIDER[TRUMBO_DRIVER] ?? "quartz-1.0-lite",
  };
}

/**
 * When the native desktop build ships Trumbo as the sole provider, remap
 * persisted thread/composer selections that still reference Codex or other
 * removed drivers so turns can continue without manual thread recreation.
 */
export function remapModelSelectionForNativeDesktopBuild(
  selection: ModelSelection,
  instanceAvailable: boolean,
): ModelSelection {
  if (!isNativeTrumboDesktopBuild() || instanceAvailable) {
    return selection;
  }
  return defaultNativeDesktopModelSelection();
}
