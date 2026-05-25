import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/store/theme";

describe("theme store", () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ mode: "system" });
    document.documentElement.removeAttribute("data-theme");
  });

  it("default mode is system", () => {
    expect(useThemeStore.getState().mode).toBe("system");
  });

  it("cycle goes system → light → dark → system", () => {
    const { cycle } = useThemeStore.getState();
    cycle();
    expect(useThemeStore.getState().mode).toBe("light");
    cycle();
    expect(useThemeStore.getState().mode).toBe("dark");
    cycle();
    expect(useThemeStore.getState().mode).toBe("system");
  });

  it("setMode applies data-theme attribute", () => {
    useThemeStore.getState().setMode("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    useThemeStore.getState().setMode("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
