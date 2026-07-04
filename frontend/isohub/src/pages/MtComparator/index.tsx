import { useCallback, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import {
  compareMtMx,
  type MtMxCompareResult,
  type MtMxCompareRow,
  type MtMxCompareStatus,
} from "@/api/swiftMtMx";

/**
 * Sprint 9.2 fix #2 — page is now a single-purpose comparator (former
 * "Modo B"). The MT→MX conversion flow ("Modo A") moved to the MT
 * Parser page as an inline follow-up, so this screen no longer has tabs.
 */
export default function MtComparatorPage() {
  const [mt, setMt] = useState("");
  const [mx, setMx] = useState("");
  const [result, setResult] = useState<MtMxCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setResult(await compareMtMx(mt, mx));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [mt, mx]);

  return (
    <AppShell
      title="Comparador MT↔MX"
      subtitle="Compare uma mensagem SWIFT MT contra o XML MX equivalente e veja onde os campos concordam ou divergem."
    >
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">Cole as duas mensagens</span>
          </CardHeader>
          <CardBody className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-text-tertiary">Mensagem MT</span>
              <textarea
                value={mt}
                onChange={(e) => setMt(e.target.value)}
                rows={14}
                className="w-full px-2 py-1.5 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[11px]"
                data-testid="mt-compare-mt"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-text-tertiary">Mensagem MX (XML)</span>
              <textarea
                value={mx}
                onChange={(e) => setMx(e.target.value)}
                rows={14}
                className="w-full px-2 py-1.5 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[11px]"
                data-testid="mt-compare-mx"
              />
            </div>
            <div className="lg:col-span-2 flex gap-2">
              <Button
                onClick={handleCompare}
                disabled={loading || !mt.trim() || !mx.trim()}
                data-testid="mt-compare-submit"
              >
                {loading ? "Comparando..." : "Comparar →"}
              </Button>
              <Button variant="ghost" onClick={() => { setMt(""); setMx(""); setResult(null); }}>
                Limpar
              </Button>
            </div>
            {error && <div className="lg:col-span-2"><ErrorBanner message={error} /></div>}
          </CardBody>
        </Card>

        {result && <CompareSummary result={result} />}
        {result && <CompareTable rows={result.rows} />}
      </div>
    </AppShell>
  );
}

function CompareSummary({ result }: { result: MtMxCompareResult }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
      <SummaryCard label="Total" value={result.rows.length} tone="neutral" />
      <SummaryCard label="✅ Compatíveis" value={result.matchCount} tone="success" />
      <SummaryCard label="⚠️ Divergentes" value={result.divergenceCount} tone="warning" />
      <SummaryCard label="✗ Só no MT" value={result.onlyInMtCount} tone="danger" />
      <SummaryCard label="ℹ Só no MX" value={result.onlyInMxCount} tone="accent" />
      <div className="col-span-2 md:col-span-5 flex items-center gap-2">
        <span className="text-text-tertiary">Veredito:</span>
        <Badge tone={result.isCompatible ? "success" : "danger"}>
          {result.isCompatible ? "Compatível" : "Incompatível"}
        </Badge>
        <span className="text-text-tertiary">
          {result.mtMessageType} → {result.mxMessageType}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-bg-input p-2">
      <div className="text-text-tertiary">{label}</div>
      <div className="text-base font-semibold">
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  );
}

function CompareTable({ rows }: { rows: MtMxCompareRow[] }) {
  const sorted = useMemo(() => {
    const priority: Record<MtMxCompareStatus, number> = {
      diverge: 0, onlyInMt: 1, onlyInMx: 2, match: 3,
    };
    return [...rows].sort((a, b) => priority[a.status] - priority[b.status]);
  }, [rows]);
  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">Comparação campo a campo</span>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-text-tertiary">
              <th className="py-1 pr-2">Tag MT</th>
              <th className="py-1 pr-2">Valor MT</th>
              <th className="py-1 pr-2">Campo MX</th>
              <th className="py-1 pr-2">Valor MX</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className={`border-t border-[var(--border)] ${rowBg(r.status)}`}>
                <td className="py-1 pr-2 font-mono">
                  {r.mtTag}
                  {r.mtSubId && <span className="text-text-tertiary"> · {r.mtSubId}</span>}
                </td>
                <td className="py-1 pr-2 font-mono">{r.mtValue ?? "—"}</td>
                <td className="py-1 pr-2 font-mono">{r.mxPath}</td>
                <td className="py-1 pr-2 font-mono">{r.mxValue ?? "—"}</td>
                <td className="py-1">
                  <CompareStatusBadge status={r.status} note={r.note} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function rowBg(status: MtMxCompareStatus): string {
  switch (status) {
    case "match": return "bg-green-500/5";
    case "diverge": return "bg-yellow-500/10";
    case "onlyInMt": return "bg-red-500/5";
    case "onlyInMx": return "bg-blue-500/5";
  }
}

function CompareStatusBadge({
  status,
  note,
}: {
  status: MtMxCompareStatus;
  note: string | null;
}) {
  const label = status === "match" ? "✅ Match"
    : status === "diverge" ? "⚠️ Diverge"
    : status === "onlyInMt" ? "✗ Só MT"
    : "ℹ Só MX";
  const tone = status === "match" ? "success"
    : status === "diverge" ? "warning"
    : status === "onlyInMt" ? "danger"
    : "accent";
  return (
    <div className="flex items-center gap-2">
      <Badge tone={tone}>{label}</Badge>
      {note && <span className="text-text-tertiary text-[10px]">{note}</span>}
    </div>
  );
}
