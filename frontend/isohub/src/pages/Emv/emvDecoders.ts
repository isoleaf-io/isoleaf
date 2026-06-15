/**
 * Bit-level decoders for the most common EMV TLV tags.
 *
 * Every function below is pure: takes a hex string, returns a structured
 * `DecodedTag` (or `null` if the tag isn't decodable here). The UI layer in
 * <BitDecoderTable /> picks the right rendering based on the `kind`
 * discriminator — adding a new decodable tag just means adding a `case` in
 * `decodeTag` plus the function itself.
 */

// ─── Shared types ─────────────────────────────────────────────────────────

export interface BitRow {
  /** EMV bit notation (8 = MSB, 1 = LSB). */
  bit: number;
  label: string;
  set: boolean;
  rfu?: boolean;
}

export interface ByteBits {
  /** Zero-based byte offset within the tag value. */
  byteIndex: number;
  /** "XX" — uppercase hex representation of this byte. */
  byteHex: string;
  /** "10101010" — 8-char binary string, MSB first. */
  binary: string;
  bits: BitRow[];
}

export interface CodeRow {
  label: string;
  byteHex: string;
  description: string;
}

export interface CvmRule {
  ruleHex: string;
  codeDesc: string;
  conditionDesc: string;
}

export interface IadField {
  label: string;
  offset: number;
  hex: string;
}

export interface RawByteView {
  offset: number;
  hex: string;
  binary: string;
}

export type DecodedTag =
  | { kind: "bits"; bytes: ByteBits[] }
  | { kind: "codes"; rows: CodeRow[] }
  | {
      kind: "cvm-list";
      amountX: string;
      amountY: string;
      rules: CvmRule[];
    }
  | {
      kind: "iad";
      format: "visa" | "mastercard";
      fields: IadField[];
    }
  | { kind: "iad-unknown"; rawBytes: RawByteView[] }
  | null;

// ─── Hex helpers ──────────────────────────────────────────────────────────

function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0) return [];
  if (!/^[0-9A-Fa-f]+$/.test(clean)) return [];
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.substring(i, i + 2), 16));
  return out;
}

function toHex2(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, "0");
}

function toBin8(byte: number): string {
  return byte.toString(2).padStart(8, "0");
}

function rawBytesView(bytes: number[]): RawByteView[] {
  return bytes.map((b, offset) => ({ offset, hex: toHex2(b), binary: toBin8(b) }));
}

/**
 * Builds a single byte's worth of bit rows from a "b8 → label" map. Bits
 * that don't appear in the map are emitted as RFU placeholders.
 */
function decodeByte(
  byteIndex: number,
  byte: number,
  labels: Partial<Record<8 | 7 | 6 | 5 | 4 | 3 | 2 | 1, string>>,
): ByteBits {
  const bits: BitRow[] = [];
  for (const bit of [8, 7, 6, 5, 4, 3, 2, 1] as const) {
    const mask = 1 << (bit - 1);
    const set = (byte & mask) !== 0;
    const label = labels[bit];
    bits.push({ bit, label: label ?? "RFU", set, rfu: label === undefined });
  }
  return { byteIndex, byteHex: toHex2(byte), binary: toBin8(byte), bits };
}

/**
 * Convenience for tags whose every byte is RFU after position N — saves the
 * caller from having to enumerate them.
 */
function decodeRfuByte(byteIndex: number, byte: number): ByteBits {
  return decodeByte(byteIndex, byte, {});
}

// ─── Tag 95 — TVR (Terminal Verification Results, 5 bytes) ────────────────

function decodeTVR(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 5) return null;
  return {
    kind: "bits",
    bytes: [
      decodeByte(0, bytes[0], {
        8: "Offline data authentication was not performed",
        7: "SDA failed",
        6: "ICC data missing",
        5: "Card number appears on hotlist",
        4: "DDA failed",
        3: "CDA failed",
        2: "SDA was selected",
        // b1 RFU
      }),
      decodeByte(1, bytes[1], {
        8: "ICC and terminal have different application versions",
        7: "Expired application",
        6: "Application not yet effective",
        5: "Requested service not allowed for card product",
        4: "New card",
        // b3..b1 RFU
      }),
      decodeByte(2, bytes[2], {
        8: "Cardholder verification was not successful",
        7: "Unrecognised CVM",
        6: "PIN Try Limit exceeded",
        5: "PIN entry required and PIN pad not present or not working",
        4: "PIN entry required, PIN pad present, but PIN was not entered",
        3: "Online PIN entered",
        // b2..b1 RFU
      }),
      decodeByte(3, bytes[3], {
        8: "Transaction exceeds floor limit",
        7: "Lower consecutive offline limit exceeded",
        6: "Upper consecutive offline limit exceeded",
        5: "Transaction selected randomly for online processing",
        4: "Merchant forced transaction online",
        // b3..b1 RFU
      }),
      decodeByte(4, bytes[4], {
        8: "Default TDOL used",
        7: "Issuer authentication failed",
        6: "Script processing failed before final GENERATE AC",
        5: "Script processing failed after final GENERATE AC",
        // b4..b1 RFU
      }),
    ],
  };
}

