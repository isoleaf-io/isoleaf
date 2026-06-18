import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/renderApp";
import DocsPage from "@/pages/Docs";

/**
 * The Docs page is now a launcher of external links to docs.isoleaf.dev.
 * Each card is an `<a target="_blank">` whose href encodes the section id as
 * a hash — the docs site uses the hash to deep-link into the right page.
 */
describe("Docs page", () => {
  it("renders one external card per section", () => {
    renderApp(<DocsPage />);
    const cards = screen.getAllByTestId(/^docs-card-/);
    expect(cards.length).toBe(8);
    for (const c of cards) {
      expect(c.tagName).toBe("A");
      expect(c).toHaveAttribute("target", "_blank");
      expect(c.getAttribute("href")).toMatch(/^https:\/\/docs\.isoleaf\.dev\/(pt|en)\/#[a-z0-9]+$/i);
    }
  });

  it("ISO 8583 card links to the iso8583 section", () => {
    renderApp(<DocsPage />);
    const card = screen.getByTestId("docs-card-iso8583");
    expect(card.getAttribute("href")).toMatch(/#iso8583$/);
  });

  it("API Reference card links to the apiDocs section", () => {
    renderApp(<DocsPage />);
    const card = screen.getByTestId("docs-card-apiDocs");
    expect(card.getAttribute("href")).toMatch(/#apiDocs$/);
  });
});
