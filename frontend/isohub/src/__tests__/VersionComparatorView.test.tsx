import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";

vi.mock("@/api/iso20022Compare", () => ({
  compareIso20022Versions: vi.fn().mockResolvedValue({
    fromVersion: "pacs.008.001.09",
    toVersion: "pacs.008.001.13",
    family: "pacs",
    addedCount: 1,
    removedCount: 0,
    changedCount: 1,
    added: [{
      name: "NewField",
      xpath: "FIToFICstmrCdtTrf/CdtTrfTxInf/NewField",
      typeName: "Max35Text",
      cardinality: "[0..1]",
      isMandatory: false,
    }],
    removed: [],
    changed: [{
      name: "MsgId",
      xpath: "FIToFICstmrCdtTrf/GrpHdr/MsgId",
      changes: [{ propertyName: "MaxLength", oldValue: "35", newValue: "70" }],
    }],
  }),
}));

import { VersionComparatorView } from "@/components/Iso20022/VersionComparatorView";

const MESSAGE_TYPES = ["pacs.008.001.09", "pacs.008.001.13", "camt.053.001.09"];

describe("VersionComparatorView", () => {
  it("renders the family/type/version controls", () => {
    renderApp(<VersionComparatorView messageTypes={MESSAGE_TYPES} />);
    expect(screen.getByTestId("comparator-controls")).toBeInTheDocument();
    expect(screen.getByTestId("comparator-family")).toBeInTheDocument();
    expect(screen.getByTestId("comparator-id")).toBeInTheDocument();
    expect(screen.getByTestId("comparator-from")).toBeInTheDocument();
    expect(screen.getByTestId("comparator-to")).toBeInTheDocument();
  });

  it("clicking Compare renders Added + Changed sections from the mocked response", async () => {
    const user = userEvent.setup();
    renderApp(<VersionComparatorView messageTypes={MESSAGE_TYPES} />);

    await user.click(screen.getByTestId("comparator-run"));

    expect(await screen.findByTestId("comparator-result")).toBeInTheDocument();
    expect(screen.getByTestId("comparator-section-added")).toBeInTheDocument();
    expect(screen.getByTestId("comparator-section-changed")).toBeInTheDocument();
    expect(screen.queryByTestId("comparator-section-removed")).not.toBeInTheDocument();
  });

  it("locks the from-side controls when lockedFromVersion is provided", () => {
    renderApp(
      <VersionComparatorView
        messageTypes={MESSAGE_TYPES}
        lockedFromVersion="pacs.008.001.09"
      />,
    );
    expect((screen.getByTestId("comparator-family") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId("comparator-id") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId("comparator-from") as HTMLSelectElement).disabled).toBe(true);
    // To-side stays enabled.
    expect((screen.getByTestId("comparator-to") as HTMLSelectElement).disabled).toBe(false);
  });
});
