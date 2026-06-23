import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { CheckCircle2, GitCompare, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { MonoText } from "@/components/ui/MonoText";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { ParsedTree } from "@/components/Iso20022/ParsedTree";
import { MessageSummaryCard } from "@/components/Iso20022/MessageSummaryCard";
import { VersionComparatorModal } from "@/components/Iso20022/VersionComparatorModal";
import { FEATURES } from "@/config/features";
import {
  parseIso20022,
  validateIso20022,
  type IncompatibleVersionError,
  type ParsedNode,
  type ParseResponse,
  type ValidateResponse,
} from "@/api/iso20022";
import { listMessageTypes } from "@/api/iso20022Reference";

type Translator = (key: string, options?: Record<string, unknown>) => string;

/**
 * Walks the parsed tree and returns every element-level XPath, skipping the
 * <Document> wrapper (whose path the validator doesn't surface) and
 * attribute children (no XPath of their own). Used to drive the version
 * comparator's "impact on your message" filter.
 */
function extractXPaths(node: ParsedNode, parent = ""): string[] {
  if (node.name === "Document") return node.children.flatMap((c) => extractXPaths(c, ""));
  if (node.name.startsWith("@")) return [];
  const current = parent ? `${parent}/${node.name}` : node.name;
  return [current, ...node.children.flatMap((c) => extractXPaths(c, current))];
}

/**
 * Pulls the element names out of the .NET schema engine's
 * <c>'X' in namespace 'urn:...'</c> list. We only keep the names that look
 * like XML element identifiers — namespaces and URIs are filtered out.
 */
function extractExpectedNames(tail: string): string[] {
  const names: string[] = [];
  const re = /'([^']+)'\s+in\s+namespace/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail)) !== null) names.push(m[1]);
  return names;
}

/**
 * Turns the .NET XmlSchema validator's verbose technical message into a
 * concise, user-friendly Portuguese line. Recognises the four most common
 * error families produced by the engine; falls back to the raw message
 * (truncated) when nothing matches so the user still sees something useful.
 */
export function formatValidationMessage(message: string): string {
  const parts: string[] = [];

  const childMatch = message.match(/has invalid child element '([^']+)'/);
  const notInContext = /is not valid in the context/i.test(message);
  const isFacet =
    /is not facet-valid/i.test(message) ||
    /not valid with respect to/i.test(message);

  // "The '{ns}:{element}' element is invalid - The value '{X}' is invalid …"
  // This shape carries both the offending value and the offending element
  // name in a single sentence — much friendlier than the generic facet
  // branch's "tipo Max15NumericText". Checked first so it wins over the
  // facet fallback below.
  const elementInvalidMatch = message.match(
    /The '([^']+)' element is invalid\s*-\s*The value '([^']+)' is invalid/i,
  );

  if (elementInvalidMatch) {
    const fullName = elementInvalidMatch[1];
    const element = fullName.split(":").pop() ?? fullName;
    const value = elementInvalidMatch[2];
    parts.push(`Valor '${value}' inválido para o elemento '${element}'.`);
  } else if (childMatch) {
    parts.push(
      `Elemento '${childMatch[1]}' está fora de ordem ou não é permitido aqui.`,
    );
  } else if (notInContext) {
    parts.push("Elemento não permitido neste contexto.");
  } else if (isFacet) {
    // Facet/value errors phrase the offending value as `value 'X'` or just `'X'`.
    const valueMatch =
      message.match(/value\s+'([^']+)'/i) ??
      message.match(/'([^']+)'\s+is\s+(?:invalid|not\s+valid)/i);
    // Datatype name is the last segment after a namespace separator (':' or '.').
    const typeMatch = message.match(/datatype\s+'[^']*[:.]([^':.]+)'/i);
    const value = valueMatch?.[1];
    const type = typeMatch?.[1];
    if (value && type) parts.push(`Valor '${value}' inválido para o tipo ${type}.`);
    else if (value) parts.push(`Valor '${value}' inválido.`);
    else parts.push(message.length > 200 ? message.slice(0, 200) + "…" : message);
  } else {
    parts.push(message.length > 200 ? message.slice(0, 200) + "…" : message);
  }

  // Additive: append the "expected" suggestion when the engine lists one —
  // but suppress it for the "invalid child element" family, where the list
  // tends to be a long parade of internal type names that don't help the
  // user. The friendly sentence already covers the actionable info.
  if (!childMatch) {
    const expectedMatch = message.match(/List of possible elements expected:\s*(.+?)\.?\s*$/);
    if (expectedMatch) {
      const names = extractExpectedNames(expectedMatch[1]);
      if (names.length > 0) {
        const visible = names.slice(0, 5).join(", ");
        const tail = names.length > 5 ? ` e mais ${names.length - 5}` : "";
        parts.push(`Posição esperada após: ${visible}${tail}.`);
      }
    }
  }

  return parts.join("\n");
}

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

