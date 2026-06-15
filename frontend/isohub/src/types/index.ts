interface ParsedField {
  bitNumber: number;
  name: string;
  /** Raw value of the field — full PAN, full Track 2, etc. */
  value: string;
  /** Server-side masked rendering (e.g. "411111******1111"). */
  displayValue: string;
  type?: string;
  length?: number;
}

export interface IsoParseResponse {
  success: boolean;
  mti?: string;
  messageClass?: string;
  messageFunction?: string;
  hasSecondaryBitmap?: boolean;
  activeBits?: number[];
  fields?: ParsedField[];
  tpdu?: { hex: string; id?: string; destinationNii?: string; sourceNii?: string } | null;
  parsedAt?: string;
  error?: string;
  /** Card brand inferred from bit 2 (PAN). Null/absent when PAN is missing or unmappable. */
  detectedBrand?: string | null;
  /**
   * Optional 2-byte big-endian length prefix detected after the TPDU.
   * `match` is true when the declared length equals the actual payload bytes.
   */
  lengthPrefix?: {
    hex: string;
    expectedLength: number;
    actualLength: number;
    match: boolean;
  } | null;
  /**
   * Structured error info — only set when `success` is false. The `error`
   * string field above is kept for legacy callers (formatted summary).
   */
  parseError?: ParseErrorDetail | null;
  /**
   * Fields parsed before the failure point. Only populated on failure when
   * the parser got past the bitmaps and into the field loop.
   */
  partialFields?: ParsedField[] | null;
}

interface ParseErrorDetail {
  field: string;
  position: number;
  message: string;
  hint?: string | null;
}

export interface BitmapParseResponse {
  activeBits: number[];
  hasSecondaryBitmap: boolean;
  bitmapBinary: string;
  primaryHex: string;
  secondaryHex?: string | null;
}

export interface LayoutFieldDefinition {
  bitNumber: number;
  name: string;
  type: string;
  maxLength: number;
  encoding: string;
}

interface SmartFieldInfo {
  bitNumber: number;
  name: string;
  value: string;
  maskedValue: string;
  origin: "generated" | "custom" | "derived";
  rule?: string | null;
}

export interface SmartBuildResult {
  success: boolean;
  error?: string;
  message?: string;
  binaryHexMessage?: string;
  tpdu?: string | null;
  bitmap?: string;
  activeBits?: number[];
  fields?: SmartFieldInfo[];
  generatedPan?: string;
  generatedPin?: string;
  profileUsed?: string;
  appliedRules?: string[];
  /** true when bit 55 ARQC was random (no IMK); false when cryptographically derived. */
  arqcIsSimulated?: boolean;
}

export interface VirtualCard {
  pan: string;
  panMasked: string;
  cardholderName: string;
  expiry: string;
  expiryFormatted: string;
  serviceCode: string;
  cvv: string;
  cvv2: string;
  track1: string;
  track2: string;
  brand: string;
  generatedAt: string;
}

export interface TlvTag {
  tag: string;
  name: string;
  length: number;
  value: string;
  description?: string;
}

export interface ParseBit55Response {
  success: boolean;
  tags: TlvTag[];
  arqc?: string;
  cryptogramType?: string;
  atc?: string;
  authResponseCode?: string;
  hasArqc: boolean;
  hasIssuerAuthData: boolean;
  /** false when the parser stopped on a structural problem; UI should render partial results. */
  isComplete: boolean;
  parseError?: string | null;
  parsedBytes: number;
  totalBytes: number;
  /** Trailing bytes the parser couldn't interpret (hex). */
  unparsedHex?: string | null;
  errorAtByte?: number | null;
  warnings: string[];
  /** Header bytes that were skipped (hex), when headerBytes > 0. */
  headerHex?: string | null;
}

// ── ARQC validation ────────────────────────────────────────────────────
export interface ValidateArqcRequest {
  hexBit55: string;
  issuerMasterKey: string;
  pan: string;
  panSequenceNumber: string;
  profile: string;
}

export interface ArqcResult {
  isValid: boolean;
  calculatedArqc: string;
  receivedArqc: string;
  tags: TlvTag[];
  profile: string;
  sessionKey: string;
}

// ── ARQC generation ────────────────────────────────────────────────────
export interface ArqcInput {
  issuerMasterKey: string;
  pan: string;
  panSequenceNumber: string;
  atc: string;
  amountAuthorized: string;
  amountOther: string;
  terminalCountryCode: string;
  tvr: string;
  currencyCode: string;
  transactionDate: string;
  transactionType: string;
  unpredictableNumber: string;
  aip: string;
  iad: string;
  profile: string;
}

export interface GenerateArqcResult {
  arqc: string;
  sessionKey: string;
  iccMasterKey: string;
  transactionData: string;
  profile: string;
}

