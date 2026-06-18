import "@testing-library/jest-dom/vitest";
// Eagerly initialise i18n so components rendered in tests see translated
// strings instead of raw keys. The module is a side-effect singleton — main.tsx
// triggers it in the app; tests need their own entry point.
import "@/i18n";

// matchMedia stub for jsdom
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
