ALTER TABLE experts ADD COLUMN IF NOT EXISTS source text DEFAULT 'Inbound';

ALTER TABLE experts ALTER COLUMN status SET DEFAULT 'lead';

UPDATE experts
SET source = 'Inbound'
WHERE source IS NULL;
