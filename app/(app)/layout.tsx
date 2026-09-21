import Link from "next/link";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { requireSession } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/board", label: "Board", phase: 1 },
  { href: "/meetings", label: "Meetings", phase: 2 },
  { href: "/decisions", label: "Decisions", phase: 4 },
  { href: "/archive", label: "Archive", phase: 2 },
] as const;

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const { user } = session;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-13 items-center gap-4 border-border border-b bg-surface-1 px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground text-sm">
            E
          </span>
          <span className="font-semibold text-foreground text-sm max-sm:hidden">
            Engineering Hub
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) =>
            "phase" in item ? (
              <span
                key={item.href}
                title={`Coming in phase ${item.phase}`}
                className="cursor-default rounded-md px-3 py-1.5 text-muted-foreground/60 text-sm"
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-foreground text-sm hover:bg-accent"
              >
                {item.label}
              </Link>
            ),
          )}
          {user.role === "admin" && (
            <Link
              href="/admin/users"
              className="rounded-md px-3 py-1.5 text-foreground text-sm hover:bg-accent"
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <span className="text-muted-foreground text-xs max-sm:hidden">
            {user.name} · <span className="capitalize">{user.role}</span>
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
