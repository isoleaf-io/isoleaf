import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { FieldSearchResults } from "@/components/Iso20022/FieldSearchResults";
import type {
  FieldOccurrenceDto,
  FieldSearchResultDto,
} from "@/api/iso20022Reference";

function makeOcc(messageType: string): FieldOccurrenceDto {
  return {
    messageType,
    xpath: `${messageType.split(".")[0]}/Path`,
    cardinality: "[1..1]",
    isMandatory: true,
    typeName: "Max35Text",
  };
}

const RESULTS: FieldSearchResultDto[] = [
  {
    fieldName: "MsgId",
    isConsistent: true,
    occurrences: [
      makeOcc("pacs.008.001.09"),
      makeOcc("pacs.008.001.13"),
      makeOcc("camt.053.001.09"),
    ],
    differences: [],
  },
  {
    fieldName: "EndToEndId",
    isConsistent: true,
    occurrences: [makeOcc("pacs.008.001.09")],
    differences: [],
  },
];

describe("FieldSearchResults — step 1 (field list)", () => {
  it("renders the field list when no field is selected", () => {
    renderApp(
      <FieldSearchResults
        results={RESULTS}
        term="Id"
        selectedFieldName={null}
        onSelectField={() => {}}
        onBack={() => {}}
        onNavigate={() => {}}
      />,
    );

    expect(screen.getByTestId("field-search-list")).toBeInTheDocument();
    expect(screen.getByTestId("field-search-list-item-MsgId")).toBeInTheDocument();
    expect(screen.getByTestId("field-search-list-item-EndToEndId")).toBeInTheDocument();
    // Detail view shouldn't be mounted yet.
    expect(screen.queryByTestId("field-search-detail")).not.toBeInTheDocument();
  });

  it("clicking a field-list item calls onSelectField with that field's name", async () => {
    const onSelectField = vi.fn();
    const user = userEvent.setup();
    renderApp(
      <FieldSearchResults
        results={RESULTS}
        term="Id"
        selectedFieldName={null}
        onSelectField={onSelectField}
        onBack={() => {}}
        onNavigate={() => {}}
      />,
    );

    await user.click(screen.getByTestId("field-search-list-item-MsgId"));

    expect(onSelectField).toHaveBeenCalledWith("MsgId");
  });
});

describe("FieldSearchResults — step 2 (drill-down)", () => {
  it("shows the family/version layout for the chosen field with a Back button", () => {
    renderApp(
      <FieldSearchResults
        results={RESULTS}
        term="Id"
        selectedFieldName="MsgId"
        onSelectField={() => {}}
        onBack={() => {}}
        onNavigate={() => {}}
      />,
    );

    expect(screen.getByTestId("field-search-detail")).toBeInTheDocument();
    // List view is hidden in step 2.
    expect(screen.queryByTestId("field-search-list")).not.toBeInTheDocument();
    // Only MsgId's families render — pacs + camt come from its occurrences.
    expect(screen.getByTestId("field-search-family-pacs")).toBeInTheDocument();
    expect(screen.getByTestId("field-search-family-camt")).toBeInTheDocument();
    // Chips are present for every occurrence of this specific field.
    expect(screen.getByTestId("field-search-chip-pacs.008.001.13")).toBeInTheDocument();
  });

  it("Back button fires onBack to return to step 1", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderApp(
      <FieldSearchResults
        results={RESULTS}
        term="Id"
        selectedFieldName="MsgId"
        onSelectField={() => {}}
        onBack={onBack}
        onNavigate={() => {}}
      />,
    );

    await user.click(screen.getByTestId("field-search-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("clicking a chip in detail view fires onNavigate(messageType, fieldName)", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderApp(
      <FieldSearchResults
        results={RESULTS}
        term="Id"
        selectedFieldName="MsgId"
        onSelectField={() => {}}
        onBack={() => {}}
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByTestId("field-search-chip-pacs.008.001.13"));
    expect(onNavigate).toHaveBeenCalledWith("pacs.008.001.13", "MsgId");
  });
});
