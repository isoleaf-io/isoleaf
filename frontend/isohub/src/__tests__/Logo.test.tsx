import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Logo } from "@/components/ui/Logo";

/**
 * The Logo component now renders <img src="/logo.svg"> instead of inline
 * SVG paths — the brand mark lives in public/logo.svg so it can be edited
 * in design tools without round-tripping through JSX.
 */
describe("Logo", () => {
  it("renders an <img> pointing at /logo.svg with an accessible alt", () => {
    const { container } = render(<Logo variant="icon" />);
    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("/logo.svg");
    expect(img.getAttribute("alt")).toBe("ISOLeaf");
  });

  it("uses the provided size for both width and height (asset is square)", () => {
    const { container } = render(<Logo variant="icon" size={64} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("height")).toBe("64");
    expect(img.getAttribute("width")).toBe("64");
  });

  it("forwards className to the image element", () => {
    const { container } = render(<Logo variant="full" className="custom-class" />);
    const img = container.querySelector("img")!;
    expect(img.className).toContain("custom-class");
  });

  it("renders the same asset regardless of variant", () => {
    // All three variants currently point at the same combined-mark SVG.
    for (const variant of ["icon", "full", "wordmark"] as const) {
      const { container } = render(<Logo variant={variant} />);
      const img = container.querySelector("img")!;
      expect(img.getAttribute("src")).toBe("/logo.svg");
    }
  });
});
