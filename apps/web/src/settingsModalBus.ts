import type { SettingsSectionId } from "./components/settings/settingsNavItems";

export type SettingsModalState = {
  readonly open: boolean;
  readonly section: SettingsSectionId;
};

type Listener = (state: SettingsModalState) => void;

let state: SettingsModalState = {
  open: false,
  section: "general",
};

const listeners = new Set<Listener>();

function emit(next: SettingsModalState) {
  state = next;
  for (const listener of listeners) {
    listener(state);
  }
}

export function getSettingsModalState(): SettingsModalState {
  return state;
}

export function subscribeSettingsModal(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function openSettingsModal(section: SettingsSectionId = "general"): void {
  emit({ open: true, section });
}

export function closeSettingsModal(): void {
  if (!state.open) {
    return;
  }
  emit({ ...state, open: false });
}

export function setSettingsModalSection(section: SettingsSectionId): void {
  emit({ ...state, section });
}
