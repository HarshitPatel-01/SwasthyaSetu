-- Swasthya Setu: persistent doctor roster + referral handover token
CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  phone TEXT,
  availability TEXT,
  working_hours TEXT NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  facility_id TEXT NOT NULL
);

-- Referral records carry a unique token that the receiving hospital uses to identify the handover.
ALTER TABLE referrals ADD COLUMN referral_token TEXT;
ALTER TABLE referrals ADD COLUMN patient_name TEXT;
ALTER TABLE referrals ADD COLUMN to_facility_name TEXT;
ALTER TABLE referrals ADD COLUMN from_facility_name TEXT;
