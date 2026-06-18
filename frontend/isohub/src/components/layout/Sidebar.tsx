import { Link, NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Code2,
  Cpu,
  CreditCard,
  ExternalLink,
  LayoutGrid,
  Lock,
  Radio,
  Settings,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { StatusDot } from "@/components/ui/StatusDot";
import { useHealth } from "@/hooks/useHealth";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { APP_VERSION } from "@/version";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof Code2;
  /** External link (opens in a new tab). When set, NavRow renders <a> instead of NavLink. */
  external?: boolean;
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
    items: [
      // Docs live on the dedicated GitHub Pages site so search engines index
      // them and the React bundle stays lean. The in-app /docs route still
      // exists as a fallback for direct-URL visits.
      { to: "https://docs.isoleaf.dev", labelKey: "common.nav.docs", icon: BookOpen, external: true },
    ],
  },
];

const FOOTER_NAV: NavItem = {
  to: "/workspace",
  labelKey: "common.nav.workspace",
  icon: Settings,
};

function NavRow({
  item,
  locked,
  onNavigate,
}: {
  item: NavItem;
  locked?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const baseCls =
    "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-text-secondary hover:bg-bg-tertiary hover:text-text-primary";

  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener"
        onClick={onNavigate}
        className={baseCls}
      >
        <Icon size={15} />
        <span className="flex-1">{t(item.labelKey)}</span>
        <ExternalLink size={11} className="text-text-tertiary shrink-0" aria-hidden />
      </a>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
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
      <span className="flex-1">{t(item.labelKey)}</span>
      {locked && <Lock size={11} className="text-text-tertiary shrink-0" />}
    </NavLink>
  );
}

interface SidebarProps {
  /** Mobile drawer open state. Ignored at md+ where the sidebar is always inline. */
  isOpen?: boolean;
  /** Fired when a nav item is clicked (used by AppShell to close the mobile drawer). */
  onNavigate?: () => void;
}

export function Sidebar({ isOpen = false, onNavigate }: SidebarProps = {}) {
  const { t } = useTranslation();
  const { data, isError } = useHealth();
  const online = !isError && data?.status === "ok";
  const config = useAppConfig();
  const { simulatorEnabled, mode } = config;
  const isOnlineMode = mode === "online";

  // In online mode the Simulator stays in the menu so users can discover it,
  // but it's marked with a lock icon and the page itself renders a locked
  // panel instead of the live UI. (Earlier iteration hid the item entirely;
  // that hid the feature too well — users didn't know it existed.)

  return (
    <aside
      data-testid="sidebar"
      data-open={isOpen ? "true" : "false"}
      className={clsx(
        "w-[220px] shrink-0 bg-bg-sidebar border-r border-[var(--border)] flex flex-col",
        // Mobile: fixed drawer that slides in from the left. md+: inline column.
        "fixed inset-y-0 left-0 z-50 transition-transform md:static md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      <Link
        to="/parser"
        onClick={onNavigate}
        className="flex items-center justify-center px-4 py-3 cursor-pointer hover:opacity-85 transition-opacity"
        aria-label="ISOLeaf home"
      >
        {/* Two variants swapped by theme: the light file has a transparent canvas
            with black wordmark, and the dark file has a transparent canvas with
            white wordmark — both share the red leaf. */}
        <img src="/logo.svg" alt="ISOLeaf" className="h-32 w-auto block dark:hidden" draggable={false} />
        <img src="/logo-dark.svg" alt="ISOLeaf" className="h-32 w-auto hidden dark:block" draggable={false} />
      </Link>

      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section) => (
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
              <NavRow
                key={item.to}
                item={item}
                locked={item.to === "/simulator" && !simulatorEnabled}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer-pinned: Workspace lives below the agent status, no section header. */}
      <div className="px-3 pb-2 pt-3 border-t border-[var(--border)]">
        <NavRow item={FOOTER_NAV} onNavigate={onNavigate} />
      </div>

      {/* Agent status — only meaningful in standalone mode. In online mode
          the Agent is always running on the demo server and the user has no
          control over it, so the row would only add noise. */}
      {!isOnlineMode && (
        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-2">
          <StatusDot status={online ? "online" : "offline"} />
          <span className="text-xs text-text-secondary">
            {online ? t("common.agentOnline") : t("common.agentOffline")}
          </span>
        </div>
      )}

      {/* Version + deployment mode — static identity, kept distinct from the
          live agent connection state above so they don't read as one signal. */}
      <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-2 text-xs text-text-tertiary">
        <span>v{APP_VERSION}</span>
        <span aria-hidden>·</span>
        <span
          className={clsx(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            isOnlineMode
              ? "bg-accent-bg/40 text-accent-text"
              : "bg-success-bg/40 text-success-text",
          )}
        >
          {isOnlineMode ? "Online" : "Standalone"}
        </span>
      </div>
    </aside>
  );
}
