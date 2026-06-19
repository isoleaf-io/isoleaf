import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/renderApp";
import { MessageSummaryCard } from "@/components/Iso20022/MessageSummaryCard";
import type { MessageSummary } from "@/api/iso20022";

const partialSummary: MessageSummary = {
  operation: "FI-to-FI Customer Credit Transfer",
  confidence: "partial",
  fields: [
    { label: "Valor", value: "1500.00", found: true },
    { label: "Moeda", value: "BRL", found: true },
    { label: "IBAN/conta credor", value: null, found: false },
  ],
};

const unknownSummary: MessageSummary = {
  operation: "ISO 20022 Message",
  confidence: "unknown",
  fields: [],
};

describe("MessageSummaryCard", () => {
  it("shows the unknown-extractor hint when confidence is unknown", () => {
    renderApp(
      <MessageSummaryCard messageType="acmt.001.001.01" summary={unknownSummary} />,
    );
    // Hint text comes from i18n; jsdom falls back to EN.
    expect(
      screen.getByText(/no semantic extractor is implemented yet|sem extrator semântico implementado/i),
    ).toBeInTheDocument();
  });

  it("renders 'not found' for fields with found: false", () => {
    renderApp(
      <MessageSummaryCard messageType="pacs.008.001.09" summary={partialSummary} />,
    );
    // Found fields show their values; the missing one shows the placeholder.
    expect(screen.getByText("1500.00")).toBeInTheDocument();
    const missing = screen.getByTestId("iso20022-summary-field-missing");
    expect(missing.textContent).toMatch(/not found|não encontrado/i);
  });
});
