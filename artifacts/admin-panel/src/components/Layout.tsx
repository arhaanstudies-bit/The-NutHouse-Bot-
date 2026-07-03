import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Image,
  Radio,
  Settings,
  Bot,
  LogOut,
  LogIn,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pending-users", label: "Pending Users", icon: Users },
  { href: "/approved-users", label: "Approved Users", icon: UserCheck },
  { href: "/media", label: "All Media", icon: Image },
  { href: "/broadcasts", label: "Broadcasts", icon: Radio },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { isAuthenticated, user, logout, login } = useAuth();
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <Bot className="h-6 w-6 text-primary" />
          <span className="text-sm font-bold tracking-wide text-sidebar-foreground">
            BRO X BOT
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 space-y-3">
          {isAuthenticated && user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-sidebar-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.firstName || user.email}</span>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
            >
              <LogIn className="h-4 w-4" />
              Log in
            </button>
          )}
          <p className="text-xs text-muted-foreground">Admin Panel v1.0</p>
        </div>
      </div>
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 bg-background">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}
