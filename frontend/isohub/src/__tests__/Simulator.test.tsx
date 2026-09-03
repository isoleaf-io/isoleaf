import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";

vi.mock("@/api/simulator", () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  startSession: vi.fn(),
  stopSession: vi.fn(),
  getLog: vi.fn().mockResolvedValue([]),
  clearLog: vi.fn(),
  injectMessage: vi.fn(),
  injectDirect: vi.fn(),
}));
vi.mock("@/api/agent", () => ({
  // Default: gate probe succeeds. Individual tests can override with
  // mockRejectedValueOnce to exercise the "not reachable" empty state.
  probeAgentHealth: vi.fn().mockResolvedValue({
    status: "ok",
    version: "2.1.3",
    uptime: "00:00:01",
    activeSessions: 0,
    totalMessagesProcessed: 0,
  }),
}));
vi.mock("@/api/workspace", () => ({
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  listTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  getTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));
vi.mock("@/hooks/useSimulatorHub", () => ({
  useSimulatorHub: () => ({
    status: "connected",
    reconnect: vi.fn(),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
  }),
}));

import SimulatorPage from "@/pages/Simulator";
import { listSessions, injectDirect, getLog, startSession } from "@/api/simulator";
import { probeAgentHealth } from "@/api/agent";
import { useInjectorStore, DEFAULTS as INJECTOR_DEFAULTS, isValidTpduOverride } from "@/store/injector";
import { useAgentConnectionStore } from "@/store/agentConnection";

async function openNewSessionForm() {
  const user = userEvent.setup();
  renderApp(<SimulatorPage />);
  await user.click(screen.getByRole("button", { name: /Nova sess[aã]o|New session/i }));
  return user;
}

describe("Simulator page — redesigned layout", () => {
  // Reset API mocks between tests so a `mockResolvedValueOnce` from one case
  // can't leak sessions/log entries into another (and break role/button counts).
  beforeEach(() => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockReset();
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getLog as unknown as ReturnType<typeof vi.fn>).mockReset();
    (getLog as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    // Sprint 12.4: probe defaults to success so happy-path tests keep
    // exercising the live UI; the "gate blocks the form when the Agent
    // is offline" case overrides with mockRejectedValueOnce.
    (probeAgentHealth as unknown as ReturnType<typeof vi.fn>).mockReset();
    (probeAgentHealth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ok",
      version: "2.1.3",
      uptime: "00:00:01",
      activeSessions: 0,
      totalMessagesProcessed: 0,
    });
    try {
      window.localStorage.removeItem("isoleaf-injector");
      window.localStorage.removeItem("simulator-logExpanded");
    } catch { /* ignore */ }
    // The zustand store survives across tests in the same module — reset
    // its in-memory state too, otherwise mocks leak between cases.
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS });
    // Sprint 12.2 P5+: the Simulator page shows a "not configured" empty
    // state when agentUrl is null. Pre-populate a URL so the existing
    // happy-path tests keep exercising the live UI. The dedicated
    // "shows not-configured empty state" case below clears it again.
    useAgentConnectionStore.setState({
      agentUrl: "http://localhost:8583",
      status: "connected",
      errorMessage: null,
    });
  });

  it("renders the three sections (Rebatedores, Injector, Live log)", () => {
    renderApp(<SimulatorPage />);
    expect(screen.getByText(/^Rebatedores$|^Listeners$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Injetor$|^Injector$/i)).toBeInTheDocument();
    expect(screen.getByText(/Log ao vivo|Live log/i)).toBeInTheDocument();
  });

  it("Nova sessão form does not show Mode field", async () => {
    await openNewSessionForm();
    // Should still expose TCP port + role + RC, but NOT a Mode selector.
    expect(screen.getByText(/Porta TCP|TCP port/i)).toBeInTheDocument();
    // queryByDisplayValue returns the select with the picked option; previously
    // there was a Mode select sitting at "Rebatedor". It must be gone now.
    expect(screen.queryByDisplayValue("Rebatedor")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Injetor")).not.toBeInTheDocument();
  });

  it("Nova sessão form does not show target host/port", async () => {
    await openNewSessionForm();
    // The injector panel below uses "Target host" / "Host destino" — that's expected.
    // What we're guarding against is the SessionForm carrying those fields. Scope by
    // the Cancel button (only present in the SessionForm) to the closest CardBody.
    const cancelBtn = screen.getByRole("button", { name: /Cancelar|Cancel/i });
    const form = cancelBtn.closest('[class*="space-y-3"]') as HTMLElement;
    expect(form).toBeTruthy();
    expect(form.querySelector('[placeholder="localhost"]')).toBeNull();
  });

  it("Autorizador not present in role select options", async () => {
    await openNewSessionForm();
    // Display labels are localized now ("Acquirer" in EN). Identify the role
    // select by its option values (the internal enum identifiers, which stay PT).
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const roleSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === "Adquirente")
    );
    expect(roleSelect).toBeTruthy();
    const options = Array.from(roleSelect!.options).map((o) => o.value);
    expect(options).toEqual(["Adquirente", "Bandeira", "Emissor"]);
    expect(options).not.toContain("Autorizador");
  });

  it("Adquirente hint shows when Adquirente selected", async () => {
    await openNewSessionForm();
    // Default selection is Adquirente — hint should already be visible.
    expect(
      screen.getByText(/credenciadora\/adquirente|Simulates the acquirer/i)
    ).toBeInTheDocument();
  });

  it("Nova sessão form defaults TCP port to 9100 (must NOT collide with Agent's 8583)", async () => {
    // Sprint 12.4 P5: the TCP port default was 8583 pre-split, which
    // coincidentally matched the Agent host's HTTP port after Sprint 12.2.
    // The default is now 9100 — a common lab-simulator port that carries
    // no false association with the Agent URL and avoids bind conflicts.
    const user = await openNewSessionForm();
    const mock = startSession as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({});

    await user.click(screen.getByRole("button", { name: /^Confirmar$|^Confirm$/i }));

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0].tcpPort).toBe(9100);
    // Regression guard: 8583 belongs to the Agent host, not the Simulator listener.
    expect(mock.mock.calls[0][0].tcpPort).not.toBe(8583);
  });

  it("Nova sessão form defaults Esperar Length prefix to ON (headerSize=2)", async () => {
    const user = await openNewSessionForm();
    const mock = startSession as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({});

    // Default state of the toggle is ON; submit immediately and check the payload.
    await user.click(screen.getByRole("button", { name: /^Confirmar$|^Confirm$/i }));

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0].headerSize).toBe(2);
    // The UI-side `expectLengthPrefix` is stripped from the payload — only
    // the backend-facing `headerSize` should be sent.
    expect("expectLengthPrefix" in mock.mock.calls[0][0]).toBe(false);
  });

  it("Nova sessão form sends headerSize=0 when toggle is turned off", async () => {
    const user = await openNewSessionForm();
    const mock = startSession as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({});

    // The Toggle component is a custom <span> (no native role); the clickable
    // pill is the first child of the wrapping label, which is the parent of
    // the text we can query for.
    const textSpan = screen.getByText(/Esperar Length prefix|Expect length prefix/i);
    const togglePill = textSpan.parentElement!.firstElementChild as HTMLElement;
    await user.click(togglePill);

    await user.click(screen.getByRole("button", { name: /^Confirmar$|^Confirm$/i }));

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0].headerSize).toBe(0);
  });

  it("SessionCard shows 'Com prefix' badge when headerSize=2", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
      },
    ]);

    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    expect(await screen.findByText(/^Com prefix$|^With prefix$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Sem prefix$|^No prefix$/i)).toBeNull();
  });

  it("Nova sessão form does NOT show 'Validate ARQC' toggle", async () => {
    // ValidateArqc moved to the per-session EMV config modal (Issuer only).
    await openNewSessionForm();
    expect(screen.queryByText(/Validar ARQC|Validate ARQC/i)).toBeNull();
  });

  it("EMV config modal shows ValidateArqc toggle only when GenerateArpc selected", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
        emvResponse: { mode: "Echo", proprietaryHeaderBytes: 0, brand: "Visa" },
      },
    ]);

    const user = userEvent.setup();
    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    await user.click(screen.getByTestId("emv-config-button"));

    // Echo selected by default → ValidateArqc toggle should be hidden.
    expect(screen.queryByTestId("validate-arqc-toggle")).toBeNull();

    // Flip to GenerateArpc → toggle appears.
    const arpcRadio = screen.getByRole("radio", { name: /Generate ARPC|Gerar ARPC/i });
    await user.click(arpcRadio);
    expect(screen.getByTestId("validate-arqc-toggle")).toBeInTheDocument();
  });

  it("InjectorPanel lists active Rebatedor sessions in the destination combobox", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Adquirente",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
      },
      {
        sessionId: "rebat-2", tcpPort: 9200, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 0,
      },
    ]);

    renderApp(<SimulatorPage />);
    // Wait until the session cards render — that's the React Query
    // resolution mark. The combobox re-renders alongside.
    await screen.findByText(/port 9100/);
    await screen.findByText(/port 9200/);
    const combobox = screen.getByTestId("injector-destination") as HTMLSelectElement;
    const sessionOptions = Array.from(combobox.options)
      .filter((o) => o.value.startsWith("session:"));
    expect(sessionOptions.map((o) => o.value)).toEqual(["session:9100", "session:9200"]);
    expect(Array.from(combobox.options).some((o) => o.value === "custom")).toBe(true);
  });

  it("InjectorPanel hides custom host/port fields when a session is selected", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Adquirente",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
      },
    ]);

    const user = userEvent.setup();
    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/); // sessions resolved
    const combobox = screen.getByTestId("injector-destination");
    // Default is "custom" → host/port visible.
    expect(screen.getByTestId("injector-custom-fields")).toBeInTheDocument();

    await user.selectOptions(combobox, "session:9100");
    expect(screen.queryByTestId("injector-custom-fields")).toBeNull();
  });

  it("InjectorPanel does NOT show a compatibility warning in custom destination mode", async () => {
    // Custom mode points at an external host/port — local Rebatedores'
    // framing is irrelevant to whether that external system accepts the
    // wire. The combobox option icons still flag local mismatches, but
    // there's no top-level warning banner.
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Adquirente",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
      },
    ]);

    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/); // sessions resolved
    expect(screen.queryByTestId("injector-incompatible-warning")).toBeNull();
  });

  it("SessionRow surfaces compatible framing border when Injector matches", async () => {
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS, includeLengthPrefix: true });
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2, // ON, matches injector ON
      },
    ]);
    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    const card = document.querySelector('[data-framing-compatible]') as HTMLElement;
    expect(card.getAttribute("data-framing-compatible")).toBe("true");
  });

  it("SessionRow surfaces incompatible framing border when Injector differs", async () => {
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS, includeLengthPrefix: false });
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2, // ON, but injector OFF → mismatch
      },
    ]);
    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    const card = document.querySelector('[data-framing-compatible]') as HTMLElement;
    expect(card.getAttribute("data-framing-compatible")).toBe("false");
  });

  it("Live log shows entry when injection fails", async () => {
    // Force a failure: mock injectDirect to return success=false + error.
    const mock = injectDirect as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({
      success: false,
      processingMs: 5,
      requestMti: "0200",
      error: "Connection refused to 127.0.0.1:9999 (ConnectionRefused).",
    });

    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C24");
    await user.click(screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i }));

    // Expand the live log to see entries.
    const bar = screen.getByRole("button", { name: /Log ao vivo|Live log/i });
    await user.click(bar);

    // The failed injection adds a log entry with errorCode "INJECTION_FAILED" —
    // surfaced in the log entry's validation summary line.
    expect(await screen.findByText(/INJECTION_FAILED/i)).toBeInTheDocument();
  });

  it("SessionCard shows EMV config button only for Issuer role", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      // Issuer/Emissor — config button should be visible.
      {
        sessionId: "rebat-issuer", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
        emvResponse: { mode: "Echo", proprietaryHeaderBytes: 0, brand: "Visa" },
      },
      // Acquirer — should NOT have the config button.
      {
        sessionId: "rebat-acquirer", tcpPort: 9101, mode: "rebatedor", role: "Adquirente",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
      },
    ]);

    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    await screen.findByText(/port 9101/);

    // Exactly one EMV config button — for the Issuer session only.
    const buttons = screen.queryAllByTestId("emv-config-button");
    expect(buttons).toHaveLength(1);
  });

  it("SessionCard shows ARPC badge when EMV mode is GenerateArpc", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-arpc", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
        emvResponse: { mode: "GenerateArpc", proprietaryHeaderBytes: 4, brand: "Visa" },
      },
    ]);

    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    expect(await screen.findByText(/Bit 55: ARPC/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bit 55: Echo/i)).toBeNull();
  });

  it("SessionCard shows Echo badge by default for Issuer", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-echo", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
        emvResponse: { mode: "Echo", proprietaryHeaderBytes: 0, brand: "Visa" },
      },
    ]);

    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    expect(await screen.findByText(/Bit 55: Echo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bit 55: ARPC/i)).toBeNull();
  });

  it("EMV config modal reveals ARPC fields only when GenerateArpc selected", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 2,
        emvResponse: { mode: "Echo", proprietaryHeaderBytes: 0, brand: "Visa" },
      },
    ]);

    const user = userEvent.setup();
    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);

    // Open the modal — ARPC fields hidden because Echo is selected.
    await user.click(screen.getByTestId("emv-config-button"));
    expect(screen.getByTestId("emv-config-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("arpc-fields")).toBeNull();

    // Flip to GenerateArpc — the proprietary header + IMK + brand fields appear.
    const arpcRadio = screen.getByRole("radio", { name: /Generate ARPC|Gerar ARPC/i });
    await user.click(arpcRadio);
    expect(screen.getByTestId("arpc-fields")).toBeInTheDocument();
  });

  it("SessionCard shows 'Sem prefix' badge when headerSize=0", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-1", tcpPort: 9100, mode: "rebatedor", role: "Emissor",
        layoutName: "default", defaultResponseCode: "00", validateArqc: false,
        autoRespond: true, status: "active",
        startedAt: new Date().toISOString(), messagesProcessed: 0, messagesRejected: 0,
        headerSize: 0,
      },
    ]);

    renderApp(<SimulatorPage />);
    await screen.findByText(/port 9100/);
    expect(await screen.findByText(/^Sem prefix$|^No prefix$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Com prefix$|^With prefix$/i)).toBeNull();
  });

  it("Emissor hint shows when Emissor selected", async () => {
    const user = await openNewSessionForm();
    // Same lookup pattern as the previous test — internal `value` is "Adquirente".
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const roleSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === "Adquirente")
    )!;
    await user.selectOptions(roleSelect, "Emissor");
    expect(
      screen.getByText(/banco emissor|Simulates the issuing bank/i)
    ).toBeInTheDocument();
  });

  // ── Live log redesign ─────────────────────────────────────────────────

  it("log section is collapsed by default", () => {
    try { window.localStorage.removeItem("simulator-logExpanded"); } catch { /* ignore */ }
    renderApp(<SimulatorPage />);

    // Log bar (the trigger button) is always rendered…
    const bar = screen.getByRole("button", { name: /Log ao vivo|Live log/i });
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-expanded", "false");

    // …but the per-direction filters live inside the expanded body and must be hidden.
    expect(screen.queryByRole("button", { name: /^Recebidas$|^Received$/i })).not.toBeInTheDocument();
  });

  it("clicking log bar expands the log", async () => {
    try { window.localStorage.removeItem("simulator-logExpanded"); } catch { /* ignore */ }
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    const bar = screen.getByRole("button", { name: /Log ao vivo|Live log/i });
    await user.click(bar);

    expect(bar).toHaveAttribute("aria-expanded", "true");
    // Direction filters are visible after expansion.
    expect(screen.getByRole("button", { name: /^Recebidas$|^Received$/i })).toBeInTheDocument();
  });

  it("clicking session log button expands and filters log", async () => {
    try { window.localStorage.removeItem("simulator-logExpanded"); } catch { /* ignore */ }
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-1",
        tcpPort: 9100,
        mode: "rebatedor",
        role: "Emissor",
        layoutName: "default",
        defaultResponseCode: "00",
        validateArqc: false,
        autoRespond: true,
        status: "active",
        startedAt: new Date().toISOString(),
        messagesProcessed: 0,
        messagesRejected: 0,
      },
    ]);
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    // Wait for the card.
    await screen.findByText(/port 9100/);

    // The session log button is reachable by title (matches both locales).
    const sessionLogBtn = screen.getByRole("button", {
      name: /Ver log desta sess[ãa]o|View this session's log/i,
    });
    await user.click(sessionLogBtn);

    // Log expands and shows the active-filter pill near the bar.
    const bar = screen.getByRole("button", { name: /Log ao vivo|Live log/i });
    expect(bar).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Mostrando:.*port 9100.*Emissor|Showing:.*port 9100.*Emissor/i)).toBeInTheDocument();
  });

  it("session badge appears in log entries", async () => {
    try { window.localStorage.setItem("simulator-logExpanded", "true"); } catch { /* ignore */ }
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sessionId: "rebat-1",
        tcpPort: 9100,
        mode: "rebatedor",
        role: "Emissor",
        layoutName: "default",
        defaultResponseCode: "00",
        validateArqc: false,
        autoRespond: true,
        status: "active",
        startedAt: new Date().toISOString(),
        messagesProcessed: 0,
        messagesRejected: 0,
      },
    ]);
    (getLog as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        entryId: "e1",
        sessionId: "rebat-1",
        timestamp: new Date().toISOString(),
        direction: "received",
        asciiMessage: "",
        binaryHexMessage: "",
        decodedMti: "0200",
        decodedFields: [],
        hasErrors: false,
        processingMs: 5,
      },
    ]);

    renderApp(<SimulatorPage />);

    // Wait for BOTH the session card AND the log entry to render. The badge
    // depends on the sessions query having resolved (it looks the session up
    // by id); waiting on the log entry alone races that resolution.
    await screen.findByText(/port 9100/);
    // "0200" appears in multiple places (an SVG decoration + the log entry),
    // so findAllByText is the safe call.
    await screen.findAllByText("0200");
    // The badge text is JSX-composed ("port {n} · {role}"), so we match by
    // concatenated textContent rather than a single getByText query.
    const badges = Array.from(document.querySelectorAll("span")).filter((el) =>
      /port\s*9100\s*·\s*Emissor/.test(el.textContent ?? "")
    );
    expect(badges.length).toBeGreaterThan(0);
  });

  it("clear filter button removes session filter", async () => {
    try { window.localStorage.removeItem("simulator-logExpanded"); } catch { /* ignore */ }
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-1",
        tcpPort: 9100,
        mode: "rebatedor",
        role: "Emissor",
        layoutName: "default",
        defaultResponseCode: "00",
        validateArqc: false,
        autoRespond: true,
        status: "active",
        startedAt: new Date().toISOString(),
        messagesProcessed: 0,
        messagesRejected: 0,
      },
    ]);
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    await screen.findByText(/port 9100/);
    await user.click(
      screen.getByRole("button", { name: /Ver log desta sess[ãa]o|View this session's log/i })
    );

    // Filter pill visible.
    expect(screen.getByText(/Mostrando:|Showing:/i)).toBeInTheDocument();

    // Click the X — it has the "Limpar filtro"/"Clear filter" title.
    await user.click(
      screen.getByRole("button", { name: /Limpar filtro|Clear filter/i })
    );
    expect(screen.queryByText(/Mostrando:|Showing:/i)).not.toBeInTheDocument();
  });

  it("inject button not present in session cards", async () => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        sessionId: "rebat-1",
        tcpPort: 8583,
        mode: "Rebatedor",
        role: "Adquirente",
        layoutName: "default",
        defaultResponseCode: "00",
        validateArqc: false,
        autoRespond: true,
        status: "active",
        startedAt: new Date().toISOString(),
        messagesProcessed: 0,
        messagesRejected: 0,
      },
    ]);

    renderApp(<SimulatorPage />);
    // Wait for the card to appear by looking for its port text.
    await screen.findByText(/port 8583/);
    expect(screen.queryByTitle(/Inject message/i)).not.toBeInTheDocument();
  });
});

