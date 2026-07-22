ALTER TABLE advisor_project_invitations
  ADD COLUMN first_viewed_at timestamp,
  ADD COLUMN last_viewed_at timestamp,
  ADD COLUMN view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN responded_at timestamp,
  ADD COLUMN declined_at timestamp,
  ADD COLUMN decline_reason text,
  ADD COLUMN decline_note text,
  ADD COLUMN response_source text,
  ADD COLUMN revoked_at timestamp;

UPDATE advisor_project_invitations
SET responded_at = submitted_at
WHERE submitted_at IS NOT NULL
  AND responded_at IS NULL;

CREATE INDEX IF NOT EXISTS advisor_project_invitations_project_status_idx
  ON advisor_project_invitations (project_id, status);

CREATE INDEX IF NOT EXISTS advisor_project_invitations_status_sent_at_idx
  ON advisor_project_invitations (status, sent_at);

CREATE INDEX IF NOT EXISTS advisor_project_invitations_responded_at_idx
  ON advisor_project_invitations (responded_at);
