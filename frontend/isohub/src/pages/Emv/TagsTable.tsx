import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MonoText } from "@/components/ui/MonoText";
import type { TlvTag } from "@/types";
import { decodeTag } from "./emvDecoders";
import { BitDecoderTable } from "./BitDecoderTable";

interface Props {
  tags: TlvTag[];
}

/**
 * Renders a TLV tag table — used by every EMV tab that shows parsed/built
 * tags. When `decodeTag(tag, value)` knows the tag (TVR, AIP, TSI, CVM
 * Results, CVM List, TTQ, CTQ, IAD) the row gets a chevron that expands
 * into the per-bit decode rendered by <BitDecoderTable />.
 */
export function TagsTable({ tags }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (tags.length === 0) {
    return <div className="text-xs text-text-tertiary text-center py-6">—</div>;
  }

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)]">
      <table className="w-full">
        <thead>
          <tr className="bg-bg-tertiary text-left text-[11px] uppercase tracking-wider text-text-tertiary">
            <th className="py-2 px-4 font-semibold w-8" aria-hidden></th>
            <th className="py-2 px-4 font-semibold">{t("emv.tag")}</th>
            <th className="py-2 px-4 font-semibold">{t("emv.name")}</th>
            <th className="py-2 px-4 font-semibold w-16">{t("emv.length")}</th>
            <th className="py-2 px-4 font-semibold">{t("emv.value")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {tags.map((tag, i) => {
            const decoded = decodeTag(tag.tag, tag.value);
            const isOpen = expanded.has(i);
            return (
              <Fragment key={i}>
                <tr>
                  <td className="py-2 px-4">
                    {decoded && (
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        aria-label={isOpen ? t("emv.bitDecoder.collapse") : t("emv.bitDecoder.expand")}
                        aria-expanded={isOpen}
                        data-testid={`emv-tag-toggle-${tag.tag}`}
                        className="text-text-tertiary hover:text-text-primary transition-colors"
                      >
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <MonoText className="text-text-mono font-medium">{tag.tag}</MonoText>
                  </td>
                  <td className="py-2 px-4 text-sm">{tag.name}</td>
                  <td className="py-2 px-4 text-text-tertiary text-xs">{tag.length}</td>
                  <td className="py-2 px-4">
                    <MonoText>{tag.value}</MonoText>
                  </td>
                </tr>
                {decoded && isOpen && (
                  <tr data-testid={`emv-tag-decoded-${tag.tag}`}>
                    <td colSpan={5} className="px-4 pb-3 pt-1 bg-bg-secondary/30">
                      <BitDecoderTable decoded={decoded} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
