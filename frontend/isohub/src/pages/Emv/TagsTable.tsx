import { useTranslation } from "react-i18next";
import { MonoText } from "@/components/ui/MonoText";
import type { TlvTag } from "@/types";

interface Props {
  tags: TlvTag[];
}

/**
 * Renders a TLV tag table — used by every EMV tab that shows parsed/built tags.
 */
export function TagsTable({ tags }: Props) {
  const { t } = useTranslation();
  if (tags.length === 0) {
    return <div className="text-xs text-text-tertiary text-center py-6">—</div>;
  }
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)]">
      <table className="w-full">
        <thead>
          <tr className="bg-bg-tertiary text-left text-[11px] uppercase tracking-wider text-text-tertiary">
            <th className="py-2 px-4 font-semibold">{t("emv.tag")}</th>
            <th className="py-2 px-4 font-semibold">{t("emv.name")}</th>
            <th className="py-2 px-4 font-semibold w-16">{t("emv.length")}</th>
            <th className="py-2 px-4 font-semibold">{t("emv.value")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {tags.map((tag, i) => (
            <tr key={i}>
              <td className="py-2 px-4">
                <MonoText className="text-text-mono font-medium">{tag.tag}</MonoText>
              </td>
              <td className="py-2 px-4 text-sm">{tag.name}</td>
              <td className="py-2 px-4 text-text-tertiary text-xs">{tag.length}</td>
              <td className="py-2 px-4">
                <MonoText>{tag.value}</MonoText>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
