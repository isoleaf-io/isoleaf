import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderApp } from "@/test/renderApp";

// vi.mock hoists above the file's top-level statements, so the sample tree
// has to be hoisted alongside the mock factory or it'll be undefined at the
// point the factory runs.
const { SAMPLE_TREE } = vi.hoisted(() => ({
  SAMPLE_TREE: {
    messageType: "pacs.008.001.09",
    totalFields: 2,
    fields: [
      {
        name: "FIToFICstmrCdtTrf",
        xpath: "FIToFICstmrCdtTrf",
        depth: 0,
        typeName: "complex",
        isComplex: true,
        cardinality: "[1..1]",
        isMandatory: true,
        minLength: null,
        maxLength: null,
        pattern: null,
        enumerations: [],
        documentation: null,
        children: [
          {
            name: "GrpHdr",
            xpath: "FIToFICstmrCdtTrf/GrpHdr",
            depth: 1,
            typeName: "complex",
            isComplex: true,
            cardinality: "[1..1]",
            isMandatory: true,
            minLength: null,
            maxLength: null,
            pattern: null,
            enumerations: [],
            documentation: null,
            children: [
              {
                name: "MsgId",
                xpath: "FIToFICstmrCdtTrf/GrpHdr/MsgId",
                depth: 2,
                typeName: "Max35Text",
                isComplex: false,
                cardinality: "[1..1]",
                isMandatory: true,
                minLength: 1,
                maxLength: 35,
                pattern: null,
                enumerations: [],
                documentation: "Unique identifier for the message.",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
}));

vi.mock("@/api/iso20022Reference", () => ({
  listMessageTypes: vi.fn().mockResolvedValue({ messageTypes: ["pacs.008.001.09"] }),
  getMessageReference: vi.fn().mockResolvedValue(SAMPLE_TREE),
  searchFields: vi.fn(),
  getFieldDetail: vi.fn().mockResolvedValue({
    fieldName: "MsgId",
    isConsistent: true,
    occurrences: [],
    differences: [],
  }),
  getFieldExample: vi.fn().mockResolvedValue({
    messageType: "pacs.008.001.09",
    xmlNamespace: "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09",
    xpath: "FIToFICstmrCdtTrf/GrpHdr/MsgId",
    xmlExample: "<Document/>",
  }),
}));
vi.mock("@/api/workspace", () => ({
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));
vi.mock("@/hooks/useSimulatorHub", () => ({ useSimulatorHub: () => {} }));

import Iso20022ReferencePage from "@/pages/Iso20022Reference";

describe("Iso20022ReferencePage", () => {
  it("renders the page title", () => {
    renderApp(<Iso20022ReferencePage />);
    expect(
      screen.getByText(/ISO 20022 Field Reference|Referência de Campos ISO 20022/i),
    ).toBeInTheDocument();
  });

  it("shows both browse and search tabs", () => {
    renderApp(<Iso20022ReferencePage />);
    expect(screen.getByTestId("tab-browse")).toBeInTheDocument();
    expect(screen.getByTestId("tab-search")).toBeInTheDocument();
  });

  it("Search button is disabled until the user types 2+ characters", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderApp(<Iso20022ReferencePage />);

    await user.click(screen.getByTestId("tab-search"));

    const btn = screen.getByTestId("iso20022-reference-search-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    const input = screen.getByTestId("iso20022-reference-search-input");
    await user.type(input, "M");
    expect(btn.disabled).toBe(true);
    await user.type(input, "s");
    expect(btn.disabled).toBe(false);
  });

  it("clicking a field in the tree opens the FieldDetailPanel", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderApp(<Iso20022ReferencePage />);

    // Wait for the mocked tree to render before clicking the leaf.
    const msgId = await waitFor(() => screen.getAllByText("MsgId")[0]);
    await user.click(msgId);

    expect(screen.getByTestId("iso20022-field-detail-panel")).toBeInTheDocument();
    // Three tabs (Padrão ISO / Exemplo XML / Usado em) are mounted.
    expect(screen.getByTestId("field-detail-tab-iso")).toBeInTheDocument();
    expect(screen.getByTestId("field-detail-tab-xml")).toBeInTheDocument();
    expect(screen.getByTestId("field-detail-tab-usedIn")).toBeInTheDocument();
  });

  it("close button (✕) removes the FieldDetailPanel", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderApp(<Iso20022ReferencePage />);

    const msgId = await waitFor(() => screen.getAllByText("MsgId")[0]);
    await user.click(msgId);
    expect(screen.getByTestId("iso20022-field-detail-panel")).toBeInTheDocument();

    await user.click(screen.getByTestId("iso20022-field-detail-close"));
    expect(screen.queryByTestId("iso20022-field-detail-panel")).not.toBeInTheDocument();
  });
});
