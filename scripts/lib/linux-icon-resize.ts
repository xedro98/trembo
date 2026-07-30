// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";

import { PNG } from "pngjs";

export function resizeLinuxIconWithPngJs(
  sourcePng: string,
  targetPng: string,
  iconSize: number,
): void {
  const source = PNG.sync.read(NodeFS.readFileSync(sourcePng));
  const target = new PNG({ width: iconSize, height: iconSize });

  for (let y = 0; y < iconSize; y++) {
    const srcY = Math.min(source.height - 1, Math.floor((y * source.height) / iconSize));
    for (let x = 0; x < iconSize; x++) {
      const srcX = Math.min(source.width - 1, Math.floor((x * source.width) / iconSize));
      const srcIdx = (source.width * srcY + srcX) << 2;
      const dstIdx = (iconSize * y + x) << 2;
      target.data[dstIdx] = source.data[srcIdx]!;
      target.data[dstIdx + 1] = source.data[srcIdx + 1]!;
      target.data[dstIdx + 2] = source.data[srcIdx + 2]!;
      target.data[dstIdx + 3] = source.data[srcIdx + 3]!;
    }
  }

  NodeFS.writeFileSync(targetPng, PNG.sync.write(target));
}
