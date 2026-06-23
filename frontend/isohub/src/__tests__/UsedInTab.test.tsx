import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { UsedInTab } from "@/components/Iso20022/UsedInTab";
import type {
  FieldOccurrenceDto,
  FieldSearchResultDto,
} from "@/api/iso20022Reference";

function makeOcc(
  messageType: string,
  typeName = "Max35Text",
  cardinality = "[1..1]",
  isMandatory = true,
): FieldOccurrenceDto {
  return {
    messageType,
    xpath: `${messageType.split(".")[0]}/${messageType}/Path`,
    cardinality,
    isMandatory,
    typeName,
  };
}

function makeUsedIn(occurrences: FieldOccurrenceDto[]): FieldSearchResultDto {
  return {
    fieldName: "MsgId",
    // The component derives consistency from the analyzer rather than this
    // flag, so the value here only affects the badge text in the legacy
    // header (which the new tab doesn't render).
    isConsistent: true,
    occurrences,
    differences: [],
  };
}

describe("UsedInTab", () => {
  it("consistent field: shows '✓ Reutilize' block, hides '⚠ Adapte' block", () => {
    // Three occurrences with identical typeName + cardinality — all roll into
    // the compatible bucket; no incompatible section should render.
    const usedIn = makeUsedIn([
      makeOcc("pacs.008.001.09"),
      makeOcc("pacs.008.001.13"),
      makeOcc("pacs.002.001.11"),
    ]);

    renderApp(
      <UsedInTab usedIn={usedIn} currentMessageType="pacs.008.001.09" />,
    );

    expect(screen.getByTestId("used-in-compatible-section")).toBeInTheDocument();
    expect(screen.queryByTestId("used-in-incompatible-section")).not.toBeInTheDocument();
  });

  it("mixed field: shows both '✓ Reutilize' and '⚠ Adapte' blocks", () => {
    // Two pacs share the reference shape; one camt diverges (different type +
    // optional vs mandatory) and lands in the incompatible bucket.
    const usedIn = makeUsedIn([
      makeOcc("pacs.008.001.09", "Max35Text", "[1..1]", true),
      makeOcc("pacs.008.001.13", "Max35Text", "[1..1]", true),
      makeOcc("camt.053.001.09", "Max70Text", "[0..1]", false),
    ]);

    renderApp(
      <UsedInTab usedIn={usedIn} currentMessageType="pacs.008.001.09" />,
    );

    expect(screen.getByTestId("used-in-compatible-section")).toBeInTheDocument();
    expect(screen.getByTestId("used-in-incompatible-section")).toBeInTheDocument();
  });

  it("auto-expands the family of the current messageType", () => {
    // pacs is the current family — its FamilyGroup starts expanded so the
    // content (message IDs list) is visible without a click. camt stays
    // collapsed: its content panel is absent from the DOM.
    const usedIn = makeUsedIn([
      makeOcc("pacs.008.001.09"),
      makeOcc("camt.053.001.09"),
    ]);

    renderApp(
      <UsedInTab usedIn={usedIn} currentMessageType="pacs.008.001.09" />,
    );

    expect(screen.getByTestId("family-content-pacs")).toBeInTheDocument();
    expect(screen.queryByTestId("family-content-camt")).not.toBeInTheDocument();
  });

  it("clicking an incompatible row expands its differences detail", async () => {
    const user = userEvent.setup();
    const usedIn = makeUsedIn([
      makeOcc("pacs.008.001.09", "Max35Text", "[1..1]", true),
      makeOcc("camt.053.001.09", "Max70Text", "[0..1]", false),
    ]);

    renderApp(
      <UsedInTab usedIn={usedIn} currentMessageType="pacs.008.001.09" />,
    );

    // Detail block is mounted only after the user expands the row.
    expect(
      screen.queryByTestId("incompatible-row-detail-camt.053.001.09"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("incompatible-row-camt.053.001.09").querySelector("button")!);

    expect(
      screen.getByTestId("incompatible-row-detail-camt.053.001.09"),
    ).toBeInTheDocument();
  });
});
