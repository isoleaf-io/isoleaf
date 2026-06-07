import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { smartBuild, buildMessage as buildFromFields, type SmartBuildRequest } from "@/api/build";
import { useBuilderStore, toBuilderField, type BuilderField } from "@/store/builder";
import { ContextBar } from "./ContextBar";
import { ContextChangeBanner } from "./ContextChangeBanner";
import { FieldsTable } from "./FieldsTable";
import { MessagePreview } from "./MessagePreview";
import { AddFieldModal } from "./AddFieldModal";
import { SaveTemplateModal } from "./SaveTemplateModal";
import { LoadTemplateModal } from "./LoadTemplateModal";

function contextToRequest(ctx: ReturnType<typeof useBuilderStore.getState>["context"], customs?: Record<string, string>): SmartBuildRequest {
  return {
    mti: ctx.mti,
    role: ctx.role,
    brand: ctx.brand,
    transactionType: ctx.txType,
    channel: ctx.channel,
    approvalMode: ctx.approvalMode,
    installments: ctx.installments,
    // The "reversal" semantic is now derived from the MTI itself (04xx → bit 90).
    isReversal: ctx.mti.startsWith("04"),
    customFields: customs,
    includeTpdu: ctx.includeTpdu,
    tpduOverride: ctx.includeTpdu ? ctx.tpduOverride : null,
  };
}

