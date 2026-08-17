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

  it("Host status block hidden in online mode", () => {
    // The Backend + Simulator Agent indicator block is only meaningful
    // when the user is running the hosts themselves — hide it on the
    // public demo where both hosts are always up on the demo server.
    // Post-Sprint-12.4 the label is "Backend online/offline"; the
    // Simulator Agent row renders separately below it.
    renderApp(withConfig(<Sidebar />, ONLINE_CONFIG));
    expect(
      screen.queryByText(/Backend online|Backend offline/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("sidebar-simulator-agent-indicator"),
    ).not.toBeInTheDocument();
  });

  it("Host status block visible in standalone mode", () => {
    renderApp(withConfig(<Sidebar />, STANDALONE_CONFIG));
    // jsdom can't reach the live Backend so it renders "offline" — either label is fine.
    expect(
      screen.getByText(/Backend online|Backend offline/i),
    ).toBeInTheDocument();
    // The Sprint 12.4 Simulator Agent indicator is a sibling row inside
    // the same block, so it must be visible in standalone mode too.
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
