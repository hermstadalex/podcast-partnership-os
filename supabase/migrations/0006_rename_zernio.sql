-- Rename the column directly to reflect the platform taxonomy
ALTER TABLE "public"."clients" RENAME COLUMN "zernio_profile_id" TO "zernio_account_id";
