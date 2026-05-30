import type { DocSection } from "./types";
import { TPDU_SVG, MESSAGE_STRUCTURE_SVG, EMV_BIT55_ORIGINS_SVG, EMV_DERIVATION_CHAIN_SVG, FOUR_LEGS_FLOW_SVG, ISOHUB_ARCHITECTURE_SVG } from "./diagrams";

/** Long-form documentation in English. Mirror of content.pt.ts. */
export const DOCS_EN: Record<string, DocSection> = {
  iso8583: {
    id: "iso8583",
    blocks: [
      // ── 1. What is ISO 8583 ───────────────────────────────────────────
      { type: "heading", level: 2, text: "What is ISO 8583" },
      {
        type: "paragraph",
        text:
          "ISO/IEC 8583 is the international standard that defines the structure, fields and encoding of electronic messages exchanged in card payment transactions — authorizations, financial, reversals, network management and administrative.",
      },
      {
        type: "paragraph",
        text:
          "It is the common language between terminals/POS, acquirers, brand networks and issuers: every participant sends and receives messages in this format, on both directions of the flow (request and response).",
      },
      {
        type: "paragraph",
        text:
          "The standard does NOT define the transport protocol (TCP, X.25, SNA, etc.) — only the message format itself. Each network decides how to frame and transport these messages; this is why concepts like TPDU, length-based framing or STX/ETX are defined per brand/network, not by ISO 8583.",
      },

      // ── 2. Structure ──────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Message structure" },
      {
        type: "paragraph",
        text:
          "A full message can have up to 3 parts: TPDU (optional, transport) + MTI + Bitmap(s) + Data Elements. The TPDU is widely used in TCP/IP networks but is not part of the ISO 8583 standard itself.",
      },
      { type: "svg", text: MESSAGE_STRUCTURE_SVG },

      // ── 3. TPDU ───────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "TPDU — Transport Protocol Data Unit" },
      {
        type: "callout",
        tone: "info",
        text:
          "The TPDU is not part of the ISO 8583 standard. It's a routing header added by each network's transport protocol (Visa, Mastercard, acquirer networks). Not every implementation uses TPDU.",
      },
      {
        type: "paragraph",
        text:
          "When present, it's 5 bytes (10 hex chars) prefixed to the ISO 8583 message. Used for TCP routing between participants — it tells the concentrator who sent the message and who should receive it.",
      },
      {
        type: "table",
        headers: ["Bytes", "Field", "Size", "Example"],
        rows: [
          ["Byte 1", "Protocol ID", "1 byte", "60"],
          ["Bytes 2-3", "Origin NII", "2 bytes", "0002"],
          ["Bytes 4-5", "Destination NII", "2 bytes", "0001"],
        ],
      },
      { type: "svg", text: TPDU_SVG },
      {
        type: "paragraph",
        text:
          "NII (Network Interface Identifier) is an identifier assigned by the brand to each network participant. Full example: 6000020001 → protocol 0x60, origin 0002, destination 0001.",
      },

      // ── 4. MTI ────────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "MTI — Message Type Indicator" },
      {
        type: "paragraph",
        text:
          "4 numeric digits identifying the message type. Each digit has a specific positional meaning — read left to right.",
      },
      {
        type: "table",
        headers: ["Digit", "Name", "Values"],
        rows: [
          ["1", "Version", "0 = ISO 8583:1987 · 1 = ISO 8583:1993 · 2 = ISO 8583:2003"],
          ["2", "Class", "1 = Authorization · 2 = Financial · 4 = Reversal · 8 = Network"],
          ["3", "Function", "0 = Request · 1 = Response · 2 = Advice · 3 = Advice response"],
          ["4", "Origin", "0 = Acquirer · 2 = Issuer · 4 = Other"],
        ],
      },
      { type: "heading", level: 3, text: "Most common MTIs" },
      {
        type: "table",
        headers: ["MTI", "Name", "Typical use"],
        rows: [
          ["0100", "Authorization Request", "Pre-authorization (no debit)"],
          ["0110", "Authorization Response", "Reply to pre-authorization"],
          ["0200", "Financial Request", "Immediate debit (purchase, withdrawal)"],
          ["0210", "Financial Response", "Reply to financial transaction"],
          ["0400", "Reversal Request", "Reversal / void of a transaction"],
          ["0410", "Reversal Response", "Reversal confirmation"],
          ["0420", "Reversal Advice", "Reversal advice (no response expected)"],
          ["0800", "Network Management Request", "Echo test, sign-on / sign-off"],
          ["0810", "Network Management Response", "Reply to network management"],
        ],
      },

      // ── 5. Bitmap ─────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Bitmap — map of present fields" },
      {
        type: "paragraph",
        text:
          "The bitmap is a sequence of bits where each bit indicates whether the corresponding field is present in the message. Bit 1 = present; bit 0 = absent.",
      },
      {
        type: "list",
        items: [
          "Primary bitmap: 8 bytes (64 bits) → indicates fields 1 to 64.",
          "Secondary bitmap: 8 bytes (64 bits) → indicates fields 65 to 128.",
          "The secondary bitmap only appears when bit 1 of the primary bitmap is on.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Bit 1 of the bitmap does NOT represent a data field — it is the flag indicating whether the secondary bitmap is present. That's why the first real data field starts at bit 2 (PAN).",
      },
      { type: "heading", level: 3, text: "Reading the bitmap byte by byte" },
      {
        type: "code",
        text:
`Hex bitmap:  F2 3C 24 81 28 C0 82 00
Binary:      11110010 00111100 00100100 10000001
             00101000 11000000 10000010 00000000
             │└──┬──┘ └──┬───┘ └──┬───┘ └──┬───┘
             │  bits     bits     bits     bits
             │  2-8      9-16    17-24    25-32
             │
             └─ bit 1: secondary bitmap present? (=1, yes)

Reading each bit left to right:
  Bit 1  = 1 → secondary bitmap present (fields 65-128 may exist)
  Bit 2  = 1 → field 2 (PAN) present
  Bit 3  = 1 → field 3 (Processing Code) present
  Bit 4  = 1 → field 4 (Amount, Transaction) present
  Bit 5  = 0 → field 5 absent
  Bit 6  = 0 → field 6 absent
  Bit 7  = 1 → field 7 (Transmission DateTime) present
  Bit 8  = 0 → field 8 absent
  ... and so on up to bit 64`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "To read manually: convert each hex pair to binary (e.g. F2 → 11110010). The most-significant bit (MSB) of each byte maps to the lowest field number in that group of 8.",
      },

      // ── 6. Data Elements ──────────────────────────────────────────────
      { type: "heading", level: 2, text: "Data Elements" },
      {
        type: "paragraph",
        text:
          "Each field has: number (1-128), name, encoding type (how the content is encoded), length type (fixed or variable) and max size.",
      },
      { type: "heading", level: 3, text: "Encoding types" },
      {
        type: "table",
        headers: ["Type", "Meaning", "Example"],
        rows: [
          ["n", "Numeric (0-9)", `"000001"`],
          ["a", "Alphabetic (A-Z, space)", `"PURCHASE"`],
          ["an", "Alphanumeric", `"STORE01"`],
          ["ans", "Alphanumeric + special", `"STORE/01"`],
          ["b", "Binary", "raw bytes"],
          ["z", "Magnetic track", `"4111=2512"`],
          ["x+n", "Sign (C/D) + numeric", `"C000000010000"`],
        ],
      },
      { type: "heading", level: 3, text: "Length types" },
      {
        type: "table",
        headers: ["Type", "Meaning"],
        rows: [
          ["FIXED", "Fixed length, always the same"],
          ["LLVAR", "2-digit length prefix + value (max 99)"],
          ["LLLVAR", "3-digit length prefix + value (max 999)"],
        ],
      },
      {
        type: "code",
        text:
`Example LLVAR — field 35 (Track 2) with value "4111111111111111=2512":

  20 4111111111111111=2512
  ┬─ ─────────────────────
  │           value (20 characters)
  │
  └ length "20" in 2 digits`,
      },

      // ── 7. Most important fields ──────────────────────────────────────
      { type: "heading", level: 2, text: "Most important fields" },
      {
        type: "paragraph",
        text:
          "The fields below appear in most transactions and are essential to read any ISO 8583 message — the ISOHub Builder and Parser highlight them too.",
      },

      { type: "heading", level: 3, text: "Bit 2 — PAN (Primary Account Number)" },
      {
        type: "paragraph",
        text:
          "Type: LLVAR n, max 19 digits. The card number. The first 6-8 digits form the BIN, which identifies the issuer and the brand. Always masked in the UI (e.g. 636368******4970).",
      },

      { type: "heading", level: 3, text: "Bit 3 — Processing Code" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 6. Six digits split into 3 sub-fields of 2 digits each — they describe what the transaction does, from which account and to which account.",
      },
      {
        type: "table",
        headers: ["Position", "Sub-field", "Common values"],
        rows: [
          ["1-2", "Transaction type", "00 = Purchase · 01 = Withdrawal · 20 = Refund · 30 = Inquiry"],
          ["3-4", "Account debited (from)", "00 = Default · 10 = Savings · 20 = Checking · 30 = Credit"],
          ["5-6", "Account credited (to)", "00 = Default · 10 = Savings · 20 = Checking · 30 = Credit"],
        ],
      },
      {
        type: "code",
        text:
`Examples:
  003000 → Credit purchase   (00 = purchase, 30 = credit,   00 = default)
  012020 → Cash withdrawal   (01 = withdraw, 20 = checking, 20 = checking)
  203000 → Refund / void of credit purchase`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Sub-fields 3-4 and 5-6 are not universal — each brand/acquirer can use proprietary combinations. Visa, Mastercard and Elo, for instance, diverge on a few values for debit single-pay vs. installments and credit vs. savings debit. Always check the processing-code catalog of the partner you integrate with.",
      },

      { type: "heading", level: 3, text: "Bit 4 — Amount, Transaction" },
      {
        type: "paragraph",
        text: "Type: FIXED n 12. Transaction amount in the smallest currency unit (e.g. cents), no decimal separator. Ex.: 000000018233 = USD 182.33.",
      },

      { type: "heading", level: 3, text: "Bit 7 — Transmission Date & Time" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 10. Format MMDDHHmmss (month, day, hour, minute, second) in UTC. Ex.: 0522104642 = May 22, 10:46:42.",
      },

      { type: "heading", level: 3, text: "Bit 11 — STAN (Systems Trace Audit Number)" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 6. Sequential transaction number generated by the terminal. Unique per terminal per day. Used for tracking and to correlate request and response. Ex.: 000042.",
      },

      { type: "heading", level: 3, text: "Bit 22 — POS Entry Mode" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 3. How the card was read by the terminal. Different from the application's \"channel\" abstraction — Bit 22 is what the terminal actually reported.",
      },
      {
        type: "table",
        headers: ["Value", "Channel", "Description"],
        rows: [
          ["010", "Manual / keyed", "PAN typed on the keypad"],
          ["021", "Magnetic stripe", "Track read"],
          ["051", "Chip (EMV)", "Chip contact, data validated"],
          ["071", "Contactless / NFC", "Card or phone tap"],
          ["090", "Stripe (chip fallback)", "Chip didn't read, fell back to stripe"],
          ["801", "Stripe, no CVV", "Fallback without PIN"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 35 — Track 2 Data" },
      {
        type: "paragraph",
        text:
          "Type: LLVAR z, max 37 chars. Track 2 magnetic stripe data. Format: PAN=YYMM[Service Code][Discretionary data]. Ex.: 4111111111111111=25121011234567890. The \"=\" separator splits PAN from service data (originally D on the physical track, mapped to = on the wire).",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Track 2 carries sensitive card data. Never store or transmit it without encryption / tokenization (PCI DSS).",
      },

      { type: "heading", level: 3, text: "Bit 37 — RRN (Retrieval Reference Number)" },
      {
        type: "paragraph",
        text:
          "Type: FIXED an 12. Unique reference number assigned by the acquirer. Used to identify the transaction in reversals, chargebacks and reconciliation. Must be unique per day.",
      },

      { type: "heading", level: 3, text: "Bit 38 — Authorization ID Response" },
      {
        type: "paragraph",
        text:
          "Type: FIXED an 6. Authorization code returned by the issuer when the transaction is approved. Ex.: \"123456\". Present only in the response (0110 / 0210).",
      },

      { type: "heading", level: 3, text: "Bit 39 — Response Code" },
      {
        type: "paragraph",
        text:
          "Type: FIXED an 2. Authorization result. \"00\" = approved; other values indicate the rejection reason.",
      },
      {
        type: "table",
        headers: ["RC", "Meaning"],
        rows: [
          ["00", "Approved"],
          ["05", "Do not honor (generic decline)"],
          ["12", "Invalid transaction"],
          ["14", "Invalid PAN"],
          ["41", "Lost card"],
          ["43", "Stolen card"],
          ["51", "Insufficient funds"],
          ["54", "Expired card"],
          ["55", "Incorrect PIN"],
          ["57", "Transaction not permitted to cardholder"],
          ["62", "Restricted card"],
          ["91", "Issuer unavailable"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 41 — Terminal ID" },
      { type: "paragraph", text: "Type: FIXED ans 8. Unique terminal identifier registered with the acquirer." },

      { type: "heading", level: 3, text: "Bit 42 — Merchant ID" },
      { type: "paragraph", text: "Type: FIXED ans 15. Unique identifier of the merchant." },

      { type: "heading", level: 3, text: "Bit 49 — Currency Code, Transaction" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 3. ISO 4217 currency code. 986 = BRL (Brazilian Real), 840 = USD, 978 = EUR.",
      },

      { type: "heading", level: 3, text: "Bit 52 — PIN Data" },
      {
        type: "paragraph",
        text:
          "Type: FIXED b 8. Encrypted PIN Block (8 bytes = 16 hex chars) in ISO 9564 format. Encrypted with the ZPK (Zone PIN Key) agreed between acquirer and brand.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The PIN Block is ultra-sensitive data. Never display it in clear text. ISOHub always shows it as ******** (masked).",
      },

      { type: "heading", level: 3, text: "Bit 55 — ICC Data (EMV)" },
      {
        type: "paragraph",
        text:
          "Type: LLLVAR b, max 255 bytes. EMV chip data in BER-TLV format. Carries the ARQC (chip cryptogram), ATC, TVR, AIP and dozens of other tags. See the \"EMV & Cryptography\" section for the full details.",
      },

      { type: "heading", level: 3, text: "Bit 90 — Original Data Elements" },
      {
        type: "paragraph",
        text:
          "Type: FIXED n 42. Present only in reversals (MTI 04xx). Carries the original transaction's data packed together: original MTI (4) + STAN (6) + DateTime (10) + RRN (12) + zero-padding up to 42.",
      },

      // ── 8. Annotated full message ─────────────────────────────────────
      { type: "heading", level: 2, text: "Annotated full message example" },
      {
        type: "paragraph",
        text:
          "To put everything together, here is an annotated example of a 0200 (financial request, credit purchase via chip) with TPDU. Each block of the example is a slice of the real ASCII wire.",
      },
      {
        type: "code",
        text:
`Full wire:
6000020001 0200 F23C248128C08200 16 4111111111111111 003000 000000018233 0522104642 000042 ...

Broken down:

  6000020001                       ← TPDU (5 bytes / 10 hex)
    60       protocol
    0002     origin NII (acquirer)
    0001     destination NII (brand)

  0200                             ← MTI (Financial Request)

  F23C248128C08200                 ← Primary bitmap (8 bytes)
    bit 1 = 1 → does it have a secondary bitmap? (this example
                doesn't — bit 1 is 0; F2 = 11110010)
    bits 2,3,4,7,11,12,...        → fields present

  16 4111111111111111              ← Bit 2 — PAN (LLVAR)
    "16" = length, then 16 PAN digits

  003000                           ← Bit 3 — Processing Code
    00 = purchase · 30 = credit · 00 = default

  000000018233                     ← Bit 4 — Amount (12 digits)
    USD 182.33

  0522104642                       ← Bit 7 — Transmission DateTime
    May 22 10:46:42 UTC

  000042                           ← Bit 11 — STAN
    42nd transaction of the day on this terminal

  ...                              ← remaining fields follow the
                                     bitmap order (12, 13, 14, 22,
                                     35, 37, 41, 42, 49, 52, 55 ...)`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The example above is for illustration only — spaces and comments are for readability. To test in the Parser, use a real ISO 8583 message generated by the Builder (no spaces, no comments). The Parser accepts ASCII wire and binary-hex without separators.",
      },

      // ── 9. Wire formats ───────────────────────────────────────────────
      { type: "heading", level: 2, text: "Wire formats" },
      {
        type: "paragraph",
        text:
          "ISOHub automatically supports two transmission formats for the same ISO 8583 message:",
      },
      {
        type: "table",
        headers: ["Format", "Description", "Example (start)"],
        rows: [
          ["ASCII wire", "Fields represented as ASCII text", `"0200F23C...NJJZ3Z"`],
          ["Binary-hex", "Bytes in hexadecimal (each byte = 2 chars)", `"30323030463233..."`],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "ASCII wire and binary-hex are just different encodings of the same ISO 8583 message. The ISOHub Parser auto-detects which one was pasted — you don't have to specify.",
      },
      {
        type: "code",
        text:
`Same MTI "0200" in three representations:

  ASCII wire:     0200          (4 ASCII chars; bytes on wire: 30 32 30 30)
  Binary-hex:     30323030      (hex of the ASCII bytes above — 8 chars)
  Raw binary:     02 00         (2 binary bytes — NOT ASCII;
                                  rare in ISO 8583, common in EMV TLV)`,
      },
    ],
  },

  emv: {
    id: "emv",
    blocks: [
      // ── 1. What is EMV ──────────────────────────────────────────────
      { type: "heading", level: 2, text: "What is EMV" },
      {
        type: "paragraph",
        text:
          "Global standard (Europay, Mastercard, Visa) for chip transactions. Defines the communication between chip and terminal and the cryptographic mechanisms that authenticate each transaction.",
      },
      {
        type: "paragraph",
        text:
          "Unlike ISO 8583 (which defines the network message), EMV defines what happens BEFORE the message is sent: the generation of security data by the card's chip.",
      },

      // ── 2. Bit 55 — where the data comes from ──────────────────────
      { type: "heading", level: 2, text: "Bit 55 — where the data comes from" },
      {
        type: "paragraph",
        text:
          "Bit 55 is a composition of data from three distinct sources. Understanding this is key to knowing what can be manipulated in tests.",
      },
      { type: "svg", text: EMV_BIT55_ORIGINS_SVG },

      { type: "heading", level: 3, text: "Chip data (personalization)" },
      {
        type: "paragraph",
        text:
          "Tags the issuer wrote into the chip when the card was issued. They define the card's capabilities and configuration. ISOHub generates realistic values for these when you use the Builder with Chip channel.",
      },
      { type: "heading", level: 3, text: "Terminal data" },
      {
        type: "paragraph",
        text:
          "Tags the terminal adds to Bit 55. They describe the physical capabilities of the equipment. Values depend on how the terminal was configured.",
      },
      { type: "heading", level: 3, text: "Negotiated data" },
      {
        type: "paragraph",
        text:
          "Tags whose values result from the chip-terminal interaction during the transaction (before the ARQC is calculated). The TVR (Terminal Verification Results), for example, records the outcome of each check performed.",
      },
      { type: "heading", level: 3, text: "Chip-generated data per transaction" },
      {
        type: "paragraph",
        text:
          "The ARQC (tag 9F26) is calculated by the chip on every transaction. The ATC (tag 9F36) increments on every transaction — never repeats. These are the data that prove the physical chip was present.",
      },

      // ── 3. BER-TLV structure ───────────────────────────────────────
      { type: "heading", level: 2, text: "BER-TLV structure" },
      {
        type: "paragraph",
        text:
          "Bit 55 uses BER-TLV (Basic Encoding Rules — Tag Length Value), an encoding format derived from ASN.1.",
      },
      { type: "paragraph", text: "Each TLV element has 3 parts:" },
      {
        type: "table",
        headers: ["Part", "Size", "Description"],
        rows: [
          ["TAG", "1-2 bytes", "Identifies the field. If bits 4-0 = 11111, the next byte is part of the tag."],
          ["LENGTH", "1-3 bytes", "Short form: 1 byte (<128). Long form: 0x81+N or 0x82+NN."],
          ["VALUE", "N bytes", "Content of the field."],
        ],
      },
      {
        type: "code",
        text:
`Bit 55 (hex): 9F 26 08 A1 B2 C3 D4 E5 F6 07 08 9F 36 02 00 1E

Breakdown:
  9F 26              ← TAG 9F26 (2 bytes, since 9F = ...11111)
  08                 ← LENGTH = 8 bytes
  A1B2C3D4E5F60708   ← VALUE = ARQC (8 bytes)

  9F 36              ← TAG 9F36 (2 bytes)
  02                 ← LENGTH = 2 bytes
  00 1E              ← VALUE = ATC = 30 decimal (30th transaction)`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "ISOHub builds and parses BER-TLV automatically. Use EMV Data → Parse Bit 55 to break any Bit 55 into its tags. The parse is partial — if an unknown tag is found, it keeps parsing the next ones.",
      },

      // ── 4. Tag table ───────────────────────────────────────────────
      { type: "heading", level: 2, text: "Most important tags" },
      {
        type: "table",
        headers: ["Tag", "Name", "Origin", "Size", "Description"],
        rows: [
          ["9F26", "ARQC", "Chip/per-tx", "8 bytes", "Authorization cryptogram"],
          ["9F27", "CID", "Chip/per-tx", "1 byte", "Cryptogram type (80=ARQC)"],
          ["9F10", "IAD", "Chip/per-tx", "variable", "Issuer-internal data"],
          ["9F36", "ATC", "Chip/per-tx", "2 bytes", "Transaction counter"],
          ["9F37", "UN", "Terminal", "4 bytes", "Unpredictable number"],
          ["9F02", "Amount", "Terminal", "6 bytes", "Authorized amount"],
          ["9F03", "Amount Other", "Terminal", "6 bytes", "Additional amount"],
          ["9A", "Tx Date", "Terminal", "3 bytes", "Transaction date (YYMMDD)"],
          ["9C", "Tx Type", "Terminal", "1 byte", "Type (00=purchase, 01=cash)"],
          ["95", "TVR", "Negotiated", "5 bytes", "Terminal Verification Results"],
          ["82", "AIP", "Chip", "2 bytes", "Application Interchange Profile"],
          ["9F33", "Term Cap", "Terminal", "3 bytes", "Terminal capabilities"],
          ["8E", "CVM List", "Chip", "variable", "Cardholder verification methods"],
          ["9F34", "CVM Results", "Negotiated", "3 bytes", "Cardholder verification result"],
          ["9F35", "Term Type", "Terminal", "1 byte", "Terminal type"],
          ["9F1A", "Term Country", "Terminal", "2 bytes", "Terminal country"],
        ],
      },

      // ── 5. Derivation chain ────────────────────────────────────────
      { type: "heading", level: 2, text: "EMV derivation chain" },
      {
        type: "paragraph",
        text:
          "The ARQC is not magic — it is the last link in a key derivation chain that starts at the issuer's HSM and ends as 8 bytes in the ISO 8583 message.",
      },
      { type: "svg", text: EMV_DERIVATION_CHAIN_SVG },
      {
        type: "paragraph",
        text:
          "Each level uses the previous one plus a transaction-specific input. This ensures the key that computes the ARQC is unique to THAT transaction on that card — any replay is detectable by the issuer.",
      },

      // ── 6. The IMK in ISOHub ───────────────────────────────────────
      { type: "heading", level: 2, text: "The IMK in ISOHub" },
      { type: "heading", level: 3, text: "Why does ISOHub use the IMK?" },
      {
        type: "paragraph",
        text:
          "In production, the IMK is protected inside an HSM (Hardware Security Module) at the issuer — it is never exposed in cleartext.",
      },
      { type: "paragraph", text: "ISOHub uses the IMK for development and testing:" },
      {
        type: "list",
        items: [
          "Builder: when the IMK is configured in the Workspace, the Builder generates a cryptographically real ARQC instead of a random value. The \"✓ derived ARQC\" badge confirms it.",
          "Validate ARQC: checks whether a received ARQC is legitimate for a given IMK and PAN. Useful to test the issuer integration.",
          "Full Flow: runs the whole IMK → ICC MK → Session Key → ARQC validation → ARPC generation chain in a single step.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Use test IMKs only — never configure a production IMK in ISOHub or any development tool. In production, the IMK must only exist inside a certified HSM.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "To configure the IMK: Workspace → Cryptographic keys → Issuer Master Key (32 hex chars).",
      },

      // ── 7. ARPC ────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "ARPC — Issuer response" },
      {
        type: "paragraph",
        text:
          "After validating the ARQC, the issuer computes the ARPC to prove to the terminal that whoever responded is really the legitimate issuer. The ARPC goes in the response Bit 55 (tag 91).",
      },
      {
        type: "table",
        headers: ["Method", "Formula", "When to use"],
        rows: [
          ["Method 1", "3DES(Session Key, ARQC XOR RC)", "Visa CVN 10/18, Elo"],
          ["Method 2", "MAC(Session Key, CSU || data)", "Mastercard M/Chip"],
        ],
      },
      {
        type: "paragraph",
        text:
          "Where RC = Response Code (2 bytes from bit 39: \"00\" = approved) and CSU = Card Status Update (4 bytes — allows updating the chip status).",
      },

      // ── 8. Decoders coming soon ────────────────────────────────────
      { type: "heading", level: 2, text: "Tag decoders — coming soon" },
      {
        type: "paragraph",
        text:
          "Some Bit 55 tags are bitmaps where each bit has a specific meaning. ISOHub plans to ship visual decoders for these tags.",
      },
      { type: "heading", level: 3, text: "TVR (Tag 95) — Terminal Verification Results" },
      { type: "paragraph", text: "5 bytes = 40 bits, each indicating one verification:" },
      {
        type: "table",
        headers: ["Bit", "Position", "Meaning"],
        rows: [
          ["Bit 1",  "1.8", "Offline data auth not performed"],
          ["Bit 2",  "1.7", "SDA failed"],
          ["Bit 3",  "1.6", "ICC data missing"],
          ["Bit 4",  "1.5", "Card on terminal exception file"],
          ["Bit 5",  "1.4", "DDA failed"],
          ["Bit 6",  "1.3", "CDA failed"],
          ["Bit 7",  "2.8", "ICC and terminal have different app versions"],
          ["Bit 8",  "2.4", "Invalid PIN entered"],
          ["Bit 9",  "2.3", "PIN entry bypassed"],
          ["Bit 10", "3.8", "Offline transaction limit exceeded"],
          ["Bit 11", "4.8", "Transaction randomly selected for review"],
          ["Bit 12", "5.8", "Merchant forced transaction online"],
        ],
      },
      { type: "heading", level: 3, text: "AIP (Tag 82) — Application Interchange Profile" },
      { type: "paragraph", text: "2 bytes indicating what the card supports:" },
      {
        type: "table",
        headers: ["Bit", "Meaning"],
        rows: [
          ["1.7", "SDA supported"],
          ["1.6", "DDA supported"],
          ["1.5", "Cardholder verification supported"],
          ["1.4", "Terminal risk management required"],
          ["1.3", "Issuer authentication supported"],
          ["1.1", "CDA supported"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Decoders for TVR, AIP, TTQ, CVM List and other bitmap tags are on the ISOHub roadmap. When available, they will appear automatically in EMV Data → Parse Bit 55.",
      },
    ],
  },

  roles: {
    id: "roles",
    blocks: [
      // ── 1. Participants ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Participants in a transaction" },
      { type: "heading", level: 3, text: "CARDHOLDER" },
      { type: "paragraph", text: "The card owner who performs the purchase." },
      { type: "heading", level: 3, text: "MERCHANT" },
      { type: "paragraph", text: "The store that accepts the payment." },
      { type: "heading", level: 3, text: "TERMINAL / POS" },
      { type: "paragraph", text: "The device that captures card data and sends the ISO 8583 message to the acquirer." },
      { type: "heading", level: 3, text: "ACQUIRER" },
      {
        type: "paragraph",
        text:
          "Connects the merchant to the network. Receives the message from the terminal and routes it to the brand network. Examples: Cielo, Rede, Stone, GetNet.",
      },
      { type: "heading", level: 3, text: "BRAND / NETWORK" },
      {
        type: "paragraph",
        text:
          "Operates the payment network. Routes the message from the acquirer to the issuer and defines authorization rules. Examples: Visa, Mastercard, Elo, Amex.",
      },
      { type: "heading", level: 3, text: "ISSUER" },
      {
        type: "paragraph",
        text:
          "The bank or institution that issued the card. Authorizes or declines the transaction — validates the ARQC, balance, limit, etc.",
      },
      { type: "heading", level: 3, text: "PROCESSOR" },
      {
        type: "paragraph",
        text:
          "In some models the processor sits between the brand and the issuer — performing authorization on the issuer's behalf. Common with smaller issuers that outsource processing.",
      },

      // ── 2. Four-leg flow ──────────────────────────────────────────
      { type: "heading", level: 2, text: "The four-leg flow" },
      {
        type: "paragraph",
        text:
          "A complete transaction traverses up to four participants in sequence. Each connection between two of them is called a \"leg\" — and each leg can use a different transport protocol.",
      },
      { type: "svg", text: FOUR_LEGS_FLOW_SVG },
      {
        type: "paragraph",
        text:
          "Each leg can use a different protocol. The TPDU (Transport Protocol Data Unit) is typically required on legs 2 and 3 (between financial institutions), while leg 1 (terminal → acquirer) often uses proprietary protocols without TPDU.",
      },
      {
        type: "paragraph",
        text:
          "On the response side, the ARPC computed by the issuer travels back along the same path (Brand → Acquirer → Terminal). The terminal hands the ARPC to the chip, which validates it and approves or rejects locally.",
      },

      // ── 2b. ISO 8583 message classes ──────────────────────────────
      { type: "heading", level: 2, text: "ISO 8583 message classes" },
      {
        type: "paragraph",
        text:
          "The MTI's second digit defines the message CLASS. Understanding this distinction is fundamental to building correct messages and integrating with any network.",
      },
      {
        type: "table",
        headers: ["Class", "MTIs", "Type", "Description"],
        rows: [
          ["1xx", "0100 / 0110 / 0120 / 0130", "Authorization", "In-store purchases, inquiries, pre-authorizations"],
          ["2xx", "0200 / 0210 / 0220 / 0230", "Financial", "Transactions with immediate financial movement (ATM, withdrawals, deposits)"],
          ["4xx", "0400 / 0410 / 0420 / 0430", "Reversal", "Cancellation of a previous transaction (1xx or 2xx)"],
          ["8xx", "0800 / 0810 / 0820 / 0830", "Network", "Echo test, sign-on / off, key exchange, cutover"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Critical distinction between 0100 and 0200. 0100 — Authorization: the customer swipes the card in a store, pharmacy, restaurant, gas station… The issuer authorizes the operation; the actual debit happens later during clearing. 0200 — Financial: ATM events (withdrawal, deposit, PIN change) — transactions that move money instantly, without a separate clearing step. This is one of the most common integration mistakes: using 0200 for an in-store purchase or 0100 for an ATM withdrawal.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Proprietary networks often define custom MTIs for functionality beyond the ISO 8583 standard, such as balance inquiries, bill payments, and network-specific services. These MTIs vary by network and are defined in each operator's technical specification — consult the documentation of the network you are integrating with. ISOHub supports custom MTIs via the \"Unknown MTI\" setting in the Simulator.",
      },

      // ── 3. Entry modes ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Entry mode — how the card was read" },
      {
        type: "paragraph",
        text:
          "Bit 22 (POS Entry Mode) tells how the card was captured. It completely changes what is expected in the message.",
      },
      {
        type: "table",
        headers: ["Code", "Mode", "Bit 35", "Bit 52", "Bit 55", "Typical use"],
        rows: [
          ["051", "Chip (ICC)", "Present", "Optional", "Present", "In-store purchase with chip"],
          ["090", "Magnetic stripe", "Present", "Optional", "Absent", "Stripe fallback"],
          ["071", "Contactless chip", "Present", "Absent", "Present", "NFC / tap to pay"],
          ["075", "Contactless stripe", "Present", "Absent", "Absent", "NFC without chip"],
          ["010", "PAN keyed (manual)", "Absent", "Absent", "Absent", "MOTO, call center"],
          ["081", "e-Commerce", "Absent", "Absent", "Absent", "Online purchase"],
          ["901", "Fallback (chip→stripe)", "Present", "Absent", "Absent", "Faulty chip"],
        ],
      },

      { type: "heading", level: 3, text: "Technical differences by entry mode" },

      { type: "heading", level: 4, text: "Chip (051)" },
      {
        type: "paragraph",
        text:
          "The chip generates the ARQC using the ICC Master Key derived from the IMK. Bit 55 is mandatory and contains the authentication cryptogram. The issuer validates the ARQC to confirm that the physical chip participated in the transaction — the main anti-fraud protection. Bit 35 (Track 2) is also captured from the chip.",
      },

      { type: "heading", level: 4, text: "Magnetic stripe (090)" },
      {
        type: "paragraph",
        text:
          "No cryptogram — only stripe data is sent. Bit 35 contains PAN + expiry + service code + discretionary data. More fraud-prone — data can be cloned. In many networks, stripe transactions from chip cards are treated with more suspicion (downgrade attack).",
      },

      { type: "heading", level: 4, text: "Contactless (071)" },
      {
        type: "paragraph",
        text:
          "The NFC chip generates an ARQC different from contact — using TTQ (Terminal Transaction Qualifiers, tag 9F66) and CTQ (Card Transaction Qualifiers, tag 9F6C) to negotiate what happens offline vs online. Low-value transactions can be approved offline by the chip without ever reaching the issuer.",
      },

      { type: "heading", level: 4, text: "CNP — Card Not Present (010, 081)" },
      {
        type: "paragraph",
        text:
          "No physical card data — only PAN, expiry and CVV2. Higher fraud risk — requires additional controls: CVV2 (printed on the card), 3D Secure, risk analysis. Bit 61 or private fields carry additional e-commerce data (URL, device fingerprint, etc.).",
      },

      // ── 4. Who decides which fields are required ──────────────────
      { type: "heading", level: 2, text: "Who decides which fields are mandatory?" },
      {
        type: "paragraph",
        text:
          "ISO 8583 only defines the structure and meaning of each field — it does not define which ones are mandatory. Each brand and network defines its own rules.",
      },
      {
        type: "table",
        headers: ["Level", "Defined by", "Example"],
        rows: [
          ["ISO 8583", "The standard", "Structure and encoding only"],
          ["Brand", "Visa, Mastercard, Elo…", "Bit 19 mandatory (Visa), Bit 43 (MC)"],
          ["Acquirer", "Cielo, Rede, Stone…", "Private fields (Bit 47 / 48)"],
          ["Issuer", "Issuing bank", "May require extra data on the response"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "In the ISOHub Builder, the selected role (Acquirer, Brand, Issuer) determines which fields are automatically included in the generated message, following the most common Brazilian-market conventions.",
      },

      // ── 5. Processing Code ────────────────────────────────────────
      { type: "heading", level: 2, text: "Processing Code — the transaction's DNA" },
      {
        type: "paragraph",
        text:
          "Bit 3 (Processing Code) defines what the transaction does with the cardholder's accounts. 6 digits in 3 subfields. Common examples in the Brazilian market:",
      },
      {
        type: "table",
        headers: ["Processing Code", "Transaction", "Description"],
        rows: [
          ["003000", "Credit purchase", "Debits cardholder's credit account"],
          ["003010", "Credit installment (merchant)", "Merchant-funded installments"],
          ["003030", "Credit installment (issuer)", "Bank-funded installments"],
          ["012020", "Cash withdrawal", "Debits checking account"],
          ["012030", "Credit cash advance", "Cash on credit line (rare)"],
          ["172020", "Balance inquiry", "Doesn't move money"],
          ["202020", "Debit refund", "Credits the checking account"],
          ["203000", "Credit refund", "Credit-line reversal"],
          ["302020", "Statement inquiry", "Informational only"],
          ["602020", "Bill payment", "Credits the beneficiary"],
        ],
      },

      // ── 6. Airline ─────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Airline transactions" },
      {
        type: "paragraph",
        text:
          "Airline transactions have unique characteristics that distinguish them from a regular in-store purchase. The exact ticket value is often unknown at booking time (fares, taxes, upgrades), so the flow uses pre-authorization + capture (completion).",
      },

      { type: "heading", level: 3, text: "Typical flow — airline transaction" },
      {
        type: "list",
        ordered: true,
        items: [
          "PRE-AUTHORIZATION (0100 / 0200) — MCC 4511 (Air Carriers, Airlines), Processing Code 003000, estimated or minimum fare value. The issuer blocks the amount on the cardholder's account but does not debit yet.",
          "COMPLETION / CAPTURE (0220 — Advice) — after ticket confirmation. Final value with all fees included. May be higher or lower than the pre-authorization. Bit 90 may carry the original pre-authorization data.",
          "CANCELLATION (0420 — Reversal Advice) — if the passenger cancels before ticketing, releases the blocked amount on the account.",
        ],
      },

      { type: "heading", level: 3, text: "Airline-specific data" },
      {
        type: "paragraph",
        text:
          "Brands define specific fields for flight data. They usually live in private fields (Bit 47, 48 or 127) or in specific fields like Bit 111 on some networks.",
      },
      {
        type: "table",
        headers: ["Field", "Common flight data"],
        rows: [
          ["Bit 43", "Card acceptor name with city / airport"],
          ["Bit 47 / 48", "Private data: PNR, flight number, origin / destination"],
          ["Bit 111", "Airline Additional Data (some networks)"],
        ],
      },

      { type: "heading", level: 3, text: "Airline terminology" },
      {
        type: "list",
        items: [
          "PNR (Passenger Name Record): unique reservation identifier in the airline's system. Ex.: \"ABC123\".",
          "Leg Data: data for each flight segment (origin, destination, date, class, flight number).",
          "IATA Code: 2-3 letter airline code (LA = LATAM, G3 = Gol).",
          "Ticket Number: electronic ticket (e-ticket) number.",
          "EMD (Electronic Miscellaneous Document): document for ancillary services (extra baggage, upgrades, etc.).",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Airline-data implementations vary widely across brands and acquirers. Visa, Mastercard and Elo each have their own specifications for these fields. Consult the specific brand's technical specification for production implementation.",
      },

      // ── 7. Other special transactions ─────────────────────────────
      { type: "heading", level: 2, text: "Other special transaction types" },

      { type: "heading", level: 3, text: "Bill payment / direct debit" },
      {
        type: "paragraph",
        text:
          "Processing Code 60xxxx. Used for paying bills (utilities, taxes, etc.). Direct credit to the beneficiary's account.",
      },

      { type: "heading", level: 3, text: "Prepaid top-up" },
      {
        type: "paragraph",
        text:
          "Prepaid cards have a different flow. The issuer is usually a prepaid-card processor. Top-ups can be done via Bit 4 with a specific Processing Code.",
      },

      { type: "heading", level: 3, text: "Cashback" },
      {
        type: "paragraph",
        text:
          "Processing Code 09xxxx (cash withdrawal embedded in the purchase). Bit 4 = purchase amount + cash amount. Bit 54 = breakdown of each portion (purchase separated from cash). Allowed on some terminals and specific networks.",
      },

      // ── 8. How to test in ISOHub ──────────────────────────────────
      { type: "heading", level: 2, text: "How to use ISOHub to test these scenarios" },
      {
        type: "table",
        headers: ["Scenario", "MTI", "Class", "Channel", "Description"],
        rows: [
          ["In-store credit purchase (chip)",     "0100", "Authorization", "Chip",      "Customer pays at a merchant with chip"],
          ["In-store credit purchase (stripe)",   "0100", "Authorization", "Stripe",    "Customer pays at a merchant with magstripe"],
          ["In-store debit purchase (chip)",      "0100", "Authorization", "Chip",      "Debit purchase with PIN at the merchant"],
          ["Online / CNP purchase",               "0100", "Authorization", "CNP",       "E-commerce, MOTO, no physical card"],
          ["Pre-authorization (gas / hotel)",     "0100", "Authorization", "Chip",      "Reserves an amount, adjusted at checkout"],
          ["ATM cash withdrawal",                 "0200", "Financial",     "Chip",      "Cash withdrawal at an ATM"],
          ["ATM PIN change",                      "0200", "Financial",     "Chip",      "PIN change at the ATM"],
          ["ATM deposit",                         "0200", "Financial",     "Chip",      "Immediate account credit via ATM"],
          ["Proprietary transactions",            "Varies per network", "Proprietary", "Chip", "Custom MTIs defined by the network (consult the network's technical specification)"],
          ["Purchase reversal",                   "0400", "Reversal",      "(same)",    "Cancels a previous 0100 authorization"],
          ["Withdrawal reversal",                 "0400", "Reversal",      "(same)",    "Cancels a previous 0200 financial"],
          ["Echo test",                           "0800", "Network",       "(n/a)",     "Checks connectivity with issuer / brand"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "The \"Proprietary transactions\" row uses a custom MTI — it is NOT an ISO 8583 standard. Each network defines its own MTIs for functionality beyond the standard's scope. To simulate these MTIs in ISOHub, configure the Simulator session with \"Unknown MTI: Custom\" and set the matching response MTI.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "In the ISOHub Builder: In-store purchase → MTI 0100, Role Acquirer. ATM withdrawal → MTI 0200, Role Acquirer, Type Cash. Reversal → use \"Create reversal\" in the MessagePreview (generates 0400 with Bit 90 auto-filled). Echo test → MTI 0800.",
      },
    ],
  },

  glossary: {
    id: "glossary",
    blocks: [
      {
        type: "table",
        headers: ["Term", "Definition"],
        rows: [
          ["ATC", "Application Transaction Counter — sequential counter in the chip. Increments per transaction. Used in Session Key derivation."],
          ["ARQC", "Application Request Cryptogram — chip-generated cryptogram authenticating the transaction. Bit 55, tag 9F26. 8 bytes."],
          ["ARPC", "Application Response Cryptogram — issuer-generated cryptogram in response to the ARQC. Tag 91. Proves the issuer is legitimate."],
          ["ARC", "Authorization Response Code — issuer response code in EMV format. Tag 8A. Same as RC (bit 39) in TLV form."],
          ["BIN", "Bank Identification Number — first 6-8 digits of the PAN. Identifies issuer and brand; used for routing."],
          ["CVV / CVC", "Card Verification Value/Code — 3-digit code derived from PAN, expiry and issuer key. CVV1 on track data, CVV2 printed on back."],
          ["CNP", "Card Not Present — transaction without physical card (e.g. e-commerce). Higher fraud risk."],
          ["CSU", "Card Status Update — data block used in ARPC Method 2. Lets the issuer update card status on the chip."],
          ["DDA", "Dynamic Data Authentication — offline auth where the chip signs dynamic data. Safer than SDA."],
          ["EMV", "Europay, Mastercard, Visa — global chip transaction standard."],
          ["IAD", "Issuer Application Data — issuer-proprietary data in Bit 55 (tag 9F10). Contains the cryptogram profile (CVN)."],
          ["IMK", "Issuer Master Key — issuer root key. Used to derive the ICC MK. Never leaves the HSM in production."],
          ["LLVAR", "Variable field with 2-digit length prefix. E.g. '12HELLO WORLD!' (12 = length)."],
          ["LLLVAR", "Variable field with 3-digit length prefix. E.g. '012HELLO WORLD!' (012 = length)."],
          ["MTI", "Message Type Indicator — 4 digits identifying the ISO 8583 message type. E.g. 0200 = Financial Request."],
          ["NII", "Network Interface Identifier — 2-byte identifier assigned by the brand. Used in TPDU for routing."],
          ["PAN", "Primary Account Number — card number. Bit 2. Usually 13-19 digits."],
          ["PIN Block", "Encrypted block containing the PIN. Bit 52. 8 bytes in ISO 9564 format."],
          ["PSN", "PAN Sequence Number — card sequence number. Disambiguates multiple cards with the same PAN. Used in ICC MK derivation."],
          ["RC", "Response Code — 2 chars in bit 39 indicating result. '00' = approved, '05' = declined."],
          ["RRN", "Retrieval Reference Number — unique transaction reference. Bit 37. 12 chars. Used for tracking and reversal."],
          ["SDA", "Static Data Authentication — simpler offline auth. The chip signs static card data."],
          ["Session Key", "Key derived from ICC MK + ATC. Unique per transaction. Used to compute the ARQC."],
          ["STAN", "System Trace Audit Number — sequential number. Bit 11. 6 digits. Unique per terminal per day."],
          ["TLV", "Tag-Length-Value — encoding structure used in Bit 55. Each field has Tag, Length and Value."],
          ["TPDU", "Transport Protocol Data Unit — 5-byte prefix before the MTI on TCP. ID + origin NII + destination NII."],
          ["TVR", "Terminal Verification Results — 5 bytes (40 bits) in Bit 55 (tag 95). Each bit is the result of a terminal check."],
          ["UN", "Unpredictable Number — 4 random bytes generated by the terminal for ARQC calculation. Tag 9F37."],
          ["ZPK", "Zone PIN Key — PIN encryption key. Used to decrypt the received PIN Block."],
        ],
      },
    ],
  },

  fields: {
    id: "fields",
    blocks: [
      { type: "paragraph", text: "Reference table of the most important ISO 8583 Data Elements (bits 2-128)." },
      {
        type: "table",
        headers: ["Bit", "Name", "Type", "Enc.", "Size", "Description"],
        rows: [
          ["2", "PAN", "LLVAR", "n", "max 19", "Card number"],
          ["3", "Processing Code", "FIXED", "n", "6", "Transaction type"],
          ["4", "Amount, Transaction", "FIXED", "n", "12", "Amount in cents"],
          ["5", "Amount, Settlement", "FIXED", "n", "12", "Settlement amount"],
          ["6", "Amount, Cardholder Billing", "FIXED", "n", "12", "Billing amount"],
          ["7", "Transmission Date & Time", "FIXED", "n", "10", "MMDDHHmmss"],
          ["11", "STAN", "FIXED", "n", "6", "Trace number"],
          ["12", "Local Transaction Time", "FIXED", "n", "6", "HHmmss"],
          ["13", "Local Transaction Date", "FIXED", "n", "4", "MMDD"],
          ["14", "Expiration Date", "FIXED", "n", "4", "YYMM"],
          ["18", "Merchant Type (MCC)", "FIXED", "n", "4", "Merchant category"],
          ["19", "Acquiring Country Code", "FIXED", "n", "3", "Acquirer country"],
          ["22", "POS Entry Mode", "FIXED", "n", "3", "How the card was read"],
          ["25", "POS Condition Code", "FIXED", "n", "2", "POS condition"],
          ["32", "Acquiring Institution ID", "LLVAR", "n", "max 11", "Acquirer ID"],
          ["35", "Track 2 Data", "LLVAR", "z", "max 37", "Magnetic stripe data"],
          ["37", "RRN", "FIXED", "an", "12", "Reference number"],
          ["38", "Authorization ID Response", "FIXED", "an", "6", "Auth code"],
          ["39", "Response Code", "FIXED", "an", "2", "'00' = approved"],
          ["41", "Terminal ID", "FIXED", "ans", "8", "Terminal ID"],
          ["42", "Merchant ID", "FIXED", "ans", "15", "Merchant ID"],
          ["43", "Card Acceptor Name/Location", "FIXED", "ans", "40", "Merchant name + city"],
          ["48", "Additional Data — Private", "LLLVAR", "an", "max 999", "Private data"],
          ["49", "Currency Code, Transaction", "FIXED", "n", "3", "986 = BRL"],
          ["52", "PIN Data", "FIXED", "b", "8", "PIN Block (binary)"],
          ["54", "Additional Amounts", "LLLVAR", "an", "max 120", "Extra amounts"],
          ["55", "ICC Data (EMV)", "LLLVAR", "b", "max 255", "Chip data BER-TLV"],
          ["57-63", "Reserved National/Private", "LLLVAR", "ans", "max 999", "Reserved national/private"],
          ["64", "MAC", "FIXED", "b", "8", "Message authentication"],
          ["70", "Network Management Info Code", "FIXED", "n", "3", "0800/0810"],
          ["90", "Original Data Elements", "FIXED", "n", "42", "Original msg data (reversal)"],
          ["100", "Receiving Institution ID", "LLVAR", "n", "max 11", "Issuer ID"],
          ["127", "Private Use", "LLLVAR", "ans", "max 999", "Private use"],
          ["128", "MAC (Extended)", "FIXED", "b", "8", "Extended MAC"],
        ],
      },
      { type: "heading", level: 3, text: "Encoding types" },
      {
        type: "list",
        items: [
          "n = numeric (digits 0-9)",
          "a = alphabetic (A-Z, space)",
          "s = special (special characters)",
          "an = alphanumeric",
          "ans = alphanumeric + special",
          "b = binary",
          "z = magnetic track (digits + separators)",
          "x+n = sign (C/D) + numeric",
        ],
      },
      { type: "heading", level: 3, text: "Length types" },
      {
        type: "list",
        items: [
          "FIXED = fixed length",
          "LLVAR = 2-digit length prefix + value (max 99)",
          "LLLVAR = 3-digit length prefix + value (max 999)",
        ],
      },
    ],
  },

  guides: {
    id: "guides",
    blocks: [
      { type: "heading", level: 2, text: "ISOHub architecture" },
      {
        type: "paragraph",
        text:
          "ISOHub is a standalone application that runs entirely on your machine. No data leaves your environment.",
      },
      { type: "svg", text: ISOHUB_ARCHITECTURE_SVG },
      { type: "heading", level: 3, text: "Security" },
      { type: "callout", tone: "success", text: "Data stays on your machine — zero telemetry, no external connections beyond what you configure." },
      { type: "callout", tone: "warning", text: "No JWT authentication — open access on localhost. If you expose port 8080 to the network (0.0.0.0), any machine on the network can access it without a password. Use only on trusted networks or behind a firewall." },
      { type: "heading", level: 3, text: "Data stored locally" },
      {
        type: "list",
        items: [
          "Workspace (IMK, ZPK, settings): local JSON file",
          "Templates: browser localStorage",
          "EMV history: session memory (cleared on restart)",
        ],
      },

      // ── First steps — module overview ─────────────────────────────
      { type: "heading", level: 2, text: "First steps — meeting the modules" },
      {
        type: "paragraph",
        text:
          "ISOHub is organized in six modules. Before diving into a specific guide, it's worth quickly getting to know what each one does.",
      },

      { type: "heading", level: 3, text: "Parser" },
      {
        type: "paragraph",
        text:
          "The most-used module. Paste any ISO 8583 message (ASCII wire or binary-hex, with or without TPDU) and see every field decoded automatically. Click any field to copy it, reveal masked values, or jump to other modules.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Parser screen",
        caption: "Parser — decodes any ISO 8583 message",
      },

      { type: "heading", level: 3, text: "Builder" },
      {
        type: "paragraph",
        text:
          "Builds complete ISO 8583 messages without having to know every field. Pick the context (role, brand, channel, transaction type) and ISOHub fills in the correct fields — including Bit 55 with a real ARQC when the IMK is configured in Workspace.",
      },
      {
        type: "image",
        src: "/screenshots/builder.png",
        alt: "Builder screen",
        caption: "Builder — builds complete messages by context",
      },

      { type: "heading", level: 3, text: "Simulator" },
      {
        type: "paragraph",
        text:
          "Spin up a Responder (Rebatedor) to receive TCP messages and reply automatically — simulating an authorizer/issuer. Or use the Injector to send messages to your system and watch the responses live.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Simulator screen",
        caption: "Simulator — active Responder and Injector",
      },

      { type: "heading", level: 3, text: "EMV Data" },
      {
        type: "paragraph",
        text:
          "Six tabs for working with EMV cryptography: Parse Bit 55, Validate ARQC, Generate ARQC, Generate ARPC, Build Response and Full Flow.",
      },
      {
        type: "image",
        src: "/screenshots/emv1.png",
        alt: "EMV Data screen",
        caption: "EMV Data — Parse Bit 55 with decoded tags",
      },

      { type: "heading", level: 3, text: "Test Card" },
      {
        type: "paragraph",
        text:
          "Generates valid PANs with tracks and CVV per brand for testing without needing real cards.",
      },
      {
        type: "image",
        src: "/screenshots/testcard.png",
        alt: "Test Card screen",
        caption: "Test Card — generates valid data per brand",
      },

      { type: "heading", level: 3, text: "Workspace" },
      {
        type: "paragraph",
        text:
          "Configure default values (Terminal ID, Merchant ID, NIIs) and cryptographic keys (IMK, ZPK) that are used automatically by the Builder and Simulator.",
      },
      {
        type: "image",
        src: "/screenshots/workspace.png",
        alt: "Workspace screen",
        caption: "Workspace — settings and cryptographic keys",
      },

      { type: "divider" },

      // ── Practical guides ──────────────────────────────────────────
      { type: "heading", level: 2, text: "Practical guides" },
      {
        type: "paragraph",
        text:
          "Step-by-step walkthroughs of the most common ISOHub flows. Each guide starts from a concrete scenario and shows the exact clicks.",
      },

      {
        type: "heading",
        level: 3,
        text: "Parse an ISO 8583 message",
        subtitle: "Scenario: you received an ISO 8583 message and need to understand what it contains.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Parser screen showing a decoded ISO 8583 message",
        caption: "Parser — paste a message and see every field decoded",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open the **Parser** module.",
          "Paste the message in the text field (accepts ASCII wire, binary-hex or with TPDU).",
          "Click **Parse →** or press `Ctrl+Enter`. ISOHub auto-detects the format.",
        ],
      },
      { type: "callout", tone: "info", text: "Pasting a message triggers parse automatically (300 ms debounce)." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Build an ISO 8583 message",
        subtitle: "Scenario: you need a ready-made message to test an integration.",
      },
      {
        type: "image",
        src: "/screenshots/builder.png",
        alt: "Builder screen with auto-generated fields",
        caption: "Builder — pick the context and generate the full message",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open the **Builder** module.",
          "Select **MTI**, **Role**, **Brand**, **Channel** and **Transaction type**.",
          "Click **Build →**. Fields are populated automatically.",
          "Edit values as needed in the table.",
          "Copy the generated message (ASCII wire or binary-hex).",
        ],
      },
      { type: "callout", tone: "info", text: "Configure the IMK in the **Workspace** to generate a real **ARQC** instead of a random one." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Validate a transaction's ARQC",
        subtitle: "Scenario: you received a message with Bit 55 and want to confirm the cryptogram is legitimate.",
      },
      {
        type: "image",
        src: "/screenshots/emv2.png",
        alt: "ARQC validation screen in the EMV Data module",
        caption: "EMV Data — ARQC validation with detailed result",
      },
      { type: "paragraph", text: "Prerequisite: have the Bit 55 in hex and the issuer's IMK." },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **EMV Data** → **Validate ARQC** tab.",
          "Paste the Bit 55 in hex.",
          "Provide the Issuer Master Key (**IMK-AC**).",
          "Provide the **PAN** and **PAN Sequence Number** (usually `00`).",
          "Select the brand profile.",
          "Click **Validate ARQC**.",
        ],
      },
      { type: "callout", tone: "info", text: "Use **Validate in EMV** directly from the **Parser** — the PAN and brand are auto-filled after parsing a message with Bit 55." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Simulate an authorizer (Rebatedor)",
        subtitle: "Scenario: you have a terminal/system that sends transactions and want to simulate the authorizer.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Simulator screen with active responder session",
        caption: "Simulator — active responder receiving and replying to messages",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **Simulator** and click **+ New session**.",
          "Configure: **TCP port** (e.g. `9100`), **Role** = `Issuer`, **Default RC** = `00`, **Auto respond** on.",
          "Click **Confirm**.",
          "Point your terminal to `localhost:9100`.",
          "ISOHub responds automatically to each received message.",
        ],
      },
      { type: "callout", tone: "info", text: "Click the log icon on the session card to filter the log to just that session." },

      { type: "heading", level: 4, text: "Responder (Listener)" },
      {
        type: "paragraph",
        text:
          "Opens a local TCP port and waits for connections. When it receives a message, it replies automatically according to the session's settings.",
      },
      { type: "paragraph", text: "Configuration fields:" },
      {
        type: "list",
        items: [
          "**TCP port**: local port to listen on (e.g. `9100`).",
          "**Role**: defines the context of the automatic response — `Acquirer` (simulates a credenciadora), `Brand` (simulates the network) or `Issuer` (simulates the issuing bank, most common).",
          "**Default RC**: default response code (`00` = approve everything).",
          "**TPDU mode**: how to handle the TPDU prefix — `Optional` (accepts with or without), `Required` (rejects without TPDU) or `Strip` (removes before processing).",
          "**Unknown MTI**: how to reply to unmapped MTIs — `Derive` (auto-derives `0100`→`0110`), `Reject` (no response), `Echo` (replies with the same MTI), or `Custom` (a specific MTI).",
          "**Auto respond**: toggle on/off.",
          "**Validate ARQC**: checks the EMV cryptogram (requires an IMK configured in the **Workspace**).",
        ],
      },
      {
        type: "image",
        src: "/screenshots/new_session.png",
        alt: "Simulator new-session form",
        caption: "Session creation — Responder configuration",
      },

      { type: "heading", level: 4, text: "Injector (Connector)" },
      {
        type: "paragraph",
        text:
          "Connects to an external TCP system and sends messages. Use it to test your authorizer by sending transactions and checking the responses.",
      },
      { type: "paragraph", text: "Configuration fields:" },
      {
        type: "list",
        items: [
          "**Target host**: IP or hostname of the target system.",
          "**Target port**: TCP port of the target system (e.g. `8583`).",
          "**Message**: the ISO 8583 to send (hex or ASCII wire).",
          "**Continuous mode**: sends in a loop (1 msg/s). Tick **Vary identifiers** so STAN/RRN/DateTime change on each send; **Vary amount** for a random Amount within a range.",
        ],
      },

      { type: "heading", level: 4, text: "Live log" },
      {
        type: "paragraph",
        text:
          "Shows in real time every message received and sent by the Responders. Click the log icon on each session to filter the log to that session only.",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Inject messages (Injector)",
        subtitle: "Scenario: you have an authorizer running and want to send transactions to test it.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **Simulator** → **Injector** section.",
          "Configure **Target host** and **Target port** (e.g. `localhost:8583`).",
          "Paste the ISO 8583 message in the text area (can be one generated by the **Builder**).",
          "Click **Inject →** to send a single message or **Start continuous** for a 1 msg/s loop.",
        ],
      },
      { type: "callout", tone: "info", text: "Tick **Vary identifiers** so each send carries a different STAN/RRN — prevents rejection as duplicate." },

      { type: "divider" },

      { type: "heading", level: 2, text: "The six tabs of the EMV Data module" },
      {
        type: "paragraph",
        text:
          "The **EMV Data** module organizes the cryptography flows into six chainable tabs. You can use each one in isolation or combine them in **Full Flow**.",
      },
      {
        type: "list",
        items: [
          "**Parse Bit 55**: paste a Bit 55 in hex and see every BER-TLV tag decoded. Supports partial parse — if it hits an invalid tag, it shows what it managed to parse up to that point.",
          "**Validate ARQC**: check whether a received ARQC is legitimate. Provide the Bit 55, the IMK and the PAN. ISOHub recomputes the derivation chain and compares against the received ARQC.",
          "**Generate ARQC**: produce a real ARQC from transaction data. Useful for creating realistic test data or verifying your derivation implementation.",
          "**Generate ARPC**: produce the ARPC (issuer response) from a received ARQC. Method 1 or Method 2.",
          "**Build Response**: assemble the response Bit 55 (tags `91` + `8A`) the issuer should return in the response message.",
          "**Full Flow**: runs the four steps in automatic sequence — **Parse Bit 55** → **Validate ARQC** → **Generate ARPC** → **Build Response**. The full issuer flow in one click.",
        ],
      },
      {
        type: "image",
        src: "/screenshots/emv6.png",
        alt: "Full Flow EMV with complete result",
        caption: "Full Flow — ARQC validated, ARPC generated, Bit 55 assembled",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Full Flow EMV",
        subtitle: "Scenario: receive a chip transaction and respond correctly with an ARPC.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open **EMV Data** → **Full Flow** tab.",
          "Fill in: **Bit 55** hex of the received message, **IMK-AC**, **PAN**, **PAN Sequence Number**, **Auth Response Code**.",
          "Click **Run Full EMV Flow**.",
          "ISOHub parses Bit 55, validates the ARQC, generates the ARPC and assembles the response Bit 55 (tags `91` + `8A`).",
          "Copy the response Bit 55 to include in your `0110` / `0210`.",
        ],
      },
    ],
  },
};