export default function Iso20022ParserPage() {
  const { t } = useTranslation();
  const [xml, setXml] = useState("");
  const [result, setResult] = useState<ParseResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (content: string) => parseIso20022(content),
    onSuccess: setResult,
  });
  const error = formatError(mutation.error, t);

  // Validation against the embedded XSD — gated by the 6.3 flag so it's only
  // active when the validator service has shipped.
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const validateMutation = useMutation({
    mutationFn: (content: string) => validateIso20022(content, result?.messageType),
    onSuccess: setValidation,
  });

  // Comparator modal — fetches the catalogue once when the parser feature is
  // enabled, lazily, so the modal can hydrate its dropdowns instantly.
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const [messageTypes, setMessageTypes] = useState<string[]>([]);
  useEffect(() => {
    if (!FEATURES.iso20022Comparator) return;
    listMessageTypes()
      .then((d) => setMessageTypes(d.messageTypes))
      .catch(() => {/* keep the dropdowns empty; the modal still opens */});
  }, []);

  const handleXmlChange = (value: string) => {
    setXml(value);
    // Don't leave stale error/loading/validation state once editing resumes.
    if (mutation.isPending || mutation.isError) mutation.reset();
    setValidation(null);
  };

  const handleClear = () => {
    setXml("");
    setResult(null);
    setValidation(null);
    mutation.reset();
  };

  return (
    <AppShell title={t("iso20022.parser.title")} subtitle={t("iso20022.parser.subtitle")}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("iso20022.parser.inputLabel")}</span>
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
            <div className="flex gap-2 flex-wrap items-center">
              <Button
                onClick={() => mutation.mutate(xml)}
                disabled={!xml.trim() || mutation.isPending}
                data-testid="iso20022-parse-button"
              >
                {mutation.isPending ? t("common.loading") : `${t("common.parse")} →`}
              </Button>
              {FEATURES.iso20022Validator && result && (
                <Button
                  variant="secondary"
                  onClick={() => validateMutation.mutate(xml)}
                  disabled={validateMutation.isPending}
                  data-testid="iso20022-validate-button"
                >
                  <ShieldCheck size={13} />{" "}
                  {validateMutation.isPending ? t("common.loading") : "Validar"}
                </Button>
              )}
              {FEATURES.iso20022Comparator && result && (
                <Button
                  variant="secondary"
                  onClick={() => setComparatorOpen(true)}
                  data-testid="iso20022-compare-button"
                >
                  <GitCompare size={13} /> Comparar versão
                </Button>
              )}
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

            {/* Validation outcome — only when the user has clicked "Validar". */}
            {validation && <ValidationResultBlock validation={validation} />}

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

      {FEATURES.iso20022Comparator && (
        <VersionComparatorModal
          open={comparatorOpen}
          onClose={() => setComparatorOpen(false)}
          messageTypes={messageTypes}
          lockedFromVersion={result?.messageType}
          currentXPaths={result ? extractXPaths(result.root) : []}
        />
      )}
    </AppShell>
  );
}

function ValidationResultBlock({ validation }: { validation: ValidateResponse }) {
  if (validation.isValid) {
    return (
      <div data-testid="iso20022-validation-valid">
        <Badge tone="success">
          <CheckCircle2 size={12} /> Mensagem válida
        </Badge>
      </div>
    );
  }

  return (
    <Card data-testid="iso20022-validation-errors">
      <CardHeader>
        <span className="text-danger-text font-semibold text-sm flex items-center gap-1.5">
          <XCircle size={14} /> {validation.errorCount} erro(s) encontrado(s)
        </span>
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-[var(--border)]">
          {validation.errors.map((err, i) => (
            <li key={i} className="py-2 first:pt-0 last:pb-0">
              {err.xpath && (
                <div className="text-[11px] text-text-tertiary mb-0.5">
                  <MonoText>{err.xpath}</MonoText>
                </div>
              )}
              <div className="text-sm text-danger-text whitespace-pre-line">
                {formatValidationMessage(err.message)}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
