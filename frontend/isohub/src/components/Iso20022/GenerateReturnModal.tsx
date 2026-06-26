import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  xml: string;
  returnMessageType: string;
  availableReturnTypes: string[];
  /** Called when the user picks a different return type chip. */
  onSwitchType: (type: string) => void;
  /** True while a switch-type request is in flight. */
  switching?: boolean;
}

/**
 * Shows the generated return-message skeleton and lets the user pick an
 * alternative target type when more than one is available (pacs.008 →
 * pacs.004 or pacs.002).
 */
export function GenerateReturnModal({
  isOpen,
  onClose,
  xml,
  returnMessageType,
  availableReturnTypes,
  onSwitchType,
  switching,
}: Props) {
  const [copied, setCopied] = useState(false);

  // Reset the "copiado!" indicator whenever the dialog opens with a new
  // return XML.
  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen, xml]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard rejection — leave the user to select-all manually.
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(900px,92vw)] max-h-[90vh] flex flex-col bg-bg-primary border border-[var(--border)] rounded-md shadow-xl"
          data-testid="generate-return-modal"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
            <Dialog.Title className="text-sm font-semibold">
              Mensagem de retorno gerada — {returnMessageType}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-4 py-3 space-y-3 overflow-y-auto">
            {availableReturnTypes.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-text-tertiary">Tipo de retorno:</span>
                {availableReturnTypes.map((type) => {
                  const active = type === returnMessageType;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={switching || active}
                      onClick={() => onSwitchType(type)}
                      data-testid={`return-type-chip-${type}`}
                      className={
                        active
                          ? "text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-text border border-accent/40"
                          : "text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-text-secondary hover:bg-bg-tertiary disabled:opacity-50 transition-colors"
                      }
                    >
                      {type}
                    </button>
                  );
                })}
                {switching && (
                  <span className="text-[10px] text-text-tertiary">Gerando...</span>
                )}
              </div>
            )}

            <textarea
              value={xml}
              readOnly
              className="w-full h-[420px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[11px] resize-none focus:outline-none"
              data-testid="generate-return-xml"
            />
          </div>

          <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={handleCopy} data-testid="generate-return-copy">
              <Copy size={13} /> {copied ? "Copiado!" : "Copiar XML"}
            </Button>
            <div className="ml-auto">
              <Button variant="secondary" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
