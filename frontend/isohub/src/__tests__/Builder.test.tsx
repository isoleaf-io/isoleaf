import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { useBuilderStore } from "@/store/builder";

vi.mock("@/api/build", () => ({
  smartBuild: vi.fn(),
  buildMessage: vi.fn().mockResolvedValue({ success: true, message: "0200…", binaryHexMessage: "30…", bitmap: "F23C", activeBits: [] }),
  getProfiles: vi.fn(),
  getRules: vi.fn(),
}));
vi.mock("@/api/workspace", () => ({
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
  saveTemplate: vi.fn(),
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import BuilderPage from "@/pages/Builder";
import { smartBuild } from "@/api/build";

function resetStore() {
  // Reset persisted store between tests
  useBuilderStore.setState({
    context: {
      mti: "0200", role: "Adquirente", brand: "Visa", channel: "Chip",
      txType: "Credito", approvalMode: "Online", installments: 1,
      includeTpdu: false, tpduOverride: null,
    },
    fields: [],
    built: null,
    contextChanged: false,
  });
}

const sampleResult = {
  success: true,
  message: "0200ABCDEF",
  binaryHexMessage: "30323030",
  bitmap: "F23C",
  activeBits: [2, 3, 4, 11, 35, 55],
  appliedRules: ["Chip→Bit55Added"],
  profileUsed: "Visa",
  fields: [
    { bitNumber: 2, name: "PAN", value: "4111111111111111", maskedValue: "411111******1111", origin: "generated" as const },
    { bitNumber: 3, name: "Processing Code", value: "000000", maskedValue: "000000", origin: "generated" as const },
    { bitNumber: 35, name: "Track 2", value: "4111111111111111=29122011234", maskedValue: "411111****1111", origin: "generated" as const },
    { bitNumber: 55, name: "EMV Data", value: "9F2608AABBCC", maskedValue: "9F2608AABBCC", origin: "generated" as const },
  ],
};

describe("Builder page", () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(smartBuild).mockReset();
  });

  it("renders empty state when no message has been built", () => {
    renderApp(<BuilderPage />);
    expect(screen.getByText(/Selecione o contexto e clique/i)).toBeInTheDocument();
  });

  it("TPDU toggle is rendered and reveals the NIIs override input when on", async () => {
    renderApp(<BuilderPage />);

    // Toggle label is always present.
    expect(screen.getByText(/Incluir TPDU|Include TPDU/i)).toBeInTheDocument();
    // NIIs override input is hidden until the toggle flips.
    expect(screen.queryByPlaceholderText(/AUTO \((usa|uses) Workspace\)/i)).not.toBeInTheDocument();

    // Drive the store directly — the Toggle component is non-trivial to click in
    // jsdom (clicks an inner <span> by design), but the UI logic only depends on
    // the boolean reaching the store.
    useBuilderStore.getState().setContext({ includeTpdu: true });

    expect(useBuilderStore.getState().context.includeTpdu).toBe(true);
    expect(await screen.findByPlaceholderText(/AUTO \((usa|uses) Workspace\)/i)).toBeInTheDocument();
  });

  it("MTI free-text combobox accepts custom 4-digit MTIs", async () => {
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    // The MTI <input list> is the only one with placeholder "0200".
    const mtiInput = screen.getByPlaceholderText("0200") as HTMLInputElement;
    await user.clear(mtiInput);
    await user.type(mtiInput, "0599");
    expect(useBuilderStore.getState().context.mti).toBe("0599");
    // Custom hint surfaces for unknown MTI values.
    expect(screen.getByText(/(MTI personalizado|Custom MTI): 0599/i)).toBeInTheDocument();
  });

  it("loadFromParser populates fields and resets built state", () => {
    const fields = [
      { bitNumber: 2, name: "PAN", value: "4111111111111111", displayValue: "4111111111111111",
        origin: "manual" as const, status: "ok" as const, fieldType: "LLVAR", length: 16,
        locked: true, dependsOn: [], dependents: [] },
      { bitNumber: 3, name: "Processing Code", value: "002000", displayValue: "002000",
        origin: "manual" as const, status: "ok" as const, fieldType: "Fixed", length: 6,
        locked: true, dependsOn: [], dependents: [] },
    ];
    useBuilderStore.setState({ built: { ascii: "x", binaryHex: "x", bitmap: "x", activeBits: [], appliedRules: [], profileUsed: "Visa", tpdu: null } });
    useBuilderStore.getState().loadFromParser(fields, "0210");

    const state = useBuilderStore.getState();
    expect(state.context.mti).toBe("0210");
    expect(state.fields).toHaveLength(2);
    expect(state.built).toBeNull();
    expect(state.fields[0].locked).toBe(true);
  });

  it("after Build success the fields table appears and Mastercard labels render as 'DE n'", async () => {
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    useBuilderStore.setState({
      context: { ...useBuilderStore.getState().context, brand: "Mastercard" },
    });

    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));

    await waitFor(() => expect(smartBuild).toHaveBeenCalled());
    expect(await screen.findByText("PAN")).toBeInTheDocument();
    expect(screen.getByText("DE 2")).toBeInTheDocument();
    expect(screen.getByText("DE 3")).toBeInTheDocument();
  });

  it("Visa brand renders 'Field n' labels", async () => {
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText("PAN");
    expect(screen.getByText("Field 2")).toBeInTheDocument();
  });

  it("Novo cartão marks card-related fields stale", async () => {
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText("PAN");

    await user.click(screen.getByRole("button", { name: /Novo cartão|New card/i }));

    const state = useBuilderStore.getState();
    const bit2 = state.fields.find((f) => f.bitNumber === 2)!;
    const bit35 = state.fields.find((f) => f.bitNumber === 35)!;
    expect(bit2.status).toBe("stale");
    expect(bit35.status).toBe("stale");
  });

  it("Limpar resets all fields", async () => {
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText("PAN");

    // i18n falls back to English in tests; "Clear" matches the common.clear key.
    await user.click(screen.getByRole("button", { name: /^(Limpar|Clear)$/i }));
    expect(useBuilderStore.getState().fields).toHaveLength(0);
    expect(useBuilderStore.getState().built).toBeNull();
  });

  it("MessagePreview shows ASCII wire after build", async () => {
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText(/Mensagem gerada|Generated message/i);
    expect(screen.getByText("0200ABCDEF")).toBeInTheDocument();
  });

  it("MessagePreview shows length value after build", async () => {
    // Sample wire "0200ABCDEF" is 10 chars → 0x000A.
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText(/Mensagem gerada|Generated message/i);
    // Length badge reads "Length: 0x000A (10 chars)".
    expect(screen.getByText(/Length:\s*0x000A\s*\(10 chars\)/i)).toBeInTheDocument();
  });

  it("MessagePreview prepends length prefix when toggle is enabled", async () => {
    try { window.localStorage.removeItem("isoleaf-builder-include-length"); } catch { /* ignore */ }
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText(/Mensagem gerada|Generated message/i);

    // The toggle is "Include length prefix" — one per visible tab (ASCII, Binary).
    // Just the first one is enough to flip the persisted flag.
    const toggles = screen.getAllByRole("checkbox", { name: /length prefix/i });
    expect(toggles.length).toBeGreaterThan(0);
    await user.click(toggles[0]);

    // Visual `[XXXX]` prefix appears in the rendered wire pre block.
    expect(screen.getAllByTestId("length-prefix-visual").length).toBeGreaterThan(0);
    expect(screen.getByText(/\[000A\]/)).toBeInTheDocument();
  });

  it("Criar reversão button appears after a 0200 build", async () => {
    vi.mocked(smartBuild).mockResolvedValue(sampleResult);
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    expect(await screen.findByRole("button", { name: /Criar reversão|Create reversal/i })).toBeInTheDocument();
  });

  it("Criar reversão button is hidden when MTI is 0400 (already a reversal)", async () => {
    vi.mocked(smartBuild).mockResolvedValue({ ...sampleResult, message: "0400ABCDEF" });
    useBuilderStore.setState({ context: { ...useBuilderStore.getState().context, mti: "0400" } });
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText(/Mensagem gerada|Generated message/i);
    expect(screen.queryByRole("button", { name: /Criar reversão|Create reversal/i })).not.toBeInTheDocument();
  });

  it("Criar reversão button is hidden for MTI 0800", async () => {
    vi.mocked(smartBuild).mockResolvedValue({ ...sampleResult, message: "0800ABCDEF" });
    useBuilderStore.setState({ context: { ...useBuilderStore.getState().context, mti: "0800" } });
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await screen.findByText(/Mensagem gerada|Generated message/i);
    expect(screen.queryByRole("button", { name: /Criar reversão|Create reversal/i })).not.toBeInTheDocument();
  });

  it("clicking Criar reversão loads 0400 with bit 90 populated", async () => {
    vi.mocked(smartBuild).mockResolvedValue({
      ...sampleResult,
      fields: [
        { bitNumber: 2, name: "PAN", value: "4111111111111111", maskedValue: "411111******1111", origin: "generated" as const },
        { bitNumber: 7, name: "Datetime", value: "0516120000", maskedValue: "0516120000", origin: "generated" as const },
        { bitNumber: 11, name: "STAN", value: "000123", maskedValue: "000123", origin: "generated" as const },
        { bitNumber: 37, name: "RRN", value: "ABCDEFGHIJKL", maskedValue: "ABCDEFGHIJKL", origin: "generated" as const },
      ],
    });
    const user = userEvent.setup();
    renderApp(<BuilderPage />);
    await user.click(screen.getByRole("button", { name: /^(Gerar|Build) →$/i }));
    await user.click(await screen.findByRole("button", { name: /Criar reversão|Create reversal/i }));

    const state = useBuilderStore.getState();
    expect(state.context.mti).toBe("0400");
    const bit90 = state.fields.find((f) => f.bitNumber === 90);
    expect(bit90).toBeDefined();
    // Format: MTI(4) + STAN(6) + datetime(10) + RRN(12) = 32 chars, padded to 42.
    expect(bit90!.value.startsWith("0200000123" + "0516120000" + "ABCDEFGHIJKL")).toBe(true);
    expect(bit90!.value.length).toBe(42);
  });
});

