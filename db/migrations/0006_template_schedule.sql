ALTER TABLE "meeting_template" ADD COLUMN "schedule_dow" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_template" ADD COLUMN "schedule_time" text;--> statement-breakpoint
ALTER TABLE "meeting_template" ADD COLUMN "monthly_last" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_template" ADD COLUMN "schedule_enabled" boolean DEFAULT true NOT NULL;