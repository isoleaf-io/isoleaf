import type { BuildFieldDto } from "@/api/iso20022Builder";

/**
 * Helpers for auto-generating dynamic values (IDs, timestamps, UETR) on
 * Builder fields. The Builder calls these:
 *   • once per `Gerar` click — to seed fresh values over the scenario's
 *     static overrides, so the user doesn't see the same MsgId twice;
 *   • per-field on the refresh icon — to regenerate a single value without
 *     touching the rest of the form.
 *
 * Format is intentionally ecosystem-agnostic: a compact ISO timestamp
 * suffix plus 6 random hex chars, with a per-purpose prefix.
 */

const ID_FIELDS = new Set([
  "MsgId",
  "InstrId",
  "EndToEndId",
  "TxId",
]);

const ID_PREFIX_BY_NAME: Record<string, string> = {
  MsgId: "MSG",
  InstrId: "INSTR",
  EndToEndId: "E2E",
  TxId: "TX",
};

const DATETIME_FIELDS = new Set(["CreDtTm", "DtTm", "FrDtTm", "ToDtTm"]);
const DATE_FIELDS = new Set([
  "Dt",
  "ReqdExctnDt",
  "BookgDt",
  "ValDt",
  "IntrBkSttlmDt",
]);

export function isGeneratableField(field: BuildFieldDto): boolean {
  if (field.name === "UETR") return true;
  if (ID_FIELDS.has(field.name)) return true;
  if (DATETIME_FIELDS.has(field.name)) return true;
  if (DATE_FIELDS.has(field.name)) return true;
  if (
    field.typeName === "ISODateTime" ||
    field.typeName === "ISODate"
  ) {
    return true;
  }
  return false;
}

export function generateFieldValue(
  field: BuildFieldDto,
  ecosystemId?: string,
): string {
  const now = new Date();

  // UETR is mandated as UUID v4 by every ecosystem — generic path covers it.
  if (field.name === "UETR") return generateUuidV4();

  // Brazilian Pix — BCB/SPI-regulated formats.
  if (ecosystemId === "brazilian-pix") {
    if (field.name === "EndToEndId") {
      // "E" + ISPB(8) + AAAAMMDD(8) + HHMM(4) + sequencial(11) = 32 chars.
      const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
      const seq = String(Math.floor(Math.random() * 99999999999)).padStart(11, "0");
      return `E99999010${date}${time}${seq}`;
    }
    if (field.name === "MsgId") {
      // ISPB(8) + AAAAMMDD(8) + sequencial(7) — under the 35-char ceiling.
      const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const seq = String(Math.floor(Math.random() * 9999999)).padStart(7, "0");
      return `99999010${date}${seq}`;
    }
    if (field.name === "TxId") {
      // 26 chars, [A-Za-z0-9] — BCB allows 26 to 35; pick the minimum.
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return Array.from({ length: 26 }, () =>
        chars[Math.floor(Math.random() * chars.length)],
      ).join("");
    }
  }

  // SWIFT CBPR+ — short prefix + date + random suffix; UETR already handled above.
  if (ecosystemId === "swift-cbpr") {
    if (field.name === "MsgId") {
      const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `CBPR${date}${random}`;
    }
    if (field.name === "InstrId") {
      // CBPR+ caps InstrId at 16 chars; stay well under.
      return Math.random().toString(36).substring(2, 10).toUpperCase().padEnd(8, "0");
    }
  }

  // TARGET / T2 — BIC11 + date + sequencial recommended.
  if (ecosystemId === "target-t2") {
    if (field.name === "MsgId") {
      const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const seq = String(Math.floor(Math.random() * 999)).padStart(3, "0");
      return `DEUTDEDBXXX${date}${seq}`;
    }
  }

  // Generic fallbacks — used by every other ecosystem and as default when a
  // regulated format above doesn't match the field.
  if (ID_FIELDS.has(field.name)) {
    return `${ID_PREFIX_BY_NAME[field.name]}-${compactTimestamp()}-${randomHex(6)}`;
  }
  if (DATETIME_FIELDS.has(field.name) || field.typeName === "ISODateTime") {
    return isoDateTime(now);
  }
  if (DATE_FIELDS.has(field.name) || field.typeName === "ISODate") {
    // ReqdExctnDt / IntrBkSttlmDt usually point at tomorrow so the message
    // reads like a forward-dated instruction.
    if (field.name === "ReqdExctnDt" || field.name === "IntrBkSttlmDt") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return isoDate(tomorrow);
    }
    return isoDate(now);
  }
  // Caller should have gated on isGeneratableField — return a sane default
  // rather than throwing, so a stray click never crashes the editor.
  return "";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function compactTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function isoDateTime(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

function isoDate(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Minimal fallback (only reached on jsdom < 22 or very old browsers).
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
