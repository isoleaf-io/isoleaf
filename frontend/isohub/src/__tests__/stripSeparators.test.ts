import { describe, expect, it } from "vitest";
import { stripCommonSeparators } from "@/pages/Parser/stripSeparators";

describe("stripCommonSeparators", () => {
  it("strips space-separated hex bytes", () => {
    const r = stripCommonSeparators("30 31 30 30 46 32 33 43");
    expect(r.removed).toBe(true);
    expect(r.cleaned).toBe("3031303046323343");
  });

  it("strips hyphen-separated hex bytes", () => {
    const r = stripCommonSeparators("30-31-30-30-46-32-33-43");
    expect(r.removed).toBe(true);
    expect(r.cleaned).toBe("3031303046323343");
  });

  it("strips colon-separated hex bytes", () => {
    const r = stripCommonSeparators("30:31:30:30:46:32:33:43");
    expect(r.removed).toBe(true);
    expect(r.cleaned).toBe("3031303046323343");
  });

  it("strips dot-separated hex bytes", () => {
    const r = stripCommonSeparators("30.31.30.30.46.32.33.43");
    expect(r.removed).toBe(true);
    expect(r.cleaned).toBe("3031303046323343");
  });

  it("returns input unchanged when too few tokens (avoids false positive)", () => {
    // Only 3 tokens — could be ASCII wire with legitimate spaces.
    const r = stripCommonSeparators("AB CD EF");
    expect(r.removed).toBe(false);
    expect(r.cleaned).toBe("AB CD EF");
  });

  it("returns input unchanged when a token is non-hex", () => {
    const r = stripCommonSeparators("30 31 30 30 NN 32 33 43");
    expect(r.removed).toBe(false);
    expect(r.cleaned).toBe("30 31 30 30 NN 32 33 43");
  });

  it("returns input unchanged when there are no separators", () => {
    const r = stripCommonSeparators("30313030F23C2481");
    expect(r.removed).toBe(false);
    expect(r.cleaned).toBe("30313030F23C2481");
  });

  it("trims leading/trailing whitespace even on no-strip pass-through", () => {
    const r = stripCommonSeparators("  30313030  ");
    expect(r.removed).toBe(false);
    expect(r.cleaned).toBe("30313030");
  });
});
