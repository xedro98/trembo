import { useState } from "react";

export function SplashScreen() {
  const [logoSrc, setLogoSrc] = useState("/trumbo-logo.svg");
  const [useFallback, setUseFallback] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="flex size-24 items-center justify-center"
        aria-label="Trumbo Code splash screen"
      >
        <img
          alt="Trumbo Code"
          className="size-16 object-contain"
          src={logoSrc}
          onError={() => {
            if (!useFallback) {
              setUseFallback(true);
              setLogoSrc("/apple-touch-icon.png");
            }
          }}
        />
      </div>
    </div>
  );
}
