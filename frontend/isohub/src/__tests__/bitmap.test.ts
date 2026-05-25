import { describe, expect, it } from "vitest";

// Pure helper extracted from BitmapPage; tested in isolation.
function bitsToHex(bits: Set<number>) {
  const buf = new Uint8Array(16);
  for (const b of bits) {
    if (b < 1 || b > 128) continue;
    const idx = (b - 1) >> 3;
    const off = 7 - ((b - 1) & 7);
    buf[idx] |= 1 << off;
  }
  const hasSecondary = Array.from(bits).some((b) => b > 64);
  if (hasSecondary) buf[0] |= 0x80;
  const slice = hasSecondary ? buf : buf.slice(0, 8);
  return Array.from(slice)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

describe("bitmap helper", () => {
  it("encodes empty bitset to all-zero hex", () => {
    expect(bitsToHex(new Set())).toBe("0000000000000000");
  });

  it("encodes bit 2 as 0x40 in first byte", () => {
    expect(bitsToHex(new Set([2]))).toBe("4000000000000000");
  });

  it("encodes bits 2,3,4,7,11,12 as 0x7230...", () => {
    // 0x72 = 0111 0010 → bits 2,3,4,7;  0x30 = 0011 0000 → bits 11,12
    expect(bitsToHex(new Set([2, 3, 4, 7, 11, 12]))).toBe("7230000000000000");
  });

  it("sets bit 1 automatically when secondary bits are present", () => {
    const result = bitsToHex(new Set([65]));
    expect(result.startsWith("80")).toBe(true);
    expect(result.length).toBe(32);
  });
});
