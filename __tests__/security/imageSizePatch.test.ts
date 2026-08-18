import { spawnSync } from "node:child_process";

import { imageSize } from "image-size";
import { JXL } from "image-size/dist/types/jxl";

describe("image-size security patch", () => {
  it("rejects a zero-length ICNS image entry", () => {
    const malformedIcns = new Uint8Array([
      0x69, 0x63, 0x6e, 0x73, 0, 0, 0, 16, 0x69, 0x63, 0x30, 0x37, 0, 0, 0, 0,
    ]);

    expect(() => imageSize(malformedIcns)).toThrow("Invalid ICNS image length");
  });

  it("returns from a zero-length JXL box", () => {
    const malformedJxl = new Uint8Array([0, 0, 0, 0, 0x6a, 0x78, 0x6c, 0x70]);

    expect(() => JXL.calculate(malformedJxl)).toThrow();
  });

  it("returns from a zero-length HEIF box", () => {
    const utilsPath = require.resolve("image-size/dist/types/utils");
    const script = `const { findBox } = require(${JSON.stringify(
      utilsPath,
    )}); findBox(Uint8Array.from([0, 0, 0, 0, 102, 114, 101, 101]), "meta", 0);`;
    const result = spawnSync(process.execPath, ["-e", script], {
      timeout: 1000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });
});
