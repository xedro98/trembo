import { memo, useMemo } from "react";
import BoringAvatars from "boring-avatars";
import { cn } from "~/lib/utils";

/**
 * Generative user avatar backed by `boring-avatars`.
 *
 * Uses the Trumbo brand-green palette so every avatar feels on-brand,
 * matching the platform web app's design language. The avatar is
 * deterministic from the seed (user id / email / name), so the same
 * user always gets the same avatar.
 *
 * If `avatarUrl` is provided (e.g. an uploaded photo), it takes
 * precedence and renders as a rounded image instead.
 */
export const BoringAvatar = memo(function BoringAvatar(props: {
  name: string;
  avatarUrl?: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const { name, avatarUrl, size = 32, className } = props;
  const seed = useMemo(() => name.trim() || "anonymous", [name]);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-background",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <BoringAvatars
        size={size}
        name={seed}
        variant="marble"
        colors={["#0F5C3A", "#178A52", "#2BBF77", "#4FD992", "#7CE8B0"]}
      />
    </span>
  );
});
