ALTER TABLE experts ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS privacy_acknowledged_at timestamp;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS privacy_policy_version text;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS consent_language text;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS onboarding_consent_source text;

ALTER TABLE project_experts ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp;
ALTER TABLE project_experts ADD COLUMN IF NOT EXISTS privacy_acknowledged_at timestamp;
ALTER TABLE project_experts ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE project_experts ADD COLUMN IF NOT EXISTS privacy_policy_version text;
ALTER TABLE project_experts ADD COLUMN IF NOT EXISTS consent_language text;
ALTER TABLE project_experts ADD COLUMN IF NOT EXISTS onboarding_consent_source text;
