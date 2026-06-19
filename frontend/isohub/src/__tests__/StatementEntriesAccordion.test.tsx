import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { StatementEntriesAccordion } from "@/components/Iso20022/StatementEntriesAccordion";
import type { StatementEntry } from "@/api/iso20022";

const credit: StatementEntry = {
  amount: "250.00",
  currency: "BRL",
  creditDebitIndicator: "CRDT",
  bookingDate: "2024-01-10",
  valueDate: "2024-01-10",
  status: "BOOK",
  endToEndId: "E2E-A-001",
  remittanceInfo: "Salary payment",
};
const debit: StatementEntry = {
  amount: "75.50",
  currency: "BRL",
  creditDebitIndicator: "DBIT",
  bookingDate: "2024-01-12",
  valueDate: null,
  status: "BOOK",
  endToEndId: "E2E-B-002",
  remittanceInfo: "Card purchase",
};

describe("StatementEntriesAccordion", () => {
  it("starts collapsed: shows count, hides the table", () => {
    renderApp(<StatementEntriesAccordion entries={[credit, debit]} />);
    // The trigger shows "2 lançamentos"/"2 entries" (i18n).
    expect(screen.getByTestId("iso20022-entries-toggle").textContent).toMatch(
      /2 entries|2 lançamentos/i,
    );
    // Table is not in the DOM until the user opens the accordion.
    expect(screen.queryByTestId("iso20022-entries-table")).not.toBeInTheDocument();
  });

  it("expands on click: table appears with one row per entry", async () => {
    const user = userEvent.setup();
    renderApp(<StatementEntriesAccordion entries={[credit, debit]} />);

    await user.click(screen.getByTestId("iso20022-entries-toggle"));

    expect(screen.getByTestId("iso20022-entries-table")).toBeInTheDocument();
    expect(screen.getByTestId("iso20022-entry-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("iso20022-entry-row-1")).toBeInTheDocument();
  });

  it("credit entry amount uses the success colour", async () => {
    const user = userEvent.setup();
    renderApp(<StatementEntriesAccordion entries={[credit]} />);
    await user.click(screen.getByTestId("iso20022-entries-toggle"));

    const cell = screen.getByTestId("iso20022-entry-amount-0");
    // Class names are kept stable so the colour is testable without snapshotting
    // a computed style (which jsdom doesn't compute anyway).
    expect(cell.className).toContain("text-success-text");
    expect(cell.textContent).toContain("+250.00");
  });

  it("debit entry amount uses the danger colour", async () => {
    const user = userEvent.setup();
    renderApp(<StatementEntriesAccordion entries={[debit]} />);
    await user.click(screen.getByTestId("iso20022-entries-toggle"));

    const cell = screen.getByTestId("iso20022-entry-amount-0");
    expect(cell.className).toContain("text-danger-text");
    expect(cell.textContent).toContain("-75.50");
  });
});
