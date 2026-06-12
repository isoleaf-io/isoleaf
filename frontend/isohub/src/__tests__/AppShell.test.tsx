import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";
import { AppShell } from "@/components/layout/AppShell";

vi.mock("@/api/workspace", () => ({
  getAppConfig: vi.fn().mockResolvedValue({
    mode: "standalone",
    simulatorEnabled: true,
    emvCryptoEnabled: true,
    workspaceKeysEnabled: true,
  }),
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));

function renderShell() {
  return renderApp(
    <AppShell title="Test" subtitle="sub">
      <div>content</div>
    </AppShell>,
  );
}

describe("AppShell mobile responsiveness", () => {
  it("AppShell_ShowsHamburgerMenu_OnMobile", () => {
    renderShell();
    // Mobile header carries `md:hidden` — it lives in the DOM regardless of
    // viewport (Tailwind classes are not evaluated in jsdom). We just assert
    // the hamburger button is rendered.
    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger).toBeInTheDocument();
    // Sanity: it sits inside a header marked md:hidden.
    const header = hamburger.closest("header")!;
    expect(header.className).toContain("md:hidden");
  });

  it("AppShell_OpensSidebar_WhenHamburgerClicked", async () => {
    const user = userEvent.setup();
    renderShell();

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    expect(sidebar).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();
  });

  it("AppShell_ClosesSidebar_WhenNavItemClicked", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveAttribute("data-open", "true");

    // Any nav link inside the sidebar triggers onNavigate → drawer closes.
    const parserLink = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href") === "/parser")!;
    await user.click(parserLink);

    expect(sidebar).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
  });
});
