import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { Download, Eye, EyeOff, Trash2, Upload } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { getWorkspace, updateWorkspace } from "@/api/workspace";
import { useTemplatesStore, type SavedTemplate } from "@/store/templates";
import type { WorkspaceConfig } from "@/types";

const HEX_32 = /^[0-9A-Fa-f]{32}$/;
/** Empty is valid (optional). Anything else must be exactly 32 hex chars. */
const isHex32OrEmpty = (v: string) => v.length === 0 || HEX_32.test(v);

export default function WorkspacePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const wsQuery = useQuery({ queryKey: ["workspace"], queryFn: getWorkspace });

  // Templates now live in localStorage via Zustand — no API roundtrip.
  const templates = useTemplatesStore((s) => s.templates);
  const loadTemplate = useTemplatesStore((s) => s.loadTemplate);
  const deleteTemplateLocal = useTemplatesStore((s) => s.deleteTemplate);
  const importTemplate = useTemplatesStore((s) => s.importTemplate);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<WorkspaceConfig | null>(null);
  useEffect(() => {
    if (wsQuery.data) setForm(wsQuery.data);
  }, [wsQuery.data]);

  const saveMut = useMutation({
    mutationFn: updateWorkspace,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace"] }),
  });

  const exportTemplate = (tpl: SavedTemplate) => {
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `isohub-template-${tpl.mti}-${tpl.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as SavedTemplate;
        if (!parsed.name || !parsed.mti || !Array.isArray(parsed.fields)) {
          alert("Arquivo inválido: campos obrigatórios ausentes (name, mti, fields).");
          return;
        }
        importTemplate(parsed);
      } catch {
        alert("Arquivo inválido: não é um JSON válido.");
      }
    });
  };

  if (!form) return <AppShell title={t("workspace.title")}>{t("common.loading")}</AppShell>;

  const set = <K extends keyof WorkspaceConfig>(k: K, v: WorkspaceConfig[K]) =>
    setForm({ ...form, [k]: v });

  // Block save when either key is set to an invalid value. Empty stays valid (optional).
  const cryptoKeysInvalid = !isHex32OrEmpty(form.imk ?? "") || !isHex32OrEmpty(form.zpk ?? "");

  return (
    <AppShell title={t("workspace.title")} subtitle={t("workspace.subtitle")}>
      <Tabs.Root defaultValue="config">
        <Tabs.List className="flex gap-1 mb-4 border-b border-[var(--border)]">
          <Tabs.Trigger
            value="config"
            className="px-4 py-2 text-sm text-text-secondary border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-text-primary"
          >
            {t("workspace.configuration")}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="templates"
            className="px-4 py-2 text-sm text-text-secondary border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-text-primary"
          >
            {t("workspace.templates")}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="config">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <span className="text-sm font-semibold">{t("workspace.identity")}</span>
              </CardHeader>
              <CardBody className="space-y-3">
                <Field label={t("workspace.acquirerId")} value={form.acquirerId} onChange={(v) => set("acquirerId", v)} />
                <Field label={t("workspace.merchantId")} value={form.merchantId} onChange={(v) => set("merchantId", v)} />
                <Field label={t("workspace.terminalId")} value={form.terminalId} onChange={(v) => set("terminalId", v)} />
                <Field label={t("workspace.merchantName")} value={form.merchantName} onChange={(v) => set("merchantName", v)} />
                <Field label={t("workspace.merchantCity")} value={form.merchantCity} onChange={(v) => set("merchantCity", v)} />
                <Field label={t("workspace.mcc")} value={form.mcc} onChange={(v) => set("mcc", v)} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <span className="text-sm font-semibold">{t("workspace.tpdu")} · {t("workspace.preferences")}</span>
              </CardHeader>
              <CardBody className="space-y-3">
                <Field label={t("workspace.originNii")} value={form.originNii} onChange={(v) => set("originNii", v)} />
                <Field label={t("workspace.destinationNii")} value={form.destinationNii} onChange={(v) => set("destinationNii", v)} />
                <Field label={t("workspace.defaultBrand")} value={form.defaultBrand} onChange={(v) => set("defaultBrand", v)} />
                <Field label={t("workspace.defaultCurrency")} value={form.defaultCurrency} onChange={(v) => set("defaultCurrency", v)} />
                <Field label={t("workspace.defaultCountry")} value={form.defaultCountry} onChange={(v) => set("defaultCountry", v)} />
                <Field label={t("workspace.defaultChannel")} value={form.defaultChannel} onChange={(v) => set("defaultChannel", v)} />
              </CardBody>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <div>
                <div className="text-sm font-semibold">{t("workspace.cryptoKeys")}</div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {t("workspace.cryptoKeysSubtitle")}
                </div>
              </div>
            </CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SecretField
                label={t("workspace.imkLabel")}
                placeholder={t("workspace.hexPlaceholder")}
                value={form.imk ?? ""}
                onChange={(v) => set("imk", v)}
                hint={t("workspace.imkHint")}
                revealTitle={t("workspace.reveal")}
                hideTitle={t("workspace.hide")}
                invalidMessage={t("workspace.hexInvalid")}
              />
              <SecretField
                label={t("workspace.zpkLabel")}
                placeholder={t("workspace.hexPlaceholder")}
                value={form.zpk ?? ""}
                onChange={(v) => set("zpk", v)}
                hint={t("workspace.zpkHint")}
                revealTitle={t("workspace.reveal")}
                hideTitle={t("workspace.hide")}
                invalidMessage={t("workspace.hexInvalid")}
              />
            </CardBody>
          </Card>

          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={() => saveMut.mutate(form)}
              disabled={saveMut.isPending || cryptoKeysInvalid}
            >
              {saveMut.isPending ? t("common.loading") : t("workspace.saveChanges")}
            </Button>
            {saveMut.isSuccess && <Badge tone="success">{t("workspace.saved")}</Badge>}
          </div>
        </Tabs.Content>

        <Tabs.Content value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{templates.length} {t("workspace.templates")}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload size={13} /> Importar
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {templates.length === 0 ? (
                <div className="text-center text-sm text-text-tertiary py-12">
                  {t("workspace.noTemplates")}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-bg-tertiary text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                      <th className="py-2 px-4">Nome</th>
                      <th className="py-2 px-4">MTI</th>
                      <th className="py-2 px-4">Salvo em</th>
                      <th className="py-2 px-4">Tags</th>
                      <th className="py-2 px-4 w-44"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {templates
                      .slice()
                      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
                      .map((tpl) => (
                        <tr key={tpl.id}>
                          <td className="py-2 px-4 text-sm font-medium">
                            {tpl.name}
                            {tpl.description && (
                              <div className="text-[11px] text-text-tertiary truncate max-w-[260px]">
                                {tpl.description}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <Badge tone="accent" className="font-mono">{tpl.mti}</Badge>
                          </td>
                          <td className="py-2 px-4 text-xs text-text-tertiary">
                            {new Date(tpl.savedAt).toLocaleString()}
                          </td>
                          <td className="py-2 px-4 text-xs text-text-tertiary truncate max-w-[180px]">
                            {tpl.tags ?? "—"}
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={() => {
                                  loadTemplate(tpl.id);
                                  navigate("/builder");
                                }}
                              >
                                Carregar no Builder
                              </Button>
                              <button
                                onClick={() => exportTemplate(tpl)}
                                className="p-1 text-text-tertiary hover:text-text-primary"
                                title="Exportar JSON"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remover template "${tpl.name}"?`))
                                    deleteTemplateLocal(tpl.id);
                                }}
                                className="p-1 text-text-tertiary hover:text-danger"
                                title="Remover"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </AppShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

