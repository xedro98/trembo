import { memo, useEffect, useMemo, useState } from "react";

import { TrumboIcon } from "../Icons";
import { cn } from "~/lib/utils";
import { resolveModelLogoUrls } from "../../lib/modelLabLogo";

export const ModelLabLogo = memo(function ModelLabLogo(props: {
  readonly modelId: string;
  readonly modelName?: string;
  readonly className?: string;
}) {
  const modelName = props.modelName ?? "";
  // Resolving the lab id runs a regex sweep across every rule; memoize it so
  // re-renders of long picker lists don't redo the work per row.
  const { labId, primaryUrl, fallbackUrl } = useMemo(
    () => resolveModelLogoUrls(props.modelId, modelName),
    [props.modelId, modelName],
  );
  const [src, setSrc] = useState(primaryUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(primaryUrl);
    setFailed(false);
  }, [primaryUrl, props.modelId, modelName]);

  if (labId === "trumbo") {
    return <TrumboIcon className={cn("size-4 shrink-0 text-brand", props.className)} aria-hidden />;
  }

  if (failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-sm bg-muted/50 text-[9px] font-semibold uppercase text-muted-foreground",
          props.className,
        )}
      >
        {labId.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      decoding="async"
      loading="lazy"
      className={cn("size-4 shrink-0 object-contain dark:invert", props.className)}
      onError={() => {
        if (src !== fallbackUrl) {
          setSrc(fallbackUrl);
          return;
        }
        setFailed(true);
      }}
    />
  );
});
