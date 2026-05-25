import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { useEmvStore, mapBrandToProfile } from "@/store/emv";

vi.mock("@/api/emv", () => ({
  parseBit55: vi.fn(),
  validateArqc: vi.fn(),
  generateArqc: vi.fn(),
  generateArpc: vi.fn(),
  buildBit55Response: vi.fn(),
  fullFlow: vi.fn(),
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

import EmvPage from "@/pages/Emv";

describe("EMV page", () => {
  beforeEach(() => {
    // The store is persisted in localStorage and survives between tests —
    // reset to defaults so each test runs in isolation.
    useEmvStore.getState().clearAll();
    useEmvStore.setState({ activeTab: "parse" });
  });

  it("renders without crashing and Parse Bit 55 tab is active by default", () => {
    renderApp(<EmvPage />);
    // Default tab content is the parse-bit55 hexBit55 textarea
    expect(screen.getByPlaceholderText(/9F2608A1B2C3D4E5F60708/i)).toBeInTheDocument();
    // Parse tab trigger exists
    expect(screen.getByRole("tab", { name: /^Parse Bit 55$/i })).toBeInTheDocument();
  });

  it("clicking 'Validate ARQC' tab swaps the panel", async () => {
    const user = userEvent.setup();
    renderApp(<EmvPage />);
    await user.click(screen.getByRole("tab", { name: /^Validate ARQC$/i }));
    // Issuer Master Key input is unique to the validate panel
    expect(screen.getByText(/Issuer Master Key \(32 hex\)/i)).toBeInTheDocument();
  });

  it("clicking 'Full Flow' renders the 5 required input fields", async () => {
    const user = userEvent.setup();
    renderApp(<EmvPage />);
    await user.click(screen.getByRole("tab", { name: /^Full Flow$/i }));

    // hexBit55Request textarea (placeholder shared with parse — but the only one inside Full Flow tab content)
    expect(screen.getByText(/Bit 55 from request/i)).toBeInTheDocument();
    expect(screen.getByText(/^Issuer Master Key$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Auth Response Code$/i)).toBeInTheDocument();
    expect(screen.getByText(/^PAN$/i)).toBeInTheDocument();
    expect(screen.getByText(/^PAN Sequence Number$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Profile$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Full EMV Flow/i })).toBeInTheDocument();
  });

  it("can navigate between Generate ARQC and Generate ARPC tabs", async () => {
    const user = userEvent.setup();
    renderApp(<EmvPage />);
    await user.click(screen.getByRole("tab", { name: /^Generate ARQC$/i }));
    expect(screen.getByText(/Card Data/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^Generate ARPC$/i }));
    expect(screen.getByText(/ARQC \(16 hex chars\)/i)).toBeInTheDocument();
  });

  // ── Clear button + header field (parse parcial) ─────────────────────────

  it("Clear button present in Parse Bit 55 tab", () => {
    renderApp(<EmvPage />);
    // Parse tab is the default — should expose a Clear button next to the action button.
    const clearButtons = screen.getAllByRole("button", { name: /Limpar|Clear/i });
    expect(clearButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("Clear button present in Full Flow tab", async () => {
    const user = userEvent.setup();
    renderApp(<EmvPage />);
    await user.click(screen.getByRole("tab", { name: /^Full Flow$/i }));
    const clearButtons = screen.getAllByRole("button", { name: /Limpar|Clear/i });
    expect(clearButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking Clear in Parse tab resets the input and persisted result", async () => {
    const user = userEvent.setup();
    // Seed the store as if a previous parse left state behind.
    useEmvStore.setState({
      parseBit55Input: "9F08021234",
      parseBit55HeaderBytes: 2,
      parseBit55Result: {
        success: true,
        tags: [{ tag: "9F08", name: "X", length: 2, value: "1234" }],
        hasArqc: false,
        hasIssuerAuthData: false,
        isComplete: true,
        parsedBytes: 5,
        totalBytes: 5,
        warnings: [],
      },
    });

    renderApp(<EmvPage />);
    const clearButton = screen.getAllByRole("button", { name: /Limpar|Clear/i })[0];
    await user.click(clearButton);

    const s = useEmvStore.getState();
    expect(s.parseBit55Input).toBe("");
    expect(s.parseBit55HeaderBytes).toBe(0);
    expect(s.parseBit55Result).toBeNull();
  });

  it("header field renders in Parse Bit 55 tab", () => {
    renderApp(<EmvPage />);
    // Either the pt-BR or en label should appear above the header input.
    const hint = screen.getByText(/(Bytes a ignorar antes do TLV|Bytes to skip before the TLV)/i);
    expect(hint).toBeInTheDocument();
  });

  // ── loadFromParser flow ─────────────────────────────────────────────────

  it("loadFromParser with object populates pan + profile in validate and full-flow tabs", () => {
    useEmvStore.getState().loadFromParser({
      hexBit55: "9F08021234",
      pan: "4111111111111111",
      brand: "Visa",
    });

    const s = useEmvStore.getState();
    expect(s.parseBit55Input).toBe("9F08021234");
    expect(s.validateInput.hexBit55).toBe("9F08021234");
    expect(s.validateInput.pan).toBe("4111111111111111");
    expect(s.validateInput.profile).toBe("Visa");
    expect(s.fullFlowInput.hexBit55Request).toBe("9F08021234");
    expect(s.fullFlowInput.pan).toBe("4111111111111111");
    expect(s.fullFlowInput.profile).toBe("Visa");
    expect(s.generateArqcInput.pan).toBe("4111111111111111");
    expect(s.generateArpcInput.pan).toBe("4111111111111111");
    expect(s.generateArpcInput.profile).toBe("Visa");
    expect(s.loadedFromParser).toBe(true);
  });

  it("loadFromParser with string keeps backward compatibility", () => {
    useEmvStore.getState().loadFromParser("9F2608A1B2C3D4E5F60708");

    const s = useEmvStore.getState();
    expect(s.parseBit55Input).toBe("9F2608A1B2C3D4E5F60708");
    expect(s.validateInput.hexBit55).toBe("9F2608A1B2C3D4E5F60708");
    expect(s.loadedFromParser).toBe(false);
  });

  it("loadFromParser does not overwrite manually set IMK", () => {
    const customImk = "FFEEDDCCBBAA99887766554433221100";
    // User typed their own IMK before going to Parser.
    useEmvStore.getState().setValidateInput({ issuerMasterKey: customImk });
    useEmvStore.getState().setGenerateArqcInput({ issuerMasterKey: customImk });
    useEmvStore.getState().setGenerateArpcInput({ issuerMasterKey: customImk });

    useEmvStore.getState().loadFromParser({
      hexBit55: "9F08021234",
      pan: "4111111111111111",
      brand: "Visa",
    });

    const s = useEmvStore.getState();
    expect(s.validateInput.issuerMasterKey).toBe(customImk);
    expect(s.generateArqcInput.issuerMasterKey).toBe(customImk);
    expect(s.generateArpcInput.issuerMasterKey).toBe(customImk);
  });

  it("loadFromParser always overwrites pan when pan is provided", () => {
    // Pre-existing value (could have come from a previous loadFromParser or
    // from a user edit — either way, the new Parser load is the source of truth).
    useEmvStore.getState().setValidateInput({ pan: "5500005555555559" });

    useEmvStore.getState().loadFromParser({
      hexBit55: "9F08021234",
      pan: "4111111111111111",
      brand: "Visa",
    });

    expect(useEmvStore.getState().validateInput.pan).toBe("4111111111111111");
    expect(useEmvStore.getState().fullFlowInput.pan).toBe("4111111111111111");
    expect(useEmvStore.getState().generateArqcInput.pan).toBe("4111111111111111");
    expect(useEmvStore.getState().generateArpcInput.pan).toBe("4111111111111111");
  });

  it("loadFromParser keeps existing pan when pan is not provided", () => {
    useEmvStore.getState().setValidateInput({ pan: "5500005555555559" });

    useEmvStore.getState().loadFromParser({ hexBit55: "9F08021234" });

    // Parser did not send a PAN → previous value stays.
    expect(useEmvStore.getState().validateInput.pan).toBe("5500005555555559");
  });

  it("mapBrandToProfile maps correctly", () => {
    expect(mapBrandToProfile("Visa")).toBe("Visa");
    expect(mapBrandToProfile("Mastercard")).toBe("Mastercard");
    expect(mapBrandToProfile("Elo")).toBe("Elo");
    expect(mapBrandToProfile(undefined)).toBe("Visa");
    expect(mapBrandToProfile(null)).toBe("Visa");
    expect(mapBrandToProfile("MASTERCARD")).toBe("Mastercard");
    expect(mapBrandToProfile("Hipercard")).toBe("Visa"); // unknown → fallback
  });
});
