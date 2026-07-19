import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, ChevronDown, ChevronRight, Folder, Upload } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { useAppConfig } from "@/contexts/AppConfigContext";
import {
  listWorkspaceSchemas,
  uploadWorkspaceSchema,
  type SchemaEntry,
} from "@/api/workspace";

/**
 * Sprint 9.5 — the ISO 20022 schemas the agent knows about. Lists the
 * current inventory from GET /api/workspace/schemas and uploads new
 * .xsd files via POST /api/workspace/schemas/upload; upload errors are
 * surfaced inline with the message from the backend, unmodified.
 *
 * Sprint 9.5b — the flat table gave way to a file-explorer style tree
 * grouped by ISO 20022 family (camt/head/pacs/pain). Every family is
 * an expandable accordion; all start open so scanning the catalogue
 * feels the same as before. A successful upload force-expands the
 * target family so the analyst sees the freshly uploaded row without
 * hunting for it.
 */
export function SchemasSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { schemaUploadEnabled } = useAppConfig();
  const query = useQuery({
    queryKey: ["workspace-schemas"],
    queryFn: listWorkspaceSchemas,
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Which family accordions are expanded. Kept as a Set so we can
  // add/remove single families cheaply on upload success. Populated
  // once whenever a fresh list arrives — subsequent user toggles are
  // preserved across query refetches.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    if (!query.data) return;
    initialised.current = true;
    setExpanded(new Set(query.data.map((s) => s.family)));
  }, [query.data]);

  const toggle = useCallback((family: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  }, []);

  const uploadMut = useMutation({
    mutationFn: uploadWorkspaceSchema,
    onMutate: () => setUploadError(null),
    onSuccess: (data) => {
      // Family is the leading segment of the message type
      // (pacs.008.001.13 → "pacs"). Ensure that accordion is open so
      // the freshly uploaded row is visible without extra clicks.
      const family = data?.messageType?.split(".")[0];
      if (family) {
        setExpanded((prev) => {
          if (prev.has(family)) return prev;
          const next = new Set(prev);
          next.add(family);
          return next;
        });
      }
      qc.invalidateQueries({ queryKey: ["workspace-schemas"] });
    },
    onError: (err: unknown) => {
      // Axios interceptors already promote the backend's structured
      // error into Error.message. Fall through to a generic message
      // for pure transport failures.
      const message = (err as Error)?.message
        ?? "Upload failed. Try again.";
      setUploadError(message);
    },
  });

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    uploadMut.mutate(file);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full gap-2">
          <span className="text-sm font-semibold">
            {t("workspace.schemas.title")}
          </span>
          {/* Upload button is hidden entirely in online mode — the tree
              below stays visible so users can still browse the fixed
              44-XSD catalogue via the Reference and Comparator screens. */}
          {schemaUploadEnabled && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMut.isPending}
                data-testid="workspace-schema-upload"
              >
                <Upload size={13} />{" "}
                {uploadMut.isPending
                  ? t("workspace.schemas.uploading")
                  : t("workspace.schemas.addButton")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xsd,application/xml,text/xml"
                className="hidden"
                data-testid="workspace-schema-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  onPickFile(f);
                  // Clear so the user can re-select the same filename after
                  // a failed upload.
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {/* Online-mode banner — same phrasing family as common.online.feature.unavailable,
            adapted to name the specific reason (fixed XSD catalogue). Shown
            regardless of upload state so users don't wonder where the button
            went. */}
        {!schemaUploadEnabled && (
          <div
            role="status"
            data-testid="workspace-schema-upload-banner"
            className="flex items-start gap-3 px-4 py-3 bg-accent-bg/40 border-b border-accent/30 text-accent-text text-xs"
          >
            <Cloud size={14} className="shrink-0 mt-0.5" />
            <span>
              {t("online.feature.unavailable")} —{" "}
              {t("workspace.schemas.uploadUnavailableReason")}
            </span>
          </div>
        )}
        {uploadError && (
          <div className="p-4">
            <ErrorBanner message={uploadError} />
          </div>
        )}
        <SchemaTree
          schemas={query.data ?? []}
          loading={query.isLoading}
          error={query.error ? String((query.error as Error).message) : null}
          expanded={expanded}
          onToggle={toggle}
        />
      </CardBody>
    </Card>
  );
}

