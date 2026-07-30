import { TrumboLogoSvg } from "./TrumboLogoSvg";

/** Trumbo green mark used in the sidebar and boot chrome. */
export function TrumboWordmark({ className }: { readonly className?: string }) {
  return <TrumboLogoSvg className={className ?? "size-4 shrink-0 text-[#2BBF77]"} />;
}
