import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ArpcInput,
  ArqcInput,
  ArqcResult,
  BuildResponseBit55Request,
  BuildResponseBit55Result,
  FullFlowRequest,
  FullFlowResult,
  GenerateArpcResult,
  GenerateArqcResult,
  ParseBit55Response,
  ValidateArqcRequest,
} from "@/types";

export type EmvTab =
  | "parse"
  | "validate"
  | "gen-arqc"
  | "gen-arpc"
  | "build"
  | "full-flow";

/** Payload accepted by <see cref="EmvState.loadFromParser"/> — string is kept for
 *  backwards compatibility (legacy callers pass just the bit 55 hex). */
export interface EmvFromParser {
  hexBit55: string;
  pan?: string;
  brand?: string;
}

const PROFILES = ["Visa", "Mastercard", "Elo"] as const;

/**
 * Maps a brand string (e.g. from the Parser's detectedBrand) to one of the EMV
 * profile values accepted by the API. Falls back to "Visa" so the form always
 * has a valid value selected, even when the brand is unknown.
 */
export function mapBrandToProfile(brand?: string | null): string {
  if (!brand) return "Visa";
  const b = brand.toLowerCase();
  if (b.includes("visa")) return "Visa";
  if (b.includes("master")) return "Mastercard";
  if (b.includes("elo")) return "Elo";
  return "Visa";
}

const TODAY_YYMMDD = (() => {
  const d = new Date();
  return d.getFullYear().toString().slice(2) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
})();

const DEFAULT_VALIDATE: ValidateArqcRequest = {
  hexBit55: "",
  issuerMasterKey: "0123456789ABCDEF0123456789ABCDEF",
  pan: "4111111111111111",
  panSequenceNumber: "00",
  profile: "Visa",
};

const DEFAULT_ARQC: Partial<ArqcInput> = {
  issuerMasterKey: "0123456789ABCDEF0123456789ABCDEF",
  pan: "4111111111111111",
  panSequenceNumber: "00",
  atc: "001E",
  amountAuthorized: "000000001000",
  amountOther: "000000000000",
  terminalCountryCode: "0076",
  tvr: "0000000000",
  currencyCode: "0986",
  transactionDate: TODAY_YYMMDD,
  transactionType: "00",
  unpredictableNumber: "AABBCCDD",
  aip: "1800",
  iad: "0706010A03A40000",
  profile: "Visa",
};

const DEFAULT_ARPC: Partial<ArpcInput> = {
  arqc: "",
  issuerMasterKey: "0123456789ABCDEF0123456789ABCDEF",
  pan: "4111111111111111",
  panSequenceNumber: "00",
  atc: "001E",
  authResponseCode: "3030",
  csu: null,
  profile: "Visa",
  method: "Method1",
};

const DEFAULT_BUILD: BuildResponseBit55Request = {
  arpc: "",
  authResponseCode: "3030",
  issuerAuthCode: null,
  issuerScript71: null,
  issuerScript72: null,
};

const DEFAULT_FULL: Partial<FullFlowRequest> = {
  hexBit55Request: "",
  issuerMasterKey: "0123456789ABCDEF0123456789ABCDEF",
  pan: "4111111111111111",
  panSequenceNumber: "00",
  authResponseCode: "3030",
  profile: "Visa",
  issuerScript72: null,
};

interface EmvState {
  activeTab: EmvTab;

  parseBit55Input: string;
  /** Bytes of proprietary header (e.g. length prefix) to skip before BER-TLV parsing. */
  parseBit55HeaderBytes: number;
  parseBit55Result: ParseBit55Response | null;

  validateInput: ValidateArqcRequest;
  validateResult: ArqcResult | null;

  generateArqcInput: Partial<ArqcInput>;
  generateArqcResult: GenerateArqcResult | null;

  generateArpcInput: Partial<ArpcInput>;
  generateArpcResult: GenerateArpcResult | null;

  buildResponseInput: BuildResponseBit55Request;
  buildResponseResult: BuildResponseBit55Result | null;

