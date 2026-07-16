import { afterEach, describe, expect, it, vi } from "vitest";

describe("FEATURES flags", () => {
  it("ships every ISOLeaf 2.0 feature enabled, with legacy slots kept off", async () => {
    const { FEATURES } = await import("@/config/features");
    // ISO 20022 module + 6.1 Parser + 6.2 Field Reference + 6.3a Validator
    // + 6.3b Comparator + 6.5 Builder — all launched with 2.0.
    expect(FEATURES.iso20022).toBe(true);
    expect(FEATURES.iso20022Parser).toBe(true);
    expect(FEATURES.iso20022FieldRef).toBe(true);
    expect(FEATURES.iso20022Validator).toBe(true);
    expect(FEATURES.iso20022Comparator).toBe(true);
    expect(FEATURES.iso20022Builder).toBe(true);
    // 7.x Pix + 9.x SWIFT/CBPR+ + 9.4 ISO 8583 flows — all launched with 2.0.
    expect(FEATURES.pixQrCode).toBe(true);
    expect(FEATURES.pixFlowVisualizer).toBe(true);
    expect(FEATURES.swiftMtParser).toBe(true);
    expect(FEATURES.swiftMtComparator).toBe(true);
    expect(FEATURES.swiftFlowVisualizer).toBe(true);
    expect(FEATURES.iso8583FlowVisualizer).toBe(true);
    // Legacy slots — replaced by newer flags, kept as `false` so the
    // routing table stays pinned. Never delete a key without checking
    // every consumer first.
    expect(FEATURES.iso20022QrCode).toBe(false);
    expect(FEATURES.iso20022Txid).toBe(false);
    expect(FEATURES.iso20022MtMx).toBe(false);
  });
});

describe("useFeature()", () => {
  afterEach(() => {
    vi.doUnmock("@/config/features");
    vi.resetModules();
  });

  it("returns the real flag value from the unmocked module", async () => {
    const { useFeature } = await import("@/hooks/useFeature");
    expect(useFeature("iso20022Parser")).toBe(true);
    expect(useFeature("iso20022FieldRef")).toBe(true);
    expect(useFeature("iso20022Validator")).toBe(true);
    expect(useFeature("iso20022Comparator")).toBe(true);
    expect(useFeature("iso20022Builder")).toBe(true);
    expect(useFeature("iso20022MtMx")).toBe(false);
  });

  it("returns true when the flag is mocked to true", async () => {
    // Reset before doMock so the mocked features module is what gets imported
    // by the hook (which itself imports @/config/features eagerly).
    vi.resetModules();
    vi.doMock("@/config/features", () => ({
      FEATURES: { iso20022: true, iso20022Parser: false },
    }));
    const { useFeature } = await import("@/hooks/useFeature");
    expect(useFeature("iso20022")).toBe(true);
    expect(useFeature("iso20022Parser")).toBe(false);
  });
});
