import { describe, expect, it } from "vitest";
import i18n from "@/i18n";

describe("i18n", () => {
  it("loads English strings", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.appName")).toBe("ISOHub");
    expect(i18n.t("parser.title")).toBe("Parser");
  });

  it("loads pt-BR strings", async () => {
    await i18n.changeLanguage("pt-BR");
    expect(i18n.t("common.appName")).toBe("ISOHub");
    expect(i18n.t("parser.subtitle")).toContain("Cole");
  });

  it("falls back to English for missing keys", async () => {
    await i18n.changeLanguage("pt-BR");
    expect(i18n.t("parser.title")).toBe("Parser");
  });
});
