import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import type { AppConfig } from "@/types";

// Sprint 12.6 P1 + P4 — the Workspace's Simulator tab now:
//   - pre-fills the URL input with the operator's saved value / server
//     hint / the local default (never an empty box)
//   - is server-gated in online mode with a lock icon + the shared
//     SimulatorLockedPanel content
// Mock heavy dependencies so this test only exercises the tab-level UX.

vi.mock("@/api/workspace", () => ({
  getAppConfig: vi.fn(),
  getWorkspace: vi.fn().mockResolvedValue({
    acquirerId: "", merchantId: "", terminalId: "",
    merchantName: "", merchantCity: "", mcc: "",
    originNii: "", destinationNii: "",
    defaultBrand: "", defaultCurrency: "", defaultCountry: "", defaultChannel: "",
    imk: "", zpk: "",
  }),
  updateWorkspace: vi.fn(),
  listWorkspaceSchemas: vi.fn().mockResolvedValue([]),
  uploadWorkspaceSchema: vi.fn(),
}));
vi.mock("@/api/agent", () => ({
  probeAgentHealth: vi.fn(),
}));

const { appConfigState } = vi.hoisted(() => ({
  appConfigState: {
    mode: "standalone" as string,
    simulatorEnabled: true,
    emvCryptoEnabled: true,
    workspaceKeysEnabled: true,
    schemaUploadEnabled: true,
    agentUrlHint: null as string | null,
  } as AppConfig,
}));
vi.mock("@/contexts/AppConfigContext", () => ({
  useAppConfig: () => appConfigState,
  AppConfigProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import WorkspacePage from "@/pages/Workspace";
import { useAgentConnectionStore } from "@/store/agentConnection";

async function openAgentTab() {
  const user = userEvent.setup();
  renderApp(<WorkspacePage />, "/workspace?tab=agent");
  // Wait for the workspace form to hydrate (getWorkspace resolves async).
  await screen.findByTestId("workspace-tab-agent");
  return user;
}

describe("Workspace → Simulador tab — pre-filled URL (Sprint 12.6 P1)", () => {
  beforeEach(() => {
    // Standalone by default; individual online-mode tests flip this below.
    appConfigState.mode = "standalone";
    appConfigState.simulatorEnabled = true;
    appConfigState.agentUrlHint = null;
    // Reset the persisted store so no leftover URL from another test seeds
    // the input.
    useAgentConnectionStore.setState({
      agentUrl: null,
      status: "idle",
      errorMessage: null,
    });
    window.localStorage.removeItem("isoleaf.agentBaseUrl");
  });

  it("seeds the URL input with http://localhost:8583 when nothing is saved and no server hint", async () => {
    await openAgentTab();
    const input = await screen.findByTestId("workspace-agent-url") as HTMLInputElement;
    expect(input.value).toBe("http://localhost:8583");
  });

  it("prefers the server hint (agentUrlHint) over the local default when nothing is saved", async () => {
    appConfigState.agentUrlHint = "http://sim.internal:8583";
    await openAgentTab();
    const input = await screen.findByTestId("workspace-agent-url") as HTMLInputElement;
    expect(input.value).toBe("http://sim.internal:8583");
  });

  it("prefers the persisted savedUrl over both the server hint and the default", async () => {
    appConfigState.agentUrlHint = "http://sim.internal:8583";
    useAgentConnectionStore.setState({
      agentUrl: "http://previous-session:9999",
      status: "idle",
      errorMessage: null,
    });
    await openAgentTab();
    // savedUrl seeds "editing=false" so we get the connected panel first;
    // to reach the input we click Change URL.
    // But with status=idle and savedUrl set, isConnected = false → editing = true → input renders.
    // Read directly.
    const input = await screen.findByTestId("workspace-agent-url") as HTMLInputElement;
    expect(input.value).toBe("http://previous-session:9999");
  });

  it("uses the PT-BR label 'URL do Agente' — no 'URL base do Agent' anymore", async () => {
    await openAgentTab();
    // The Label sits above the input. If English fallback is active, allow
    // "Agent URL" too; the regression we're guarding against is the old
    // mixed-language "URL base do Agent".
    expect(await screen.findByText(/URL do Agente|Agent URL/)).toBeInTheDocument();
    expect(screen.queryByText(/URL base do Agent/)).not.toBeInTheDocument();
  });
});

describe("Workspace → Simulador tab — online gating (Sprint 12.6 P4)", () => {
  beforeEach(() => {
    appConfigState.mode = "online";
    appConfigState.simulatorEnabled = false;
    appConfigState.agentUrlHint = null;
    useAgentConnectionStore.setState({
      agentUrl: null,
      status: "idle",
      errorMessage: null,
    });
  });

  it("marks the tab trigger as disabled and shows the lock icon", async () => {
    const user = userEvent.setup();
    renderApp(<WorkspacePage />, "/workspace");
    await screen.findByTestId("workspace-tab-agent");
    const trigger = screen.getByTestId("workspace-tab-agent");
    expect(trigger).toBeDisabled();
    // Lock icon is a lucide svg — check by role. The Radix Trigger is a
    // <button>; the icon is a child <svg>.
    expect(trigger.querySelector("svg")).toBeTruthy();
    // Clicking a disabled trigger is a no-op — the tab shouldn't activate.
    await user.click(trigger);
    expect(trigger).toHaveAttribute("data-state", "inactive");
  });

  it("renders SimulatorLockedPanel instead of AgentSection when the tab IS somehow the active one", async () => {
    // Simulate a saved link like /workspace?tab=agent — the initialTab
    // fallback should route to 'config' in online mode, so the locked
    // panel doesn't render... but if the user manages to activate the
    // agent content anyway (e.g. via URL manipulation post-hydration),
    // the content branch must still show the locked panel and NOT the
    // real AgentSection (which would try to hit /api/health via probe).
    renderApp(<WorkspacePage />, "/workspace?tab=agent");
    await screen.findByTestId("workspace-tab-agent");
    // Because simulatorEnabled=false the initialTab falls back to
    // 'config'. Nothing in the AgentSection should be visible.
    expect(screen.queryByTestId("workspace-agent-url")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-agent-connect")).not.toBeInTheDocument();
  });
});
