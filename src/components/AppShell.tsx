import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  LogOut,
  Moon,
  PhoneCall,
  Send,
  Sun,
  Target,
  Users,
  CalendarClock,
  Database,
} from "lucide-react";
import type { ReactNode } from "react";

import { BrandStrap } from "@/components/Brand";
import { DropletField } from "@/components/DropletField";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const NAV = [
  { to: "/dashboard", label: "Command", icon: BarChart3, managerOnly: false },
  { to: "/calling", label: "Calling", icon: PhoneCall, managerOnly: false },
  { to: "/leads", label: "Leads", icon: Target, managerOnly: false },
  { to: "/tasks", label: "Follow-ups", icon: CalendarClock, managerOnly: false },
  { to: "/data", label: "Data", icon: Database, managerOnly: false },
  { to: "/blast", label: "Blast", icon: Send, managerOnly: false },
  { to: "/team", label: "Team", icon: Users, managerOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, isManager, signOut } = useAuth();
  const { mode, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((item) => !item.managerOnly || isManager);

  return (
    <div className="min-h-screen pb-24 sm:pb-8">
      <DropletField />

      <header className="sticky top-0 z-40">
        <BrandStrap compact />
        <div className="glass mx-auto mt-3 flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3 py-2 sm:mx-4">
          <nav className="hidden items-center gap-1 sm:flex">
            {items.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`press flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-lift"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:hidden">
            <span className="text-sm font-semibold">{profile?.full_name ?? "Ezmora"}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-border px-3 py-1 text-xs font-medium tracking-wide uppercase text-muted-foreground sm:inline">
              {role}
            </span>
            <button
              onClick={toggle}
              aria-label="Toggle light and dark mode"
              className="press rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="press rounded-xl border border-border p-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>

      <nav className="glass bottom-nav-overlay fixed bottom-3 left-3 right-3 z-[100] isolate flex items-center justify-between overflow-hidden rounded-2xl px-2 py-2 sm:hidden">
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-background" />
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`press flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <item.icon className="size-4" />
              {item.label === "Follow-ups" ? (
                <span className="whitespace-nowrap">{item.label}</span>
              ) : (
                item.label
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}