import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BookOpen, ChevronDown, ChevronRight, Cpu, FileText, Layers, Link as LinkIcon, MessageCircle, Network, Sparkles, Terminal } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { DOCS_PT } from "./content.pt";
import { DOCS_EN } from "./content.en";
import { DocBlocks } from "./DocBlocks";

interface Topic {
  id: string;
  icon: typeof BookOpen;
  titleKey: string;
  descriptionKey: string;
  /** When set, the card behaves as a navigation tile (no accordion). The
   *  target is a SPA route under react-router — not an external URL. */
  to?: string;
}

const TOPICS: Topic[] = [
  { id: "iso8583",  icon: FileText, titleKey: "docs.cards.iso8583.title",  descriptionKey: "docs.cards.iso8583.description" },
  { id: "emv",      icon: Cpu,      titleKey: "docs.cards.emv.title",      descriptionKey: "docs.cards.emv.description" },
  { id: "roles",    icon: Network,  titleKey: "docs.cards.roles.title",    descriptionKey: "docs.cards.roles.description" },
  { id: "glossary", icon: BookOpen, titleKey: "docs.cards.glossary.title", descriptionKey: "docs.cards.glossary.description" },
  { id: "fields",   icon: Layers,   titleKey: "docs.cards.fields.title",   descriptionKey: "docs.cards.fields.description" },
  { id: "guides",   icon: Sparkles, titleKey: "docs.cards.guides.title",   descriptionKey: "docs.cards.guides.description" },
  // Navigation card: opens the dedicated API reference page (which itself
  // links out to the Scalar UI). Routed through react-router so the SPA
  // doesn't reload.
  { id: "api",      icon: Terminal, titleKey: "docs.cards.api.title",      descriptionKey: "docs.cards.api.description", to: "/docs/api" },
  { id: "community", icon: MessageCircle, titleKey: "docs.cards.community.title", descriptionKey: "docs.cards.community.description" },
];

const STORAGE_KEY = "isoleaf-docs-open";

export default function DocsPage() {
  const { t, i18n } = useTranslation();

  // One section open at a time. Persisted across reloads + honors a URL hash
  // (e.g. /docs#iso8583) when the user lands directly on a deep link.
  const [openId, setOpenId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const fromHash = window.location.hash.replace(/^#/, "");
    if (fromHash && TOPICS.some((t) => t.id === fromHash)) return fromHash;
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  useEffect(() => {
    try {
      if (openId) localStorage.setItem(STORAGE_KEY, openId);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore quota / private mode */ }
  }, [openId]);

  // Pick the right content map for the active language. Anything outside the
  // two known locales falls back to English to match the app's fallbackLng.
  const docs = i18n.language?.startsWith("pt") ? DOCS_PT : DOCS_EN;

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const onToggle = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) {
      // Scroll the just-opened card into view once the panel has rendered.
      setTimeout(() => cardRefs.current[next]?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 80);
      try { history.replaceState(null, "", `#${next}`); } catch { /* ignore */ }
    } else {
      try { history.replaceState(null, "", window.location.pathname); } catch { /* ignore */ }
    }
  };

  const onCopyLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try { navigator.clipboard.writeText(url); } catch { /* ignore */ }
  };

  return (
    <AppShell title={t("docs.title")} subtitle={t("docs.subtitle")}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          const isOpen = openId === topic.id;

          // Navigation-tile branch: react-router Link wraps the card body.
          // No accordion, no expand state — clicking transitions the SPA to
          // topic.to without a full reload.
          if (topic.to) {
            return (
              <div key={topic.id} id={topic.id}>
                <Link
                  to={topic.to}
                  className="block group"
                  data-testid={`docs-card-${topic.id}`}
                >
                  <Card className="transition-colors hover:border-accent/40 group-hover:border-accent/40 h-full">
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-9 h-9 rounded-md bg-accent-bg text-accent-text flex items-center justify-center shrink-0">
                          <Icon size={18} />
                        </div>
                        <ChevronRight size={18} className="text-text-tertiary shrink-0 mt-1 group-hover:text-accent" />
                      </div>
                      <h3 className="text-sm font-semibold leading-tight">{t(topic.titleKey)}</h3>
                      <p className="text-xs text-text-secondary leading-relaxed">{t(topic.descriptionKey)}</p>
                    </CardBody>
                  </Card>
                </Link>
              </div>
            );
          }

          return (
            <div
              key={topic.id}
              ref={(el) => { cardRefs.current[topic.id] = el; }}
              id={topic.id}
              // Span every column when open so the expanded content takes the
              // full width of the grid; collapsed cards stay 1-column tiles.
              className={clsx(isOpen && "md:col-span-2 lg:col-span-3")}
            >
              <Card className={clsx(
                "transition-colors",
                isOpen ? "border-accent/60" : "hover:border-accent/40"
              )}>
                <button
                  type="button"
                  onClick={() => onToggle(topic.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left"
                >
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-9 h-9 rounded-md bg-accent-bg text-accent-text flex items-center justify-center shrink-0">
                        <Icon size={18} />
                      </div>
                      {isOpen
                        ? <ChevronDown size={18} className="text-text-tertiary shrink-0 mt-1" />
                        : <ChevronRight size={18} className="text-text-tertiary shrink-0 mt-1" />}
                    </div>
                    <h3 className="text-sm font-semibold leading-tight">{t(topic.titleKey)}</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{t(topic.descriptionKey)}</p>
                  </CardBody>
                </button>

                {isOpen && (
                  <CardBody className="border-t border-[var(--border)] pt-4">
                    <div className="flex items-center justify-end mb-3">
                      <button
                        type="button"
                        onClick={() => onCopyLink(topic.id)}
                        className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-accent"
                        title={t("docs.copyLink")}
                      >
                        <LinkIcon size={12} /> #{topic.id}
                      </button>
                    </div>
                    <DocBlocks blocks={docs[topic.id]?.blocks ?? []} />
                  </CardBody>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
