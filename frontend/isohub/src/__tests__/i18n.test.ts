import { describe, expect, it } from "vitest";
import i18n from "@/i18n";

describe("i18n", () => {
  it("loads English strings", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.appName")).toBe("ISOLeaf");
    expect(i18n.t("parser.title")).toBe("Parser");
  });

  it("loads pt-BR strings", async () => {
    await i18n.changeLanguage("pt-BR");
    expect(i18n.t("common.appName")).toBe("ISOLeaf");
    expect(i18n.t("parser.subtitle")).toContain("Cole");
  });

  it("falls back to English for missing keys", async () => {
    await i18n.changeLanguage("pt-BR");
    expect(i18n.t("parser.title")).toBe("Parser");
  });

  // Sprint 12.4 P2 — the Workspace tab was "Agent (Simulador)" (mixed
  // languages + didn't match the sibling tabs). Renamed to "Simulador"
  // (PT) / "Simulator" (EN). If someone reverts these accidentally, the
  // suite catches it here.
  it("Workspace tab is 'Simulador' in pt-BR (not 'Agent (Simulador)')", async () => {
    await i18n.changeLanguage("pt-BR");
    expect(i18n.t("workspace.agent.tab")).toBe("Simulador");
    // The full-title "Agent do Simulador" stays inside the section — only
    // the TAB label was renamed.
    expect(i18n.t("workspace.agent.tab")).not.toMatch(/Agent \(/);
  });

  it("Workspace tab is 'Simulator' in EN", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("workspace.agent.tab")).toBe("Simulator");
    expect(i18n.t("workspace.agent.tab")).not.toMatch(/Agent \(/);
  });
});
