import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/renderApp";

// Sprint 9.7 — the sequence diagram SVG must scale to the container
// via viewBox instead of forcing a horizontal-scroll strip on mobile.
// These tests assert the resulting SVG attribute shape.

const { SAMPLE_PIX_RESULT } = vi.hoisted(() => ({
  SAMPLE_PIX_RESULT: {
    flowType: "pix-transfer",
    steps: [
      {
        stepId: 1,
        messageType: "pacs.008.001.13",
        label: "Ordem de pagamento",
        fromActor: "PSP Pagador",
        toActor: "SPI/BCB",
        xml: "<Document/>",
        contentType: "xml" as const,
      },
      {
        stepId: 2,
        messageType: "pacs.002.001.15",
        label: "Confirmação",
        fromActor: "SPI/BCB",
        toActor: "PSP Pagador",
        xml: "<Document/>",
        contentType: "xml" as const,
      },
    ],
    alerts: [],
  },
}));

vi.mock("@/api/pixFlow", () => ({
  generatePixFlow: vi.fn().mockResolvedValue(SAMPLE_PIX_RESULT),
  listPixFlowTypes: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/api/swiftFlow", () => ({
  generateSwiftFlow: vi.fn(),
}));
vi.mock("@/api/iso8583Flow", () => ({
  generateIso8583Flow: vi.fn(),
}));
vi.mock("@/api/iso20022", () => ({
  parseIso20022: vi.fn(),
}));
vi.mock("@/api/workspace", () => ({
  getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));
vi.mock("@/hooks/useSimulatorHub", () => ({ useSimulatorHub: () => {} }));

import PixFlowPage from "@/pages/PixFlow";

describe("FlowVisualizer — SVG auto-scale (Sprint 9.7)", () => {
  it("renders the diagram SVG with viewBox and width=100% (no fixed-pixel width)", async () => {
    const user = userEvent.setup();
    renderApp(<PixFlowPage />);

    await user.click(await screen.findByTestId("pix-flow-generate"));

    const svg = await waitFor(() => screen.getByTestId("pix-flow-diagram-svg"));

    // viewBox is set to intrinsic dimensions so the SVG scales with
    // the container width.
    expect(svg.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
    // No hardcoded pixel width — that was the pre-Sprint 9.7 bug that
    // forced horizontal scroll on 390–414px viewports.
    expect(svg.hasAttribute("width")).toBe(false);
    // Tailwind class-based width: 100% + auto height.
    const svgClass = svg.getAttribute("class") ?? "";
    expect(svgClass).toContain("w-full");
    expect(svgClass).toContain("h-auto");
  });

  it("container no longer uses horizontal-scroll fallback", async () => {
    const user = userEvent.setup();
    renderApp(<PixFlowPage />);

    await user.click(await screen.findByTestId("pix-flow-generate"));

    const container = await waitFor(() =>
      screen.getByTestId("pix-flow-diagram-container"),
    );
    // Before Sprint 9.7 this element carried `overflow-x-auto` and
    // `justify-center`. Both must be gone now — the SVG viewBox handles
    // the fit.
    expect(container.className).not.toContain("overflow-x-auto");
    expect(container.className).not.toContain("justify-center");
    expect(container.className).toContain("w-full");
  });

  it("uses preserveAspectRatio so the diagram isn't stretched", async () => {
    const user = userEvent.setup();
    renderApp(<PixFlowPage />);

    await user.click(await screen.findByTestId("pix-flow-generate"));

    const svg = await waitFor(() => screen.getByTestId("pix-flow-diagram-svg"));
    // xMidYMin meet keeps the diagram centred horizontally and top-
    // aligned when the container is wider than the intrinsic aspect
    // ratio — same behaviour the desktop layout used to have.
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMin meet");
  });
});
