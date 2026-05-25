import i18n from "@/i18n";
import { useState } from "react";

/**
 * Compact PT/EN switch. Persists the choice in localStorage so the language
 * detector picks it up on reload.
 */
export function LanguageToggle() {
  // Track local state so re-renders pick up the change immediately.
  const [lng, setLng] = useState(i18n.resolvedLanguage ?? "en");
  const isPt = lng.startsWith("pt");

  const switchLng = () => {
    const next = isPt ? "en" : "pt-BR";
    i18n.changeLanguage(next);
    localStorage.setItem("isohub-lng", next);
    setLng(next);
  };

  return (
    <button
      type="button"
      onClick={switchLng}
      title={isPt ? "Mudar para inglês" : "Switch to Portuguese"}
      aria-label="Toggle language"
      className="h-9 px-3 inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-bg-input text-text-secondary hover:text-text-primary hover:bg-bg-tertiary text-xs font-medium uppercase"
    >
      {isPt ? "PT" : "EN"}
    </button>
  );
}
