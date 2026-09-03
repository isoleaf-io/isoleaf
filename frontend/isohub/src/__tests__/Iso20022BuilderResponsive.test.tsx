import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";

// Sprint 9.7 — mobile responsiveness. The Builder's form/XML split
// becomes tabs below the lg breakpoint. These tests verify the tab bar
// mounts once a build result is present and that switching tabs flips
// which pane is visible on mobile (the classname toggling is what
// drives display: none in the browser).

const { SAMPLE_BUILD, SAMPLE_ECOSYSTEMS, SAMPLE_SCENARIOS } = vi.hoisted(() => ({
  SAMPLE_ECOSYSTEMS: [
    { ecosystemId: "brazilian-pix", displayName: "Brazilian Pix", description: "" },
  ],
  SAMPLE_SCENARIOS: [
    {
      scenarioId: "pix-credit-transfer",
      ecosystemId: "brazilian-pix",
      messageTypePrefix: "pacs.008",
      displayName: "Credit Transfer (Pix)",
      description: "",
    },
  ],
  SAMPLE_BUILD: {
    messageType: "pacs.008.001.13",
    scenarioId: "pix-credit-transfer",
    xml: "<Document/>",
    sections: [
      {
        name: "FIToFICstmrCdtTrf",
        xpath: "FIToFICstmrCdtTrf",
        isMandatory: true,
        fields: [],
        sections: [],
      },
    ],
  },
}));

vi.mock("@/api/iso20022Builder", () => ({
  listEcosystems: vi.fn().mockResolvedValue(SAMPLE_ECOSYSTEMS),
  listScenarios: vi.fn().mockResolvedValue(SAMPLE_SCENARIOS),
  buildIso20022: vi.fn().mockResolvedValue(SAMPLE_BUILD),
  listAvailableFields: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/api/iso20022Reference", () => ({
  listMessageTypes: vi.fn().mockResolvedValue({
    messageTypes: ["pacs.008.001.13"],
  }),
}));
vi.mock("@/api/iso20022", () => ({
  validateIso20022: vi.fn(),
}));
vi.mock("@/api/testData", () => ({
  fetchTestPerson: vi.fn().mockResolvedValue({ name: "Test" }),
}));
vi.mock("@/api/workspace", () => ({
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));
vi.mock("@/hooks/useSimulatorHub", () => ({ useSimulatorHub: () => {} }));

import Iso20022BuilderPage from "@/pages/Iso20022Builder";

async function generateAndWait(user: ReturnType<typeof userEvent.setup>) {
  // Sprint 12.10: findByRole surfaces the button as soon as it mounts, but
  // BuilderPage disables it (line ~430 in Iso20022Builder/index.tsx) while
  // the ecosystem/scenario defaults are still being seeded by their useEffect
  // chain (listEcosystems -> listScenarios -> setScenarioId -> setVersion ->
  // fullMessageType). Clicking a disabled button is a userEvent no-op —
  // handleGenerate never fires, waitFor(builder-result) times out. Wait for
  // the button to be actually enabled before clicking; that's the honest
  // signal that fullMessageType + scenarioId are both truthy.
  const generate = await screen.findByRole("button", { name: /Gerar/i });
  await waitFor(() => expect(generate).not.toBeDisabled());
  await user.click(generate);
  await waitFor(() =>
    expect(screen.getByTestId("builder-result")).toBeInTheDocument(),
  );
}

describe("Iso20022BuilderPage — mobile tabs (Sprint 9.7)", () => {
  it("mounts the mobile tab bar once a build result is present", async () => {
    const user = userEvent.setup();
    renderApp(<Iso20022BuilderPage />);
    await generateAndWait(user);

    // Tab bar exists, hidden above lg via the `lg:hidden` class — we
    // don't assert visibility (jsdom doesn't compute media queries),
    // only that the element and its two buttons render.
    const tablist = screen.getByTestId("builder-mobile-tabs");
    expect(tablist).toBeInTheDocument();
    expect(tablist.className).toContain("lg:hidden");
    expect(screen.getByTestId("builder-mobile-tab-form")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("builder-mobile-tab-xml")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("switches active tab from Formulário to XML on click", async () => {
    const user = userEvent.setup();
    renderApp(<Iso20022BuilderPage />);
    await generateAndWait(user);

    await user.click(screen.getByTestId("builder-mobile-tab-xml"));

    expect(screen.getByTestId("builder-mobile-tab-form")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("builder-mobile-tab-xml")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("XML textarea remains reachable after tab-switching to XML (mobile) — generation flow intact", async () => {
    // Regression guard for the mobile-tabs refactor: the XML pane must
    // still be mounted (not conditionally unmounted) so the generation
    // flow keeps working. Even when the form tab is active, both panes
    // are in the DOM — the class toggle controls visibility.
    const user = userEvent.setup();
    renderApp(<Iso20022BuilderPage />);
    await generateAndWait(user);

    // Textarea is present regardless of active tab.
    expect(screen.getByTestId("builder-xml")).toBeInTheDocument();

    await user.click(screen.getByTestId("builder-mobile-tab-xml"));
    expect(screen.getByTestId("builder-xml")).toBeInTheDocument();

    await user.click(screen.getByTestId("builder-mobile-tab-form"));
    expect(screen.getByTestId("builder-xml")).toBeInTheDocument();
  });
});
