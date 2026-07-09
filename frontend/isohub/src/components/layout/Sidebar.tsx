import { useCallback, useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  LayoutGrid,
  Lock,
  QrCode,
  Radio,
  Settings,
  Workflow,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { StatusDot } from "@/components/ui/StatusDot";
import { useHealth } from "@/hooks/useHealth";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { FEATURES, type FeatureKey } from "@/config/features";
import { APP_VERSION } from "@/version";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof Code2;
  /** External link (opens in a new tab). When set, NavRow renders <a> instead of NavLink. */
  external?: boolean;
  /** Build-time feature flag gating this item. Item is hidden when the flag is off. */
  feature?: FeatureKey;
}

interface NavSubsection {
  titleKey: string;
  items: NavItem[];
}

/**
 * Collapsible parent group — the top-level "world" (ISO 8583, ISO 20022).
 * Its header toggles expansion, its subsections carry the small-caps labels
 * that used to be the top level of the sidebar, and its `looseItems` render
 * without a subsection header (used for Simulador at the same level as the
 * subsections).
 */
interface CollapsibleGroup {
  kind: "group";
  /** Stable id used as the localStorage key for expansion state. */
  groupId: string;
  titleKey: string;
  feature?: FeatureKey;
  subsections: NavSubsection[];
  looseItems?: NavItem[];
}

/**
 * Flat section — no chevron, always visible. Used for Cross-Protocol tools
 * and the Reference/Docs group in the footer area.
 */
interface FlatSection {
  kind: "flat";
  titleKey: string;
  items: NavItem[];
  /**
   * Visual divider above this section.
   *   - "subtle"    → thin top border with less breathing room; marks a
   *     different category (Cross-Protocol) without competing visually
   *     with the mother-group separators.
   *   - "separated" → thicker breathing room + border; used at the
   *     footer boundary to peel Reference/Docs off from the main tree.
   */
  divider?: "subtle" | "separated";
}

type NavEntry = CollapsibleGroup | FlatSection;

/**
 * Menu structure. Split into two collapsible mother-groups (ISO 8583, ISO
 * 20022) each containing subsections, plus a flat Cross-Protocol Tools
 * section and the Reference/Docs group at the bottom. No route was moved —
 * only the visual hierarchy changed.
 */
const NAV: NavEntry[] = [
  {
    kind: "group",
    groupId: "iso8583",
    titleKey: "common.nav.iso8583",
    subsections: [
      {
        titleKey: "common.nav.messages",
        items: [
          { to: "/parser",  labelKey: "common.nav.parser",  icon: Code2 },
          { to: "/builder", labelKey: "common.nav.builder", icon: Zap },
          { to: "/bitmap",  labelKey: "common.nav.bitmap",  icon: LayoutGrid },
          // "Cartão de teste" moved here from the EMV & Cartões subsection
          // — the analyst reaches for it while composing a message, not
          // while inspecting EMV data.
          { to: "/cards",   labelKey: "common.nav.cards",   icon: CreditCard },
        ],
      },
      {
        titleKey: "common.nav.emvCards",
        items: [
          { to: "/emv", labelKey: "common.nav.emv", icon: Cpu },
        ],
      },
    ],
    // Simulador sits at the same hierarchical level as the subsections
    // (Mensagens, EMV & Cartões) — one leaf item, no subsection header
    // above it.
    looseItems: [
      { to: "/simulator", labelKey: "common.nav.simulator", icon: Radio },
    ],
  },
  {
    kind: "group",
    groupId: "iso20022",
    titleKey: "common.nav.iso20022",
    feature: "iso20022",
    subsections: [
      {
        titleKey: "common.nav.generic",
        items: [
          { to: "/iso20022/parser",    labelKey: "common.nav.iso20022Parser",     icon: Code2,      feature: "iso20022Parser" },
          { to: "/iso20022/reference", labelKey: "common.nav.iso20022FieldRef",   icon: FileText,   feature: "iso20022FieldRef" },
          { to: "/iso20022/compare",   labelKey: "common.nav.iso20022Comparator", icon: LayoutGrid, feature: "iso20022Comparator" },
          { to: "/iso20022/builder",   labelKey: "common.nav.iso20022Builder",    icon: Zap,        feature: "iso20022Builder" },
        ],
      },
      {
        titleKey: "common.nav.pix",
        items: [
          { to: "/pix/qrcode", labelKey: "common.nav.pixQrCode", icon: QrCode, feature: "pixQrCode" },
        ],
      },
      {
        titleKey: "common.nav.cbpr",
        items: [
          { to: "/swift/mt-parser",     labelKey: "common.nav.swiftMtParser",     icon: Globe,      feature: "swiftMtParser" },
          { to: "/swift/mt-comparator", labelKey: "common.nav.swiftMtComparator", icon: LayoutGrid, feature: "swiftMtComparator" },
        ],
      },
    ],
  },
  {
    kind: "flat",
    titleKey: "common.nav.crossProtocol",
    divider: "subtle",
    items: [
      { to: "/flow", labelKey: "common.nav.flowVisualizer", icon: Workflow, feature: "pixFlowVisualizer" },
    ],
  },
  {
    kind: "flat",
    titleKey: "common.nav.reference",
    divider: "separated",
    items: [
      // Docs live on the dedicated GitHub Pages site so search engines index
      // them and the React bundle stays lean.
      { to: "https://docs.isoleaf.dev", labelKey: "common.nav.docs", icon: BookOpen, external: true },
    ],
  },
];

