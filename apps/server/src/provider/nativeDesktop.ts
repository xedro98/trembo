export function isNativeTrumboDesktopBuild(): boolean {
  return process.env.TRUMBO_CODE_NATIVE_DESKTOP === "1";
}
