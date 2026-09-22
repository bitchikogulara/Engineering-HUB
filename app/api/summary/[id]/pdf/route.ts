import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import React from "react";
import { db } from "@/db";
import { weeklySummary } from "@/db/schema";
import { requirePermission } from "@/lib/session";

// FR-29: weekly summary as a PDF file.

export const dynamic = "force-dynamic";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#12151c",
  },
  brand: { fontSize: 16, marginBottom: 2, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#59616f", marginBottom: 20 },
  body: { lineHeight: 1.6 },
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePermission("meeting.submit");
  const { id } = await params;
  const [summary] = await db
    .select()
    .from(weeklySummary)
    .where(eq(weeklySummary.id, id));
  if (!summary) return new Response("not found", { status: 404 });

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        null,
        React.createElement(
          Text,
          { style: styles.brand },
          "Engineering — weekly summary",
        ),
        React.createElement(
          Text,
          { style: styles.meta },
          `Week of ${summary.weekStart} · Transporter Group`,
        ),
        React.createElement(Text, { style: styles.body }, summary.content),
      ),
    ),
  );

  const buffer = await renderToBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="weekly-summary-${summary.weekStart}.pdf"`,
    },
  });
}