export default function BuilderPage() {
  const { t } = useTranslation();
  const {
    context, fields, built, contextChanged,
    setContext, clearAll, setBuiltResult, acknowledgeContextChange,
    updateField, replaceField, keepField, addField, removeField, markCardStale,
  } = useBuilderStore();

  const [showAdd, setShowAdd] = useState(false);
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [showLoadTpl, setShowLoadTpl] = useState(false);

  // ── Hydrate from Parser/Bitmap when navigated with state ──────────────
  const location = useLocation();
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    const state = location.state as
      | {
          fromParser?: {
            mti: string;
            fields: Array<{ bitNumber: number; value: string; name: string; type: string; length: number }>;
            originalWire?: string;
          };
          fromBitmap?: { bits: number[] };
        }
      | null;
    if (!state) return;

    if (state.fromParser) {
      hydrated.current = true;
      const builderFields: BuilderField[] = state.fromParser.fields.map((f) => ({
        bitNumber: f.bitNumber,
        name: f.name,
        value: f.value,
        displayValue: f.value,
        origin: "manual",
        status: "ok",
        fieldType: f.type,
        length: f.length,
        // Parser fields are treated as user-authored — they win on rebuild.
        locked: true,
        dependsOn: [],
        dependents: [],
      }));
      // Pass the original wire so the preview is pre-filled — saves the user
      // an extra click and avoids a Generate that might silently mutate fields
      // the Builder doesn't recognize.
      useBuilderStore.getState().loadFromParser(
        builderFields,
        state.fromParser.mti,
        state.fromParser.originalWire ? { wire: state.fromParser.originalWire } : undefined,
      );
      window.history.replaceState({}, "");
      return;
    }

    if (state.fromBitmap) {
      hydrated.current = true;
      const targetBits = new Set(state.fromBitmap.bits);
      const current = useBuilderStore.getState().fields;
      const currentByBit = new Map(current.map((f) => [f.bitNumber, f]));

      // Hybrid reconcile:
      //   empty Builder  → seed every selected bit as an editing-mode row.
      //   populated      → keep bits that match, drop extras, add missing as empty.
      const next: BuilderField[] = Array.from(targetBits)
        .sort((a, b) => a - b)
        .map((bit) => {
          const existing = currentByBit.get(bit);
          if (existing) return existing;
          // Bit 1 is the secondary-bitmap indicator, never a data field.
          return {
            bitNumber: bit,
            name: bit === 1 ? "Secondary bitmap" : `Bit ${bit}`,
            value: "",
            displayValue: "",
            origin: "manual",
            status: "editing",
            fieldType: "",
            length: 0,
            locked: true,
            dependsOn: [],
            dependents: [],
          };
        });

      const currentMti = useBuilderStore.getState().context.mti;
      useBuilderStore.getState().loadFromParser(next, currentMti);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const buildMutation = useMutation({
    mutationFn: smartBuild,
    onSuccess: (res) => {
      if (!res.success || !res.fields) return;
      // Preserve manual locked fields by carrying them over.
      const lockedByBit = new Map(fields.filter((f) => f.locked).map((f) => [f.bitNumber, f]));
      const merged: BuilderField[] = res.fields.map((info) => {
        const locked = lockedByBit.get(info.bitNumber);
        return locked ?? toBuilderField(info);
      });
      setBuiltResult({
        ascii: res.message ?? "",
        binaryHex: res.binaryHexMessage ?? "",
        bitmap: res.bitmap ?? "",
        activeBits: res.activeBits ?? [],
        appliedRules: res.appliedRules ?? [],
        profileUsed: res.profileUsed ?? "",
        tpdu: res.tpdu,
        arqcIsSimulated: res.arqcIsSimulated,
      }, merged);
    },
  });

  // Live preview rebuild — debounced — when fields change manually.
  const [, setRebuildTick] = useState(0);
  const rebuildLiveMutation = useMutation({
    mutationFn: (input: { mti: string; fields: { bitNumber: number; value: string }[] }) =>
      buildFromFields(input.mti, input.fields),
  });
  useEffect(() => {
    if (!built || fields.length === 0) return;
    const handle = setTimeout(() => {
      const inputs = fields.map((f) => ({ bitNumber: f.bitNumber, value: f.value }));
      rebuildLiveMutation.mutate(
        { mti: context.mti, fields: inputs },
        {
          onSuccess: (res: any) => {
            if (!res?.success) return;
            useBuilderStore.setState({
              built: {
                ascii: res.message ?? "",
                binaryHex: res.binaryHexMessage ?? "",
                bitmap: res.bitmap ?? "",
                activeBits: res.activeBits ?? [],
                appliedRules: built.appliedRules,
                profileUsed: built.profileUsed,
                tpdu: built.tpdu,
              },
            });
            setRebuildTick((t) => t + 1);
          },
        }
      );
    }, 500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, context.mti]);

  const onBuild = () => {
    const customs: Record<string, string> = {};
    for (const f of fields) {
      if (f.locked) customs[String(f.bitNumber)] = f.value;
    }
    buildMutation.mutate(contextToRequest(context, Object.keys(customs).length ? customs : undefined));
  };

  const onRegenerateField = (bit: number) => {
    // Strip the field's lock so the smart builder regenerates a fresh value,
    // then merge it back keeping the rest of the user's current state.
    const customs: Record<string, string> = {};
    for (const f of fields) {
      if (f.locked && f.bitNumber !== bit) customs[String(f.bitNumber)] = f.value;
    }
    smartBuild(contextToRequest(context, Object.keys(customs).length ? customs : undefined))
      .then((res) => {
        const fresh = res.fields?.find((f) => f.bitNumber === bit);
        if (!fresh) return;
        replaceField(bit, toBuilderField(fresh));
      });
  };

  const onRegenerateAll = () => {
    acknowledgeContextChange();
    onBuild();
  };

  const onRegenerateCard = () => {
    markCardStale();
  };

  const onAddField = (bit: number, name: string) => {
    addField({
      bitNumber: bit,
      name,
      value: "",
      displayValue: "",
      origin: "manual",
      status: "editing",
      fieldType: "",
      length: 0,
      locked: true,
      dependsOn: [],
      dependents: [],
    });
    setShowAdd(false);
  };

  const presentBits = useMemo(() => new Set(fields.map((f) => f.bitNumber)), [fields]);
  const staleCount = useMemo(() => fields.filter((f) => f.status === "stale").length, [fields]);

  // Save flow now opens the rich modal — actual persistence lives in useTemplatesStore.
  const onSaveTemplate = () => setShowSaveTpl(true);

  const errorMsg =
    (buildMutation.error as Error | undefined)?.message ??
    (buildMutation.data && !buildMutation.data.success ? buildMutation.data.error : null);

  const scrollToFirstStale = () => {
    const first = fields.find((f) => f.status === "stale");
    if (!first) return;
    const el = document.querySelector(`[data-bit="${first.bitNumber}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <AppShell title={t("builder.title")} subtitle={t("builder.subtitle")}>
      <div className="space-y-4">
        <ContextBar
          context={context}
          onChange={setContext}
          onBuild={onBuild}
          onClear={clearAll}
          onOpenTemplates={() => setShowLoadTpl(true)}
          loading={buildMutation.isPending}
        />

        {contextChanged && built && (
          <ContextChangeBanner
            staleCount={staleCount}
            onRegenerate={onRegenerateAll}
            onScrollToFirst={scrollToFirstStale}
            onIgnore={acknowledgeContextChange}
          />
        )}

        {errorMsg && <ErrorBanner message={errorMsg} />}

        {fields.length === 0 ? (
          <Card>
            <CardBody className="text-center text-sm text-text-tertiary py-12">
              Selecione o contexto e clique <span className="font-semibold text-text-primary">Gerar</span> para
              montar sua mensagem ISO. Use o botão <span className="font-semibold text-text-primary">Templates</span> para
              carregar uma mensagem salva.
            </CardBody>
          </Card>
        ) : (
          <FieldsTable
            fields={fields}
            brand={context.brand}
            bitmap={built?.bitmap}
            arqcIsSimulated={built?.arqcIsSimulated}
            onEditField={updateField}
            onRegenerateField={onRegenerateField}
            onKeepField={keepField}
            onRemoveField={removeField}
            onRegenerateCard={onRegenerateCard}
            onAddField={() => setShowAdd(true)}
          />
        )}

        {built && <MessagePreview built={built} onSaveTemplate={onSaveTemplate} />}
      </div>

      <AddFieldModal
        open={showAdd}
        presentBits={presentBits}
        onClose={() => setShowAdd(false)}
        onAdd={onAddField}
      />
      <SaveTemplateModal open={showSaveTpl} onClose={() => setShowSaveTpl(false)} />
      <LoadTemplateModal open={showLoadTpl} onClose={() => setShowLoadTpl(false)} />
    </AppShell>
  );
}
