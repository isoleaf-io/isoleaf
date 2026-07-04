import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import {
  parseMtMessage,
  type MtBlock,
  type MtField,
  type MtFieldConfidence,
  type MtParseResult,
} from "@/api/swiftMt";
import { MappingWorkflow } from "@/components/SwiftMt/MappingWorkflow";

const SESSION_KEY = "swift-mt-parser:payload";

type PageMode = "parse" | "convert";

export default function MtParserPage() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<MtParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  // FlowVisualizer ("Abrir no Parser MT") stashes the payload in
  // sessionStorage before navigating here. Reading it in a useState
  // initializer only worked on the first mount — if the user opened
  // MtParser via the sidebar, then navigated to /flow and clicked
  // "Abrir no Parser MT", the component was still mounted and the
  // initializer never ran a second time. Reacting to `location`
  // re-runs on every navigation into this route (or search-string
  // change), regardless of whether the component was already mounted.
  useEffect(() => {
    try {
      const payload = sessionStorage.getItem(SESSION_KEY);
      if (payload) {
        setRaw(payload);
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch { /* private mode / quota — silent */ }
  }, [location]);
  // The Parser view has two modes: showing the parsed blocks (default),
  // or showing the MT→MX mapping workflow triggered by the CTA that
  // now lives right next to the "Parsear →" button. Switching back
  // preserves the parsed blocks so the user doesn't lose their work.
  const [mode, setMode] = useState<PageMode>("parse");

  async function handleParse() {
    setError(null);
    setLoading(true);
    setMode("parse");
    try {
      setResult(await parseMtMessage(raw));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title="SWIFT MT Parser"
      subtitle="Decodifique mensagens MT103, MT202 e MT202COV campo por campo, com mapeamento MT→MX e indicação de confiança por campo."
    >
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">Mensagem MT</span>
          </CardHeader>
          <CardBody className="space-y-2">
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={14}
              className="w-full px-2 py-1.5 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent"
              data-testid="mt-parser-input"
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleParse} disabled={loading || !raw.trim()} data-testid="mt-parser-submit">
                {loading ? "Parseando..." : "Parsear →"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setRaw(""); setResult(null); setMode("parse"); }}
              >
                Limpar
              </Button>
              {/* Sprint 9.2 — CTA promoted next to "Parsear" so the
                  user sees the follow-up flow without scrolling past
                  the parsed blocks. In "convert" mode the same slot
                  hosts the "back to parse" action. */}
              {result && mode === "parse" && (
                <Button
                  variant="secondary"
                  className="ml-auto"
                  onClick={() => setMode("convert")}
                  data-testid="mt-parser-convert"
                >
                  → Converter para MX
                </Button>
              )}
              {result && mode === "convert" && (
                <Button
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setMode("parse")}
                  data-testid="mt-parser-back"
                >
                  ← Voltar ao parse
                </Button>
              )}
            </div>
            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>

        {result && mode === "parse" && (
          <>
            <SummaryCard result={result} />
            {result.warnings.length > 0 && <WarningsCard warnings={result.warnings} />}
            {result.blocks.map((b) => (
              <BlockCard key={b.blockId} block={b} />
            ))}
          </>
        )}

        {result && mode === "convert" && (
          // autoStart=true skips the widget's own CTA — the user already
          // committed to converting by clicking the header button.
          <MappingWorkflow rawMessage={raw} autoStart />
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ result }: { result: MtParseResult }) {
  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">Resumo</span>
      </CardHeader>
      <CardBody className="flex flex-wrap items-center gap-3 text-xs">
        <Badge tone="accent">{result.messageType}</Badge>
        <SummaryItem label="Remetente" value={result.sender} mono />
        <SummaryItem label="Destinatário" value={result.receiver} mono />
        <SummaryItem label="UETR" value={result.uetr} mono />
      </CardBody>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-text-tertiary">{label}:</span>
      <span className={mono ? "font-mono" : ""}>{value ?? "—"}</span>
    </div>
  );
}

function WarningsCard({ warnings }: { warnings: string[] }) {
  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold text-warning-text">Avisos do parser</span>
      </CardHeader>
      <CardBody className="space-y-1 text-xs">
        {warnings.map((w, i) => (
          <p key={i} className="text-warning-text">⚠ {w}</p>
        ))}
      </CardBody>
    </Card>
  );
}

function BlockCard({ block }: { block: MtBlock }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold"
        >
          <span>
            Bloco {block.blockId} — {block.name}
          </span>
          <span className="text-text-tertiary text-xs">
            {block.fields.length} campo{block.fields.length === 1 ? "" : "s"} · {open ? "▾" : "▸"}
          </span>
        </button>
      </CardHeader>
      {open && (
        <CardBody className="space-y-3 text-xs">
          {block.fields.map((f, i) => (
            <FieldRow key={`${f.tag}-${i}`} field={f} />
          ))}
        </CardBody>
      )}
    </Card>
  );
}

function FieldRow({ field }: { field: MtField }) {
  return (
    <div className="border border-[var(--border)] rounded-md p-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] bg-bg-input px-1.5 py-0.5 rounded">
          :{field.tag}:
        </span>
        <span className="font-medium">{field.name}</span>
        <ConfidenceBadge confidence={field.confidence} />
        {field.mxPath && (
          <span className="text-text-tertiary">
            → <span className="font-mono">{field.mxPath}</span>
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-tertiary">{field.description}</p>
      <pre className="font-mono text-[11px] whitespace-pre-wrap bg-bg-input p-1.5 rounded">
        {field.rawValue}
      </pre>

      {field.subFields.length > 0 && (
        <div className="mt-1 pl-3 border-l border-[var(--border)] space-y-1">
          {field.subFields.map((sf, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {sf.subId && <span className="text-text-tertiary">{sf.subId}:</span>}
              <span className="font-mono">{sf.parsedValue ?? sf.rawValue}</span>
              {sf.mxPath && (
                <span className="text-text-tertiary">
                  → <span className="font-mono">{sf.mxPath}</span>
                  {sf.mxValue && <> = <span className="font-mono">{sf.mxValue}</span></>}
                </span>
              )}
              <ConfidenceBadge confidence={sf.confidence} compact />
            </div>
          ))}
        </div>
      )}

      {field.confidence === "ambiguous" && field.mxAlternatives.length > 0 && (
        <details className="text-[11px] mt-1">
          <summary className="cursor-pointer text-warning-text">
            ⚠ {field.mxAlternatives.length} alternativas MX possíveis
          </summary>
          <ul className="mt-1 pl-3 space-y-0.5">
            {field.mxAlternatives.map((alt) => (
              <li key={alt} className="font-mono">{alt}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ConfidenceBadge({
  confidence,
  compact,
}: {
  confidence: MtFieldConfidence;
  compact?: boolean;
}) {
  if (confidence === "automatic") {
    return <Badge tone="success">{compact ? "✅" : "✅ Automático"}</Badge>;
  }
  if (confidence === "ambiguous") {
    return <Badge tone="warning">{compact ? "⚠" : "⚠ Ambíguo"}</Badge>;
  }
  return <Badge tone="neutral">{compact ? "—" : "— Sem MX"}</Badge>;
}
