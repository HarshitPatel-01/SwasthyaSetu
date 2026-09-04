-- Permanent patient contact + facility-managed access
-- SQLite runtime applies the equivalent migration automatically.
ALTER TABLE users ADD COLUMN phone TEXT;
