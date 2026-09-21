import Link from "next/link";

export function AdminTabs({ active }: { active: "users" | "board" }) {
  const cls = (isActive: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${
      isActive
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;
  return (
    <nav className="mb-4 flex gap-1 rounded-md border border-border bg-surface-1 p-0.5 w-fit">
      <Link href="/admin/users" className={cls(active === "users")}>
        Users
      </Link>
      <Link href="/admin/board" className={cls(active === "board")}>
        Board setup
      </Link>
    </nav>
  );
}
