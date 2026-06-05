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

import { OnlineBanner } from "@/components/layout/OnlineBanner";
import { Sidebar } from "@/components/layout/Sidebar";
import EmvPage from "@/pages/Emv";
import WorkspacePage from "@/pages/Workspace";

const ONLINE_CONFIG: AppConfig = {
  mode: "online",
  simulatorEnabled: false,
  emvCryptoEnabled: false,
  workspaceKeysEnabled: false,
};

const STANDALONE_CONFIG: AppConfig = {
  mode: "standalone",
  simulatorEnabled: true,
  emvCryptoEnabled: true,
  workspaceKeysEnabled: true,
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

  it("Simulator menu hidden when simulatorEnabled is false", () => {
    renderApp(withConfig(<Sidebar />, ONLINE_CONFIG));
    // The /simulator NavLink should be absent. Other nav items still present.
    const navLinks = screen.getAllByRole("link");
    const hrefs = navLinks.map((el) => el.getAttribute("href"));
    expect(hrefs).not.toContain("/simulator");
    // sanity: at least parser is still there
    expect(hrefs).toContain("/parser");
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
});
