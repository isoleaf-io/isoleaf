import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";

// Mock the parse + workspace API modules before importing the page.
vi.mock("@/api/parse", () => ({
  parseHex: vi.fn(),
  parseBitmap: vi.fn(),
  getLayouts: vi.fn().mockResolvedValue([]),
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

import ParserPage from "@/pages/Parser";
import { parseHex } from "@/api/parse";

const SAMPLE = "020072300000000000001634567890123456780600000000000001000605123000000006123000";

describe("Parser page", () => {
  beforeEach(() => {
    vi.mocked(parseHex).mockReset();
  });

  it("renders without crashing and shows the empty state", () => {
    renderApp(<ParserPage />);
    expect(screen.getByText(/no message parsed/i)).toBeInTheDocument();
  });

  it("Parse button is disabled when input is empty", () => {
    renderApp(<ParserPage />);
    const parseBtn = screen.getByRole("button", { name: /parse/i });
    expect(parseBtn).toBeDisabled();
  });

  it("after parsing a valid message, fields table appears with PAN masked", async () => {
    vi.mocked(parseHex).mockResolvedValue({
      success: true,
      mti: "0200",
      activeBits: [2, 3, 4, 11, 12, 13],
      hasSecondaryBitmap: false,
      fields: [
        { bitNumber: 2, name: "PAN", value: "4111111111111111", displayValue: "411111******1111", type: "LLVAR", length: 16 },
        { bitNumber: 3, name: "Processing Code", value: "000000", displayValue: "000000", type: "Fixed", length: 6 },
      ],
    });

    const user = userEvent.setup();
    renderApp(<ParserPage />);

    const textarea = screen.getByPlaceholderText(/Paste your ISO 8583/i);
    await user.type(textarea, SAMPLE);
    await user.click(screen.getByRole("button", { name: /^parse →$/i }));

    await waitFor(() => expect(parseHex).toHaveBeenCalled());
    // The MTI badge renders "0200"; the friendly name "Financial Request" is rendered alongside.
    expect(await screen.findByText(/Financial Request/i)).toBeInTheDocument();
    // PAN value comes through masked initially.
    expect(await screen.findByText("411111******1111")).toBeInTheDocument();
  });

  it("shows partial fields + error callout when parse fails midway", async () => {
    // Mock a failure response from the API: parse_error with hint + 2 partial fields.
    vi.mocked(parseHex).mockResolvedValue({
      success: false,
      error: "[Bit 36 @ pos 110] LLLVAR declared length 353 exceeds MaxLength 104",
      parseError: {
        field: "Bit 36",
        position: 110,
        message: "LLLVAR declared length 353 exceeds MaxLength 104",
        hint: "The error surfaced while reading Bit 36...",
      },
      partialFields: [
        { bitNumber: 2, name: "PAN", value: "4111111111111111", displayValue: "411111******1111", type: "LLVAR", length: 16 },
        { bitNumber: 3, name: "Processing Code", value: "000000", displayValue: "000000", type: "Fixed", length: 6 },
      ],
    });

    const user = userEvent.setup();
    renderApp(<ParserPage />);
    const textarea = screen.getByPlaceholderText(/Paste your ISO 8583/i);
    await user.type(textarea, SAMPLE);
    await user.click(screen.getByRole("button", { name: /^parse →$/i }));

    // The structured error message is surfaced (the message text itself).
    expect(await screen.findByText(/LLLVAR declared length 353/i)).toBeInTheDocument();
    // Partial badge + count line are visible.
    expect(await screen.findByText(/Partial/i)).toBeInTheDocument();
    expect(await screen.findByText(/2 fields parsed before the error/i)).toBeInTheDocument();
    // Partial fields render in the table — PAN comes through masked.
    expect(await screen.findByText("411111******1111")).toBeInTheDocument();
  });

  it("shows ASCII-equivalent collapsible when binary-hex parse fails", async () => {
    vi.mocked(parseHex).mockResolvedValue({
      success: false,
      error: "[Bit 36 @ pos 110] ...",
      parseError: { field: "Bit 36", position: 110, message: "boom", hint: null },
      partialFields: [],
    });

    const user = userEvent.setup();
    renderApp(<ParserPage />);
    const textarea = screen.getByPlaceholderText(/Paste your ISO 8583/i);
    // A binary-hex looking input (all hex chars, even length) triggers the
    // ASCII equivalent block.
    await user.type(textarea, "30323030F23C2481");
    await user.click(screen.getByRole("button", { name: /^parse →$/i }));

    // The toggle button is rendered (collapsed by default).
    const asciiToggle = await screen.findByRole("button", { name: /ASCII-equivalent wire/i });
    expect(asciiToggle).toBeInTheDocument();

    // After expanding, the decoded ASCII content appears. Hex pairs above
    // decode to "0200", a non-printable byte (0xF2 → "."), then "<$".
    await user.click(asciiToggle);
    expect(await screen.findByText(/0200/)).toBeInTheDocument();
  });

  it("clear button resets the input and result", async () => {
    vi.mocked(parseHex).mockResolvedValue({
      success: true,
      mti: "0200",
      activeBits: [2],
      hasSecondaryBitmap: false,
      fields: [
        { bitNumber: 2, name: "PAN", value: "4111111111111111", displayValue: "411111******1111", type: "LLVAR", length: 16 },
      ],
    });
    const user = userEvent.setup();
    renderApp(<ParserPage />);
    const textarea = screen.getByPlaceholderText(/Paste your ISO 8583/i) as HTMLTextAreaElement;
    await user.type(textarea, SAMPLE);
    expect(textarea.value).toBe(SAMPLE);

    const clearBtn = screen.getByRole("button", { name: /clear/i });
    await user.click(clearBtn);
    expect(textarea.value).toBe("");
  });
});
