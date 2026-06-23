import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { VersionComparatorView } from "@/components/Iso20022/VersionComparatorView";
import { listMessageTypes } from "@/api/iso20022Reference";

/**
 * Standalone page for the comparator — same view that's used inside the
 * parser modal, but rendered inline without the dialog chrome and in
 * "free" mode (both ends unlocked).
 */
export default function Iso20022ComparatorPage() {
  const [messageTypes, setMessageTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMessageTypes()
      .then((d) => setMessageTypes(d.messageTypes))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <AppShell
      title="Comparador de versões ISO 20022"
      subtitle="Compare campos entre duas versões da mesma família de mensagem (pacs, camt, pain, etc.)."
    >
      <Card>
        <CardBody>
          {error && <p className="text-danger-text text-sm mb-3">{error}</p>}
          {messageTypes.length > 0 && (
            <VersionComparatorView messageTypes={messageTypes} />
          )}
        </CardBody>
      </Card>
    </AppShell>
  );
}
