CREATE TABLE "activity_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"actor_id" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_column" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"wip_hint" integer,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "task_display_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"column_id" uuid NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"assignee_id" text NOT NULL,
	"project_id" uuid,
	"type_id" uuid NOT NULL,
	"requester_name" text,
	"requester_department" text,
	"priority" text DEFAULT 'p2' NOT NULL,
	"estimate" text,
	"due_date" date,
	"blocked_reason" text,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"created_by_type" text DEFAULT 'user' NOT NULL,
	"created_by_id" text NOT NULL,
	"origin_meeting_id" uuid,
	"done_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"mentions" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'internal' NOT NULL,
	"icon" text DEFAULT 'wrench' NOT NULL,
	"is_external" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_column_id_board_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_column"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_type_id_task_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."task_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "task_column_position_idx" ON "task" USING btree ("column_id","position");--> statement-breakpoint
CREATE INDEX "task_assignee_idx" ON "task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "task_project_idx" ON "task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_type_idx" ON "task" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "task_comment_task_idx" ON "task_comment" USING btree ("task_id","created_at");