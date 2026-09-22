import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminTabs } from "@/components/shell/admin-tabs";
import { hasPermission } from "@/lib/permissions";
import { getActiveTemplates } from "@/lib/queries/meetings";
import { sectionsSchema } from "@/lib/schemas/meeting";
import { requireSession } from "@/lib/session";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesAdminPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "template.edit")) {
    redirect("/dashboard");
  }
  const templates = await getActiveTemplates();
  return (
    <div className="mx-auto max-w-3xl">
      <AdminTabs active="templates" />
      <TemplateEditor
        templates={templates.map((t) => ({
          baseId: t.baseId,
          name: t.name,
          version: t.version,
          durationMinutes: t.durationMinutes,
          scheduleDow: t.scheduleDow,
          scheduleTime: t.scheduleTime,
          scheduleEnabled: t.scheduleEnabled,
          extractionInstructions: t.extractionInstructions,
          sections: sectionsSchema.parse(t.sections),
        }))}
      />
    </div>
  );
}
