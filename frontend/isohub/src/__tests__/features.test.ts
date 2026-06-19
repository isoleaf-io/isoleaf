import { afterEach, describe, expect, it, vi } from "vitest";

describe("FEATURES flags", () => {
  it("ships Parser enabled (v1.4.0) and every other ISO 20022 sub-flag off", async () => {
    const { FEATURES } = await import("@/config/features");
    // Module gate + Parser shipped in v1.4.0.
    expect(FEATURES.iso20022).toBe(true);
    expect(FEATURES.iso20022Parser).toBe(true);
    // Everything else stays gated until its own release.
    expect(FEATURES.iso20022FieldRef).toBe(false);
    expect(FEATURES.iso20022Validator).toBe(false);
    expect(FEATURES.iso20022QrCode).toBe(false);
    expect(FEATURES.iso20022Builder).toBe(false);
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
    // iso20022Parser shipped in v1.4.0; the still-unreleased sub-features stay off.
    expect(useFeature("iso20022Parser")).toBe(true);
    expect(useFeature("iso20022Validator")).toBe(false);
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
