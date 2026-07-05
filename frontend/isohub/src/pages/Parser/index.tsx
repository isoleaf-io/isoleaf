import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { IsoInput } from "./IsoInput";
import { ParseResult } from "./ParseResult";
import { stripCommonSeparators } from "./stripSeparators";
import { parseHex } from "@/api/parse";
import type { IsoParseResponse } from "@/types";

export default function ParserPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<IsoParseResponse | null>(null);
  const [separatorsStripped, setSeparatorsStripped] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const mutation = useMutation({
    mutationFn: (hex: string) => parseHex(hex),
    onSuccess: setResult,
  });

  const onParse = () => {
    if (!input.trim()) return;
    const { cleaned, removed } = stripCommonSeparators(input);
    setSeparatorsStripped(removed);
    mutation.mutate(cleaned);
  };

  // Hydrate from navigation state when arriving via "Open in Parser" buttons
  // (Builder, EMV Build Response, EMV Full Flow). Auto-parse once, then strip
  // the state so a refresh doesn't re-fire.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    const auto = (location.state as { autoMessage?: string } | null)?.autoMessage;
    if (auto) {
      hydrated.current = true;
      setInput(auto);
      const { cleaned, removed } = stripCommonSeparators(auto);
      setSeparatorsStripped(removed);
      mutation.mutate(cleaned);
      window.history.replaceState({}, "");
    }
  }, [location.state, mutation]);

  // Sprint 9.4 — Flow Visualizer ("Abrir no Parser ISO 8583") stashes
  // the raw wire in sessionStorage before navigating here. Reacting to
  // `location` re-runs on every navigation into this route regardless
  // of whether the component was already mounted (the react-router
  // caches instances by path).
  useEffect(() => {
    try {
      const payload = sessionStorage.getItem("iso8583-parser:payload");
      if (payload) {
        sessionStorage.removeItem("iso8583-parser:payload");
        setInput(payload);
        const { cleaned, removed } = stripCommonSeparators(payload);
        setSeparatorsStripped(removed);
        mutation.mutate(cleaned);
      }
    } catch { /* private mode / quota — silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const onClear = () => {
    setInput("");
    setResult(null);
    setSeparatorsStripped(false);
    mutation.reset();
  };

  // Network / transport-level errors surface in `mutation.error`. Parser
  // failures (which now carry structured info + partial fields) surface
  // inside `result` itself — the ParseResult component renders the rich
  // view, so we only fall back to the banner for the transport case.
  const transportError = (mutation.error as Error | undefined)?.message ?? null;

  return (
    <AppShell title={t("parser.title")} subtitle={t("parser.subtitle")}>
      <div className="space-y-6">
        <Card>
          <CardBody>
            <IsoInput
              value={input}
              onChange={setInput}
              onParse={onParse}
              onClear={onClear}
              loading={mutation.isPending}
              tpduDetected={!!result?.tpdu}
            />
          </CardBody>
        </Card>

        {separatorsStripped && result?.success && (
          <div className="text-xs text-text-tertiary italic">
            {t("parser.separatorsStripped")}
          </div>
        )}

        {transportError && <ErrorBanner message={transportError} />}

        {result && (
          <ParseResult
            result={result}
            cleanedInput={stripCommonSeparators(input).cleaned}
            onOpenInBuilder={
              result.success
                ? () =>
                    navigate("/builder", {
                      state: {
                        fromParser: {
                          mti: result.mti,
                          fields: (result.fields ?? []).map((f) => ({
                            bitNumber: f.bitNumber,
                            value: f.value,
                            name: f.name,
                            type: f.type ?? "",
                            length: f.length ?? f.value?.length ?? 0,
                          })),
                          // Send the input that was actually parsed (post-separator-strip)
                          // so the Builder can display it as the preview without
                          // forcing a Generate round-trip.
                          originalWire: stripCommonSeparators(input).cleaned,
                        },
                      },
                    })
                : undefined
            }
          />
        )}
        {!result && !mutation.isPending && !transportError && (
          <Card>
            <CardBody className="text-center text-sm text-text-tertiary py-12">
              {t("parser.noResult")}
            </CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
