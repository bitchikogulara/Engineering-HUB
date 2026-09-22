CREATE TABLE "ai_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clarification_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"questions" jsonb NOT NULL,
	"answers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"context" text,
	"meeting_id" uuid,
	"date" date DEFAULT now() NOT NULL,
	"created_by_type" text DEFAULT 'user' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"feedback" text NOT NULL,
	"given_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"meeting_id" uuid,
	"proposed_instructions" text NOT NULL,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "extraction" jsonb;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "applied_result" jsonb;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "source_quote" text;--> statement-breakpoint
ALTER TABLE "ai_call" ADD CONSTRAINT "ai_call_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarification_round" ADD CONSTRAINT "clarification_round_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_round" ADD CONSTRAINT "feedback_round_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_round" ADD CONSTRAINT "feedback_round_given_by_id_user_id_fk" FOREIGN KEY ("given_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_suggestion" ADD CONSTRAINT "template_suggestion_template_id_meeting_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."meeting_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_suggestion" ADD CONSTRAINT "template_suggestion_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_call_meeting_idx" ON "ai_call" USING btree ("meeting_id","created_at");--> statement-breakpoint
CREATE INDEX "clarification_meeting_idx" ON "clarification_round" USING btree ("meeting_id","round");--> statement-breakpoint
CREATE INDEX "decision_date_idx" ON "decision" USING btree ("date");--> statement-breakpoint
CREATE INDEX "feedback_meeting_idx" ON "feedback_round" USING btree ("meeting_id","round");