const FOOTER_NAV: NavItem = {
  to: "/workspace",
  labelKey: "common.nav.workspace",
  icon: Settings,
};

// localStorage key + default set. The initial value is "both parent groups
// open" so a first-time visitor sees the full menu; from then on the user's
// last-seen expand state is preserved across reloads.
const EXPANDED_STORAGE_KEY = "isoleaf.sidebar.expandedGroups";
const DEFAULT_EXPANDED_GROUPS: readonly string[] = ["iso8583", "iso20022"];

function readExpandedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw == null) return new Set(DEFAULT_EXPANDED_GROUPS);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_EXPANDED_GROUPS);
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    // Corrupt payload / storage disabled — fall back to defaults so the
    // sidebar stays usable.
    return new Set(DEFAULT_EXPANDED_GROUPS);
  }
}

function writeExpandedGroups(set: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Best-effort — a failed write doesn't affect the in-memory state.
  }
}

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

/**
 * Filter items by their feature flag; used for both loose items and
 * subsection items so a single-flag helper covers every list.
 */
function filterItems(items: NavItem[]): NavItem[] {
  return items.filter((i) => !i.feature || FEATURES[i.feature]);
}

/**
 * Small-caps subsection label — same visual treatment the sidebar had at
 * its previous top level, kept identical so the shift in hierarchy doesn't
 * introduce a second unfamiliar font weight.
 */
function SubsectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2 mb-1 mt-2 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
      {label}
    </div>
  );
}

