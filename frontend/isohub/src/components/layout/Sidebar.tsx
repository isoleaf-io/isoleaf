import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Code2,
  Cpu,
  CreditCard,
  LayoutGrid,
  Radio,
  Settings,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { StatusDot } from "@/components/ui/StatusDot";
import { Logo } from "@/components/ui/Logo";
import { useHealth } from "@/hooks/useHealth";
import { useAppConfig } from "@/contexts/AppConfigContext";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof Code2;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
  /** Visually separates this section from the previous one with extra spacing. */
  separated?: boolean;
}

const sections: NavSection[] = [
  {
    titleKey: "common.nav.iso8583",
    items: [
      { to: "/parser", labelKey: "common.nav.parser", icon: Code2 },
      { to: "/builder", labelKey: "common.nav.builder", icon: Zap },
      { to: "/bitmap", labelKey: "common.nav.bitmap", icon: LayoutGrid },
    ],
  },
  {
    titleKey: "common.nav.emvCards",
    items: [
      { to: "/emv", labelKey: "common.nav.emv", icon: Cpu },
      { to: "/cards", labelKey: "common.nav.cards", icon: CreditCard },
    ],
  },
  {
    titleKey: "common.nav.testing",
    items: [{ to: "/simulator", labelKey: "common.nav.simulator", icon: Radio }],
  },
  {
    titleKey: "common.nav.reference",
    separated: true,
    items: [{ to: "/docs", labelKey: "common.nav.docs", icon: BookOpen }],
  },
];

const FOOTER_NAV: NavItem = {
  to: "/workspace",
  labelKey: "common.nav.workspace",
  icon: Settings,
};

function NavRow({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
          isActive
            ? "bg-accent-bg text-accent-text font-medium"
            : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        )
      }
    >
      <Icon size={15} />
      {t(item.labelKey)}
    </NavLink>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { data, isError } = useHealth();
  const online = !isError && data?.status === "ok";
  const { simulatorEnabled } = useAppConfig();

  // Filter out sections whose items become empty when a feature is off,
  // and the items themselves (e.g. /simulator hidden in online mode).
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.to === "/simulator" ? simulatorEnabled : true,
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="w-[220px] shrink-0 bg-bg-sidebar border-r border-[var(--border)] flex flex-col">
      <div className="px-5 py-5">
        <Link
          to="/parser"
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
          aria-label="ISOLeaf home"
        >
          <Logo variant="icon" size={32} />
          <div className="leading-tight">
            <div className="text-sm font-semibold">{t("common.appName")}</div>
            <div className="text-[11px] text-text-tertiary">{t("common.version")}</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {visibleSections.map((section) => (
          <div
            key={section.titleKey}
            className={clsx(
              "px-3 mb-3",
              section.separated && "mt-3 pt-3 border-t border-[var(--border)]"
            )}
          >
            <div className="px-2 mb-1 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
              {t(section.titleKey)}
            </div>
            {section.items.map((item) => (
              <NavRow key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer-pinned: Workspace lives below the agent status, no section header. */}
      <div className="px-3 pb-2 pt-3 border-t border-[var(--border)]">
        <NavRow item={FOOTER_NAV} />
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-2">
        <StatusDot status={online ? "online" : "offline"} />
        <span className="text-xs text-text-secondary">
          {online ? t("common.agentOnline") : t("common.agentOffline")}
        </span>
      </div>
    </aside>
  );
}
