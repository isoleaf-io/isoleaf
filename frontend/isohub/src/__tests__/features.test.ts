import { afterEach, describe, expect, it, vi } from "vitest";

describe("FEATURES flags", () => {
  it("every ISO 20022 flag defaults to false", async () => {
    const { FEATURES } = await import("@/config/features");
    expect(FEATURES.iso20022).toBe(false);
    expect(FEATURES.iso20022Parser).toBe(false);
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

  it("returns false for the disabled flag (real module)", async () => {
    const { useFeature } = await import("@/hooks/useFeature");
    expect(useFeature("iso20022")).toBe(false);
    expect(useFeature("iso20022Parser")).toBe(false);
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
