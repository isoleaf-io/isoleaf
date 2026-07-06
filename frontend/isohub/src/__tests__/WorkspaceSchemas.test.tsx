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

    // Every "pacs.*" schema must live inside the pacs group; the camt
    // group must contain zero pacs rows. The scoped `within` guarantees
    // we're not matching the wrong sub-tree by accident.
    const pacsGroup = screen.getByTestId("workspace-schemas-family-pacs");
    expect(within(pacsGroup).getByText("pacs.002.001.11")).toBeInTheDocument();
    expect(within(pacsGroup).getByText("pacs.008.001.09")).toBeInTheDocument();
    expect(within(pacsGroup).getByText("pacs.008.001.13")).toBeInTheDocument();
    expect(within(pacsGroup).queryByText("camt.053.001.13")).toBeNull();

    const camtGroup = screen.getByTestId("workspace-schemas-family-camt");
    expect(within(camtGroup).getByText("camt.053.001.09")).toBeInTheDocument();
    expect(within(camtGroup).getByText("camt.053.001.13")).toBeInTheDocument();
    expect(within(camtGroup).queryByText("pacs.008.001.13")).toBeNull();
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
    // Starts open — the pacs rows are visible.
    expect(screen.getByText("pacs.008.001.13")).toBeInTheDocument();

    await userEvent.click(toggle);
    // After collapsing, the rows are gone from the DOM.
    expect(screen.queryByText("pacs.008.001.13")).toBeNull();

    await userEvent.click(toggle);
    // Re-expanding restores them.
    expect(screen.getByText("pacs.008.001.13")).toBeInTheDocument();
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
    // extra click.
    await waitFor(() => {
      const group = screen.getByTestId("workspace-schemas-family-pacs");
      expect(within(group).getByText("pacs.008.001.13")).toBeInTheDocument();
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

    // pacs must be back open and the new row visible.
    await waitFor(() => {
      const group = screen.getByTestId("workspace-schemas-family-pacs");
      expect(within(group).getByText("pacs.028.001.06")).toBeInTheDocument();
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
});
