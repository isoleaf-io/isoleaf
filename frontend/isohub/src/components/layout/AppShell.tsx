import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { PageHeader } from "./PageHeader";
import { OnlineBanner } from "./OnlineBanner";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Single-column main layout: sidebar + scrollable content area.
 * The previous global Topbar is gone — its title/subtitle/theme toggles
 * are now inlined via <PageHeader /> inside the scrollable area.
 *
 * The <OnlineBanner /> sits above the scroll area so it stays visible while
 * the user scrolls long pages. It auto-hides in standalone mode.
 */
export function AppShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="flex h-full bg-bg-secondary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto flex flex-col">
        <OnlineBanner />
        <div className="max-w-[1400px] mx-auto px-6 py-5 w-full">
          <PageHeader title={title} subtitle={subtitle} actions={actions} />
          {children}
        </div>
      </main>
    </div>
  );
}
