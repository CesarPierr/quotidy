-- Allow households to opt out of the Savings module from the navigation.
-- Existing households default to true (no behavior change on upgrade).
ALTER TABLE "Household" ADD COLUMN "savingsEnabled" BOOLEAN NOT NULL DEFAULT true;
