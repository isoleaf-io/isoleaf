import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { MessageTypeSelector } from "@/components/Iso20022/MessageTypeSelector";

const MESSAGE_TYPES = [
  "pacs.008.001.09",
  "pacs.008.001.13",
  "pacs.002.001.11",
  "camt.053.001.09",
  "camt.053.001.13",
];

function getSelect(testid: string): HTMLSelectElement {
  return screen.getByTestId(testid) as HTMLSelectElement;
}

describe("MessageTypeSelector (chained selects)", () => {
  it("mounts with three selects reflecting the current selectedType", () => {
    renderApp(
      <MessageTypeSelector
        messageTypes={MESSAGE_TYPES}
        selectedType="pacs.008.001.09"
        onSelect={() => {}}
      />,
    );

    expect(getSelect("message-type-select-family").value).toBe("pacs");
    expect(getSelect("message-type-select-id").value).toBe("pacs.008");
    expect(getSelect("message-type-select-version").value).toBe("001.09");
  });

  it("changing family resets the type+version to the first available and fires onSelect", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderApp(
      <MessageTypeSelector
        messageTypes={MESSAGE_TYPES}
        selectedType="pacs.008.001.09"
        onSelect={onSelect}
      />,
    );

    await user.selectOptions(getSelect("message-type-select-family"), "camt");

    // camt has a single messageId (camt.053) — Type cascades to it; Version
    // cascades to the first ordered version (001.09). onSelect fires with
    // the freshly assembled messageType.
    expect(getSelect("message-type-select-id").value).toBe("camt.053");
    expect(getSelect("message-type-select-version").value).toBe("001.09");
    expect(onSelect).toHaveBeenCalledWith("camt.053.001.09");
  });

  it("changing version (final leg) fires onSelect with the assembled messageType", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderApp(
      <MessageTypeSelector
        messageTypes={MESSAGE_TYPES}
        selectedType="pacs.008.001.09"
        onSelect={onSelect}
      />,
    );

    await user.selectOptions(getSelect("message-type-select-version"), "001.13");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("pacs.008.001.13");
  });
});
