import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import DocsPage from "@/pages/Docs";

/**
 * Returns only the Docs-card buttons (they carry aria-expanded). Filters out
 * sidebar links, theme toggles and other unrelated buttons that may match
 * a regex by accident.
 */
function getCardByName(name: RegExp): HTMLElement {
  const matches = screen
    .getAllByRole("button", { name })
    .filter((el) => el.hasAttribute("aria-expanded"));
  if (matches.length === 0) throw new Error(`No Docs card matching ${name}`);
  return matches[0];
}

describe("Docs page", () => {
  beforeEach(() => {
    // openId is restored from either localStorage OR the URL hash. Both persist
    // across tests in the same jsdom window — clear both so every case starts
    // with all cards collapsed.
    try { window.localStorage.removeItem("isohub-docs-open"); } catch { /* ignore */ }
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* ignore */ }
  });

  it("clicking ISO 8583 card expands content", async () => {
    const user = userEvent.setup();
    renderApp(<DocsPage />);

    const card = getCardByName(/ISO 8583/i);
    expect(card).toHaveAttribute("aria-expanded", "false");

    await user.click(card);

    expect(card).toHaveAttribute("aria-expanded", "true");
    // Heading from the iso8583 section. Multiple section titles may also match
    // by accident (e.g. table of contents); findAllByText is the safe call.
    const matches = await screen.findAllByText(/What is ISO 8583|O que é o ISO 8583/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("clicking same card collapses content", async () => {
    const user = userEvent.setup();
    renderApp(<DocsPage />);

    const card = getCardByName(/ISO 8583/i);
    await user.click(card);
    expect(card).toHaveAttribute("aria-expanded", "true");

    await user.click(card);
    expect(card).toHaveAttribute("aria-expanded", "false");
    // After collapse the inner heading disappears.
    expect(
      screen.queryByText(/What is ISO 8583|O que é o ISO 8583/i)
    ).not.toBeInTheDocument();
  });

  it("clicking different card closes previous", async () => {
    const user = userEvent.setup();
    renderApp(<DocsPage />);

    const iso = getCardByName(/ISO 8583/i);
    const emv = getCardByName(/EMV/i);

    await user.click(iso);
    expect(iso).toHaveAttribute("aria-expanded", "true");

    await user.click(emv);
    expect(emv).toHaveAttribute("aria-expanded", "true");
    // ISO 8583 must have collapsed.
    expect(iso).toHaveAttribute("aria-expanded", "false");
  });

  it("architecture section renders inside Guias rápidos", async () => {
    const user = userEvent.setup();
    renderApp(<DocsPage />);

    const guides = getCardByName(/Quick guides|Guias rápidos/i);
    await user.click(guides);

    const matches = await screen.findAllByText(/ISOHub architecture|Arquitetura do ISOHub/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
