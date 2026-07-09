import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { FieldTree } from "@/components/Iso20022/FieldTree";
import { FieldSearchResults } from "@/components/Iso20022/FieldSearchResults";
import { FieldDetailPanel } from "@/components/Iso20022/FieldDetailPanel";
import { MessageTypeSelector } from "@/components/Iso20022/MessageTypeSelector";
import {
  listMessageTypes,
  getMessageReference,
  searchFields,
  type FieldDefinitionDto,
  type MessageReferenceResponse,
  type SearchResponse,
} from "@/api/iso20022Reference";

type Mode = "browse" | "search";

/**
 * Depth-first search for a field by exact name within a reference tree.
 * Returns the first match (the tree may legitimately repeat field names at
 * different depths — first wins, matching the order the user scans visually).
 */
function findFieldInTree(
  fields: FieldDefinitionDto[],
  fieldName: string,
): FieldDefinitionDto | null {
  for (const field of fields) {
    if (field.name === fieldName) return field;
    const found = findFieldInTree(field.children, fieldName);
    if (found) return found;
  }
  return null;
}

export default function Iso20022ReferencePage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("browse");
  const [messageTypes, setMessageTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [reference, setReference] = useState<MessageReferenceResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Field-detail side panel: opens on row click in either tab.
  const [selectedField, setSelectedField] = useState<FieldDefinitionDto | null>(null);
  // Track which message type owns the selected field — search hits cross types,
  // so this can be different from the browse-mode "selectedType".
  const [selectedFieldMessageType, setSelectedFieldMessageType] = useState<string>("");
  // Pending field-name navigation from the search tab: set when the user
  // clicks a version chip, resolved once the reference for that message type
  // finishes loading (see resolver effect below).
  const [pendingField, setPendingField] = useState<string | null>(null);
  // XPath of the row to spotlight in the tree (transient: cleared after a
  // short delay so the user sees the "found it" flash without persistent
  // visual noise).
  const [highlightedXPath, setHighlightedXPath] = useState<string | null>(null);
  // Step-2 drill-down inside the search tab: when set, the search results
  // panel filters down to this single field's family/version map. Cleared
  // by the "back" button to return to step 1 (the field list).
  const [selectedSearchField, setSelectedSearchField] = useState<string | null>(null);
  // Clearing selection on tab swap avoids showing detail for a field that
  // belongs to a different message type than what's on screen. Also clears
  // the owning messageType + any in-flight highlight so the panel never
  // points at stale data.
  useEffect(() => {
    setSelectedField(null);
    setSelectedFieldMessageType("");
    setHighlightedXPath(null);
  }, [mode]);

  // Escape dismisses the detail panel from anywhere on the page.
  useEffect(() => {
    if (!selectedField) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedField(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedField]);

  // Boot: fetch the supported-types list once. Default the selection so the
  // browse panel renders something on first paint instead of an empty card.
  // `typesLoading` covers the cold-start window: in production the agent
  // walks 32 XSDs on first request, which can take a few seconds — without
  // a visible loading cue the page looks broken.
  const [typesLoading, setTypesLoading] = useState(true);
  useEffect(() => {
    setTypesLoading(true);
    listMessageTypes()
      .then((d) => {
        setMessageTypes(d.messageTypes);
        if (d.messageTypes.length > 0) setSelectedType(d.messageTypes[0]);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setTypesLoading(false));
  }, []);

  // Refetch the tree whenever the user picks a new message type (browse mode).
  useEffect(() => {
    if (!selectedType || mode !== "browse") return;
    setLoading(true);
    setError(null);
    setReference(null);
    getMessageReference(selectedType)
      .then(setReference)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedType, mode]);

  // Resolves a pending field-name navigation once the message reference for
  // the target type has been loaded. Walks the tree depth-first; the first
  // node with a matching `name` wins. Sets the owning message type alongside
  // so the detail panel renders against the correct family. Also flashes the
  // field in the tree so the user can see where it sits structurally.
  useEffect(() => {
    if (!pendingField || !reference) return;
    const found = findFieldInTree(reference.fields, pendingField);
    if (found) {
      setSelectedField(found);
      setSelectedFieldMessageType(reference.messageType);
      setHighlightedXPath(found.xpath);
    }
    setPendingField(null);
  }, [reference, pendingField]);

  // Transient highlight: clears the XPath after 3s so the row reverts to its
  // regular (or "selected") appearance. The FieldTree itself does the scroll
  // and the visual marker — we just own the timer.
  useEffect(() => {
    if (!highlightedXPath) return;
    const timer = setTimeout(() => setHighlightedXPath(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedXPath]);

  function handleNavigateToField(messageType: string, fieldName: string) {
    setMode("browse");
    setSelectedType(messageType);
    setSelectedField(null);
    setPendingField(fieldName);
  }

  const runSearch = useCallback(async () => {
    if (searchTerm.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setSearchResults(null);
    try {
      setSearchResults(await searchFields(searchTerm.trim()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  return (
    <AppShell
      title={t("iso20022.reference.title")}
      subtitle={t("iso20022.reference.subtitle")}
    >
      {/*
        Split layout: page height is locked to the viewport (minus AppShell
        chrome) so the two panes scroll independently instead of letting the
        page grow vertically. The right pane mounts only when a field is
        selected — left expands to full width when it's gone.
      */}
      <div
        className="flex gap-0 overflow-hidden"
        style={{ height: "calc(100vh - 120px)" }}
      >
        {/* Sprint 9.7 — on mobile the tree hides while a field detail is
            open (viewport too narrow for a useful split); onClose in the
            detail panel brings it back. Above md both panes coexist. */}
        <div
          className={clsx(
            "flex flex-col gap-4 overflow-y-auto pr-0 md:pr-4",
            selectedField ? "hidden md:flex md:w-1/2" : "w-full",
          )}
        >
        {/* Mode tabs */}
        <div className="inline-flex gap-1 bg-bg-secondary rounded-lg p-1">
          {(["browse", "search"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              data-testid={`tab-${m}`}
              className={
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors " +
                (mode === m
                  ? "bg-bg-primary text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-primary")
              }
            >
              {m === "browse"
                ? t("iso20022.reference.byMessage")
                : t("iso20022.reference.fieldSearch")}
            </button>
          ))}
        </div>

        {mode === "browse" && (
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {t("iso20022.reference.messageType")}
                  </span>
                  {reference && (
                    <span className="text-xs text-text-tertiary">
                      {t("iso20022.reference.totalFields", { count: reference.totalFields })}
                    </span>
                  )}
                </div>
                {typesLoading && messageTypes.length === 0 ? (
                  // Skeleton matched to the selector's height so the layout
                  // doesn't jump when the catalogue finishes loading. The
                  // text doubles as a "we're not stuck" affordance during
                  // the cold-start window in production.
                  <div
                    className="flex items-center gap-2 bg-bg-input border border-[var(--border)] rounded-md px-3 py-1.5 animate-pulse text-sm text-text-tertiary"
                    data-testid="iso20022-reference-types-loading"
                  >
                    {t("common.loading")}... carregando schemas
                  </div>
                ) : (
                <MessageTypeSelector
                  messageTypes={messageTypes}
                  selectedType={selectedType}
                  onSelect={(type) => {
                    setSelectedType(type);
                    // Trocar de tipo invalida o campo selecionado — fecha o
                    // painel e zera o owning-messageType pra evitar o caso
                    // "tree de X mas panel mostrando campo de Y".
                    setSelectedField(null);
                    setSelectedFieldMessageType("");
                    setHighlightedXPath(null);
                  }}
                />
                )}
              </div>

              {loading && (
                <div className="text-text-tertiary text-sm">{t("common.loading")}</div>
              )}
              {reference && !loading && (
                <div className="bg-bg-input border border-[var(--border)] rounded-md p-3 overflow-x-auto">
                  {reference.fields.map((field, i) => (
                    <FieldTree
                      key={`${field.name}-${i}`}
                      field={field}
                      defaultExpanded
                      onSelectField={(f) => {
                        setSelectedField(f);
                        setSelectedFieldMessageType(selectedType);
                      }}
                      selectedXPath={selectedField?.xpath}
                      highlightXPath={highlightedXPath ?? undefined}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {mode === "search" && (
          <Card>
            <CardBody className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch();
                    }}
                    placeholder={t("iso20022.reference.searchPlaceholder")}
                    data-testid="iso20022-reference-search-input"
                    className="w-full bg-bg-input border border-[var(--border)] rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                </div>
                <Button
                  onClick={runSearch}
                  disabled={loading || searchTerm.trim().length < 2}
                  data-testid="iso20022-reference-search-button"
                >
                  {loading ? t("common.loading") : t("common.search")}
                </Button>
              </div>

              {searchResults && (
                <FieldSearchResults
                  results={searchResults.results}
                  term={searchResults.term}
                  selectedFieldName={selectedSearchField}
                  onSelectField={setSelectedSearchField}
                  onBack={() => setSelectedSearchField(null)}
                  onNavigate={handleNavigateToField}
                />
              )}
            </CardBody>
          </Card>
        )}

        {error && <ErrorBanner message={error} />}
        </div>

        {selectedField && (
          <div className="w-full md:w-1/2 overflow-hidden md:border-l border-[var(--border)] flex flex-col">
            <ErrorBoundary area="Field detail">
              <FieldDetailPanel
                messageType={selectedFieldMessageType || selectedType}
                field={selectedField}
                onClose={() => setSelectedField(null)}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </AppShell>
  );
}
