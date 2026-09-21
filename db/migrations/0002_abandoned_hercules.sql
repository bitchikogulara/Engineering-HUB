CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"participants" text[] DEFAULT '{}' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"free_text" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" text,
	"created_by_id" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"cadence" text,
	"duration_minutes" integer,
	"participants" text,
	"reminder_offsets" integer[] DEFAULT '{15}' NOT NULL,
	"sections" jsonb NOT NULL,
	"agenda_rules" text[] DEFAULT '{}' NOT NULL,
	"extraction_instructions" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objective" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"week_start" date NOT NULL,
	"owner_id" text NOT NULL,
	"state" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestion_dismissal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"dismissed_by_id" text NOT NULL,
	"dismissed_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "objective_id" uuid;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_template_id_meeting_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."meeting_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective" ADD CONSTRAINT "objective_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_dismissal" ADD CONSTRAINT "suggestion_dismissal_dismissed_by_id_user_id_fk" FOREIGN KEY ("dismissed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_status_idx" ON "meeting" USING btree ("status","date");--> statement-breakpoint
CREATE INDEX "meeting_template_base_idx" ON "meeting_template" USING btree ("base_id","version");--> statement-breakpoint
CREATE INDEX "objective_week_idx" ON "objective" USING btree ("week_start","state");--> statement-breakpoint
CREATE INDEX "suggestion_dismissal_key_idx" ON "suggestion_dismissal" USING btree ("key");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_objective_id_objective_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objective"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_origin_meeting_id_meeting_id_fk" FOREIGN KEY ("origin_meeting_id") REFERENCES "public"."meeting"("id") ON DELETE no action ON UPDATE no action;