// ─── Tag 82 — AIP (Application Interchange Profile, 2 bytes) ──────────────

function decodeAIP(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 2) return null;
  return {
    kind: "bits",
    bytes: [
      decodeByte(0, bytes[0], {
        // b8 RFU
        7: "SDA supported",
        6: "DDA supported",
        5: "Cardholder verification is supported",
        4: "Terminal risk management is to be performed",
        3: "Issuer authentication is supported",
        // b2 RFU
        1: "CDA supported",
      }),
      decodeByte(1, bytes[1], {
        8: "Consumer Device CVM supported (Mastercard)",
        // b7..b1 RFU
      }),
    ],
  };
}

// ─── Tag 9B — TSI (Transaction Status Information, 2 bytes) ───────────────

function decodeTSI(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 2) return null;
  return {
    kind: "bits",
    bytes: [
      decodeByte(0, bytes[0], {
        8: "Offline data authentication was performed",
        7: "Cardholder verification was performed",
        6: "Card risk management was performed",
        5: "Issuer authentication was performed",
        4: "Terminal risk management was performed",
        3: "Script processing was performed",
        // b2..b1 RFU
      }),
      decodeRfuByte(1, bytes[1]),
    ],
  };
}

// ─── Tag 9F34 — CVM Results (3 bytes) ─────────────────────────────────────

const CVM_PERFORMED: Record<number, string> = {
  0x00: "Fail CVM processing",
  0x01: "Plaintext PIN verification performed by ICC",
  0x02: "Enciphered PIN verified online",
  0x03: "Plaintext PIN verification performed by ICC and signature",
  0x04: "Enciphered PIN verification performed by ICC",
  0x05: "Enciphered PIN verification performed by ICC and signature",
  0x1E: "Signature",
  0x1F: "No CVM required",
  0x3F: "Not performed / unknown",
};

const CVM_CONDITION: Record<number, string> = {
  0x00: "Always",
  0x01: "If unattended cash",
  0x02: "If not unattended cash and not manual cash and not purchase with cashback",
  0x03: "If terminal supports the CVM",
  0x04: "If manual cash",
  0x05: "If purchase with cashback",
  0x06: "If transaction is in the application currency and under X value",
  0x07: "If transaction is in the application currency and over X value",
};

const CVM_RESULT: Record<number, string> = {
  0x00: "Unknown",
  0x01: "Failed",
  0x02: "Successful",
};

function decodeCVMResults(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 3) return null;
  return {
    kind: "codes",
    rows: [
      { label: "CVM Performed", byteHex: toHex2(bytes[0]), description: CVM_PERFORMED[bytes[0]] ?? "Unknown / proprietary code" },
      { label: "CVM Condition", byteHex: toHex2(bytes[1]), description: CVM_CONDITION[bytes[1]] ?? "Unknown / proprietary code" },
      { label: "CVM Result", byteHex: toHex2(bytes[2]), description: CVM_RESULT[bytes[2]] ?? "Unknown" },
    ],
  };
}

// ─── Tag 8E — CVM List (variable: [X 4B][Y 4B][rule 2B]*) ────────────────

function decodeCVMList(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  // Need at least Amount X (4B) + Amount Y (4B) + one rule (2B) to be useful.
  if (bytes.length < 10 || (bytes.length - 8) % 2 !== 0) return null;
  const toHexN = (slice: number[]) => slice.map(toHex2).join("");
  const amountX = toHexN(bytes.slice(0, 4));
  const amountY = toHexN(bytes.slice(4, 8));
  const rules: CvmRule[] = [];
  for (let i = 8; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] & 0x3F; // bottom 6 bits — top 2 are fail-if-unsuccessful/always
    const condition = bytes[i + 1];
    rules.push({
      ruleHex: toHex2(bytes[i]) + toHex2(bytes[i + 1]),
      codeDesc: CVM_PERFORMED[code] ?? `Code 0x${toHex2(code)}`,
      conditionDesc: CVM_CONDITION[condition] ?? `Condition 0x${toHex2(condition)}`,
    });
  }
  return { kind: "cvm-list", amountX, amountY, rules };
}

// ─── Tag 9F66 — TTQ (Terminal Transaction Qualifiers, 4 bytes, Visa) ──────

