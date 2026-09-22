import { and, count, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { NotificationBell } from "@/components/shell/notification-bell";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireSession } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/board", label: "Board" },
  { href: "/objectives", label: "Objectives" },
  { href: "/meetings", label: "Meetings" },
  { href: "/decisions", label: "Decisions" },
  { href: "/analytics", label: "Analytics" },
  { href: "/archive", label: "Archive" },
] as const;

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const { user } = session;
  const [{ value: unread }] = await db
    .select({ value: count() })
    .from(notification)
    .where(and(eq(notification.userId, user.id), isNull(notification.readAt)));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-13 items-center gap-4 border-border border-b bg-surface-1 px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground text-sm">
            E
          </span>
          <span className="font-semibold text-foreground text-sm max-lg:hidden">
            Engineering Hub
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-foreground text-sm hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
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
          <NotificationBell unread={unread} />
          <ThemeToggle />
          <Link
            href="/account"
            className="text-muted-foreground text-xs hover:text-foreground max-sm:hidden"
          >
            {user.name.split(" ")[0]} ·{" "}
            <span className="capitalize">{user.role}</span>
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
