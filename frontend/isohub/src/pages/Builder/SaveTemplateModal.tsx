import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useTemplatesStore } from "@/store/templates";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

export function SaveTemplateModal({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tpl = useTemplatesStore.getState().saveTemplate(
      trimmed.slice(0, 50),
      description.trim() || undefined,
      tags.trim() || undefined
    );
    setName("");
    setDescription("");
    setTags("");
    onSaved?.(tpl.id);
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,90vw)] bg-bg-primary border border-[var(--border)] rounded-lg shadow-2xl z-50 focus:outline-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <Dialog.Title className="text-base font-semibold">Salvar template</Dialog.Title>
            <Dialog.Close className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <Label>Nome do template</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: 0200 Visa Chip aprovado"
                maxLength={50}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Cenário coberto, observações…"
              />
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="visa, chip, aprovado"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={onSave} disabled={!name.trim()}>Salvar</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
