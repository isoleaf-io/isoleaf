import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelpButton } from "@/components/ui/HelpButton";

describe("HelpButton", () => {
  it("renders popover content on click", async () => {
    const user = userEvent.setup();
    render(
      <HelpButton
        title="Example title"
        content={"First paragraph.\n\nSecond paragraph."}
        ariaLabel="open help"
      />
    );

    // Popover is hidden by default.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open help/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Example title");
    expect(dialog).toHaveTextContent("First paragraph.");
    expect(dialog).toHaveTextContent("Second paragraph.");
  });
});