interface SecretFieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  revealTitle: string;
  hideTitle: string;
  invalidMessage: string;
}

/**
 * Password-masked input for 32-hex secrets (IMK/ZPK). Empty is valid (optional).
 * Loads masked from API and stays masked until the user clicks reveal — even
 * after the GET fills in the real value, we never show it without intent.
 */
function SecretField({
  label, placeholder, value, onChange, hint,
  revealTitle, hideTitle, invalidMessage,
}: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [touched, setTouched] = useState(false);

  // Valid = empty OR exactly 32 hex. Invalid border only shows after blur,
  // so the user isn't yelled at while still typing.
  const valid = isHex32OrEmpty(value);
  const showError = touched && !valid;
  const showOk = touched && valid && value.length === 32;

  const borderClass = showError
    ? "border-danger focus:border-danger focus:ring-danger/30"
    : showOk
    ? "border-success focus:border-success focus:ring-success/30"
    : "";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <Label className="mb-0">{label}</Label>
        <span className={clsx("text-[11px] font-mono", showError ? "text-danger" : "text-text-tertiary")}>
          {value.length}/32
        </span>
      </div>
      <div className="relative">
        <Input
          type={revealed ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          onBlur={() => setTouched(true)}
          className={clsx("pr-9 font-mono", borderClass)}
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary"
          title={revealed ? hideTitle : revealTitle}
          aria-label={revealed ? hideTitle : revealTitle}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {showError ? (
        <div className="text-[11px] text-danger mt-1">{invalidMessage}</div>
      ) : hint ? (
        <div className="text-[11px] text-text-tertiary mt-1">{hint}</div>
      ) : null}
    </div>
  );
}
