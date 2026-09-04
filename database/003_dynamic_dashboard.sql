-- Dynamic frontline dashboard data
CREATE TABLE IF NOT EXISTS medicine_inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 20,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teleconsults (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  appointment_id TEXT,
  doctor_id TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  requested_at TEXT NOT NULL,
  connected_at TEXT,
  completed_at TEXT
);
