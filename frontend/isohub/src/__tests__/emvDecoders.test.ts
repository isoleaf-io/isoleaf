import { describe, expect, it } from "vitest";
import { decodeTag } from "@/pages/Emv/emvDecoders";

/**
 * Helper to assert a `bits` decode came back as expected. Pulls out the bit
 * row by EMV bit number from the named byte so tests read clearly.
 */
function bitOf(decoded: ReturnType<typeof decodeTag>, byteIndex: number, bit: number) {
  if (!decoded || decoded.kind !== "bits") throw new Error("not a bits decode");
  const byte = decoded.bytes[byteIndex];
  const row = byte.bits.find((r) => r.bit === bit);
  if (!row) throw new Error(`bit ${bit} not found in byte ${byteIndex}`);
  return row;
}

describe("decodeTag — unknown tags", () => {
  it("returns null for tags we don't decode", () => {
    expect(decodeTag("5A", "4111111111111111")).toBeNull();
    expect(decodeTag("9F26", "AABBCCDDEEFF0011")).toBeNull();
  });

  it("returns null when hex is empty or mis-sized for the tag", () => {
    // TVR must be 5 bytes.
    expect(decodeTag("95", "0000")).toBeNull();
    // AIP must be 2 bytes.
    expect(decodeTag("82", "00")).toBeNull();
  });

  it("is case-insensitive and tolerates 0x prefix", () => {
    expect(decodeTag("95", "9500000000")?.kind).toBe("bits");
    expect(decodeTag("0x95", "9500000000")?.kind).toBe("bits");
    expect(decodeTag("0X95", "9500000000")?.kind).toBe("bits");
  });
});

describe("Tag 95 — TVR", () => {
  it("flags b8 of byte 1 when value is 9500000000 (Offline data auth NOT performed)", () => {
    const d = decodeTag("95", "9500000000");
    expect(d?.kind).toBe("bits");
    if (d?.kind !== "bits") return;
    expect(d.bytes).toHaveLength(5);
    expect(bitOf(d, 0, 8).set).toBe(true);
    expect(bitOf(d, 0, 8).label).toMatch(/Offline data authentication was not performed/i);
    // 0x95 = 10010101 → b8 b5 b3 b1 set.
    expect(bitOf(d, 0, 7).set).toBe(false);
    expect(bitOf(d, 0, 5).set).toBe(true);
    expect(bitOf(d, 0, 3).set).toBe(true);
    // b1 of byte 1 is RFU per the spec.
    expect(bitOf(d, 0, 1).rfu).toBe(true);
  });

  it("emits all-zero bits when value is 0000000000", () => {
    const d = decodeTag("95", "0000000000");
    expect(d?.kind).toBe("bits");
    if (d?.kind !== "bits") return;
    for (const byte of d.bytes) {
      for (const row of byte.bits) {
        expect(row.set).toBe(false);
      }
    }
  });
});

describe("Tag 82 — AIP", () => {
  it("decodes 5800 with SDA + CVM + Terminal-risk set (byte 1 = 0x58)", () => {
    // 0x58 = 01011000 → b7 (SDA), b5 (Cardholder verif), b4 (Terminal risk) set.
    const d = decodeTag("82", "5800");
    expect(d?.kind).toBe("bits");
    if (d?.kind !== "bits") return;
    expect(bitOf(d, 0, 7).set).toBe(true);   // SDA supported
    expect(bitOf(d, 0, 5).set).toBe(true);   // Cardholder verification
    expect(bitOf(d, 0, 4).set).toBe(true);   // Terminal risk management
    expect(bitOf(d, 0, 6).set).toBe(false);  // DDA NOT supported
    expect(bitOf(d, 0, 1).set).toBe(false);  // CDA NOT supported
    // b8 + b2 are RFU per the spec.
    expect(bitOf(d, 0, 8).rfu).toBe(true);
    expect(bitOf(d, 0, 2).rfu).toBe(true);
  });

  it("decodes 0000 as all clear", () => {
    const d = decodeTag("82", "0000");
    expect(d?.kind).toBe("bits");
    if (d?.kind !== "bits") return;
    expect(d.bytes.every((b) => b.bits.every((r) => !r.set))).toBe(true);
  });
});

