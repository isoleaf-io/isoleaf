import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";

// Sprint 9.5 — the SchemasSection reads and writes via the workspace
// API module. Full-module mock so both the list query and the upload
// mutation are drivable from the test.
vi.mock("@/api/workspace", () => ({
  listWorkspaceSchemas: vi.fn(),
  uploadWorkspaceSchema: vi.fn(),
}));

// Sprint 10.7 — schemaUploadEnabled gates the upload button. Every test
// starts with it true (standalone default); the "online mode" test flips
// it before rendering. Kept as a mutable holder so the mock factory can
// pick up the current value at call time.
const { appConfigState } = vi.hoisted(() => ({
  appConfigState: {
    mode: "standalone" as string,
    simulatorEnabled: true,
    emvCryptoEnabled: true,
    workspaceKeysEnabled: true,
    schemaUploadEnabled: true,
  },
}));
vi.mock("@/contexts/AppConfigContext", () => ({
  useAppConfig: () => appConfigState,
  AppConfigProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import {
  listWorkspaceSchemas,
  uploadWorkspaceSchema,
  type SchemaEntry,
  type SchemaUploadResponse,
} from "@/api/workspace";
import { SchemasSection } from "@/pages/Workspace/SchemasSection";

const mockedList = vi.mocked(listWorkspaceSchemas);
const mockedUpload = vi.mocked(uploadWorkspaceSchema);

const mkEntry = (
  family: string,
  messageType: string,
  version: string,
  fileName: string,
): SchemaEntry => ({
  family,
  messageType,
  version,
  fileName,
  namespace: `urn:iso:std:iso:20022:tech:xsd:${messageType}`,
});

// Intentionally shuffled + spanning two families so the group-by
// invariants (family header, per-group count, per-group sort) are
// meaningful to assert.
const SAMPLE: SchemaEntry[] = [
  mkEntry("pacs", "pacs.008.001.13", "001.13", "pacs.008.001.13.xsd"),
  mkEntry("camt", "camt.053.001.13", "001.13", "camt.053.001.13.xsd"),
  mkEntry("pacs", "pacs.008.001.09", "001.09", "pacs.008.001.09.xsd"),
  mkEntry("camt", "camt.053.001.09", "001.09", "camt.053.001.09.xsd"),
  mkEntry("pacs", "pacs.002.001.11", "001.11", "pacs.002.001.11.xsd"),
];

describe("Workspace / SchemasSection", () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedUpload.mockReset();
    // Reset back to standalone defaults so tests that don't opt into
    // online mode always start from a clean full-featured baseline.
    appConfigState.mode = "standalone";
    appConfigState.schemaUploadEnabled = true;
  });

  it("groups schemas under family accordions with correct counts", async () => {
    mockedList.mockResolvedValue(SAMPLE);

    renderApp(<SchemasSection />);

    // Wait for the tree to appear.
    await waitFor(() => {
      expect(screen.getByTestId("workspace-schemas-tree")).toBeInTheDocument();
    });

    // Two family headers, each carrying the right count. Data-testid
    // targets are more robust than substring matches on the label
    // ("pacs (3)") because the accordion button splits name and count
    // into separate <span>s.
    expect(screen.getByTestId("workspace-schemas-family-count-pacs")).toHaveTextContent("(3)");
    expect(screen.getByTestId("workspace-schemas-family-count-camt")).toHaveTextContent("(2)");
  });

  it("scopes each schema row to its family group", async () => {
    mockedList.mockResolvedValue(SAMPLE);
    renderApp(<SchemasSection />);
    await waitFor(() => {
      expect(screen.getByTestId("workspace-schemas-tree")).toBeInTheDocument();
    });

    // Sprint 9.7 — each group now renders both a <table> (desktop) and
    // a <ul> of cards (mobile). Scope the assertions to the desktop
    // table so the duplicate mobile-card DOM nodes don't collide with
    // `getByText`.
    const pacsGroup = screen.getByTestId("workspace-schemas-family-pacs");
    const pacsTable = within(pacsGroup).getByRole("table");
    expect(within(pacsTable).getByText("pacs.002.001.11")).toBeInTheDocument();
    expect(within(pacsTable).getByText("pacs.008.001.09")).toBeInTheDocument();
    expect(within(pacsTable).getByText("pacs.008.001.13")).toBeInTheDocument();
    expect(within(pacsTable).queryByText("camt.053.001.13")).toBeNull();

    const camtGroup = screen.getByTestId("workspace-schemas-family-camt");
    const camtTable = within(camtGroup).getByRole("table");
    expect(within(camtTable).getByText("camt.053.001.09")).toBeInTheDocument();
    expect(within(camtTable).getByText("camt.053.001.13")).toBeInTheDocument();
    expect(within(camtTable).queryByText("pacs.008.001.13")).toBeNull();
  });

  it("orders rows inside a group by messageType then version", async () => {
    mockedList.mockResolvedValue(SAMPLE);
    renderApp(<SchemasSection />);
    await waitFor(() => {
      expect(screen.getByTestId("workspace-schemas-tree")).toBeInTheDocument();
    });

    const pacsGroup = screen.getByTestId("workspace-schemas-family-pacs");
    // Query the first column of each row (Message Type). The service
    // shuffles pacs entries; the UI must render them sorted:
    //   pacs.002.001.11 → pacs.008.001.09 → pacs.008.001.13
    const rows = within(pacsGroup).getAllByRole("row");
    // Row 0 is the <thead>; the first data row is index 1.
    const dataRows = rows.slice(1);
    const messageTypes = dataRows.map(
      (r) => within(r).getAllByRole("cell")[0].textContent,
    );
    expect(messageTypes).toEqual([
      "pacs.002.001.11",
      "pacs.008.001.09",
      "pacs.008.001.13",
    ]);
  });

  it("collapses and re-expands a family when its header is clicked", async () => {
    mockedList.mockResolvedValue(SAMPLE);
    renderApp(<SchemasSection />);
    await waitFor(() => {
      expect(screen.getByTestId("workspace-schemas-tree")).toBeInTheDocument();
    });

    const toggle = screen.getByTestId("workspace-schemas-family-toggle-pacs");
    // Starts open — the pacs rows are visible. Sprint 9.7 renders each
    // schema in both a table row and a mobile card, so
    // `pacs.008.001.13` appears twice; assert on the count instead.
    expect(screen.getAllByText("pacs.008.001.13").length).toBeGreaterThan(0);

    await userEvent.click(toggle);
    // After collapsing, every occurrence (table + mobile card) is gone.
    expect(screen.queryByText("pacs.008.001.13")).toBeNull();

    await userEvent.click(toggle);
    // Re-expanding restores them.
    expect(screen.getAllByText("pacs.008.001.13").length).toBeGreaterThan(0);
  });

  it("uploads a picked file and refreshes the list", async () => {
    mockedList.mockResolvedValueOnce([]);
    const uploaded: SchemaUploadResponse = {
      messageType: "pacs.008.001.13",
      namespace: "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13",
      fileName: "pacs.008.001.13.xsd",
    };
    mockedUpload.mockResolvedValue(uploaded);
    mockedList.mockResolvedValueOnce([
      mkEntry("pacs", uploaded.messageType, "001.13", uploaded.fileName),
    ]);

    renderApp(<SchemasSection />);

    await waitFor(() => {
      expect(screen.getByText(/No schemas loaded|Nenhum schema/i)).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId("workspace-schema-file") as HTMLInputElement;
    const file = new File(["<xs:schema/>"], uploaded.fileName, { type: "application/xml" });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(mockedUpload).toHaveBeenCalledTimes(1);
    });
    expect(mockedUpload.mock.calls[0][0]).toBe(file);

    // Freshly uploaded schema lands under its family group, and that
    // group must be expanded so the analyst sees the row without an
    // extra click. Scope to the desktop <table> so the duplicate mobile
    // card node doesn't collide with the `getByText` matcher.
    await waitFor(() => {
      const group = screen.getByTestId("workspace-schemas-family-pacs");
      const table = within(group).getByRole("table");
      expect(within(table).getByText("pacs.008.001.13")).toBeInTheDocument();
    });
  });

  it("auto-expands the target family after a successful upload", async () => {
    // Two initial families, both open. Manually collapse "pacs" and
    // then upload a new pacs schema — the mutation's onSuccess must
    // re-expand it.
    mockedList.mockResolvedValueOnce(SAMPLE);
    const uploaded: SchemaUploadResponse = {
      messageType: "pacs.028.001.06",
      namespace: "urn:iso:std:iso:20022:tech:xsd:pacs.028.001.06",
      fileName: "pacs.028.001.06.xsd",
    };
    mockedUpload.mockResolvedValue(uploaded);
    mockedList.mockResolvedValueOnce([
      ...SAMPLE,
      mkEntry("pacs", uploaded.messageType, "001.06", uploaded.fileName),
    ]);

    renderApp(<SchemasSection />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-schemas-family-toggle-pacs")).toBeInTheDocument();
    });

    // Collapse pacs. Sanity-check the state before the upload.
    await userEvent.click(screen.getByTestId("workspace-schemas-family-toggle-pacs"));
    expect(screen.queryByText("pacs.008.001.13")).toBeNull();

    // Fire the upload.
    const fileInput = screen.getByTestId("workspace-schema-file") as HTMLInputElement;
    const file = new File(["<xs:schema/>"], uploaded.fileName, { type: "application/xml" });
    await userEvent.upload(fileInput, file);

    // pacs must be back open and the new row visible. Scope to the
    // desktop <table> so the mobile-card duplicate doesn't disambiguate
    // the assertion (Sprint 9.7 renders both trees at all times).
    await waitFor(() => {
      const group = screen.getByTestId("workspace-schemas-family-pacs");
      const table = within(group).getByRole("table");
      expect(within(table).getByText("pacs.028.001.06")).toBeInTheDocument();
    });
  });

  it("surfaces the backend error message when upload fails", async () => {
    mockedList.mockResolvedValue([]);
    mockedUpload.mockRejectedValue(
      new Error("Invalid schema: line 12 — element 'Foo' not declared"),
    );

    renderApp(<SchemasSection />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-schema-file")).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId("workspace-schema-file") as HTMLInputElement;
    const file = new File(["<Document/>"], "not-an-xsd.xsd", { type: "application/xml" });
    await userEvent.upload(fileInput, file);

    // The exact backend message renders verbatim inside the
    // ErrorBanner — no reformatting on the frontend side.
    await waitFor(() => {
      expect(
        screen.getByText(/Invalid schema.*element 'Foo' not declared/i),
      ).toBeInTheDocument();
    });
  });

  it("hides the upload button and shows an online-mode banner when schemaUploadEnabled is false", async () => {
    appConfigState.mode = "online";
    appConfigState.schemaUploadEnabled = false;
    mockedList.mockResolvedValue(SAMPLE);

    renderApp(<SchemasSection />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-schemas-tree")).toBeInTheDocument();
    });

    // The upload button is unmounted entirely in online mode — safer than
    // just disabling it because a rogue enable via devtools still gets a
    // 403 from the backend middleware.
    expect(screen.queryByTestId("workspace-schema-upload")).toBeNull();
    expect(screen.queryByTestId("workspace-schema-file")).toBeNull();

    // Banner surfaces the shared "not available in the online version"
    // phrasing plus the schema-specific reason mentioning the fixed
    // catalogue.
    const banner = screen.getByTestId("workspace-schema-upload-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(
      /not available in the online version|não está disponível na versão online/i,
    );
    expect(banner.textContent).toMatch(
      /fixed ISO 20022 XSD catalogue|catálogo fixo de XSDs ISO 20022/i,
    );

    // The tree itself keeps rendering — the read/browse flow (Reference,
    // Comparator) has to keep working over the fixed catalogue.
    const pacsGroup = screen.getByTestId("workspace-schemas-family-pacs");
    expect(pacsGroup).toBeInTheDocument();
  });

  it("keeps the upload button visible when schemaUploadEnabled is true (standalone)", async () => {
    // Regression guard for the gate — the button reappears the moment the
    // flag flips back to true. beforeEach already resets to standalone.
    mockedList.mockResolvedValue(SAMPLE);

    renderApp(<SchemasSection />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-schemas-tree")).toBeInTheDocument();
    });

    expect(screen.getByTestId("workspace-schema-upload")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-schema-file")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-schema-upload-banner")).toBeNull();
  });
});
