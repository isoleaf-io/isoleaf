import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { PageHeader } from "./PageHeader";

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
 */
export function AppShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="flex h-full bg-bg-secondary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <PageHeader title={title} subtitle={subtitle} actions={actions} />
          {children}
        </div>
      </main>
    </div>
  );
}
