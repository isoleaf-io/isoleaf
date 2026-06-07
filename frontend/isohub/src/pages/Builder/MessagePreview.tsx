import * as Tabs from "@radix-ui/react-tabs";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, RotateCcw, Save } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useBuilderStore, type BuilderField, type BuiltMessage } from "@/store/builder";

interface Props {
  built: BuiltMessage;
  onSaveTemplate?: () => void;
}

/**
 * Bit 90 (Original Data) format: MTI(4) + Bit11(6) + Bit7(10) + Bit37(12)
 * The remaining bytes of the 42-char field are zero-padded; downstream networks
 * usually only inspect the first 4 components.
 */
function buildBit90(originalMti: string, fields: BuilderField[]): string {
  const valueOf = (bit: number, len: number) =>
    (fields.find((f) => f.bitNumber === bit)?.value ?? "").padEnd(len, "0").slice(0, len);
  const stan = valueOf(11, 6);
  const datetime = valueOf(7, 10);
  const rrn = valueOf(37, 12);
  return (originalMti + stan + datetime + rrn).padEnd(42, "0");
}

/** Bits that are forwarded from the original transaction into the 0400 reversal. */
const REVERSAL_ECHO_BITS = new Set([2, 3, 4, 7, 11, 12, 13, 37, 41, 42, 49]);

export function MessagePreview({ built, onSaveTemplate }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const context = useBuilderStore((s) => s.context);
  const fields = useBuilderStore((s) => s.fields);
  const { workspaceKeysEnabled } = useAppConfig();

  // â†© Reversal: build a 0400 from the current message in-place.
  // Hidden for 04xx (already a reversal) and 08xx (network management).
  const mtiClass = context.mti.slice(0, 2);
  const canReverse = mtiClass !== "04" && mtiClass !== "08";

  const createReversal = () => {
    const originalMti = context.mti;
    const echoed: BuilderField[] = fields
      .filter((f) => REVERSAL_ECHO_BITS.has(f.bitNumber))
      .map((f) => ({ ...f, status: "ok", locked: true }));
    const bit90: BuilderField = {
      bitNumber: 90,
      name: "Original Data Elements",
      value: buildBit90(originalMti, fields),
      displayValue: buildBit90(originalMti, fields),
      origin: "derived",
      status: "ok",
      fieldType: "Fixed",
      length: 42,
      locked: true,
      dependsOn: [],
      dependents: [],
    };
    const reversalFields = [...echoed, bit90].sort((a, b) => a.bitNumber - b.bitNumber);
    useBuilderStore.getState().loadFromParser(reversalFields, "0400");
    // Bring the table back into view.
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Card className="sticky bottom-4 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {built.fromParser ? t("builder.messageFromParser") : t("builder.messageGenerated")}
            </span>
            <Badge tone={built.fromParser ? "accent" : "success"}>{built.profileUsed}</Badge>
            {built.tpdu && <Badge tone="warning">TPDU: <MonoText className="ml-1">{built.tpdu}</MonoText></Badge>}
            {built.activeBits.includes(55) && (
              built.arqcIsSimulated === false ? (
                <Badge tone="success" title={t("builder.arqcDerivedTooltip")}>
                  {t("builder.arqcDerived")}
                </Badge>
              ) : workspaceKeysEnabled ? (
                <button
                  type="button"
                  onClick={() => navigate("/workspace")}
                  title={t("builder.arqcSimulatedTooltip")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning-bg text-warning-text hover:opacity-80"
                >
                  {t("builder.arqcSimulated")}
                </button>
              ) : (
                // Online mode: no IMK available â€” render a plain badge with a
                // tooltip pointing to Docker, not a clickable link to Workspace.
                <Badge tone="warning" title={t("builder.arqcSimulatedOnlineTooltip")}>
                  {t("builder.arqcSimulated")}
                </Badge>
              )
            )}
          </div>
          <div className="flex gap-2">
            {onSaveTemplate && (
              <Button variant="secondary" size="sm" onClick={onSaveTemplate}>
                <Save size={13} /> {t("builder.saveTemplate")}
              </Button>
            )}
            {canReverse && (
              <Button
                variant="secondary"
                size="sm"
                onClick={createReversal}
                title={t("builder.createReversalTooltip")}
              >
                <RotateCcw size={13} /> {t("builder.createReversal")}
              </Button>
            )}
            <Button variant="secondary" size="sm"
              onClick={() => navigate("/parser", { state: { autoMessage: built.ascii } })}>
              <ChevronRight size={13} /> {t("builder.openInParser")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <Tabs.Root defaultValue="ascii">
          <Tabs.List className="flex gap-1 mb-3 border-b border-[var(--border)]">
            <Tabs.Trigger value="ascii"
              className="px-3 py-1.5 text-sm text-text-secondary border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-text-primary">
              ASCII wire
            </Tabs.Trigger>
            <Tabs.Trigger value="binary"
              className="px-3 py-1.5 text-sm text-text-secondary border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-text-primary">
              Binary hex
            </Tabs.Trigger>
            <Tabs.Trigger value="bitmap"
              className="px-3 py-1.5 text-sm text-text-secondary border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-text-primary">
              Bitmap
            </Tabs.Trigger>
          </Tabs.List>

          {(["ascii", "binary", "bitmap"] as const).map((kind) => {
            // Wire prefix is only meaningful on ASCII/binary tabs; the bitmap stands alone.
            const body =
              kind === "ascii" ? built.ascii :
              kind === "binary" ? built.binaryHex :
              built.bitmap;
            const showTpduPrefix = !!built.tpdu && kind !== "bitmap";
            // For binary-hex view, TPDU is already raw hex; for ASCII wire we prepend the
            // 10-hex literal (matches what goes on the TCP socket if the simulator forwards it).
            const wireValue = showTpduPrefix ? `${built.tpdu}${body ?? ""}` : (body ?? "");
            return (
              <Tabs.Content key={kind} value={kind}>
                {showTpduPrefix && (
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <Badge tone="warning">
                      TPDU prefix: <MonoText className="ml-1">{built.tpdu}</MonoText>
                    </Badge>
                    <CopyButton value={built.tpdu ?? ""} />
                    <span className="text-text-tertiary">{t("builder.tpduPrecedes")}</span>
                  </div>
                )}
                <div className="relative">
                  <pre className="bg-bg-input border border-[var(--border)] rounded-md py-3 pl-3 pr-10 font-mono text-xs text-text-primary whitespace-pre-wrap break-all max-h-[180px] overflow-auto">
                    {wireValue || "â€”"}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton value={wireValue} />
                  </div>
                </div>
                {kind === "bitmap" && built.activeBits.length > 0 && (
                  <div className="text-xs text-text-tertiary mt-2">
                    {t("builder.activeBitsLabel")} <MonoText>{built.activeBits.join(", ")}</MonoText>
                  </div>
                )}
              </Tabs.Content>
            );
          })}
        </Tabs.Root>
      </CardBody>
    </Card>
  );
}
