import { LiquidMetal } from "@paper-design/shaders-react";
import { Component, Suspense, useMemo, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { TrumboWordmark } from "../TrumboWordmark";

const HERO_PX = 512;
const DIAMOND_MASK_URL = "https://shaders.paper.design/images/logos/diamond.svg";

const heroFrameClassName =
  "ready-to-build-hero relative mx-auto aspect-square w-[min(92vw,28rem)] sm:w-[min(84vw,32rem)]";

const liquidMetalProps = {
  className: "relative isolate block size-full min-h-full",
  width: HERO_PX,
  height: HERO_PX,
  colorBack: "#aaaaac00",
  colorTint: "#ffffff",
  repetition: 2,
  softness: 0.1,
  shiftRed: 0.3,
  shiftBlue: 0.3,
  distortion: 0.07,
  contour: 0.4,
  angle: 70,
  speed: 1,
  scale: 0.6,
  fit: "contain" as const,
  suspendWhenProcessingImage: true,
};

function resolveTrumboMaskUrl(): string {
  if (typeof window === "undefined") {
    return DIAMOND_MASK_URL;
  }

  try {
    return new URL("trumbo-logo.svg", window.location.href).href;
  } catch {
    return DIAMOND_MASK_URL;
  }
}

function HeroFallback() {
  return (
    <div className="flex size-full items-center justify-center">
      <TrumboWordmark className="size-24 text-brand" />
    </div>
  );
}

function LiquidMetalHero({ maskUrl }: { readonly maskUrl: string }) {
  return <LiquidMetal {...liquidMetalProps} image={maskUrl} />;
}

class ShaderErrorBoundary extends Component<
  { readonly children: ReactNode; readonly onError: () => void; readonly fallback: ReactNode },
  { readonly hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

type MaskTier = "trumbo" | "diamond" | "static";

function ReadyToBuildHeroShader() {
  const trumboMaskUrl = useMemo(() => resolveTrumboMaskUrl(), []);
  const [maskTier, setMaskTier] = useState<MaskTier>("trumbo");

  if (maskTier === "static") {
    return <HeroFallback />;
  }

  const maskUrl = maskTier === "trumbo" ? trumboMaskUrl : DIAMOND_MASK_URL;

  return (
    <ShaderErrorBoundary
      key={maskTier}
      fallback={<HeroFallback />}
      onError={() => {
        setMaskTier((current) => (current === "trumbo" ? "diamond" : "static"));
      }}
    >
      <Suspense fallback={<HeroFallback />}>
        <LiquidMetalHero maskUrl={maskUrl} />
      </Suspense>
    </ShaderErrorBoundary>
  );
}

export function ReadyToBuildHero(props: { readonly className?: string }) {
  if (typeof window === "undefined") {
    return <div className={cn(heroFrameClassName, props.className)} aria-hidden />;
  }

  return (
    <div className={cn(heroFrameClassName, props.className)} aria-hidden>
      <ReadyToBuildHeroShader />
    </div>
  );
}