  fullFlowInput: Partial<FullFlowRequest>;
  fullFlowResult: FullFlowResult | null;

  setActiveTab: (tab: EmvTab) => void;

  setParseBit55Input: (v: string) => void;
  setParseBit55HeaderBytes: (v: number) => void;
  setParseBit55Result: (r: ParseBit55Response | null) => void;

  setValidateInput: (p: Partial<ValidateArqcRequest>) => void;
  setValidateResult: (r: ArqcResult | null) => void;

  setGenerateArqcInput: (p: Partial<ArqcInput>) => void;
  setGenerateArqcResult: (r: GenerateArqcResult | null) => void;

  setGenerateArpcInput: (p: Partial<ArpcInput>) => void;
  setGenerateArpcResult: (r: GenerateArpcResult | null) => void;

  setBuildResponseInput: (p: Partial<BuildResponseBit55Request>) => void;
  setBuildResponseResult: (r: BuildResponseBit55Result | null) => void;

  setFullFlowInput: (p: Partial<FullFlowRequest>) => void;
  setFullFlowResult: (r: FullFlowResult | null) => void;

  /**
   * Pull a Bit 55 hex (and optionally PAN + brand) from the Parser flow.
   * Backwards-compatible: a plain string is treated as just the hex.
   * When given an object, populates Parse + Validate + GenArqc + FullFlow tabs
   * with whatever fields are present, without overwriting user-set IMK or other secrets.
   */
  loadFromParser: (data: EmvFromParser | string) => void;

  /** Set when loadFromParser populated PAN/profile — UI uses this to flash a one-shot hint. */
  loadedFromParser: boolean;
  /** Clears the loadedFromParser hint (UI calls this on first edit / on dismissal). */
  acknowledgeLoadedFromParser: () => void;

  /** Reset the inputs + result of a single tab to its initial defaults. Other tabs untouched. */
  clearTab: (tab: EmvTab) => void;

  /** Reset all six tabs to defaults. */
  clearAll: () => void;
}

