
-- Add contact email fields to venues_new
ALTER TABLE venues_new ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE venues_new ADD COLUMN IF NOT EXISTS contact_email_source TEXT;

-- Use validation trigger instead of CHECK for contact_email_source
CREATE OR REPLACE FUNCTION validate_contact_email_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contact_email_source IS NOT NULL AND NEW.contact_email_source NOT IN ('scraped', 'user_submitted', 'manual') THEN
    RAISE EXCEPTION 'Invalid contact_email_source: %', NEW.contact_email_source;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_contact_email_source
  BEFORE INSERT OR UPDATE ON venues_new
  FOR EACH ROW EXECUTE FUNCTION validate_contact_email_source();

-- Track background email search jobs
CREATE TABLE venue_email_searches (
  search_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      TEXT NOT NULL REFERENCES venues_new(venue_id),
  session_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'searching',
  root_url      TEXT,
  email_found   TEXT,
  searched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION validate_ves_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('searching', 'found', 'not_found', 'error') THEN
    RAISE EXCEPTION 'Invalid venue_email_searches status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_ves_status
  BEFORE INSERT OR UPDATE ON venue_email_searches
  FOR EACH ROW EXECUTE FUNCTION validate_ves_status();

CREATE INDEX idx_ves_venue ON venue_email_searches(venue_id);
CREATE INDEX idx_ves_session ON venue_email_searches(session_id);

-- Track outreach emails sent to venues
CREATE TABLE venue_outreach (
  outreach_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      TEXT NOT NULL REFERENCES venues_new(venue_id),
  session_id    TEXT NOT NULL,
  user_id       UUID NOT NULL,
  email_to      TEXT NOT NULL,
  email_source  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION validate_vo_email_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_source NOT IN ('scraped', 'user_submitted') THEN
    RAISE EXCEPTION 'Invalid venue_outreach email_source: %', NEW.email_source;
  END IF;
  IF NEW.status NOT IN ('pending', 'sent', 'failed', 'bounced', 'opted_out') THEN
    RAISE EXCEPTION 'Invalid venue_outreach status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_vo_fields
  BEFORE INSERT OR UPDATE ON venue_outreach
  FOR EACH ROW EXECUTE FUNCTION validate_vo_email_source();

CREATE INDEX idx_vo_venue ON venue_outreach(venue_id);
CREATE INDEX idx_vo_status ON venue_outreach(status);

-- RLS
ALTER TABLE venue_email_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_outreach ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read venue_email_searches
CREATE POLICY "ves_read_authenticated"
  ON venue_email_searches FOR SELECT
  TO authenticated
  USING (true);

-- No public write on either table — edge functions use SERVICE_ROLE_KEY
