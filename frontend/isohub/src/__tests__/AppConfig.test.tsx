import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import type { AppConfig } from "@/types";

vi.mock("@/api/workspace", () => ({
  getAppConfig: vi.fn(),
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
  getWorkspace: vi.fn().mockResolvedValue({}),
  updateWorkspace: vi.fn(),
  listTemplates: vi.fn().mockResolvedValue([]),
  saveTemplate: vi.fn(),
  getTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));
vi.mock("@/api/simulator", () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  startSession: vi.fn(),
  stopSession: vi.fn(),
  getLog: vi.fn().mockResolvedValue([]),
  clearLog: vi.fn(),
}));
vi.mock("@/hooks/useSimulatorHub", () => ({
  useSimulatorHub: () => {},
}));

import { OnlineBanner } from "@/components/layout/OnlineBanner";
import { Sidebar } from "@/components/layout/Sidebar";
import EmvPage from "@/pages/Emv";
import WorkspacePage from "@/pages/Workspace";
import SimulatorPage from "@/pages/Simulator";

const ONLINE_CONFIG: AppConfig = {
  mode: "online",
  simulatorEnabled: false,
  emvCryptoEnabled: false,
  workspaceKeysEnabled: false,
  schemaUploadEnabled: false,
};

const STANDALONE_CONFIG: AppConfig = {
  mode: "standalone",
  simulatorEnabled: true,
  emvCryptoEnabled: true,
  workspaceKeysEnabled: true,
  schemaUploadEnabled: true,
};

/**
 * Wraps the UI in the AppConfigProvider with a specific config injected
 * (bypasses the /api/config fetch via the `initialConfig` test hook).
 */
function withConfig(ui: React.ReactElement, config: AppConfig) {
  return <AppConfigProvider initialConfig={config}>{ui}</AppConfigProvider>;
}

