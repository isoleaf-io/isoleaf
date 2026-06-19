import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { ParsedTree } from "@/components/Iso20022/ParsedTree";
import { MessageSummaryCard } from "@/components/Iso20022/MessageSummaryCard";
import {
  parseIso20022,
  type IncompatibleVersionError,
  type ParseResponse,
} from "@/api/iso20022";

type Translator = (key: string, options?: Record<string, unknown>) => string;

/**
 * Turns the mutation error into the user-facing string. For the version
 * mismatch case we compose a two-line message so users see both the explanation
 * and the list of accepted versions; everything else falls back to the axios
 * interceptor's "Error.message", which already extracts <c>data.detail</c> for
 * us at the client layer.
 */
function formatError(err: unknown, t: Translator): string | undefined {
  if (!err) return undefined;
  if (err instanceof AxiosError) {
    const data = err.response?.data as Partial<IncompatibleVersionError> | undefined;
    if (data && Array.isArray(data.compatibleVersions)) {
      // The backend already namespaces the versions (`urn:iso:...:pacs.002.001.11`);
      // strip the URN prefix so the list is readable.
      const versions = data.compatibleVersions
        .map((v) => v.split(":").pop() ?? v)
        .join(", ");
      const detail = data.detail ?? (err as Error).message;
      return versions.length > 0
        ? `${detail}\n\n${t("iso20022.parser.versionsSupported", { versions })}`
        : detail;
    }
  }
  return (err as Error).message;
}

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MSG-2024-001</MsgId>
      <CreDtTm>2024-01-15T10:30:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
  </FIToFICstmrCdtTrf>
</Document>`;

export default function Iso20022ParserPage() {
  const { t } = useTranslation();
  const [xml, setXml] = useState("");
  const [result, setResult] = useState<ParseResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (content: string) => parseIso20022(content),
    onSuccess: setResult,
  });
  const error = formatError(mutation.error, t);

  const handleXmlChange = (value: string) => {
    setXml(value);
    // Don't leave stale error/loading state once the user starts editing again.
    if (mutation.isPending || mutation.isError) mutation.reset();
  };

  const handleLoadSample = () => {
    setXml(SAMPLE_XML);
    setResult(null);
    mutation.reset();
  };

  const handleClear = () => {
    setXml("");
    setResult(null);
    mutation.reset();
  };

  return (
    <AppShell title={t("iso20022.parser.title")} subtitle={t("iso20022.parser.subtitle")}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 w-full">
              <span className="text-sm font-semibold">{t("iso20022.parser.inputLabel")}</span>
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-xs text-accent hover:opacity-80 transition-opacity"
              >
                {t("iso20022.parser.loadSample")}
              </button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <textarea
              value={xml}
              onChange={(e) => handleXmlChange(e.target.value)}
              placeholder={t("iso20022.parser.placeholder")}
              className="w-full min-h-[200px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              spellCheck={false}
              data-testid="iso20022-xml-input"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => mutation.mutate(xml)}
                disabled={!xml.trim() || mutation.isPending}
                data-testid="iso20022-parse-button"
              >
                {mutation.isPending ? t("common.loading") : `${t("common.parse")} →`}
              </Button>
              <Button variant="secondary" onClick={handleClear} disabled={!xml && !result}>
                <RotateCcw size={13} /> {t("common.clear")}
              </Button>
            </div>
            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>

        {result && (
          <div className="space-y-4" data-testid="iso20022-result">
            {/* Summary first — gives the user the "what does this message mean" at a glance. */}
            <MessageSummaryCard messageType={result.messageType} summary={result.summary} />

            {/* Then the raw tree for deep inspection. */}
            <Card>
              <CardHeader>
                <span className="text-sm font-semibold">{t("iso20022.parser.resultTitle")}</span>
              </CardHeader>
              <CardBody>
                <div className="bg-bg-input border border-[var(--border)] rounded-md p-3 overflow-x-auto">
                  <ParsedTree node={result.root} defaultExpanded />
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