// ── ARPC generation ────────────────────────────────────────────────────
export interface ArpcInput {
  arqc: string;
  issuerMasterKey: string;
  pan: string;
  panSequenceNumber: string;
  atc: string;
  authResponseCode: string;
  csu?: string | null;
  profile: string;
  method: "Method1" | "Method2";
}

export interface GenerateArpcResult {
  arpc: string;
  method: string;
  sessionKey: string;
}

// ── Build response Bit 55 ──────────────────────────────────────────────
export interface BuildResponseBit55Request {
  arpc: string;
  authResponseCode: string;
  issuerAuthCode?: string | null;
  issuerScript71?: string | null;
  issuerScript72?: string | null;
}

export interface BuildResponseBit55Result {
  hexBit55: string;
  tags: TlvTag[];
}

// ── Full EMV flow ──────────────────────────────────────────────────────
export interface FullFlowRequest {
  hexBit55Request: string;
  issuerMasterKey: string;
  pan: string;
  panSequenceNumber: string;
  authResponseCode: string;
  profile: string;
  issuerScript71?: string | null;
  issuerScript72?: string | null;
  issuerAuthCode?: string | null;
}

export interface FullFlowResult {
  arqcValidation: ArqcResult;
  arpc: string;
  hexBit55Response: string;
  responseTags: TlvTag[];
  flowSummary: string;
}

export interface SimulatorSession {
  sessionId: string;
  tcpPort: number;
  mode: string;
  role: string;
  layoutName: string;
  defaultResponseCode: string;
  validateArqc: boolean;
  autoRespond: boolean;
  status: "starting" | "active" | "stopped" | "error";
  startedAt: string;
  stoppedAt?: string | null;
  messagesProcessed: number;
  messagesRejected: number;
  lastError?: string | null;
  /** Remote host for Injetor sessions; null for Rebatedor. */
  targetHost?: string | null;
  /** Remote port for Injetor sessions; null for Rebatedor. */
  targetPort?: number | null;
  /**
   * Wire framing the session uses. 2 = 2-byte big-endian length prefix
   * (default, standard for acquirer/network connections). 0 = un-framed
   * (1 connect = 1 message; for terminals without framing).
   */
  headerSize?: number;
  /**
   * How the Issuer-role session handles Bit 55 in its responses. Only
   * meaningful when role = "Emissor"; ignored otherwise.
   */
  emvResponse?: EmvResponseConfig;
}

export type EmvResponseMode = "Echo" | "GenerateArpc";

export interface EmvResponseConfig {
  mode: EmvResponseMode;
  /** Bytes (NOT chars) of proprietary header to skip before the TLV parse. */
  proprietaryHeaderBytes: number;
  /** Null → use Workspace IMK; if that's also null, falls back to Echo. */
  imkOverride?: string | null;
  brand: string;
  /** When true (default) and mode=GenerateArpc, an invalid ARQC produces RC=05. */
  validateArqc?: boolean;
}

export interface MessageLogEntry {
  entryId: string;
  sessionId: string;
  timestamp: string;
  direction: "received" | "sent";
  asciiMessage: string;
  binaryHexMessage: string;
  tpdu?: string | null;
  tpduPresent?: boolean;
  tpduMode?: string | null;
  decodedMti?: string;
  decodedFields: { bitNumber: number; name: string; value: string; maskedValue: string }[];
  validationSummary?: string;
  hasErrors: boolean;
  rejected?: boolean;
  errorCode?: string | null;
  /** Describes the unknown-MTI policy outcome — "Rejected — ...", "Derived:XXXX", "Echoed", "Custom:XXXX". */
  unknownMtiAction?: string | null;
  processingMs: number;
}

export interface WorkspaceConfig {
  acquirerId: string;
  merchantId: string;
  terminalId: string;
  merchantName: string;
  merchantCity: string;
  mcc: string;
  originNii: string;
  destinationNii: string;
  processingCodes: Record<string, string>;
  zpk: string;
  imk: string;
  defaultBrand: string;
  defaultCurrency: string;
  defaultCountry: string;
  defaultChannel: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  uptime: string;
  activeSessions: number;
  totalMessagesProcessed: number;
  mongoDbConnected: boolean;
  brokerConnected: boolean;
}

/**
 * Runtime feature flags returned by GET /api/config. Reflects the value of
 * the ISOHUB_MODE environment variable on the server side.
 *   - "standalone": full local Docker deployment, all features on.
 *   - "online":     public demo, simulator + crypto features blocked at the
 *                   API layer (403) and hidden in the UI.
 */
export interface AppConfig {
  mode: "standalone" | "online" | string;
  simulatorEnabled: boolean;
  emvCryptoEnabled: boolean;
  workspaceKeysEnabled: boolean;
}
