import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Copy, ExternalLink, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { BuilderSection } from "@/components/Iso20022/BuilderSection";
import { AddOptionalFieldButton } from "@/components/Iso20022/AddOptionalFieldButton";
import {
  FieldSearchBar,
  type FlatField,
} from "@/components/Iso20022/FieldSearchBar";
import { getFieldLabel } from "@/config/iso20022FieldLabels";
import {
  buildIso20022,
  listAvailableFields,
  listEcosystems,
  listScenarios,
  type AvailableField,
  type BuildResponse,
  type BuildSectionDto,
  type EcosystemDto,
  type ScenarioDto,
} from "@/api/iso20022Builder";
import { listMessageTypes } from "@/api/iso20022Reference";
import { validateIso20022, type ValidateResponse } from "@/api/iso20022";
import {
  generateFieldValue,
  isGeneratableField,
} from "@/utils/iso20022Generators";
import { fetchTestPerson } from "@/api/testData";

// Sprint 8.1 — locale per ecosystem, drives PaymentTestDataGenerator
// when the user clicks "↺ Dados de teste". Maps to the Faker locale
// list registered server-side; brazilian-pix → pt_BR (CPF + +55 phone),
// SEPA/T2 → de, CBPR+ → en.
const ECOSYSTEM_LOCALES: Record<string, string> = {
  "brazilian-pix": "pt_BR",
  sepa: "de",
  "swift-cbpr": "en",
  "target-t2": "de",
  generic: "en",
};

const WILDCARD_PREFIX = "*";

