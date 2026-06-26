import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export interface FlatField {
  name: string;
  xpath: string;
  label: string;
  typeName: string;
  isMandatory: boolean;
  isEcosystemMandatory: boolean;
  isVisible: boolean;
  parentXPath: string;
  isSection: boolean;
}

interface Props {
  allFields: FlatField[];
  onNavigate: (xpath: string) => void;
  onAdd: (xpath: string) => void;
}

const MAX_RESULTS = 10;

/**
 * Search box over every field/section in the loaded message. Matches the
 * friendly label (via getFieldLabel) and the technical XSD name in a
 * case-insensitive substring sweep. Results render in a portal-anchored
 * dropdown so they escape the editor card's overflow. Visible fields show
 * a "→ ir" action; hidden optionals show "+ adicionar".
 */
export function FieldSearchBar({ allFields, onNavigate, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: FlatField[] = [];
    for (const f of allFields) {
      if (
        f.name.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q)
      ) {
        out.push(f);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [query, allFields]);

  function updatePosition() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (inputRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleScrollOrResize() {
      updatePosition();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  function handleNavigate(xpath: string) {
    onNavigate(xpath);
    setOpen(false);
  }

  function handleAdd(xpath: string) {
    onAdd(xpath);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-bg-input border border-[var(--border)] rounded-md px-2 py-1">
        <Search size={14} className="text-text-tertiary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar campo... (ex: MsgId, Debtor, IBAN)"
          className="flex-1 bg-transparent text-xs focus:outline-none"
          data-testid="builder-field-search"
        />
      </div>

      {open &&
        query.trim().length > 0 &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "absolute",
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 9999,
            }}
            className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-h-72 overflow-y-auto"
            data-testid="builder-field-search-results"
          >
            {results.length === 0 ? (
              <div className="px-3 py-3 text-xs text-zinc-400">
                Nenhum campo encontrado para "{query}"
              </div>
            ) : (
              <ul className="py-1">
                {results.map((f) => (
                  <li
                    key={f.xpath}
                    className="px-3 py-2 hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-zinc-100 font-medium flex-1 truncate">
                        {getContextLabel(f.xpath, f.name)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {f.label}
                      </span>
                      <MandatoryBadge field={f} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500 flex-1 truncate">
                        {f.xpath}
                      </span>
                      {f.isVisible ? (
                        <button
                          type="button"
                          onClick={() => handleNavigate(f.xpath)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                          data-testid={`builder-search-navigate-${f.xpath}`}
                        >
                          → ir para campo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdd(f.xpath)}
                          className="text-[11px] text-green-400 hover:text-green-300 transition-colors shrink-0"
                          data-testid={`builder-search-add-${f.xpath}`}
                        >
                          + adicionar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function getContextLabel(xpath: string, name: string): string {
  const parts = xpath.split("/");
  if (parts.length <= 1) return name;
  // Surface the immediate parent so users can tell apart sibling fields
  // that share the same XSD name (Dbtr/Nm vs Cdtr/Nm, etc.).
  const parent = parts[parts.length - 2];
  return `${parent} / ${name}`;
}

function MandatoryBadge({ field }: { field: FlatField }) {
  if (field.isEcosystemMandatory) {
    return <Badge tone="warning">ecossistema</Badge>;
  }
  if (field.isMandatory) {
    return <Badge tone="success">obrigatório</Badge>;
  }
  return <Badge tone="neutral">opcional</Badge>;
}