function decodeTTQ(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 4) return null;
  return {
    kind: "bits",
    bytes: [
      decodeByte(0, bytes[0], {
        8: "MSD supported",
        // b7 RFU
        6: "qVSDC supported",
        5: "EMV contact chip supported",
        4: "Offline-only reader",
        3: "Online PIN supported",
        2: "Signature supported",
        1: "Offline Data Authentication for Online Authorizations supported",
      }),
      decodeByte(1, bytes[1], {
        8: "Online cryptogram required",
        7: "CVM required",
        6: "(Contact Chip) Offline PIN supported",
        // b5..b1 RFU
      }),
      decodeByte(2, bytes[2], {
        8: "Issuer Update Processing supported",
        7: "Mobile functionality supported (Consumer Device CVM)",
        // b6..b1 RFU
      }),
      decodeRfuByte(3, bytes[3]),
    ],
  };
}

// ─── Tag 9F6C — CTQ (Card Transaction Qualifiers, 2 bytes) ────────────────

function decodeCTQ(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 2) return null;
  return {
    kind: "bits",
    bytes: [
      decodeByte(0, bytes[0], {
        8: "Online PIN required",
        7: "Signature required",
        6: "Go online if Offline Data Authentication fails and reader is online capable",
        5: "Switch interface if Offline Data Authentication fails and reader supports contact chip",
        4: "Go online if application expired",
        3: "Switch interface for cash transactions",
        2: "Switch interface if offline PIN not supported",
        // b1 RFU
      }),
      decodeByte(1, bytes[1], {
        8: "Consumer Device CVM performed",
        7: "Card supports issuer update processing at the POS",
        // b6..b1 RFU
      }),
    ],
  };
}

// ─── Tag 9F10 — IAD (Issuer Application Data, format per scheme) ──────────

/**
 * Heuristic format detection:
 * - byte[0] is treated as the IAD length declaration (informational only).
 * - byte[2] is the scheme discriminator:
 *     0x06 or 0x07 → Visa VIS (byte 1 = DKI, byte 2 = CVN, bytes 3-5 = CVR)
 *     0x01         → Mastercard M/Chip (byte 1 = CVN, byte 2 = DKI, bytes 3-7 = CVR)
 *     anything else → "unknown" — surfaced verbatim as a raw-byte dump.
 */
function decodeIAD(hex: string): DecodedTag {
  const bytes = hexToBytes(hex);
  if (bytes.length < 3) return { kind: "iad-unknown", rawBytes: rawBytesView(bytes) };

  const discriminator = bytes[2];
  const sliceHex = (from: number, to: number) =>
    bytes.slice(from, Math.min(to, bytes.length)).map(toHex2).join("");

  if (discriminator === 0x06 || discriminator === 0x07) {
    return {
      kind: "iad",
      format: "visa",
      fields: [
        { label: "IAD length", offset: 0, hex: toHex2(bytes[0]) },
        { label: "DKI (Derivation Key Index)", offset: 1, hex: toHex2(bytes[1]) },
        { label: "CVN (Cryptogram Version Number)", offset: 2, hex: toHex2(bytes[2]) },
        { label: "CVR (Card Verification Results)", offset: 3, hex: sliceHex(3, 6) },
      ],
    };
  }

  if (discriminator === 0x01) {
    return {
      kind: "iad",
      format: "mastercard",
      fields: [
        { label: "IAD length", offset: 0, hex: toHex2(bytes[0]) },
        { label: "CVN (Cryptogram Version Number)", offset: 1, hex: toHex2(bytes[1]) },
        { label: "DKI (Derivation Key Index)", offset: 2, hex: toHex2(bytes[2]) },
        { label: "CVR (Card Verification Results)", offset: 3, hex: sliceHex(3, 8) },
      ],
    };
  }

  return { kind: "iad-unknown", rawBytes: rawBytesView(bytes) };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────

/**
 * Returns a structured bit-level decode for the given EMV tag, or `null` if
 * we don't know how to decode that tag yet (the TagsTable then skips the
 * accordion for that row).
 *
 * Tag IDs are matched case-insensitively and tolerate a leading "0x".
 */
export function decodeTag(tag: string, value: string): DecodedTag {
  const t = tag.toUpperCase().replace(/^0X/, "");
  switch (t) {
    case "95":   return decodeTVR(value);
    case "82":   return decodeAIP(value);
    case "9B":   return decodeTSI(value);
    case "9F34": return decodeCVMResults(value);
    case "8E":   return decodeCVMList(value);
    case "9F66": return decodeTTQ(value);
    case "9F6C": return decodeCTQ(value);
    case "9F10": return decodeIAD(value);
    default:     return null;
  }
}
