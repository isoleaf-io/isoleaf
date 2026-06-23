import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { VersionComparatorView } from "./VersionComparatorView";

interface Props {
  open: boolean;
  onClose: () => void;
  messageTypes: string[];
  /** Locks the "from" version — used when launched from the parser. */
  lockedFromVersion?: string;
  /** XPaths in the user's current XML. Triggers impact-filtered diff. */
  currentXPaths?: string[];
}

/**
 * Thin Radix Dialog wrapper around <c>VersionComparatorView</c>. Used by the
 * parser page; the standalone page (<c>Iso20022ComparatorPage</c>) renders
 * the same view inline without the modal chrome.
 */
export function VersionComparatorModal({
  open,
  onClose,
  messageTypes,
  lockedFromVersion,
  currentXPaths,
}: Props) {
  // "Impact" mode kicks in whenever the caller hands us the XML's XPaths —
  // header copy switches to "impact on your message" framing.
  const lockedMode = !!currentXPaths;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(900px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto bg-bg-primary border border-[var(--border)] rounded-lg shadow-2xl"
          data-testid="version-comparator-modal"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)]">
            <Dialog.Title className="text-base font-semibold">
              {lockedMode
                ? "Impacto na sua mensagem"
                : "Comparar versões"}
              {lockedFromVersion && (
                <span className="ml-2 text-text-tertiary font-mono text-xs">
                  (a partir de {lockedFromVersion})
                </span>
              )}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-bg-tertiary"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-5">
            <VersionComparatorView
              messageTypes={messageTypes}
              lockedFromVersion={lockedFromVersion}
              currentXPaths={currentXPaths}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
