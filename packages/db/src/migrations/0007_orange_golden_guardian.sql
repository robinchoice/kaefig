CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_hash" varchar(64) NOT NULL,
	"nym" varchar(40) DEFAULT 'anon' NOT NULL,
	"ln_address" varchar(200),
	"document" text NOT NULL,
	"tier" integer DEFAULT 0 NOT NULL,
	"stopped" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_payment_hash_unique" UNIQUE("payment_hash")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	"sats" integer NOT NULL,
	"ln_address" varchar(200),
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "protocol" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"event" varchar(40) NOT NULL,
	"subject" varchar(120) NOT NULL,
	"detail" varchar(300) NOT NULL,
	"prev_hash" varchar(64),
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;