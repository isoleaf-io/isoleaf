import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FieldTree } from "@/components/Iso20022/FieldTree";
import type { FieldDefinitionDto } from "@/api/iso20022Reference";

// jsdom doesn't implement Element.scrollIntoView. Stub it before each test so
// the FieldTree's effect can call it without throwing.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function makeField(
  name: string,
  xpath: string,
  depth: number,
  children: FieldDefinitionDto[] = [],
): FieldDefinitionDto {
  return {
    name,
    xpath,
    depth,
    typeName: children.length > 0 ? "complex" : "Max35Text",
    isComplex: children.length > 0,
    cardinality: "[1..1]",
    isMandatory: true,
    minLength: null,
    maxLength: null,
    pattern: null,
    enumerations: [],
    documentation: null,
    children,
  };
}

const TREE: FieldDefinitionDto = makeField("Root", "Root", 0, [
  makeField("GrpHdr", "Root/GrpHdr", 1, [
    makeField("MsgId", "Root/GrpHdr/MsgId", 2),
  ]),
]);

describe("FieldTree — highlight", () => {
  it("applies the highlight ring on the row whose xpath matches highlightXPath", async () => {
    render(
      <FieldTree
        field={TREE}
        defaultExpanded
        highlightXPath="Root/GrpHdr/MsgId"
      />,
    );

    // The deep target is force-expanded by the highlight effect on each
    // ancestor, so the leaf row is in the DOM.
    const row = screen.getByTestId("field-row-Root/GrpHdr/MsgId");
    expect(row.className).toContain("ring-2");
    expect(row.className).toContain("ring-accent");
    // scrollIntoView is deferred to the next animation frame; waitFor flushes
    // jsdom's rAF queue before asserting.
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it("does not apply the highlight ring when highlightXPath is absent", () => {
    render(<FieldTree field={TREE} defaultExpanded />);
    const row = screen.getByTestId("field-row-Root");
    expect(row.className).not.toContain("ring-2");
  });

  it("auto-expands every ancestor of the highlighted xpath", () => {
    // With no highlight, GrpHdr (depth 1) auto-expands by default but MsgId's
    // parent doesn't render unless GrpHdr is expanded. The highlight effect
    // forces expansion down the path so the leaf shows up.
    render(
      <FieldTree
        field={TREE}
        defaultExpanded
        highlightXPath="Root/GrpHdr/MsgId"
      />,
    );
    expect(screen.getByTestId("field-row-Root/GrpHdr")).toBeInTheDocument();
    expect(screen.getByTestId("field-row-Root/GrpHdr/MsgId")).toBeInTheDocument();
  });

  it("expands deep ancestors when highlightXPath is set AFTER mount", async () => {
    // Simulates the real navigation flow: tree mounts first without a
    // highlight, then the search→browse navigation sets highlightXPath. A
    // collapsed depth-2 container must auto-expand so the target deep below
    // becomes visible.
    const deep: FieldDefinitionDto = makeField("Top", "Top", 0, [
      makeField("Mid1", "Top/Mid1", 1, [
        makeField("Mid2", "Top/Mid1/Mid2", 2, [
          makeField("Target", "Top/Mid1/Mid2/Target", 3),
        ]),
      ]),
    ]);

    const { rerender } = render(<FieldTree field={deep} defaultExpanded />);

    // Default state: Mid2 (depth 2) is collapsed; Target (depth 3) hasn't
    // mounted yet because Mid2 doesn't render children.
    expect(screen.queryByTestId("field-row-Top/Mid1/Mid2/Target")).not.toBeInTheDocument();

    // Now the parent sets the highlight (this is what the page does once the
    // resolver finds the field). The cascade must expand Mid2 so Target
    // renders and gets the highlight ring.
    rerender(
      <FieldTree
        field={deep}
        defaultExpanded
        highlightXPath="Top/Mid1/Mid2/Target"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("field-row-Top/Mid1/Mid2/Target")).toBeInTheDocument();
    });
    const target = screen.getByTestId("field-row-Top/Mid1/Mid2/Target");
    expect(target.className).toContain("ring-2");
  });
});
