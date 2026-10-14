CREATE TABLE "match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"score" smallint NOT NULL,
	"strong" boolean NOT NULL,
	"breakdown" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentorship_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentee_id" uuid NOT NULL,
	"primary_arch" text NOT NULL,
	"target_subcategories" text[] NOT NULL,
	"commercial_skills" text[] DEFAULT '{}' NOT NULL,
	"stakeholder_interests" text[] DEFAULT '{}' NOT NULL,
	"deal_size" text,
	"competitors" text[] DEFAULT '{}' NOT NULL,
	"formats" text[] NOT NULL,
	"goal" text NOT NULL,
	"goal_embedding" vector(384),
	"embedding_model" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"algorithm_version" text NOT NULL,
	"evaluated" integer DEFAULT 0 NOT NULL,
	"excluded" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"mentee_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"match_score" smallint,
	"breakdown" jsonb,
	"focus" text DEFAULT '' NOT NULL,
	"message" text,
	"decline_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"webex_room_id" text,
	"webex_room_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cec_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"job_title" text NOT NULL,
	"manager_id" uuid,
	"webex_email" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"se_role" text,
	"specialist_arch" text,
	"theater" text,
	"segment" text,
	"regional_sub" text,
	"timezone" text,
	"bio" text DEFAULT '' NOT NULL,
	"bio_embedding" vector(384),
	"embedding_model" text,
	"is_mentor" boolean DEFAULT false NOT NULL,
	"mentee_capacity" smallint DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'self' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_capacity_ck" CHECK ("people"."mentee_capacity" between 1 and 2)
);
--> statement-breakpoint
CREATE TABLE "person_skills" (
	"person_id" uuid NOT NULL,
	"subcategory" text NOT NULL,
	"level" smallint NOT NULL,
	CONSTRAINT "person_skills_person_id_subcategory_pk" PRIMARY KEY("person_id","subcategory"),
	CONSTRAINT "person_skills_level_ck" CHECK ("person_skills"."level" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "person_tags" (
	"person_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	CONSTRAINT "person_tags_person_id_kind_code_pk" PRIMARY KEY("person_id","kind","code")
);
--> statement-breakpoint
CREATE TABLE "taxonomy_items" (
	"code" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"parent" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"version" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_request_id_mentorship_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."mentorship_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_mentor_id_people_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentee_id_people_id_fk" FOREIGN KEY ("mentee_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_deal_size_taxonomy_items_code_fk" FOREIGN KEY ("deal_size") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_request_id_mentorship_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."mentorship_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentee_id_people_id_fk" FOREIGN KEY ("mentee_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentor_id_people_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_manager_id_people_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_se_role_taxonomy_items_code_fk" FOREIGN KEY ("se_role") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_specialist_arch_taxonomy_items_code_fk" FOREIGN KEY ("specialist_arch") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_theater_taxonomy_items_code_fk" FOREIGN KEY ("theater") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_segment_taxonomy_items_code_fk" FOREIGN KEY ("segment") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_regional_sub_taxonomy_items_code_fk" FOREIGN KEY ("regional_sub") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_timezone_taxonomy_items_code_fk" FOREIGN KEY ("timezone") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_subcategory_taxonomy_items_code_fk" FOREIGN KEY ("subcategory") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_code_taxonomy_items_code_fk" FOREIGN KEY ("code") REFERENCES "public"."taxonomy_items"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_results_request_mentor_uq" ON "match_results" USING btree ("request_id","mentor_id");--> statement-breakpoint
CREATE INDEX "mentorship_requests_mentee_idx" ON "mentorship_requests" USING btree ("mentee_id","created_at");--> statement-breakpoint
CREATE INDEX "mentorships_mentor_status_idx" ON "mentorships" USING btree ("mentor_id","status");--> statement-breakpoint
CREATE INDEX "mentorships_mentee_status_idx" ON "mentorships" USING btree ("mentee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorships_open_pair_uq" ON "mentorships" USING btree ("mentee_id","mentor_id") WHERE "mentorships"."status" in ('PENDING', 'ACTIVE');--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("id") WHERE "outbox_events"."processed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "people_cec_id_uq" ON "people" USING btree ("cec_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_webex_email_uq" ON "people" USING btree (lower("webex_email"));--> statement-breakpoint
CREATE INDEX "people_manager_idx" ON "people" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "people_mentor_pool_idx" ON "people" USING btree ("is_mentor","specialist_arch");--> statement-breakpoint
CREATE INDEX "person_skills_lookup_idx" ON "person_skills" USING btree ("subcategory","level");--> statement-breakpoint
CREATE INDEX "person_tags_lookup_idx" ON "person_tags" USING btree ("kind","code");--> statement-breakpoint
CREATE INDEX "taxonomy_items_kind_idx" ON "taxonomy_items" USING btree ("kind","sort");