ALTER TABLE experts ADD COLUMN IF NOT EXISTS expected_rate numeric(10,2);
ALTER TABLE experts ADD COLUMN IF NOT EXISTS expected_rate_currency text;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS agreed_rate numeric(10,2);
ALTER TABLE experts ADD COLUMN IF NOT EXISTS agreed_rate_currency text;

UPDATE experts
SET agreed_rate = hourly_rate,
    agreed_rate_currency = 'USD'
WHERE hourly_rate IS NOT NULL
  AND agreed_rate IS NULL
  AND agreed_rate_currency IS NULL;

ALTER TABLE experts ALTER COLUMN expertise DROP NOT NULL;
ALTER TABLE experts ALTER COLUMN industry DROP NOT NULL;
ALTER TABLE experts ALTER COLUMN years_of_experience DROP NOT NULL;
ALTER TABLE experts ALTER COLUMN hourly_rate DROP NOT NULL;
