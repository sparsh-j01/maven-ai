ALTER TABLE "interviews" ADD COLUMN "company_type" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "questions" SET "slug" = 'q-' || "id"::text WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "file_size" integer;