describe("Builder store — pure state transitions", () => {
  beforeEach(resetStore);

  it("editing a parent bit marks dependents stale", () => {
    const initial = [
      { bitNumber: 2, name: "PAN", value: "4111", displayValue: "4111", origin: "generated" as const, status: "ok" as const, fieldType: "", length: 4, locked: false, dependsOn: [], dependents: [] },
      { bitNumber: 35, name: "Track 2", value: "4111=29122011", displayValue: "***", origin: "generated" as const, status: "ok" as const, fieldType: "", length: 13, locked: false, dependsOn: [2, 14], dependents: [] },
      { bitNumber: 52, name: "PIN", value: "ABCDEF12", displayValue: "***", origin: "generated" as const, status: "ok" as const, fieldType: "", length: 8, locked: false, dependsOn: [2], dependents: [] },
    ];
    useBuilderStore.setState({ fields: initial });
    useBuilderStore.getState().updateField(2, "5555");
    const fields = useBuilderStore.getState().fields;
    expect(fields.find((f) => f.bitNumber === 2)!.locked).toBe(true);
    expect(fields.find((f) => f.bitNumber === 35)!.status).toBe("stale");
    expect(fields.find((f) => f.bitNumber === 52)!.status).toBe("stale");
  });

  it("keepField removes the stale flag without changing the value", () => {
    useBuilderStore.setState({
      fields: [
        { bitNumber: 35, name: "Track 2", value: "x", displayValue: "x", origin: "generated", status: "stale", fieldType: "", length: 1, locked: false, dependsOn: [], dependents: [] },
      ],
    });
    useBuilderStore.getState().keepField(35);
    expect(useBuilderStore.getState().fields[0].status).toBe("ok");
    expect(useBuilderStore.getState().fields[0].value).toBe("x");
  });

  it("setContext flips contextChanged only when there is a built message", () => {
    useBuilderStore.getState().setContext({ brand: "Elo" });
    expect(useBuilderStore.getState().contextChanged).toBe(false);

    useBuilderStore.setState({ built: { ascii: "x", binaryHex: "x", bitmap: "x", activeBits: [], appliedRules: [], profileUsed: "Visa", tpdu: null } });
    useBuilderStore.getState().setContext({ brand: "Mastercard" });
    expect(useBuilderStore.getState().contextChanged).toBe(true);
  });
});