function CollapsibleGroupView({
  group,
  expanded,
  onToggle,
  simulatorLocked,
  onNavigate,
  showTopBorder,
}: {
  group: CollapsibleGroup;
  expanded: boolean;
  onToggle: () => void;
  simulatorLocked: boolean;
  onNavigate?: () => void;
  /**
   * Whether to draw the thin top divider that separates this group
   * from what precedes it. Suppressed for the first mother-group so the
   * line doesn't sit directly under the app logo (would read redundant
   * with the logo's own visual "seat").
   */
  showTopBorder: boolean;
}) {
  const { t } = useTranslation();

  // Feature-filter every list up front so an all-empty group can be
  // hidden entirely (no dangling header pointing at nothing).
  const visibleSubsections = group.subsections
    .map((s) => ({ ...s, items: filterItems(s.items) }))
    .filter((s) => s.items.length > 0);
  const visibleLoose = filterItems(group.looseItems ?? []);
  if (visibleSubsections.length === 0 && visibleLoose.length === 0) return null;

  return (
    <div
      className={clsx(
        // pt-4 on every mother-group gives both headers the same
        // breathing room the reference banking-menu style uses to peel
        // "worlds" apart. The optional top border is what makes the
        // separation explicit; the padding stays even when suppressed.
        "px-3 pt-4 mb-3",
        showTopBorder && "border-t border-[var(--border)]",
      )}
      data-testid={`sidebar-group-${group.groupId}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`sidebar-group-body-${group.groupId}`}
        data-testid={`sidebar-group-toggle-${group.groupId}`}
        // Higher-contrast treatment than the subsection labels so the
        // two "worlds" (ISO 8583, ISO 20022) read as a level above their
        // subsections: bolder weight, slightly stronger colour, and a
        // subtle hover background. Chevron flips on state.
        className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-text-primary hover:bg-bg-tertiary transition-colors"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>{t(group.titleKey)}</span>
      </button>
      {expanded && (
        <div id={`sidebar-group-body-${group.groupId}`}>
          {visibleSubsections.map((sub) => (
            <div key={sub.titleKey}>
              <SubsectionHeader label={t(sub.titleKey)} />
              {sub.items.map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
          {visibleLoose.length > 0 && (
            <div className="mt-2">
              {visibleLoose.map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  locked={item.to === "/simulator" && simulatorLocked}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlatSectionView({
  section,
  onNavigate,
}: {
  section: FlatSection;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const items = filterItems(section.items);
  if (items.length === 0) return null;

  return (
    <div
      data-testid={`sidebar-flat-${section.titleKey}`}
      className={clsx(
        "px-3 mb-3",
        // "subtle" — same border colour as the mother-group divider but
        // with less top padding, so this section reads as a marginal
        // category rather than a peer of ISO 8583 / ISO 20022.
        section.divider === "subtle" && "pt-2 border-t border-[var(--border)]",
        // "separated" — thicker breathing room + same border; used for
        // the footer Reference/Docs group.
        section.divider === "separated" && "mt-3 pt-3 border-t border-[var(--border)]",
      )}
    >
      <div className="px-2 mb-1 text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">
        {t(section.titleKey)}
      </div>
      {items.map((item) => (
        <NavRow key={item.to} item={item} onNavigate={onNavigate} />
      ))}
    </div>
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
  const simulatorLocked = !simulatorEnabled;

  // Expansion state for the collapsible groups. Initialised from
  // localStorage on mount so the sidebar comes up in the same state the
  // user left it; every toggle persists back synchronously.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    readExpandedGroups(),
  );

  useEffect(() => {
    writeExpandedGroups(expandedGroups);
  }, [expandedGroups]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

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
        {(() => {
          // Track which visible collapsible group is first, so its top
          // divider can be suppressed (the logo above already acts as a
          // visual anchor and a line right below would read redundant).
          // We count `feature`-gated groups too — if ISO 8583 is ever
          // gated off in the future the first *visible* one still gets
          // no border.
          let seenFirstGroup = false;
          return NAV.map((entry) => {
            if (entry.kind === "group") {
              if (entry.feature && !FEATURES[entry.feature]) return null;
              const isFirst = !seenFirstGroup;
              seenFirstGroup = true;
              return (
                <CollapsibleGroupView
                  key={entry.groupId}
                  group={entry}
                  expanded={expandedGroups.has(entry.groupId)}
                  onToggle={() => toggleGroup(entry.groupId)}
                  simulatorLocked={simulatorLocked}
                  onNavigate={onNavigate}
                  showTopBorder={!isFirst}
                />
              );
            }
            return (
              <FlatSectionView
                key={entry.titleKey}
                section={entry}
                onNavigate={onNavigate}
              />
            );
          });
        })()}
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