/**
 * Groups schemas by <c>family</c> and renders one collapsible accordion
 * per group. Sort order inside a group is by <c>messageType</c> then
 * <c>version</c> so <c>pacs.008.001.09</c> reads before <c>.001.13</c>.
 */
function SchemaTree({
  schemas,
  loading,
  error,
  expanded,
  onToggle,
}: {
  schemas: SchemaEntry[];
  loading: boolean;
  error: string | null;
  expanded: Set<string>;
  onToggle: (family: string) => void;
}) {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const map = new Map<string, SchemaEntry[]>();
    for (const s of schemas) {
      const list = map.get(s.family);
      if (list) list.push(s);
      else map.set(s.family, [s]);
    }
    // Sort families alphabetically, and each group by messageType +
    // version. Version is baked into messageType, so a plain string
    // compare over messageType keeps 001.09 before 001.13.
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([family, entries]) => ({
        family,
        entries: entries.slice().sort((a, b) => {
          const cmp = a.messageType.localeCompare(b.messageType);
          return cmp !== 0 ? cmp : a.version.localeCompare(b.version);
        }),
      }));
  }, [schemas]);

  if (loading) {
    return (
      <div className="text-center text-sm text-text-tertiary py-8">
        {t("workspace.schemas.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4">
        <ErrorBanner message={error} />
      </div>
    );
  }
  if (schemas.length === 0) {
    return (
      <div className="text-center text-sm text-text-tertiary py-8">
        {t("workspace.schemas.empty")}
      </div>
    );
  }

  return (
    <div data-testid="workspace-schemas-tree" className="divide-y divide-[var(--border)]">
      {grouped.map((group) => (
        <FamilyGroup
          key={group.family}
          family={group.family}
          entries={group.entries}
          expanded={expanded.has(group.family)}
          onToggle={() => onToggle(group.family)}
        />
      ))}
    </div>
  );
}

function FamilyGroup({
  family,
  entries,
  expanded,
  onToggle,
}: {
  family: string;
  entries: SchemaEntry[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-testid={`workspace-schemas-family-${family}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        // Chevron + folder + name + count. Full-width click target so
        // hovering anywhere on the header row toggles the group.
        className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium bg-bg-tertiary hover:bg-bg-quaternary text-text-primary"
        data-testid={`workspace-schemas-family-toggle-${family}`}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} className="text-text-secondary" />
        <span>{family}</span>
        <span
          className="text-xs text-text-tertiary"
          data-testid={`workspace-schemas-family-count-${family}`}
        >
          ({entries.length})
        </span>
      </button>
      {expanded && (
        <>
          {/* Sprint 9.7 — desktop keeps the 4-column table. Mobile
              (< md) switches to a card list per schema so a namespace
              URI ~55 chars in font-mono doesn't force horizontal scroll. */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="py-2 pl-10 pr-4">{t("workspace.schemas.col.messageType")}</th>
                <th className="py-2 px-4">{t("workspace.schemas.col.version")}</th>
                <th className="py-2 px-4">{t("workspace.schemas.col.namespace")}</th>
                <th className="py-2 px-4">{t("workspace.schemas.col.file")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-xs font-mono">
              {entries.map((s) => (
                <tr key={s.namespace}>
                  <td className="py-2 pl-10 pr-4">{s.messageType}</td>
                  <td className="py-2 px-4 text-text-secondary">{s.version}</td>
                  <td className="py-2 px-4 text-text-tertiary truncate max-w-[420px]">
                    {s.namespace}
                  </td>
                  <td className="py-2 px-4 text-text-secondary">{s.fileName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul
            className="md:hidden divide-y divide-[var(--border)]"
            data-testid={`workspace-schemas-family-${family}-cards`}
          >
            {entries.map((s) => (
              <li key={s.namespace} className="py-2 pl-10 pr-4 space-y-1 text-xs font-mono">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-text-primary">{s.messageType}</span>
                  <span className="text-text-secondary text-[11px]">{s.version}</span>
                </div>
                <div className="text-text-tertiary break-all">{s.namespace}</div>
                <div className="text-text-secondary text-[11px] break-all">{s.fileName}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
