import type { Metadata } from "next";
import Link from "next/link";
import { searchAll } from "@/lib/queries/search";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Archive" };
export const dynamic = "force-dynamic";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSession();
  const { q = "" } = await searchParams;
  const results = q ? await searchAll(q) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-semibold text-foreground text-xl">Archive</h1>
      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search tasks, meetings, decisions…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:opacity-90"
        >
          Search
        </button>
      </form>

      {q && results.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
          Nothing found for “{q}”.
        </p>
      )}

      <ul className="space-y-2">
        {results.map((r) => (
          <li key={`${r.kind}:${r.id}`}>
            <Link
              href={r.href}
              className="block rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/50"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground capitalize">
                  {r.kind}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
                  {r.title}
                </span>
                {r.archived && (
                  <span className="rounded bg-(--badge-stale-bg) px-1.5 py-0.5 text-(--badge-stale-fg) text-[11px]">
                    archived
                  </span>
                )}
                <span className="text-muted-foreground text-xs capitalize">
                  {r.meta}
                </span>
              </div>
              {r.snippet && (
                <p className="mt-1 truncate text-muted-foreground text-xs">
                  {r.snippet}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
