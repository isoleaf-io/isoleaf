import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Logo } from "@/components/ui/Logo";

describe("Logo", () => {
  it("icon variant renders SVG with the diamond rects", () => {
    const { container } = render(<Logo variant="icon" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute("viewBox")).toBe("0 0 310 308");
    // Diamond rows are 1+3+5+7+5+3+1 = 25 quads.
    expect(container.querySelectorAll("rect").length).toBe(25);
  });

  it("full variant renders both diamond and the wordmark texts", () => {
    const { container } = render(<Logo variant="full" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 520 308");
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("ISO");
    expect(texts).toContain("Hub");
    expect(texts).toContain("ISO 8583 TOOLKIT");
  });

  it("wordmark variant renders text without diamond rects", () => {
    const { container } = render(<Logo variant="wordmark" />);
    expect(container.querySelectorAll("rect").length).toBe(0);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("ISO");
    expect(texts).toContain("Hub");
  });

  it("size prop sets svg height", () => {
    const { container } = render(<Logo variant="icon" size={64} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("height")).toBe("64");
  });
});
