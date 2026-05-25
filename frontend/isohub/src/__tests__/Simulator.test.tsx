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
import { listSessions, injectDirect, getLog } from "@/api/simulator";

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
    try {
      window.localStorage.removeItem("isohub-injector");
      window.localStorage.removeItem("simulator-logExpanded");
    } catch { /* ignore */ }
  });

  it("renders the three sections (Rebatedores, Injector, Live log)", () => {
    renderApp(<SimulatorPage />);
    expect(screen.getByText(/^Rebatedores$/i)).toBeInTheDocument();
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
    try { window.localStorage.removeItem("isohub-injector"); } catch { /* ignore */ }
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
});
