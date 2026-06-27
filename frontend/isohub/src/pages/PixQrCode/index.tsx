import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Copy, QrCode, RefreshCw, ScanLine, XCircle } from "lucide-react";
import QRCode from "qrcode";
import clsx from "clsx";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import {
  analyzePixKey,
  decodePixPayload,
  generatePixPayload,
  generatePixTxId,
  type PixDecodeResult,
  type PixField,
  type PixKeyAnalysis,
} from "@/api/pix";

type Tab = "decode" | "generate";

export default function PixQrCodePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("decode");
  const [pendingDecodePayload, setPendingDecodePayload] = useState<string | null>(null);

  return (
    <AppShell
      title={t("pix.qrcode.title")}
      subtitle={t("pix.qrcode.subtitle")}
    >
      <div className="space-y-4">
        <div className="flex gap-1 border-b border-[var(--border)]">
          <TabButton active={tab === "decode"} onClick={() => setTab("decode")}>
            <ScanLine size={13} /> {t("pix.qrcode.tabs.decode")}
          </TabButton>
          <TabButton active={tab === "generate"} onClick={() => setTab("generate")}>
            <QrCode size={13} /> {t("pix.qrcode.tabs.generate")}
          </TabButton>
        </div>

        {tab === "decode" ? (
          <DecodePane
            initialPayload={pendingDecodePayload}
            onConsumed={() => setPendingDecodePayload(null)}
          />
        ) : (
          <GeneratePane
            onDecodeRequested={(payload) => {
              setPendingDecodePayload(payload);
              setTab("decode");
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1 px-3 py-2 text-xs border-b-2 -mb-px transition-colors",
        active
          ? "border-accent text-text-primary font-medium"
          : "border-transparent text-text-secondary hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

// ─── Decode pane ────────────────────────────────────────────────────────────

function DecodePane({
  initialPayload,
  onConsumed,
}: {
  initialPayload: string | null;
  onConsumed: () => void;
}) {
  const { t } = useTranslation();
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState<PixDecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-load payload handed off from the Generate pane via the page state.
  useEffect(() => {
    if (!initialPayload) return;
    setPayload(initialPayload);
    setError(null);
    setLoading(true);
    decodePixPayload(initialPayload)
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setLoading(false);
        onConsumed();
      });
  }, [initialPayload, onConsumed]);

  async function handleDecode() {
    if (!payload.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await decodePixPayload(payload));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold">{t("pix.qrcode.decode.inputLabel")}</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder={t("pix.qrcode.decode.placeholder")}
            className="w-full h-32 p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[11px] resize-y focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent"
            data-testid="pix-decode-input"
          />
          <Button onClick={handleDecode} disabled={!payload.trim() || loading}>
            <ScanLine size={13} /> {loading ? t("common.loading") : t("pix.qrcode.decode.button")}
          </Button>
          {error && <ErrorBanner message={error} />}
        </CardBody>
      </Card>

      {result && <DecodeSummary result={result} />}
      {result && result.fields.length > 0 && <FieldsTable fields={result.fields} />}
    </div>
  );
}

function DecodeSummary({ result }: { result: PixDecodeResult }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-sm font-semibold">{t("pix.qrcode.decode.summaryTitle")}</span>
          <Badge tone={result.crcValid ? "success" : "danger"}>
            {result.crcValid ? (
              <>
                <CheckCircle2 size={12} /> CRC OK
              </>
            ) : (
              <>
                <XCircle size={12} /> CRC inválido
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <SummaryRow label={t("pix.qrcode.fields.qrType")} value={result.qrType === "dynamic" ? "Dinâmico" : "Estático"} />
          <SummaryRow
            label={t("pix.qrcode.fields.pixKey")}
            value={result.pixKey}
            after={result.pixKeyType && <Badge tone="neutral">{result.pixKeyType}</Badge>}
          />
          <SummaryRow label={t("pix.qrcode.fields.merchantName")} value={result.merchantName} />
          <SummaryRow label={t("pix.qrcode.fields.merchantCity")} value={result.merchantCity} />
          <SummaryRow label={t("pix.qrcode.fields.amount")} value={formatAmountBrl(result.amount)} />
          <TxIdRow label={t("pix.qrcode.fields.txId")} txId={result.txId} />
        </div>
        {result.warnings.length > 0 && (
          <div className="rounded-md border border-warning-text/40 bg-warning-bg/30 p-2 text-xs space-y-1">
            {result.warnings.map((w, i) => (
              <div key={i} className="text-warning-text">⚠ {w}</div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Backend hands the amount back as the raw EMV string ("452.00"). Render
// it as Brazilian currency for the summary card; fall back to the raw
// value if it's not a finite number so unexpected payloads don't blank
// out the row.
function formatAmountBrl(amount: string | null): string | null {
  if (amount == null || amount.trim() === "") return null;
  const n = Number(amount.replace(",", "."));
  if (!Number.isFinite(n)) return amount;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * TXID summary row with inline format validation. The backend echoes the
 * EMV value back as-is — "***" is the BCB sentinel for "not assigned",
 * which we surface as "Não informado" instead of a code-like row. Real
 * TXIDs go through the same regex shape as ValidateTxId on the backend
 * (26–35 chars, [a-zA-Z0-9]) so the user gets immediate feedback without
 * a round-trip.
 */
function TxIdRow({ label, txId }: { label: string; txId: string | null }) {
  const isSentinel = txId === "***";
  if (!txId || isSentinel) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
        <span className="text-text-tertiary italic">Não informado</span>
      </div>
    );
  }
  const v = validateTxIdInline(txId);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
      <span className="flex items-center gap-2 flex-wrap">
        <span className="font-mono break-all">{txId}</span>
        {v.kind === "ok" ? (
          <Badge tone="success">✓ Formato válido</Badge>
        ) : (
          <Badge tone="warning">⚠ {v.message}</Badge>
        )}
      </span>
    </div>
  );
}

function validateTxIdInline(txId: string): { kind: "ok" } | { kind: "warn"; message: string } {
  if (/^[a-zA-Z0-9]{26,35}$/.test(txId)) return { kind: "ok" };
  if (!/^[a-zA-Z0-9]*$/.test(txId)) return { kind: "warn", message: "Caracteres inválidos" };
  if (txId.length < 26) return { kind: "warn", message: `Muito curto (${txId.length} chars, mínimo 26)` };
  return { kind: "warn", message: `Muito longo (${txId.length} chars, máximo 35)` };
}

function SummaryRow({
  label,
  value,
  after,
  mono,
}: {
  label: string;
  value: string | null;
  after?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
      <span className="flex items-center gap-2">
        <span className={clsx(mono && "font-mono", !value && "text-text-tertiary italic")}>
          {value || "—"}
        </span>
        {after}
      </span>
    </div>
  );
}

function FieldsTable({ fields }: { fields: PixField[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">{t("pix.qrcode.decode.fieldsTitle")}</span>
      </CardHeader>
      <CardBody>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-text-tertiary">
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-1 pr-2 w-12">ID</th>
              <th className="text-left py-1 pr-2">Nome</th>
              <th className="text-left py-1 pr-2">Valor</th>
              <th className="text-left py-1">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {fields.flatMap((f) => renderRows(f, 0))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function renderRows(f: PixField, depth: number): React.ReactNode[] {
  const rows: React.ReactNode[] = [
    <tr key={f.id + "-" + depth} className="border-b border-[var(--border)] last:border-b-0">
      <td className="py-1 pr-2 font-mono text-text-tertiary">{f.id}</td>
      <td className="py-1 pr-2" style={{ paddingLeft: depth * 16 }}>{f.name}</td>
      <td className="py-1 pr-2 font-mono break-all">{f.value}</td>
      <td className="py-1 text-text-tertiary">{f.description}</td>
    </tr>,
  ];
  for (const sub of f.subFields) rows.push(...renderRows(sub, depth + 1));
  return rows;
}

// ─── Generate pane ──────────────────────────────────────────────────────────

function GeneratePane({ onDecodeRequested }: { onDecodeRequested: (payload: string) => void }) {
  const { t } = useTranslation();
  const [pixKey, setPixKey] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [amount, setAmount] = useState("");
  // Toggles between raw editing ("123" / "123,45") and the formatted BRL
  // display ("R$ 123,45") so the field reads as currency at rest but is
  // still easy to edit on focus.
  const [amountFocused, setAmountFocused] = useState(false);
  const [description, setDescription] = useState("");
  const [txId, setTxId] = useState("");
  const [singleUse, setSingleUse] = useState(false);
  const [payload, setPayload] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live key analysis on blur — the badge + warnings show inline below the
  // input without blocking input editing.
  const [keyAnalysis, setKeyAnalysis] = useState<PixKeyAnalysis | null>(null);
  const analyseKey = useCallback(async () => {
    const trimmed = pixKey.trim();
    if (!trimmed) {
      setKeyAnalysis(null);
      return;
    }
    try {
      setKeyAnalysis(await analyzePixKey(trimmed));
    } catch {
      setKeyAnalysis(null);
    }
  }, [pixKey]);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      const parsedAmount = amount.trim() ? Number(amount.replace(",", ".")) : null;
      const p = await generatePixPayload({
        pixKey: pixKey.trim(),
        merchantName: merchantName.trim(),
        merchantCity: merchantCity.trim(),
        amount: parsedAmount && !Number.isNaN(parsedAmount) ? parsedAmount : null,
        txId: txId.trim() || null,
        description: description.trim() || null,
        singleUse,
      });
      setPayload(p);
      // QR code rendering — square 256x256 PNG data-url, low margin.
      const url = await QRCode.toDataURL(p, { margin: 1, width: 256 });
      setQrDataUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTxId() {
    try {
      setTxId(await generatePixTxId());
    } catch {
      // ignore — TXID gen is fire-and-forget UX
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard rejection (e.g. Safari over http) — silently swallow
    }
  }

  const inputCls =
    "w-full px-2 py-1.5 rounded-md bg-bg-input border border-[var(--border)] text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold">{t("pix.qrcode.generate.formTitle")}</span>
        </CardHeader>
        <CardBody className="space-y-3 text-xs">
          <Field label={t("pix.qrcode.fields.pixKey")}>
            <input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              onBlur={analyseKey}
              className={inputCls}
              data-testid="pix-generate-key"
            />
            {/* The backend's analyser only recognises phones with the
                +55 prefix and CPF/CNPJ as digits-only. Tell the user up
                front so the live badge below doesn't surprise them. */}
            <p className="mt-1 text-[10px] text-text-tertiary">
              CPF (11 dígitos), CNPJ (14 dígitos), email, telefone (+5511999999999) ou EVP (UUID).
            </p>
            {keyAnalysis && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <Badge tone={keyAnalysis.keyType === "UNKNOWN" ? "danger" : "neutral"}>
                  {keyAnalysis.keyType}
                </Badge>
                {keyAnalysis.warnings.map((w, i) => (
                  <span key={i} className="text-warning-text">⚠ {w}</span>
                ))}
              </div>
            )}
          </Field>
          <Field label={t("pix.qrcode.fields.merchantName")}>
            <input
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              maxLength={25}
              className={inputCls}
            />
          </Field>
          <Field label={t("pix.qrcode.fields.merchantCity")}>
            <input
              value={merchantCity}
              onChange={(e) => setMerchantCity(e.target.value)}
              maxLength={15}
              className={inputCls}
            />
          </Field>
          <Field label={t("pix.qrcode.fields.amount") + " (opcional)"}>
            <input
              value={amountFocused ? amount : formatAmountBrl(amount) ?? ""}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              placeholder="R$ 0,00"
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field label={t("pix.qrcode.fields.description") + " (opcional)"}>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t("pix.qrcode.fields.txId") + " (opcional)"}>
            <div className="flex gap-1">
              <input
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                className={inputCls}
              />
              <button
                type="button"
                onClick={handleGenerateTxId}
                title={t("pix.qrcode.generate.generateTxId")}
                className="shrink-0 p-1.5 rounded-md border border-[var(--border)] text-text-tertiary hover:text-accent-text hover:bg-bg-tertiary transition-colors"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </Field>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={singleUse}
              onChange={(e) => setSingleUse(e.target.checked)}
            />
            {t("pix.qrcode.generate.singleUse")}
          </label>
          <Button onClick={handleGenerate} disabled={loading} className="w-full justify-center">
            <QrCode size={13} /> {loading ? t("common.loading") : t("pix.qrcode.generate.button")}
          </Button>
          {error && <ErrorBanner message={error} />}
        </CardBody>
      </Card>

      {payload && (
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("pix.qrcode.generate.previewTitle")}</span>
          </CardHeader>
          <CardBody className="space-y-3">
            {qrDataUrl && (
              <div className="flex justify-center bg-white p-3 rounded-md">
                <img src={qrDataUrl} alt="QR Code Pix" className="w-64 h-64" />
              </div>
            )}
            <textarea
              value={payload}
              readOnly
              className="w-full h-32 p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[11px] resize-none focus:outline-none"
              data-testid="pix-generate-payload"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleCopy}>
                <Copy size={13} /> {copied ? "Copiado!" : t("pix.qrcode.generate.copy")}
              </Button>
              <Button variant="secondary" onClick={() => onDecodeRequested(payload)}>
                <ScanLine size={13} /> {t("pix.qrcode.generate.decode")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</span>
      {children}
    </label>
  );
}
