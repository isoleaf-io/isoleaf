import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle, Input, Label } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { Badge } from "@/components/ui/Badge";
import { injectMessage } from "@/api/simulator";

interface Props {
  sessionId: string | null;
  onClose: () => void;
  onInjected?: (sessionId: string) => void;
}

export function InjectModal({ sessionId, onClose, onInjected }: Props) {
  const { t } = useTranslation();
  const [hex, setHex] = useState("");
  const [includeTpdu, setIncludeTpdu] = useState(false);
  const [tpdu, setTpdu] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: string) => injectMessage(sessionId!, body),
    onSuccess: () => {
      setSuccess(true);
      onInjected?.(sessionId!);
      setTimeout(() => {
        setSuccess(false);
        setHex("");
        onClose();
      }, 900);
    },
  });

  const onInject = () => {
    if (!sessionId || !hex.trim()) return;
    const payload = includeTpdu && tpdu.trim() ? tpdu.trim() + hex.trim() : hex.trim();
    mutation.mutate(payload);
  };

  const error = (mutation.error as Error | undefined)?.message;

  return (
    <Dialog.Root open={sessionId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,90vw)] bg-bg-primary border border-[var(--border)] rounded-lg shadow-2xl z-50 focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <Dialog.Title className="text-base font-semibold">
              {t("simulator.inject")} — Session #{sessionId?.slice(0, 8)}
            </Dialog.Title>
            <Dialog.Close className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <Label>ISO 8583 message (hex / ASCII wire)</Label>
              <textarea
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                placeholder="0200F23C6501..."
                className="w-full min-h-[120px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                spellCheck={false}
              />
            </div>

            <Toggle
              checked={includeTpdu}
              onChange={setIncludeTpdu}
              label="Include TPDU prefix"
            />

            {includeTpdu && (
              <div>
                <Label>TPDU (10 hex chars, leave empty for AUTO)</Label>
                <Input
                  className="font-mono"
                  value={tpdu}
                  onChange={(e) => setTpdu(e.target.value.toUpperCase())}
                  placeholder="6000010002"
                  maxLength={10}
                />
              </div>
            )}

            {error && <ErrorBanner message={error} />}
            {success && (
              <Badge tone="success" className="px-3 py-1">
                Message injected ✓
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-bg-secondary/40 rounded-b-lg">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onInject} disabled={!hex.trim() || mutation.isPending}>
              {mutation.isPending ? t("common.loading") : `${t("simulator.inject")} →`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
