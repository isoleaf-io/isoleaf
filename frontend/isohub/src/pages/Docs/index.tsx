import { useTranslation } from "react-i18next";
import { BookOpen, ChevronRight, Cpu, ExternalLink, FileText, Layers, MessageCircle, Network, Sparkles, Terminal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";

/**
 * The full prose now lives at https://docs.isoleaf.dev. This page keeps the
 * familiar card grid as a launcher so existing /docs deep links still resolve
 * to something useful — each card opens the corresponding section on the
 * dedicated docs site in a new tab.
 */
interface Topic {
  /** Section id on the docs site (matches the URL hash there). */
  id: string;
  icon: typeof BookOpen;
  titleKey: string;
  descriptionKey: string;
}

const TOPICS: Topic[] = [
  { id: "iso8583",   icon: FileText,      titleKey: "docs.cards.iso8583.title",   descriptionKey: "docs.cards.iso8583.description" },
  { id: "emv",       icon: Cpu,           titleKey: "docs.cards.emv.title",       descriptionKey: "docs.cards.emv.description" },
  { id: "roles",     icon: Network,       titleKey: "docs.cards.roles.title",     descriptionKey: "docs.cards.roles.description" },
  { id: "glossary",  icon: BookOpen,      titleKey: "docs.cards.glossary.title",  descriptionKey: "docs.cards.glossary.description" },
  { id: "fields",    icon: Layers,        titleKey: "docs.cards.fields.title",    descriptionKey: "docs.cards.fields.description" },
  { id: "guides",    icon: Sparkles,      titleKey: "docs.cards.guides.title",    descriptionKey: "docs.cards.guides.description" },
  { id: "apiDocs",   icon: Terminal,      titleKey: "docs.cards.api.title",       descriptionKey: "docs.cards.api.description" },
  { id: "community", icon: MessageCircle, titleKey: "docs.cards.community.title", descriptionKey: "docs.cards.community.description" },
];

const DOCS_BASE = "https://docs.isoleaf.dev";

export default function DocsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("pt") ? "pt" : "en";

  return (
    <AppShell title={t("docs.title")} subtitle={t("docs.subtitle")}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          const href = `${DOCS_BASE}/${lang}/#${topic.id}`;
          return (
            <a
              key={topic.id}
              id={topic.id}
              href={href}
              target="_blank"
              rel="noopener"
              className="block group"
              data-testid={`docs-card-${topic.id}`}
            >
              <Card className="transition-colors hover:border-accent/40 group-hover:border-accent/40 h-full">
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-9 h-9 rounded-md bg-accent-bg text-accent-text flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </div>
                    <ExternalLink size={14} className="text-text-tertiary shrink-0 mt-1 group-hover:text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                    {t(topic.titleKey)}
                    <ChevronRight size={12} className="text-text-tertiary group-hover:text-accent" />
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{t(topic.descriptionKey)}</p>
                </CardBody>
              </Card>
            </a>
          );
        })}
      </div>
    </AppShell>
  );
}
