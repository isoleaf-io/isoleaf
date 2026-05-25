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
