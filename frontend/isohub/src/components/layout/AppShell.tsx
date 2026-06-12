import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { PageHeader } from "./PageHeader";
import { OnlineBanner } from "./OnlineBanner";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex flex-col md:flex-row h-full bg-bg-secondary">
      {/* Mobile-only top bar: visible below md, hamburger opens the drawer.
          Spacer on the right keeps the logo visually centered next to the button. */}
      <header className="flex md:hidden items-center justify-between px-4 py-2 bg-bg-sidebar border-b border-[var(--border)] shrink-0">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open menu"
          className="p-2 -m-2 text-text-primary hover:text-accent-text transition-colors"
        >
          <Menu size={20} />
        </button>
        <img src="/logo.svg" alt="ISOLeaf" className="h-8 w-auto block dark:hidden" draggable={false} />
        <img src="/logo-dark.svg" alt="ISOLeaf" className="h-8 w-auto hidden dark:block" draggable={false} />
        <span aria-hidden className="w-9" />
      </header>

      {isSidebarOpen && (
        <div
          data-testid="sidebar-overlay"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onNavigate={closeSidebar} />

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