describe("AppConfig — online vs standalone mode", () => {
  beforeEach(() => {
    try {
      window.sessionStorage.removeItem("isoleaf-online-banner-dismissed");
      window.localStorage.removeItem("isoleaf-docs-open");
      // Sprint 10.7 — sidebar expand state persists in localStorage.
      // Clear it here so per-test seeding (e.g. the Simulator test)
      // doesn't leak into subsequent tests.
      window.localStorage.removeItem("isoleaf.sidebar.expandedGroups");
    } catch { /* ignore */ }
  });

  it("OnlineBanner renders when mode is online", () => {
    renderApp(withConfig(<OnlineBanner />, ONLINE_CONFIG));
    // Banner text comes from i18n; fallback locale is EN in jsdom.
    expect(
      screen.getByText(/ISOLeaf Online|ISOLeaf Online\./i),
    ).toBeInTheDocument();
  });

  it("OnlineBanner hidden when mode is standalone", () => {
    renderApp(withConfig(<OnlineBanner />, STANDALONE_CONFIG));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("Sprint 12.7 P1: install link is generic ('How to install'), NOT Docker-specific", () => {
    renderApp(withConfig(<OnlineBanner />, ONLINE_CONFIG));
    // The old "How to install via Docker" wording is gone — the banner
    // now points at the docs guides section which covers Docker Compose,
    // individual containers AND the portable zip.
    const link = screen.getByRole("link", { name: /How to install|Como instalar/i });
    expect(link).toBeInTheDocument();
    expect(link.textContent).not.toMatch(/via Docker/i);
  });

  it("Sprint 12.7 P3: install link points to the Quick Start matrix in the docs guides section", () => {
    renderApp(withConfig(<OnlineBanner />, ONLINE_CONFIG));
    const link = screen.getByRole("link", { name: /How to install|Como instalar/i }) as HTMLAnchorElement;
    expect(link.href).toContain("docs.isoleaf.dev");
    // #guides/{slug} — the Quick Start H2 anchor within the guides page,
    // not the raw #guides which lands at the top of "Self-host with Docker".
    expect(link.href).toContain("#guides/quick-start-");
    // Regression guard: the earliest version of this link went to the
    // GitHub README; the Sprint 12.7 P1 pass replaced it with the docs
    // #guides top. Both are now dead ends for the user.
    expect(link.href).not.toContain("github.com");
    expect(link.href).not.toMatch(/#guides$/);
  });

  it("Sprint 12.7 P1: banner text mentions running locally without pinning any single install path", () => {
    renderApp(withConfig(<OnlineBanner />, ONLINE_CONFIG));
    // The text no longer prescribes "install locally" as if there's one
    // way — it acknowledges Docker Compose / containers / portable and
    // steers the user to the docs.
    expect(
      screen.getByText(/portable|Compose|containers/i),
    ).toBeInTheDocument();
  });

  it("Simulator menu stays visible in online mode (locked, not hidden)", () => {
    // Earlier iteration hid /simulator entirely; current behaviour keeps
    // it in the menu with a lock icon so users can discover the feature.
    // Sprint 10.7 — the ISO 8583 mother-group now starts collapsed by
    // default, which unmounts /simulator (a leaf item inside the group).
    // Seed localStorage so this test still asserts what it means to
    // assert: the *visibility policy* under online mode, not the group's
    // default expansion state.
    localStorage.setItem(
      "isoleaf.sidebar.expandedGroups",
      JSON.stringify(["iso8583"]),
    );
    renderApp(withConfig(<Sidebar />, ONLINE_CONFIG));
    const navLinks = screen.getAllByRole("link");
    const hrefs = navLinks.map((el) => el.getAttribute("href"));
    expect(hrefs).toContain("/simulator");
    expect(hrefs).toContain("/parser");
  });

  it("Simulator Agent indicator hidden in online mode", () => {
    // The Simulator Agent indicator is only meaningful when the operator
    // is running their own Agent process — hide it on the public demo.
    // Sprint 12.6 P2 removed the Backend badge that used to sit above
    // it; only the Simulator Agent row remains to be asserted.
    renderApp(withConfig(<Sidebar />, ONLINE_CONFIG));
    expect(
      screen.queryByTestId("sidebar-simulator-agent-indicator"),
    ).not.toBeInTheDocument();
  });

  it("Sprint 12.7 P2: Reference links (GitHub + Contact) visible in ONLINE mode", () => {
    // Reference has no `feature` gate, so GitHub + Contact must render
    // regardless of mode — finding the repo / reaching the maintainers
    // is never mode-gated.
    renderApp(withConfig(<Sidebar />, ONLINE_CONFIG));
    expect(
      screen.getByRole("link", { name: /^GitHub$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Contato$|^Contact$/i }),
    ).toBeInTheDocument();
  });

  it("Sprint 12.7 P2: Reference links (GitHub + Contact) visible in STANDALONE mode", () => {
    renderApp(withConfig(<Sidebar />, STANDALONE_CONFIG));
    expect(
      screen.getByRole("link", { name: /^GitHub$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Contato$|^Contact$/i }),
    ).toBeInTheDocument();
  });

  it("Simulator Agent indicator visible in standalone mode", () => {
    renderApp(withConfig(<Sidebar />, STANDALONE_CONFIG));
    expect(
      screen.getByTestId("sidebar-simulator-agent-indicator"),
    ).toBeInTheDocument();
  });

  it("EMV crypto tabs disabled when emvCryptoEnabled is false", async () => {
    const user = userEvent.setup();
    renderApp(withConfig(<EmvPage />, ONLINE_CONFIG));
    // Radix tabs require real pointer events for activation — vanilla .click()
    // doesn't switch the panel. userEvent.click() does.
    const validateTab = await screen.findByRole("tab", { name: /Validate ARQC/i });
    await user.click(validateTab);
    // Locked-panel copy comes from i18n; jsdom uses the EN fallback.
    expect(
      await screen.findByText(/not available in the online version|não está disponível na versão online/i),
    ).toBeInTheDocument();
  });

  it("Workspace keys card hidden when workspaceKeysEnabled is false", async () => {
    renderApp(withConfig(<WorkspacePage />, ONLINE_CONFIG));
    // Wait for the workspace fetch to resolve — the "Loading..." placeholder
    // disappears once form state is populated. Then assert the IMK/ZPK
    // secret fields are absent (they're the only inputs labelled "IMK"/"ZPK").
    await waitFor(() => {
      expect(screen.queryByText(/Loading\.\.\.|Carregando\.\.\./i)).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/^IMK$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^ZPK$/i)).not.toBeInTheDocument();
  });

  it("Simulator page renders locked panel when simulatorEnabled is false", () => {
    renderApp(withConfig(<SimulatorPage />, ONLINE_CONFIG));
    // Locked panel surfaces "TCP Simulator" in both the title and reason copy
    // (jsdom falls back to EN). getAllByText handles the multiple matches.
    expect(screen.getAllByText(/TCP Simulator|Simulador TCP/i).length).toBeGreaterThan(0);
    // The normal Simulator UI never mounts: no "+ New session" button.
    expect(screen.queryByText(/\+ New session|\+ Nova sessão/i)).not.toBeInTheDocument();
  });
});
