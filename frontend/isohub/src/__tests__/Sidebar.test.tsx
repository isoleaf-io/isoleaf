import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";

// Sidebar reads health + AppConfig; mock both so the test doesn't hit
// the network. The AppConfigContext isn't mocked directly — AppShell
// wraps every route via renderApp's providers, but the Sidebar can be
// rendered on its own if we mock the consuming hook.
vi.mock("@/api/workspace", () => ({
  getAppConfig: vi.fn().mockResolvedValue({
    mode: "standalone",
    simulatorEnabled: true,
    emvCryptoEnabled: true,
    workspaceKeysEnabled: true,
  }),
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));
vi.mock("@/hooks/useHealth", () => ({
  useHealth: () => ({ data: { status: "ok" }, isError: false }),
}));
vi.mock("@/contexts/AppConfigContext", () => ({
  useAppConfig: () => ({
    mode: "standalone",
    simulatorEnabled: true,
    emvCryptoEnabled: true,
    workspaceKeysEnabled: true,
  }),
  AppConfigProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { Sidebar } from "@/components/layout/Sidebar";

const STORAGE_KEY = "isoleaf.sidebar.expandedGroups";

describe("Sidebar — two-mother-group layout", () => {
  beforeEach(() => {
    // Fresh storage per test so the persistence assertions start from
    // the "first-visit" default (both groups collapsed — the empty
    // DEFAULT_EXPANDED_GROUPS set in Sidebar.tsx).
    localStorage.clear();
  });

  it("renders both mother groups collapsed by default on first visit", () => {
    renderApp(<Sidebar />);

    const iso8583 = screen.getByTestId("sidebar-group-toggle-iso8583");
    const iso20022 = screen.getByTestId("sidebar-group-toggle-iso20022");

    expect(iso8583).toHaveAttribute("aria-expanded", "false");
    expect(iso20022).toHaveAttribute("aria-expanded", "false");

    // No child nav links inside either group — the accordions are
    // closed and their content is unmounted. Only sidebar chrome
    // links (logo `/parser` link, footer `/workspace`) live outside
    // the groups and remain.
    const iso8583Group = screen.getByTestId("sidebar-group-iso8583");
    const iso20022Group = screen.getByTestId("sidebar-group-iso20022");
    expect(within(iso8583Group).queryAllByRole("link")).toHaveLength(0);
    expect(within(iso20022Group).queryAllByRole("link")).toHaveLength(0);
  });

  it("clicking a collapsed group header expands it and reveals its child links", async () => {
    const user = userEvent.setup();
    renderApp(<Sidebar />);

    const group = screen.getByTestId("sidebar-group-iso8583");
    const toggle = within(group).getByTestId("sidebar-group-toggle-iso8583");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Child links now mounted inside the group — pick /parser and
    // /simulator as spot-checks (both live under ISO 8583).
    expect(
      within(group).getAllByRole("link").filter((l) => l.getAttribute("href") === "/parser"),
    ).toHaveLength(1);
    expect(
      within(group).getAllByRole("link").filter((l) => l.getAttribute("href") === "/simulator"),
    ).toHaveLength(1);

    // Clicking again collapses back — the unmount is symmetric.
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      within(group).queryAllByRole("link").filter((l) => l.getAttribute("href") === "/parser"),
    ).toHaveLength(0);
  });

  it("persists the expanded set in localStorage under isoleaf.sidebar.expandedGroups", async () => {
    const user = userEvent.setup();
    renderApp(<Sidebar />);

    // Starts empty (default = both collapsed). Expanding iso8583 first,
    // then iso20022 — assert localStorage reflects the accumulated state.
    await user.click(screen.getByTestId("sidebar-group-toggle-iso8583"));
    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toContain("iso8583");
    expect(stored).not.toContain("iso20022");

    await user.click(screen.getByTestId("sidebar-group-toggle-iso20022"));
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toContain("iso8583");
    expect(stored).toContain("iso20022");

    // Collapsing removes the id back.
    await user.click(screen.getByTestId("sidebar-group-toggle-iso8583"));
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).not.toContain("iso8583");
    expect(stored).toContain("iso20022");
  });

  it("hydrates from a pre-seeded localStorage value", () => {
    // Simulate a returning user who last left iso8583 collapsed.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["iso20022"]));

    renderApp(<Sidebar />);

    expect(screen.getByTestId("sidebar-group-toggle-iso8583")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByTestId("sidebar-group-toggle-iso20022")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("Cross-Protocol section renders without a chevron and is never collapsed", () => {
    renderApp(<Sidebar />);

    const flat = screen.getByTestId("sidebar-flat-common.nav.crossProtocol");
    expect(flat).toBeInTheDocument();
    // No toggle button — it's a plain section.
    expect(
      within(flat).queryByRole("button"),
    ).toBeNull();
    // Flow Visualizer link is always present regardless of the group
    // states (it doesn't belong to either mother group).
    const flowLink = within(flat).getByRole("link");
    expect(flowLink.getAttribute("href")).toBe("/flow");
  });

  it("Cartão de teste lives under Mensagens, not under EMV & Cartões", () => {
    // Seed localStorage so the ISO 8583 group is expanded on render —
    // the assertion below depends on the subsection labels and nav
    // links being mounted. Without this, the accordion is collapsed
    // (empty DEFAULT_EXPANDED_GROUPS) and the DOM won't hold /cards
    // and /emv at all.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["iso8583"]));

    renderApp(<Sidebar />);

    // Both subsection labels exist. Localise via the rendered text.
    const messagesLabel = screen.getByText(/^Mensagens$|^Messages$/);
    const emvLabel = screen.getByText(/^EMV & Cartões$|^EMV & Cards$/);

    // The nav row for /cards must precede /emv in the DOM order and
    // sit in the same containing group as /parser (the Messages
    // subsection). Rather than climb ancestor trees, compare DOM order:
    // /cards must appear before /emv.
    const links = screen.getAllByRole("link");
    const cardsIdx = links.findIndex((l) => l.getAttribute("href") === "/cards");
    const emvIdx = links.findIndex((l) => l.getAttribute("href") === "/emv");
    expect(cardsIdx).toBeGreaterThanOrEqual(0);
    expect(emvIdx).toBeGreaterThanOrEqual(0);
    expect(cardsIdx).toBeLessThan(emvIdx);

    // Sanity: the two subsection headers are present in the expected
    // Messages-before-EMV order.
    const messagesPos = document.body.textContent!.indexOf(messagesLabel.textContent!);
    const emvPos = document.body.textContent!.indexOf(emvLabel.textContent!);
    expect(messagesPos).toBeLessThan(emvPos);
  });

  it("mother-group toggles have chevron icons — visual level cue above subsections", () => {
    renderApp(<Sidebar />);

    // The toggle button hosts a lucide chevron svg (down when expanded,
    // right when collapsed). Look for either svg inside the toggle.
    const toggle = screen.getByTestId("sidebar-group-toggle-iso8583");
    const svg = toggle.querySelector("svg.lucide-chevron-down, svg.lucide-chevron-right");
    expect(svg).not.toBeNull();
  });

  it("first mother-group has extra padding-top but NO top border (redundant with logo)", () => {
    renderApp(<Sidebar />);

    // ISO 8583 sits directly under the logo; drawing a border here
    // would double up with the visual seat the logo already creates.
    // The pt-4 breathing room is kept regardless.
    const iso8583 = screen.getByTestId("sidebar-group-iso8583");
    expect(iso8583.className).toContain("pt-4");
    expect(iso8583.className).not.toContain("border-t");
  });

  it("second mother-group draws a top border with matching breathing room", () => {
    renderApp(<Sidebar />);

    // ISO 20022 is the second mother-group: it must carry the divider
    // that separates it from the ISO 8583 world above.
    const iso20022 = screen.getByTestId("sidebar-group-iso20022");
    expect(iso20022.className).toContain("border-t");
    expect(iso20022.className).toContain("border-[var(--border)]");
    expect(iso20022.className).toContain("pt-4");
  });

  it("Cross-Protocol section has a subtler divider than the mother groups", () => {
    renderApp(<Sidebar />);

    // Same border colour, but less top padding — the reduced breathing
    // room is what makes the divider read as "adjacent category" instead
    // of "peer world".
    const cross = screen.getByTestId("sidebar-flat-common.nav.crossProtocol");
    expect(cross.className).toContain("border-t");
    expect(cross.className).toContain("border-[var(--border)]");
    expect(cross.className).toContain("pt-2");
    // Explicitly NOT the mother-group pt-4 — that's what makes it subtler.
    expect(cross.className).not.toContain("pt-4");
  });
});
