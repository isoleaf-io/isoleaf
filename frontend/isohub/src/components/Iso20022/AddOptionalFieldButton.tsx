import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getFieldLabel } from "@/config/iso20022FieldLabels";
import type {
  BuildFieldDto,
  BuildSectionDto,
} from "@/api/iso20022Builder";

interface Props {
  hiddenFields: BuildFieldDto[];
  hiddenSections: BuildSectionDto[];
  onAdd: (xpath: string) => void;
}

/**
 * "+ Adicionar campo opcional" button rendered at the bottom of every
 * Builder section that still has hidden optionals. The popover is mounted
 * via {@link createPortal} on document.body and absolutely positioned
 * relative to the viewport — otherwise the section card's overflow rule
 * clips the dropdown.
 */
export function AddOptionalFieldButton({
  hiddenFields,
  hiddenSections,
  onAdd,
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  function handleOpen() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 240),
      });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      // Popover lives on document.body via portal, so the button-ref check
      // alone misses clicks inside the popover and closes it before the
      // item's onClick fires. Check both refs.
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1"
        data-testid="builder-add-optional"
      >
        + Adicionar campo opcional
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "absolute",
              top: position.top,
              left: position.left,
              minWidth: position.width,
              zIndex: 9999,
            }}
            className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
            data-testid="builder-add-optional-popover"
          >
            {hiddenSections.map((section) => (
              <button
                key={section.xpath}
                type="button"
                onClick={() => {
                  onAdd(section.xpath);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700 transition-colors flex items-center gap-2"
              >
                <span className="text-zinc-400">📁</span>
                <span className="text-zinc-200 font-medium">
                  {getFieldLabel(section.name)}
                </span>
                <span className="text-zinc-500 font-mono ml-1">
                  {section.name}
                </span>
                <span className="ml-auto text-zinc-600 text-xs">seção</span>
              </button>
            ))}
            {hiddenFields.map((field) => (
              <button
                key={field.xpath}
                type="button"
                onClick={() => {
                  onAdd(field.xpath);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700 transition-colors flex items-center gap-2"
              >
                <span className="text-zinc-200 font-medium">
                  {getFieldLabel(field.name)}
                </span>
                <span className="text-zinc-500 font-mono ml-1">
                  {field.name}
                </span>
                {field.typeName && (
                  <span className="ml-auto text-zinc-600">{field.typeName}</span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
