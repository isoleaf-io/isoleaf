import { afterEach, describe, expect, it, vi } from "vitest";

describe("FEATURES flags", () => {
  it("ships Parser, Field Reference, Validator, Comparator and Builder enabled in dev with the rest gated", async () => {
    const { FEATURES } = await import("@/config/features");
    // Module gate + 6.1 + 6.2 (v1.4.0) + 6.3a + 6.3b (v1.4.2) + 6.4 (v1.4.3).
    // All gated behind import.meta.env.DEV — true in Vitest.
    expect(FEATURES.iso20022).toBe(true);
    expect(FEATURES.iso20022Parser).toBe(true);
    expect(FEATURES.iso20022FieldRef).toBe(true);
    expect(FEATURES.iso20022Validator).toBe(true);
    expect(FEATURES.iso20022Comparator).toBe(true);
    expect(FEATURES.iso20022Builder).toBe(true);
    // Everything else stays gated until its own release.
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