describe("InjectorPanel", () => {
  // Persisted state (host/port/message/flags) lives in localStorage; clear it
  // between tests so message inputs don't accumulate across cases.
  beforeEach(() => {
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockReset();
    (listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getLog as unknown as ReturnType<typeof vi.fn>).mockReset();
    (getLog as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    try { window.localStorage.removeItem("isoleaf-injector"); } catch { /* ignore */ }
    // Zustand store survives across tests — reset its in-memory state too.
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS });
  });


  it("renders with default values", () => {
    renderApp(<SimulatorPage />);
    // Default host / port from PersistedState.
    const hostInput = screen.getByPlaceholderText("localhost") as HTMLInputElement;
    expect(hostInput.value).toBe("localhost");
    // The port input is a sibling — its label "Porta" exists.
    expect(screen.getByText(/^Porta$|^Port$/i)).toBeInTheDocument();
  });

  it("Injetar button disabled when message is empty", () => {
    renderApp(<SimulatorPage />);
    const injectBtn = screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i });
    expect(injectBtn).toBeDisabled();
  });

  it("Injetar button enabled when message has content", async () => {
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);
    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C");
    const injectBtn = screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i });
    expect(injectBtn).not.toBeDisabled();
  });

  it("Start contínuo button shows Stop when running", async () => {
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);
    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C");

    const startBtn = screen.getByRole("button", { name: /Iniciar cont[íi]nuo|Start continuous/i });
    await user.click(startBtn);

    // After click the button label flips to Stop.
    expect(
      screen.getByRole("button", { name: /^Parar$|^Stop$/i })
    ).toBeInTheDocument();

    // Stop the loop so the test doesn't leak a timer.
    await user.click(screen.getByRole("button", { name: /^Parar$|^Stop$/i }));
  });

  // ── Variation flags + numeric duration ───────────────────────────────

  it("varyIdentifiers checkbox renders with help button", () => {
    renderApp(<SimulatorPage />);
    expect(
      screen.getByLabelText(/Variar identificadores|Vary identifiers/i)
    ).toBeInTheDocument();
    // Two HelpButtons live alongside the flags — at least one is reachable by its title.
    expect(
      screen.getByRole("button", { name: /O que s[aã]o identificadores|What are identifiers/i })
    ).toBeInTheDocument();
  });

  it("varyAmount checkbox renders with help button", () => {
    renderApp(<SimulatorPage />);
    expect(
      screen.getByLabelText(/Variar valor da transa[çc][ãa]o|Vary transaction amount/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Varia[çc][ãa]o de valor|Amount variation/i })
    ).toBeInTheDocument();
  });

  it("flags live inside the continuous-mode section, not next to the Inject button", () => {
    renderApp(<SimulatorPage />);

    // The "Continuous mode" header sits in its own row; its parent (the bordered
    // <div class="rounded-md border …">) wraps the flags + duration + start button.
    const continuousHeader = screen.getByText(/Modo cont[íi]nuo|Continuous mode/i);
    const section = continuousHeader.parentElement;
    expect(section).toBeTruthy();

    const varyIdentifiersCheckbox = screen.getByLabelText(
      /Variar identificadores|Vary identifiers/i
    );
    const injectBtn = screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i });

    expect(section!.contains(varyIdentifiersCheckbox)).toBe(true);
    expect(section!.contains(injectBtn)).toBe(false);
  });

  it("varyAmount shows min/max inputs when checked", async () => {
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);
    // Min/Max fields hidden by default.
    expect(screen.queryByText(/Valor m[íi]n\.|Min amount/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByLabelText(/Variar valor da transa[çc][ãa]o|Vary transaction amount/i)
    );

    expect(screen.getByText(/Valor m[íi]n\.|Min amount/i)).toBeInTheDocument();
    expect(screen.getByText(/Valor m[áa]x\.|Max amount/i)).toBeInTheDocument();
  });

  it("duration input is numeric with hint text", () => {
    renderApp(<SimulatorPage />);
    // Hint text always present below the duration field.
    expect(screen.getByText(/0 = sem limite|0 = no limit/i)).toBeInTheDocument();
    // The duration input has type=number — confirm via spinbutton role.
    expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
  });

  /**
   * Finds the "Limpar" button that lives next to the Injetar button.
   * Walks up to the row that contains the Inject button, then picks the next
   * sibling button (the Limpar is the only other button in that row).
   */
  function getInjectorClear(): HTMLElement {
    const injectBtn = screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i });
    const row = injectBtn.parentElement!;
    const buttons = Array.from(row.querySelectorAll("button")) as HTMLButtonElement[];
    const clear = buttons.find((b) => b !== injectBtn);
    if (!clear) throw new Error("Injector Clear button not found");
    return clear;
  }

  it("clear button resets all injector fields to defaults", async () => {
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    // Mutate state: change message + target host.
    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C");
    const hostInput = screen.getByPlaceholderText("localhost") as HTMLInputElement;
    await user.clear(hostInput);
    await user.type(hostInput, "1.2.3.4");

    expect(textarea.value).toBe("0200F23C");
    expect(hostInput.value).toBe("1.2.3.4");

    await user.click(getInjectorClear());

    expect((screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByPlaceholderText("localhost") as HTMLInputElement).value).toBe("localhost");
  });

  // Sprint 12.6 P5 — "Limpar mensagem" (eraser next to the textarea label)
  // clears ONLY the message field; host/port/toggles stay put. Different
  // affordance from the big "Limpar" that resets everything.
  it("Sprint 12.6 P5: clear-message button clears only the message, preserving host/port/toggles", async () => {
    // Seed a non-default toggle in the store BEFORE render so we can then
    // assert it survives the clear-message click. Interacting with the
    // Toggle component through userEvent is finicky in jsdom (it's a
    // custom span, not a native <input>); driving the store directly is
    // both more stable and truer to what the field actually persists.
    useInjectorStore.setState({
      ...INJECTOR_DEFAULTS,
      includeTpdu: true,
      tpduOverride: "6001020304",
      message: "0200F23C24",
      targetHost: "1.2.3.4",
      targetPort: 9500,
    });

    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    // Sanity — the store snapshot the panel renders shows all the values.
    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    const hostInput = screen.getByPlaceholderText("localhost") as HTMLInputElement;
    expect(textarea.value).toBe("0200F23C24");
    expect(hostInput.value).toBe("1.2.3.4");
    // The TPDU literal field only renders when includeTpdu is ON — its
    // presence is our proxy for "the toggle is set".
    expect(screen.getByTestId("injector-tpdu-field")).toBeInTheDocument();

    // Click the small eraser button next to the Message label.
    await user.click(screen.getByTestId("injector-clear-message"));

    // Message emptied.
    expect(
      (screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement).value,
    ).toBe("");
    // Host + TPDU toggle preserved — the store still carries them.
    expect(
      (screen.getByPlaceholderText("localhost") as HTMLInputElement).value,
    ).toBe("1.2.3.4");
    expect(screen.getByTestId("injector-tpdu-field")).toBeInTheDocument();
    // Direct store check for the belt: the reset must have touched ONLY
    // the message key.
    const state = useInjectorStore.getState();
    expect(state.message).toBe("");
    expect(state.targetHost).toBe("1.2.3.4");
    expect(state.targetPort).toBe(9500);
    expect(state.includeTpdu).toBe(true);
    expect(state.tpduOverride).toBe("6001020304");
  });

  it("Sprint 12.6 P5: clear-message button is disabled when the message is already empty", () => {
    // Fresh render, no message typed → the eraser is disabled so a stray
    // click doesn't clobber anything.
    renderApp(<SimulatorPage />);
    const btn = screen.getByTestId("injector-clear-message") as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  it("clear button stops continuous mode if running", async () => {
    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C");

    const start = screen.getByRole("button", { name: /Iniciar cont[íi]nuo|Start continuous/i });
    await user.click(start);

    // Stop button is showing → continuous mode is on.
    expect(screen.getByRole("button", { name: /^Parar$|^Stop$/i })).toBeInTheDocument();

    await user.click(getInjectorClear());

    expect((screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement).value).toBe("");
    expect(
      screen.getByRole("button", { name: /Iniciar cont[íi]nuo|Start continuous/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Parar$|^Stop$/i })).not.toBeInTheDocument();
  });

  it("unit-mode Inject button calls injectDirect with varyIdentifiers=false", async () => {
    const user = userEvent.setup();
    const mock = injectDirect as unknown as ReturnType<typeof vi.fn>;
    // Other tests in this file may have left calls on the spy — reset so the
    // assertions below are about this single click only.
    mock.mockReset();
    mock.mockResolvedValueOnce({ success: true, processingMs: 5 });

    renderApp(<SimulatorPage />);

    // Even though varyIdentifiers defaults to true in localStorage, the unit-mode
    // button must override it to false — the user typed an exact payload.
    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C");

    const injectBtn = screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i });
    await user.click(injectBtn);

    expect(mock).toHaveBeenCalledTimes(1);
    const args = mock.mock.calls[0][0];
    expect(args.varyIdentifiers).toBe(false);
    expect(args.varyAmount).toBe(false);
  });

  it("shows correct preview after stripping an existing length prefix", async () => {
    // User pastes "0004" + "30323030" — "0004" is a valid length prefix
    // (declares 4 wire bytes), payload is the binary-hex of "0200" (4 chars).
    // Preview must show [0004] (recomputed from the 4-byte payload), NOT
    // [0006] which the old code computed by counting all 12 hex chars / 2.
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS, includeLengthPrefix: true });

    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "000430323030");

    const preview = await screen.findByTestId("injector-length-preview");
    expect(preview.textContent).toContain("[0004]");
    expect(preview.textContent).not.toContain("[0006]");
    // The detected-prefix hint surfaces the value we stripped.
    expect(preview.textContent).toMatch(/0004/);
  });

  it("calculates correct length preview for binary-hex input", async () => {
    // Binary-hex input "0200F23C" is 8 hex chars = 4 wire bytes. The preview
    // must show "[0004]" — not "[0008]" (the old bug counted hex chars).
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS, includeLengthPrefix: true });

    const user = userEvent.setup();
    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C");

    const preview = await screen.findByTestId("injector-length-preview");
    expect(preview.textContent).toContain("[0004]");
    expect(preview.textContent).not.toContain("[0008]");
  });

  it("sends includeLengthPrefix flag to backend (not concat in body)", async () => {
    // Regression: earlier this UI concatenated the prefix as 4 ASCII hex chars
    // into the message string. The backend then wrapped it with its own
    // (correct) 2-byte binary prefix → receiver got "000A0200…" inside the
    // body and failed to parse the MTI. The fix moved prefix generation to
    // the backend, which now reads a boolean from the request DTO.
    const user = userEvent.setup();
    const mock = injectDirect as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({ success: true, processingMs: 5 });
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS, includeLengthPrefix: true });

    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C24");
    await user.click(screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i }));

    expect(mock).toHaveBeenCalledTimes(1);
    const arg = mock.mock.calls[0][0];
    expect(arg.message).toBe("0200F23C24");        // body untouched
    expect(arg.includeLengthPrefix).toBe(true);    // flag forwarded
  });

  it("omits includeLengthPrefix when toggle is disabled", async () => {
    const user = userEvent.setup();
    const mock = injectDirect as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({ success: true, processingMs: 5 });

    // Default state → includeLengthPrefix: false (set explicitly so we test
    // the disabled path too).
    useInjectorStore.setState({ ...INJECTOR_DEFAULTS, includeLengthPrefix: false });

    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C24");
    await user.click(screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i }));

    expect(mock).toHaveBeenCalledTimes(1);
    const arg = mock.mock.calls[0][0];
    expect(arg.message).toBe("0200F23C24");
    expect(arg.includeLengthPrefix).toBe(false);
  });

  // ── TPDU editable literal ─────────────────────────────────────────────────
  // The toggle has always existed; this group covers the new editable value
  // field (tpduOverride) that lets users force the 5 TPDU bytes verbatim.

  it("isValidTpduOverride accepts null/empty and 10-hex strings, rejects everything else", () => {
    expect(isValidTpduOverride(null)).toBe(true);
    expect(isValidTpduOverride("")).toBe(true);
    expect(isValidTpduOverride("6000000000")).toBe(true);
    expect(isValidTpduOverride("6abcDEF012")).toBe(true);  // mixed case ok
    expect(isValidTpduOverride("60000000")).toBe(false);    // 8 chars — too short
    expect(isValidTpduOverride("60000000000")).toBe(false); // 11 chars — too long
    expect(isValidTpduOverride("6000ZZ0000")).toBe(false);  // non-hex char
  });

  it("TPDU value field is hidden by default and appears only when includeTpdu is on", () => {
    // The Toggle is a custom span-based widget without a real <input>, so
    // we can't reach it via getByLabelText / userEvent — drive state through
    // the store, same pattern used by the framing-border tests above.
    const { unmount } = renderApp(<SimulatorPage />);
    expect(screen.queryByTestId("injector-tpdu-field")).not.toBeInTheDocument();
    unmount();

    useInjectorStore.setState({ ...INJECTOR_DEFAULTS, includeTpdu: true });
    renderApp(<SimulatorPage />);
    expect(screen.getByTestId("injector-tpdu-field")).toBeInTheDocument();
  });

  it("forwards literal tpduOverride to injectDirect when set", async () => {
    const user = userEvent.setup();
    const mock = injectDirect as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({ success: true, processingMs: 5 });

    useInjectorStore.setState({
      ...INJECTOR_DEFAULTS,
      includeTpdu: true,
      tpduOverride: "6000000000",
    });

    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C24");
    await user.click(screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i }));

    expect(mock).toHaveBeenCalledTimes(1);
    const arg = mock.mock.calls[0][0];
    expect(arg.includeTpdu).toBe(true);
    expect(arg.tpduOverride).toBe("6000000000");
  });

  it("maps empty tpduOverride to null (AUTO from Workspace NIIs)", async () => {
    const user = userEvent.setup();
    const mock = injectDirect as unknown as ReturnType<typeof vi.fn>;
    mock.mockReset();
    mock.mockResolvedValueOnce({ success: true, processingMs: 5 });

    // includeTpdu ON but no literal — backend should get null and fall back
    // to the Workspace-NII auto-generation path.
    useInjectorStore.setState({
      ...INJECTOR_DEFAULTS,
      includeTpdu: true,
      tpduOverride: null,
    });

    renderApp(<SimulatorPage />);

    const textarea = screen.getByPlaceholderText("0200F23C...") as HTMLTextAreaElement;
    await user.type(textarea, "0200F23C24");
    await user.click(screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i }));

    expect(mock).toHaveBeenCalledTimes(1);
    const arg = mock.mock.calls[0][0];
    expect(arg.includeTpdu).toBe(true);
    expect(arg.tpduOverride).toBeNull();
  });

  it("disables Inject button when TPDU literal is invalid", async () => {
    // Pre-seed an invalid literal (8 chars instead of 10) and a non-empty
    // message so the message-empty path can't account for the disabled state.
    useInjectorStore.setState({
      ...INJECTOR_DEFAULTS,
      includeTpdu: true,
      tpduOverride: "60000000",
      message: "0200F23C24",
    });

    renderApp(<SimulatorPage />);

    const injectBtn = screen.getByRole("button", { name: /^(Injetar|Inject)\s*→/i });
    expect(injectBtn).toBeDisabled();
  });
});