export default function Iso20022BuilderPage() {
  const navigate = useNavigate();

  const [ecosystems, setEcosystems] = useState<EcosystemDto[]>([]);
  const [messageTypes, setMessageTypes] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioDto[]>([]);

  // New cascade: Ecosystem → Scenario → Version → Generate.
  // The scenario carries the message-type prefix, so the version selector
  // is just a filter over the catalogue once the scenario is known.
  const [ecosystemId, setEcosystemId] = useState<string>("");
  const [scenarioId, setScenarioId] = useState<string>("");
  const [version, setVersion] = useState<string>("");

  const [result, setResult] = useState<BuildResponse | null>(null);
  // Optional leaves the user can promote via search — fetched in parallel
  // with the build so the search bar lights up as soon as Gerar resolves.
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  // Editor state is keyed by the field's full XPath — two fields that share
  // the same XSD name (e.g. Dbtr/Nm and Cdtr/Nm, or any of the many <Id>
  // elements) would collide on a name-keyed map.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // Optional fields/sub-sections the user has explicitly promoted to
  // visible via the "+" picker. XPaths are unique, so a Set works as the
  // authoritative visibility flag.
  const [addedOptionalXPaths, setAddedOptionalXPaths] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);

  // Boot: load the static catalogues. Two parallel fetches; either failure
  // surfaces in the error banner but the rest of the page still works.
  useEffect(() => {
    Promise.all([listEcosystems(), listMessageTypes()])
      .then(([ecos, types]) => {
        setEcosystems(ecos);
        setMessageTypes(types.messageTypes);
        if (ecos.length > 0) setEcosystemId(ecos[0].ecosystemId);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // Refresh scenarios whenever the ecosystem changes — no message-type
  // filter at this stage; the user picks the scenario first.
  useEffect(() => {
    if (!ecosystemId) {
      setScenarios([]);
      return;
    }
    listScenarios(ecosystemId)
      .then((data) => {
        setScenarios(data);
        // Default to the first scenario so the "Gerar" button is actionable
        // straight away; user can refine before hitting it.
        setScenarioId(data.length > 0 ? data[0].scenarioId : "");
      })
      .catch((e: Error) => setError(e.message));
  }, [ecosystemId]);

  const currentScenario = useMemo(
    () => scenarios.find((s) => s.scenarioId === scenarioId) ?? null,
    [scenarios, scenarioId],
  );

  // Versions for the chosen scenario. For wildcard scenarios (generic), the
  // "version" selector lists every full message type so the user can pick
  // freely; for concrete scenarios it lists only the version suffix matching
  // the scenario's prefix (e.g. "001.13" for pacs.008.*).
  const availableVersions = useMemo(() => {
    if (!currentScenario) return [];
    if (currentScenario.messageTypePrefix === WILDCARD_PREFIX) {
      return [...messageTypes].sort().reverse();
    }
    const prefix = currentScenario.messageTypePrefix + ".";
    return messageTypes
      .filter((mt) => mt.startsWith(prefix))
      .map((mt) => mt.substring(prefix.length))
      .sort()
      .reverse();
  }, [currentScenario, messageTypes]);

  // Whenever the version list changes, fall back to the newest available
  // (sorted descending above) if the previously-picked one is gone.
  useEffect(() => {
    if (availableVersions.length === 0) {
      setVersion("");
      return;
    }
    if (!availableVersions.includes(version)) {
      setVersion(availableVersions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVersions.join("|")]);

  const fullMessageType = useMemo(() => {
    if (!currentScenario || !version) return "";
    if (currentScenario.messageTypePrefix === WILDCARD_PREFIX) return version;
    return `${currentScenario.messageTypePrefix}.${version}`;
  }, [currentScenario, version]);

  const handleFieldChange = useCallback((xpath: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [xpath]: value }));
  }, []);

  const [testDataLoading, setTestDataLoading] = useState(false);
  const handleLoadTestData = useCallback(async () => {
    if (!ecosystemId) return;
    const locale = ECOSYSTEM_LOCALES[ecosystemId] ?? "pt_BR";
    setTestDataLoading(true);
    try {
      // Pagador + recebedor são personas independentes; faz 2 chamadas
      // pra evitar que ambos saiam com o mesmo nome.
      const [payer, payee] = await Promise.all([
        fetchTestPerson(locale),
        fetchTestPerson(locale),
      ]);
      setFieldValues((prev) => {
        const next = { ...prev };
        // Atualiza qualquer XPath cujo último segmento seja "Dbtr/Nm",
        // "Cdtr/Nm" ou "InitgPty/Nm" — cobre pacs.008, pain.001, pain.009
        // e pain.012 sem precisar saber qual é o messageType.
        for (const xp of Object.keys(next)) {
          if (/(^|\/)Dbtr\/Nm$/.test(xp) || /(^|\/)InitgPty\/Nm$/.test(xp)) {
            next[xp] = payer.name;
          } else if (/(^|\/)Cdtr\/Nm$/.test(xp)) {
            next[xp] = payee.name;
          }
        }
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTestDataLoading(false);
    }
  }, [ecosystemId]);

  const handleAddOptional = useCallback((xpath: string) => {
    setAddedOptionalXPaths((prev) => {
      if (prev.has(xpath)) return prev;
      const next = new Set(prev);
      next.add(xpath);
      return next;
    });
  }, []);

  const handleRemoveOptional = useCallback((xpath: string) => {
    setAddedOptionalXPaths((prev) => {
      if (!prev.has(xpath)) return prev;
      const next = new Set(prev);
      // Also drop any descendant entries — removing a section hides
      // everything inside it, so its child overrides shouldn't linger.
      for (const entry of next) {
        if (entry === xpath || entry.startsWith(xpath + "/")) next.delete(entry);
      }
      return next;
    });
  }, []);

  async function handleGenerate() {
    setError(null);
    setResult(null);
    setValidation(null);
    if (!fullMessageType || !scenarioId) return;
    setLoading(true);
    try {
      const [r, optional] = await Promise.all([
        buildIso20022(fullMessageType, scenarioId),
        listAvailableFields(fullMessageType, scenarioId).catch(() => []),
      ]);
      setResult(r);
      setAvailableFields(optional);
      // Seed editor values from what the server sent, then overwrite
      // generatable leaves (MsgId/UETR/timestamps/...) with fresh client-
      // side values so the same scenario never produces two identical IDs.
      setFieldValues(
        seedValuesFromSections(r.sections, { regenerate: true, ecosystemId }),
      );
      // A fresh build resets which optionals are visible.
      setAddedOptionalXPaths(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Refetch the build whenever the user adds or removes an optional field —
  // the XML preview should reflect the new visible set, and the server is
  // the source of truth for namespace / element attributes / ordering.
  // First Gerar already populated everything, so we skip while no result
  // is present.
  useEffect(() => {
    if (!result || !fullMessageType || !scenarioId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await buildIso20022(
          fullMessageType,
          scenarioId,
          [...addedOptionalXPaths],
        );
        if (cancelled) return;
        setResult(r);
        // Merge: server defaults for any newly-included leaves, user edits
        // for everything they already touched. Regen is intentionally off
        // here — adding one optional shouldn't churn the MsgId.
        const fresh = seedValuesFromSections(r.sections, { regenerate: false });
        setFieldValues((prev) => ({ ...fresh, ...prev }));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addedOptionalXPaths]);

  // Live XML preview: parse the server's rendered XML, walk its element
  // tree building each leaf's XPath, and replace text content from the
  // `fieldValues` map keyed by XPath. Substituting by XPath (not by tag
  // name) is the only way to disambiguate fields that share a name across
  // contexts — e.g. <Nm> exists under Dbtr, Cdtr, FinInstnId, CtctDtls,
  // CashAccount, and editing one was overwriting another in the preview.
  const renderedXml = useMemo(() => {
    if (!result) return "";
    return applyValuesToXml(result.xml, fieldValues);
  }, [result, fieldValues]);

  async function handleCopy() {
    if (!renderedXml) return;
    try {
      await navigator.clipboard.writeText(renderedXml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard rejection (Safari without https) — keep silent; the user
      // can still select-all manually.
    }
  }

  function handleOpenInParser() {
    if (!renderedXml) return;
    navigate("/iso20022/parser", { state: { xml: renderedXml } });
  }

  async function handleValidate() {
    if (!renderedXml || !result) return;
    setValidating(true);
    setValidation(null);
    try {
      const v = await validateIso20022(renderedXml, result.messageType);
      setValidation(v);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setValidating(false);
    }
  }

  // Flat list of every field + section in the loaded message, with an
  // isVisible flag so the search component can route hits to "→ ir" vs
  // "+ adicionar". The structure carries XSD-mandatory + ecosystem +
  // already-added optionals; the available-fields endpoint provides the
  // rest of the optional tree (TxId, InstrId, every Acct branch, etc.) so
  // search can reach them even before they live in the form.
  const flatIndex = useMemo<FlatField[]>(() => {
    if (!result) return [];
    const fromStructure = buildFlatIndex(result.sections, addedOptionalXPaths);
    const seenXPaths = new Set(fromStructure.map((f) => f.xpath));
    const fromAvailable: FlatField[] = availableFields
      .filter((f) => !f.name.startsWith("@"))
      .filter((f) => !seenXPaths.has(f.xpath))
      .map((f) => ({
        name: f.name,
        xpath: f.xpath,
        label: getFieldLabel(f.name),
        typeName: f.typeName,
        isMandatory: false,
        isEcosystemMandatory: false,
        isVisible: addedOptionalXPaths.has(f.xpath),
        parentXPath: f.xpath.split("/").slice(0, -1).join("/"),
        isSection: false,
      }));
    return [...fromStructure, ...fromAvailable];
  }, [result, addedOptionalXPaths, availableFields]);

  const scrollToField = useCallback((xpath: string) => {
    const el = document.querySelector(
      `[data-xpath="${CSS.escape(xpath)}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-blue-500");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-blue-500");
    }, 2000);
  }, []);

  const handleSearchAdd = useCallback(
    (xpath: string) => {
      handleAddOptional(xpath);
      // The refetch effect runs immediately, but the DOM node only exists
      // after the next render. A short delay lets BuilderSection paint
      // before we try to scroll to it.
      setTimeout(() => scrollToField(xpath), 200);
    },
    [handleAddOptional, scrollToField],
  );

  const selectClass =
    "bg-bg-input border border-[var(--border)] rounded-md px-2 py-1 text-xs font-mono " +
    "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent";

  return (
    <AppShell
      title="Builder ISO 20022"
      subtitle="Construa uma mensagem do zero com defaults e dicas do ecossistema."
    >
      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-3">
            <div
              className="flex items-end gap-2 flex-wrap"
              data-testid="builder-selectors"
            >
              <Selector
                label="Ecossistema"
                value={ecosystemId}
                onChange={(v) => {
                  setEcosystemId(v);
                  setResult(null);
                  setValidation(null);
                }}
                options={ecosystems.map((e) => ({
                  value: e.ecosystemId,
                  label: e.displayName,
                }))}
                testid="builder-ecosystem"
                className={selectClass}
              />
              <Selector
                label="Cenário"
                value={scenarioId}
                onChange={(v) => {
                  setScenarioId(v);
                  // Version may be invalid under the new scenario's prefix;
                  // the version effect above re-seeds to the newest match.
                  setResult(null);
                  setValidation(null);
                }}
                options={scenarios.map((s) => ({
                  value: s.scenarioId,
                  label: s.displayName,
                }))}
                testid="builder-scenario"
                className={selectClass}
                disabled={scenarios.length === 0}
              />
              <Selector
                label="Versão"
                value={version}
                onChange={setVersion}
                options={availableVersions.map((v) => ({ value: v, label: v }))}
                testid="builder-version"
                className={selectClass}
                disabled={availableVersions.length === 0}
              />
              <Button
                onClick={handleGenerate}
                disabled={loading || !fullMessageType || !scenarioId}
                data-testid="builder-generate"
              >
                {loading ? "Gerando..." : "Gerar →"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleLoadTestData}
                disabled={testDataLoading || !result || !ecosystemId}
                data-testid="builder-test-data"
                title="Substituir nomes Dbtr/Cdtr por dados gerados via Bogus"
              >
                {testDataLoading ? "Gerando..." : "↺ Dados de teste"}
              </Button>
            </div>

            {scenarios.length > 0 && scenarioId && (
              <p className="text-xs text-text-tertiary">
                {scenarios.find((s) => s.scenarioId === scenarioId)?.description}
              </p>
            )}

            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>

        {result && (
          <Card>
            <CardBody className="py-2">
              <FieldSearchBar
                allFields={flatIndex}
                onNavigate={scrollToField}
                onAdd={handleSearchAdd}
              />
            </CardBody>
          </Card>
        )}

        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="builder-result">
            <ErrorBoundary area="Builder editor">
              <RootSections
                sections={result.sections}
                fieldValues={fieldValues}
                onFieldChange={handleFieldChange}
                addedOptionalXPaths={addedOptionalXPaths}
                onAddOptional={handleAddOptional}
                onRemoveOptional={handleRemoveOptional}
                ecosystemId={ecosystemId}
              />
            </ErrorBoundary>

            <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-sm font-semibold">XML gerado</span>
                    {validation && (
                      <Badge tone={validation.isValid ? "success" : "danger"}>
                        {validation.isValid ? (
                          <>
                            <CheckCircle2 size={12} /> válido
                          </>
                        ) : (
                          <>
                            <XCircle size={12} /> {validation.errorCount} erro(s)
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  <textarea
                    value={renderedXml}
                    readOnly
                    className="w-full h-[440px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[11px] resize-none focus:outline-none"
                    data-testid="builder-xml"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={handleCopy} data-testid="builder-copy">
                      <Copy size={13} /> {copied ? "Copiado!" : "Copiar XML"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleOpenInParser}
                      data-testid="builder-open-in-parser"
                    >
                      <ExternalLink size={13} /> Abrir no Parser
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleValidate}
                      disabled={validating}
                      data-testid="builder-validate"
                    >
                      <ShieldCheck size={13} /> {validating ? "Validando..." : "Validar"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setResult(null);
                        setFieldValues({});
                        setAddedOptionalXPaths(new Set());
                        setValidation(null);
                      }}
                    >
                      <RotateCcw size={13} /> Limpar
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
  testid,
  className,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testid: string;
  className: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-text-tertiary uppercase tracking-wide">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        data-testid={testid}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Top-level Builder sections plus a "+" button for promoting optional root
 * sub-trees. Mirrors {@link BuilderSection}'s behaviour at the page level
 * so the same hidden-by-default rule applies to root-level optionals.
 */
function RootSections({
  sections,
  fieldValues,
  onFieldChange,
  addedOptionalXPaths,
  onAddOptional,
  onRemoveOptional,
  ecosystemId,
}: {
  sections: BuildSectionDto[];
  fieldValues: Record<string, string>;
  onFieldChange: (xpath: string, value: string) => void;
  addedOptionalXPaths: Set<string>;
  onAddOptional: (xpath: string) => void;
  onRemoveOptional: (xpath: string) => void;
  ecosystemId?: string;
}) {
  const visibleSections = sections.filter(
    (s) => s.isMandatory || addedOptionalXPaths.has(s.xpath),
  );
  const hiddenOptionalSections = sections.filter(
    (s) => !s.isMandatory && !addedOptionalXPaths.has(s.xpath),
  );

  return (
    <div className="space-y-2">
      {visibleSections.map((s) => (
        <BuilderSection
          key={s.xpath}
          section={s}
          values={fieldValues}
          onChange={onFieldChange}
          addedOptionalXPaths={addedOptionalXPaths}
          onAddOptional={onAddOptional}
          onRemoveOptional={onRemoveOptional}
          ecosystemId={ecosystemId}
          defaultExpanded={s.isMandatory}
        />
      ))}
      {hiddenOptionalSections.length > 0 && (
        <AddOptionalFieldButton
          hiddenFields={[]}
          hiddenSections={hiddenOptionalSections}
          onAdd={onAddOptional}
        />
      )}
    </div>
  );
}

/**
 * Walks the section tree and emits one entry per section AND per leaf,
 * carrying the visibility flag (mandatory / ecosystem-mandatory / already
 * added → true; hidden optional → false). Used by {@link FieldSearchBar}
 * to power both "→ ir" and "+ adicionar" actions from a single index.
 */
function buildFlatIndex(
  sections: BuildSectionDto[],
  addedXPaths: Set<string>,
  parentXPath = "",
): FlatField[] {
  const out: FlatField[] = [];
  for (const section of sections) {
    out.push({
      name: section.name,
      xpath: section.xpath,
      label: getFieldLabel(section.name),
      typeName: "",
      isMandatory: section.isMandatory,
      isEcosystemMandatory: false,
      isVisible: section.isMandatory || addedXPaths.has(section.xpath),
      parentXPath,
      isSection: true,
    });
    for (const field of section.fields) {
      // XML attribute pseudo-fields (e.g. "@Ccy") aren't standalone editable
      // entries — they're driven by the parent element. Skip so they don't
      // pollute the search index with hits like "Ccy / Currency Code".
      if (field.name.startsWith("@")) continue;
      out.push({
        name: field.name,
        xpath: field.xpath,
        label: getFieldLabel(field.name),
        typeName: field.typeName,
        isMandatory: field.isMandatory,
        isEcosystemMandatory: field.isEcosystemMandatory,
        isVisible:
          field.isMandatory ||
          field.isEcosystemMandatory ||
          addedXPaths.has(field.xpath),
        parentXPath: section.xpath,
        isSection: false,
      });
    }
    out.push(...buildFlatIndex(section.sections, addedXPaths, section.xpath));
  }
  return out;
}

function seedValuesFromSections(
  sections: BuildSectionDto[],
  {
    regenerate,
    ecosystemId,
  }: { regenerate: boolean; ecosystemId?: string } = { regenerate: false },
): Record<string, string> {
  const out: Record<string, string> = {};
  walk(sections);
  return out;

  function walk(list: BuildSectionDto[]) {
    for (const s of list) {
      for (const f of s.fields) {
        if (regenerate && isGeneratableField(f)) {
          // Fresh client-side value beats the scenario's static override —
          // identifiers and timestamps should never repeat between builds.
          out[f.xpath] = generateFieldValue(f, ecosystemId);
        } else if (f.value != null) {
          out[f.xpath] = f.value;
        }
      }
      walk(s.sections);
    }
  }
}

/**
 * Substitutes edited values back into the server-rendered XML by parsing
 * it as DOM, walking each element and building the leaf's XPath from the
 * tag chain (skipping the outer &lt;Document&gt;), then replacing the
 * text content of any leaf whose XPath is present in `values`. The result
 * is pretty-printed back with 2-space indentation to match the look of
 * the server-rendered preview.
 *
 * Matching by XPath (instead of by tag name) is what makes editing one
 * &lt;Nm&gt; not bleed into another &lt;Nm&gt; under a different parent.
 */
function applyValuesToXml(
  baseXml: string,
  values: Record<string, string>,
): string {
  if (typeof DOMParser === "undefined") return baseXml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(baseXml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return baseXml;

  const documentEl = doc.documentElement;
  for (const child of Array.from(documentEl.children)) {
    walkAndSubstitute(child, child.localName);
  }

  const ns = documentEl.getAttribute("xmlns") ?? "";
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Document xmlns="${ns}">`,
  ];
  for (const child of Array.from(documentEl.children)) {
    lines.push(serializeWithIndent(child, 1));
  }
  lines.push("</Document>");
  return lines.join("\n");

  function walkAndSubstitute(el: Element, currentPath: string) {
    // Apply attribute overrides keyed as "elementXPath/@AttrName" — the
    // CurrencyAmountEditor stores Ccy edits there since attributes don't
    // round-trip through BuildFieldDto.
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === "xmlns") continue;
      const attrKey = `${currentPath}/@${attr.name}`;
      if (attrKey in values) el.setAttribute(attr.name, values[attrKey]);
    }

    const children = Array.from(el.children);
    if (children.length === 0) {
      const v = values[currentPath];
      if (v != null) el.textContent = v;
      return;
    }
    for (const child of children) {
      walkAndSubstitute(child, `${currentPath}/${child.localName}`);
    }
  }
}

function serializeWithIndent(el: Element, indent: number): string {
  const pad = "  ".repeat(indent);
  const tag = el.localName;
  const attrs = Array.from(el.attributes)
    .filter((a) => a.name !== "xmlns")
    .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
    .join("");

  const children = Array.from(el.children);
  if (children.length === 0) {
    const text = el.textContent ?? "";
    if (text === "") return `${pad}<${tag}${attrs}/>`;
    return `${pad}<${tag}${attrs}>${escapeXml(text)}</${tag}>`;
  }

  const lines = [`${pad}<${tag}${attrs}>`];
  for (const child of children) {
    lines.push(serializeWithIndent(child, indent + 1));
  }
  lines.push(`${pad}</${tag}>`);
  return lines.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
