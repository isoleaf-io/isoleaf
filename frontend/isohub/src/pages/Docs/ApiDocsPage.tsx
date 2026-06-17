import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { DOCS_PT } from "./content.pt";
import { DOCS_EN } from "./content.en";
import { DocBlocks } from "./DocBlocks";

/**
 * Standalone documentation page for the REST API. Reuses the same DocBlocks
 * renderer and content shape (`content.{pt,en}.ts` → `apiDocs`) as the
 * accordion sections in /docs, so prose stays consistent. Lives at its own
 * route (/docs/api) instead of an inline accordion because the API content
 * is long enough to deserve its own URL.
 */
export default function ApiDocsPage() {
  const { t, i18n } = useTranslation();
  const docs = i18n.language?.startsWith("pt") ? DOCS_PT : DOCS_EN;
  const blocks = docs["apiDocs"]?.blocks ?? [];

  return (
    <AppShell
      title={t("docs.apiDocs.title")}
      subtitle={t("docs.apiDocs.subtitle")}
      actions={
        <Link
          to="/docs"
          className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors"
          data-testid="api-docs-back"
        >
          <ChevronLeft size={14} /> {t("docs.apiDocs.backToDocs")}
        </Link>
      }
    >
      <Card>
        <CardBody>
          <DocBlocks blocks={blocks} />
        </CardBody>
      </Card>
    </AppShell>
  );
}
