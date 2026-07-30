export type CommandPaletteOpenTarget = "add-project" | "new-thread-in";

export type OpenCommandPaletteOptions = {
  readonly open?: CommandPaletteOpenTarget;
};

type Listener = (options?: OpenCommandPaletteOptions) => void;

const listeners = new Set<Listener>();

/** Imperative open for chrome/menus outside the CommandPalette React tree. */
export function openCommandPalette(options?: OpenCommandPaletteOptions): void {
  for (const listener of listeners) {
    listener(options);
  }
}

export function subscribeCommandPaletteOpen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
