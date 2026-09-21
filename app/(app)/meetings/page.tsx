import type { Metadata } from "next";
import { hasPermission } from "@/lib/permissions";
import { getActiveTemplates, getRecentMeetings } from "@/lib/queries/meetings";
import { requireSession } from "@/lib/session";
import { MeetingsScreen } from "./meetings-screen";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const session = await requireSession();
  const [templates, meetings] = await Promise.all([
    getActiveTemplates(),
    getRecentMeetings(),
  ]);

  return (
    <MeetingsScreen
      templates={templates.map((t) => ({
        baseId: t.baseId,
        name: t.name,
        cadence: t.cadence,
        durationMinutes: t.durationMinutes,
        participants: t.participants,
      }))}
      meetings={meetings.map((m) => ({
        id: m.id,
        date: m.date.toISOString(),
        status: m.status,
        templateName: m.templateName,
        createdByName: m.createdByName,
      }))}
      canStart={hasPermission(session.user.role, "meeting.participate")}
    />
  );
}