export const useEmvStore = create<EmvState>()(
  persist(
    (set) => ({
      activeTab: "parse",

      parseBit55Input: "",
      parseBit55HeaderBytes: 0,
      parseBit55Result: null,

      validateInput: DEFAULT_VALIDATE,
      validateResult: null,

      generateArqcInput: DEFAULT_ARQC,
      generateArqcResult: null,

      generateArpcInput: DEFAULT_ARPC,
      generateArpcResult: null,

      buildResponseInput: DEFAULT_BUILD,
      buildResponseResult: null,

      fullFlowInput: DEFAULT_FULL,
      fullFlowResult: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setParseBit55Input: (v) => set({ parseBit55Input: v }),
      setParseBit55HeaderBytes: (v) => set({ parseBit55HeaderBytes: Math.max(0, Math.min(16, v | 0)) }),
      setParseBit55Result: (r) => set({ parseBit55Result: r }),

      setValidateInput: (p) => set((s) => ({ validateInput: { ...s.validateInput, ...p } })),
      setValidateResult: (r) => set({ validateResult: r }),

      setGenerateArqcInput: (p) => set((s) => ({ generateArqcInput: { ...s.generateArqcInput, ...p } })),
      setGenerateArqcResult: (r) => set({ generateArqcResult: r }),

      setGenerateArpcInput: (p) => set((s) => ({ generateArpcInput: { ...s.generateArpcInput, ...p } })),
      setGenerateArpcResult: (r) => set({ generateArpcResult: r }),

      setBuildResponseInput: (p) => set((s) => ({ buildResponseInput: { ...s.buildResponseInput, ...p } })),
      setBuildResponseResult: (r) => set({ buildResponseResult: r }),

      setFullFlowInput: (p) => set((s) => ({ fullFlowInput: { ...s.fullFlowInput, ...p } })),
      setFullFlowResult: (r) => set({ fullFlowResult: r }),

      loadFromParser: (data) =>
        set((s) => {
          // Legacy form: bare hex string → behave like before.
          if (typeof data === "string") {
            return {
              activeTab: "parse",
              parseBit55Input: data,
              parseBit55Result: null,
              validateInput: { ...s.validateInput, hexBit55: data },
              fullFlowInput: { ...s.fullFlowInput, hexBit55Request: data },
              loadedFromParser: false,
            };
          }

          const { hexBit55, pan, brand } = data;
          const profile = brand ? mapBrandToProfile(brand) : null;

          // PAN and profile come straight from the parsed message — when the
          // Parser tells us what they are, the user wants to see those values.
          // The previous "only fill when default" guard kept stale values from
          // earlier loads alive and forced users to click Clear between messages.
          //
          // Sensitive crypto config (IMK/ZPK/ATC/TVR/AIP/IAD/PSN) is never touched
          // here — it stays whatever the user (or Workspace defaults) has set.
          const validatePan = pan ?? s.validateInput.pan;
          const validateProfile = profile ?? s.validateInput.profile;

          const arqcPan = pan ?? s.generateArqcInput.pan;

          const arpcPan = pan ?? s.generateArpcInput.pan;
          const arpcProfile = profile ?? s.generateArpcInput.profile;

          const fullPan = pan ?? s.fullFlowInput.pan;
          const fullProfile = profile ?? s.fullFlowInput.profile;

          const populatedExtras = Boolean(pan || profile);

          return {
            activeTab: "parse",
            parseBit55Input: hexBit55,
            parseBit55Result: null,
            // hexBit55 is the central pivot — always overwrites.
            validateInput: {
              ...s.validateInput,
              hexBit55,
              pan: validatePan,
              profile: validateProfile,
            },
            generateArqcInput: {
              ...s.generateArqcInput,
              pan: arqcPan,
            },
            generateArpcInput: {
              ...s.generateArpcInput,
              pan: arpcPan,
              profile: arpcProfile,
            },
            fullFlowInput: {
              ...s.fullFlowInput,
              hexBit55Request: hexBit55,
              pan: fullPan,
              profile: fullProfile,
            },
            loadedFromParser: populatedExtras,
          };
        }),

      loadedFromParser: false,

      acknowledgeLoadedFromParser: () => set({ loadedFromParser: false }),

      clearTab: (tab) =>
        set(() => {
          switch (tab) {
            case "parse":
              return {
                parseBit55Input: "",
                parseBit55HeaderBytes: 0,
                parseBit55Result: null,
              };
            case "validate":
              return { validateInput: DEFAULT_VALIDATE, validateResult: null };
            case "gen-arqc":
              return { generateArqcInput: DEFAULT_ARQC, generateArqcResult: null };
            case "gen-arpc":
              return { generateArpcInput: DEFAULT_ARPC, generateArpcResult: null };
            case "build":
              return { buildResponseInput: DEFAULT_BUILD, buildResponseResult: null };
            case "full-flow":
              return { fullFlowInput: DEFAULT_FULL, fullFlowResult: null };
          }
        }),

      clearAll: () =>
        set({
          parseBit55Input: "",
          parseBit55HeaderBytes: 0,
          parseBit55Result: null,
          validateInput: DEFAULT_VALIDATE,
          validateResult: null,
          generateArqcInput: DEFAULT_ARQC,
          generateArqcResult: null,
          generateArpcInput: DEFAULT_ARPC,
          generateArpcResult: null,
          buildResponseInput: DEFAULT_BUILD,
          buildResponseResult: null,
          fullFlowInput: DEFAULT_FULL,
          fullFlowResult: null,
        }),
    }),
    {
      name: "isoleaf-emv",
      // Persist inputs + active tab only — results are volatile (recalculated on demand).
      partialize: (s) => ({
        activeTab: s.activeTab,
        parseBit55Input: s.parseBit55Input,
        parseBit55HeaderBytes: s.parseBit55HeaderBytes,
        validateInput: s.validateInput,
        generateArqcInput: s.generateArqcInput,
        generateArpcInput: s.generateArpcInput,
        buildResponseInput: s.buildResponseInput,
        fullFlowInput: s.fullFlowInput,
      }),
    }
  )
);
