import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminTabs } from "@/components/shell/admin-tabs";
import { hasPermission } from "@/lib/permissions";
import { getBoardConfig } from "@/lib/queries/board";
import { requireSession } from "@/lib/session";
import { BoardAdminScreen } from "./board-admin-screen";

export const metadata: Metadata = { title: "Board settings" };
export const dynamic = "force-dynamic";

export default async function BoardAdminPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "board.configure")) {
    redirect("/dashboard");
  }
  const config = await getBoardConfig();
  return (
    <div className="mx-auto max-w-3xl">
      <AdminTabs active="board" />
      <BoardAdminScreen
        columns={config.columns}
        projects={config.projects}
        types={config.types}
      />
    </div>
  );
}
