import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/renderApp";

// Mock the api client so the page doesn't fire real HTTP at module load.
vi.mock("@/api/iso20022", () => ({
  parseIso20022: vi.fn(),
}));
vi.mock("@/api/workspace", () => ({
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));
vi.mock("@/hooks/useSimulatorHub", () => ({ useSimulatorHub: () => {} }));

import Iso20022ParserPage from "@/pages/Iso20022Parser";

describe("Iso20022ParserPage", () => {
  it("renders the page title", () => {
    renderApp(<Iso20022ParserPage />);
    // AppShell's PageHeader renders the title as a span (not a real heading),
    // so we look it up by text instead of by role.
    expect(
      screen.getByText(/ISO 20022 Parser|Parser ISO 20022/i),
    ).toBeInTheDocument();
  });

  it("Parse button is disabled when textarea is empty", () => {
    renderApp(<Iso20022ParserPage />);
    const btn = screen.getByTestId("iso20022-parse-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