describe("Tag 9F66 — TTQ", () => {
  it("decodes 36804000 (qVSDC, EMV contact, Online PIN, Signature, Online crypto required, CDCVM)", () => {
    // byte 0 = 0x36 = 00110110 → b6 (qVSDC), b5 (EMV contact chip), b3 (Online PIN), b2 (Signature)
    // byte 1 = 0x80 = 10000000 → b8 (Online cryptogram required)
    // byte 2 = 0x40 = 01000000 → b7 (Mobile / Consumer Device CVM)
    // byte 3 = 0x00 → all RFU
    const d = decodeTag("9F66", "36804000");
    expect(d?.kind).toBe("bits");
    if (d?.kind !== "bits") return;
    expect(d.bytes).toHaveLength(4);
    expect(bitOf(d, 0, 6).set).toBe(true);  // qVSDC
    expect(bitOf(d, 0, 5).set).toBe(true);  // EMV contact chip
    expect(bitOf(d, 0, 3).set).toBe(true);  // Online PIN
    expect(bitOf(d, 0, 2).set).toBe(true);  // Signature
    expect(bitOf(d, 0, 8).set).toBe(false); // MSD NOT set
    expect(bitOf(d, 1, 8).set).toBe(true);  // Online cryptogram required
    expect(bitOf(d, 2, 7).set).toBe(true);  // Mobile / Consumer Device CVM
  });
});

describe("Tag 9F10 — IAD (Issuer Application Data)", () => {
  it("detects Visa VIS format when byte[2] = 0x06", () => {
    // length(0x06) + DKI(0x01) + CVN(0x06) + CVR(4 bytes)
    const d = decodeTag("9F10", "0601060A03A4B0C0");
    expect(d?.kind).toBe("iad");
    if (d?.kind !== "iad") return;
    expect(d.format).toBe("visa");
    expect(d.fields[0]).toEqual({ label: "IAD length", offset: 0, hex: "06" });
    expect(d.fields[1].label).toMatch(/DKI/);
    expect(d.fields[1].hex).toBe("01");
    expect(d.fields[2].label).toMatch(/CVN/);
    expect(d.fields[2].hex).toBe("06");
    expect(d.fields[3].label).toMatch(/CVR/);
    expect(d.fields[3].hex).toBe("0A03A4");  // bytes 3..5
  });

  it("detects Visa VIS format when byte[2] = 0x07", () => {
    // length(0x07) + DKI(0x02) + CVN(0x07) + CVR(5 bytes)
    const d = decodeTag("9F10", "0702070000000000");
    expect(d?.kind).toBe("iad");
    if (d?.kind !== "iad") return;
    expect(d.format).toBe("visa");
    expect(d.fields[2].hex).toBe("07");
  });

  it("detects Mastercard M/Chip format when byte[2] = 0x01", () => {
    // length(0x14) + CVN(0x12) + DKI(0x01) + CVR(5 bytes) + issuer-discretionary tail
    const d = decodeTag("9F10", "1412010102030405A1B2C3D4E5F6");
    expect(d?.kind).toBe("iad");
    if (d?.kind !== "iad") return;
    expect(d.format).toBe("mastercard");
    expect(d.fields[0].hex).toBe("14");        // length
    expect(d.fields[1].label).toMatch(/CVN/);
    expect(d.fields[1].hex).toBe("12");
    expect(d.fields[2].label).toMatch(/DKI/);
    expect(d.fields[2].hex).toBe("01");
    expect(d.fields[3].label).toMatch(/CVR/);
    expect(d.fields[3].hex).toBe("0102030405"); // bytes 3..7
  });

  it("returns iad-unknown for unrecognised formats", () => {
    // byte[2] = 0xFF — not Visa (0x06/0x07) and not Mastercard (0x01).
    const d = decodeTag("9F10", "08DEFFCAFE112233");
    expect(d?.kind).toBe("iad-unknown");
    if (d?.kind !== "iad-unknown") return;
    expect(d.rawBytes).toHaveLength(8);
    expect(d.rawBytes[0]).toEqual({ offset: 0, hex: "08", binary: "00001000" });
    expect(d.rawBytes[2].hex).toBe("FF");
  });

  it("returns iad-unknown when there aren't even 3 bytes to inspect", () => {
    const d = decodeTag("9F10", "0102");
    expect(d?.kind).toBe("iad-unknown");
  });
});

describe("Tag 9F34 — CVM Results codes", () => {
  it("decodes 1F0002 as 'No CVM required / Always / Successful'", () => {
    const d = decodeTag("9F34", "1F0002");
    expect(d?.kind).toBe("codes");
    if (d?.kind !== "codes") return;
    expect(d.rows[0].byteHex).toBe("1F");
    expect(d.rows[0].description).toMatch(/No CVM required/);
    expect(d.rows[1].description).toMatch(/Always/);
    expect(d.rows[2].description).toMatch(/Successful/);
  });
});
