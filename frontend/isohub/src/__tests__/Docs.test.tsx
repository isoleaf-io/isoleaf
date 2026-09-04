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
  it("renders one external card per section, in the canonical order", () => {
    renderApp(<DocsPage />);
    const cards = screen.getAllByTestId(/^docs-card-/);
    // Sprint 10.x — split into two ISO 20022 cards: one for the
    // protocol overview (iso20022) and one for the roles/participants
    // page (iso20022Roles).
    // Sprint 12.7 P4 — added `architecture` card between guides and
    // community for production topology + K8s/ECS/VM deploy manifests.
    expect(cards.length).toBe(11);
    // The DOM order of the cards drives the nav ordering on the docs
    // site. It must match the section-key sequence in DOCS_PT/DOCS_EN.
    const ids = cards.map((c) => c.getAttribute("data-testid"));
    expect(ids).toEqual([
      "docs-card-iso8583",
      "docs-card-emv",
      "docs-card-roles",
      "docs-card-fields",
      "docs-card-iso20022",
      "docs-card-iso20022Roles",
      "docs-card-glossary",
      "docs-card-guides",
      "docs-card-architecture",
      "docs-card-community",
      "docs-card-apiDocs",
    ]);
    for (const c of cards) {
      expect(c.tagName).toBe("A");
      expect(c).toHaveAttribute("target", "_blank");
      // Section ids are alphanumeric — the case-insensitive [a-z0-9]+
      // range covers iso20022Roles (capital R) as well.
      expect(c.getAttribute("href")).toMatch(/^https:\/\/docs\.isoleaf\.dev\/(pt|en)\/#[a-z0-9]+$/i);
    }
  });

  it("Architecture & Deployment card links to the architecture section (Sprint 12.7 P4)", () => {
    renderApp(<DocsPage />);
    const card = screen.getByTestId("docs-card-architecture");
    expect(card.getAttribute("href")).toMatch(/#architecture$/);
  });

  it("ISO 8583 card links to the iso8583 section", () => {
    renderApp(<DocsPage />);
    const card = screen.getByTestId("docs-card-iso8583");
    expect(card.getAttribute("href")).toMatch(/#iso8583$/);
  });

  it("ISO 20022 card links to the iso20022 section", () => {
    renderApp(<DocsPage />);
    const card = screen.getByTestId("docs-card-iso20022");
    expect(card.getAttribute("href")).toMatch(/#iso20022$/);
  });

  it("ISO 20022 Roles card links to the iso20022Roles section", () => {
    renderApp(<DocsPage />);
    const card = screen.getByTestId("docs-card-iso20022Roles");
    expect(card.getAttribute("href")).toMatch(/#iso20022Roles$/);
  });

  it("API Reference card links to the apiDocs section", () => {
    renderApp(<DocsPage />);
    const card = screen.getByTestId("docs-card-apiDocs");
    expect(card.getAttribute("href")).toMatch(/#apiDocs$/);
  });
});
