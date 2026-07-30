import type { SVGProps } from "react";
import { cn } from "~/lib/utils";

import { TRUMBO_LOGO_FRAME_PATH, TRUMBO_LOGO_MARK_PATH } from "./trumboLogoPaths";

/** Inline Trumbo logo mark used by provider icons, wordmarks, and splash chrome. */
export function TrumboLogoSvg({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      aria-hidden
      viewBox="0 0 366 366"
      fill="none"
      fillRule="evenodd"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path fillRule="evenodd" fill="currentColor" d={TRUMBO_LOGO_MARK_PATH} />
      <path fillRule="evenodd" fill="currentColor" d={TRUMBO_LOGO_FRAME_PATH} />
    </svg>
  );
}

export function trumboLogoClassName(className?: string) {
  return cn("shrink-0 text-[#2BBF77]", className);
}
