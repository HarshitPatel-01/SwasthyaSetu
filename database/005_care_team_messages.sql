-- Shared, simple patient <-> health worker <-> doctor conversation
CREATE TABLE IF NOT EXISTS care_team_messages (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT NOT NULL,
  recipient_role TEXT NOT NULL,
  recipient_id TEXT,
  recipient_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