describe("Simulator page — Agent not configured (Sprint 12.2 P5+)", () => {
  it("shows the 'not configured' empty state when agentUrl is null", () => {
    // Clear the URL so the Simulator page short-circuits with the panel
    // that points the user at the Workspace.
    useAgentConnectionStore.setState({
      agentUrl: null,
      status: "idle",
      errorMessage: null,
    });

    renderApp(<SimulatorPage />);

    expect(screen.getByTestId("simulator-agent-not-configured")).toBeInTheDocument();
    // The three regular sections must NOT render — no API calls should
    // fire while the Agent URL is unconfigured.
    expect(screen.queryByText(/^Rebatedores$|^Listeners$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Injetor$|^Injector$/i)).not.toBeInTheDocument();
  });

  it("hides the empty state once an agentUrl is configured", () => {
    useAgentConnectionStore.setState({
      agentUrl: "http://localhost:8583",
      status: "connected",
      errorMessage: null,
    });

    renderApp(<SimulatorPage />);

    expect(screen.queryByTestId("simulator-agent-not-configured")).not.toBeInTheDocument();
    // The three normal sections are back.
    expect(screen.getByText(/^Rebatedores$|^Listeners$/i)).toBeInTheDocument();
  });
});

describe("Simulator page — connectivity gate (Sprint 12.4 P3)", () => {
  it("shows 'not reachable' when URL is saved but the Agent health probe fails", async () => {
    // Simulate a stale-URL scenario: previous session persisted an Agent
    // URL, but the process is gone now. The gate MUST NOT render the form
    // + a banner on top; it must render the empty state alone.
    useAgentConnectionStore.setState({
      agentUrl: "http://localhost:8583",
      status: "connected", // deliberately stale — the gate must overwrite this
      errorMessage: null,
    });
    (probeAgentHealth as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Não foi possível alcançar o Agent. Verifique se ele foi iniciado e está acessível na rede."),
    );

    renderApp(<SimulatorPage />);

    // Wait for the gate query to settle.
    const panel = await screen.findByTestId("simulator-agent-not-configured");
    expect(panel).toHaveAttribute("data-reason", "unreachable");
    // The three sections must not render alongside the empty state.
    expect(screen.queryByText(/^Rebatedores$|^Listeners$/i)).not.toBeInTheDocument();
    // The attempted URL is surfaced so the user can spot a wrong host.
    expect(screen.getByTestId("simulator-agent-attempted-url"))
      .toHaveTextContent("http://localhost:8583");
    // The error message goes verbatim (via the shared interceptor).
    expect(screen.getByTestId("simulator-agent-error-message"))
      .toHaveTextContent(/N[aã]o foi poss[ií]vel alcan[çc]ar/);
  });

  it("proxies the probe outcome into the agentConnection store (status=error)", async () => {
    useAgentConnectionStore.setState({
      agentUrl: "http://localhost:8583",
      status: "connected",
      errorMessage: null,
    });
    (probeAgentHealth as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Não foi possível alcançar o Agent. Verifique se ele foi iniciado e está acessível na rede."),
    );

    renderApp(<SimulatorPage />);
    await screen.findByTestId("simulator-agent-not-configured");

    // Sidebar indicator relies on this — the mirror must fire on failure.
    expect(useAgentConnectionStore.getState().status).toBe("error");
    expect(useAgentConnectionStore.getState().errorMessage).toMatch(/alcan[çc]ar/);
  });
});
