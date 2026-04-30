-- Simian Order schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  wallet_address      TEXT PRIMARY KEY,
  twitter_id          TEXT,
  discord_id          TEXT,
  application_status  TEXT NOT NULL DEFAULT 'none'
                      CHECK (application_status IN ('none','pending','approved','rejected')),
  fcfs_allocated      BOOLEAN NOT NULL DEFAULT FALSE,
  referral_code       TEXT UNIQUE,
  referrer            TEXT REFERENCES users(wallet_address) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_referrer       ON users(referrer);
CREATE INDEX IF NOT EXISTS idx_users_referral_code  ON users(referral_code);

CREATE TABLE IF NOT EXISTS fcfs_state (
  id           INT PRIMARY KEY DEFAULT 1,
  total_spots  INT NOT NULL,
  spots_taken  INT NOT NULL DEFAULT 0,
  CHECK (id = 1),
  CHECK (spots_taken >= 0),
  CHECK (spots_taken <= total_spots)
);

CREATE TABLE IF NOT EXISTS applications (
  id              SERIAL PRIMARY KEY,
  wallet_address  TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  handle          TEXT,
  discord         TEXT,
  why             TEXT,
  referrer_input  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','withdrawn')),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_applications_wallet ON applications(wallet_address);

CREATE TABLE IF NOT EXISTS task_completions (
  id              SERIAL PRIMARY KEY,
  wallet_address  TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  task            TEXT NOT NULL,
  payload         JSONB,
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_address, task)
);

CREATE INDEX IF NOT EXISTS idx_tasks_wallet ON task_completions(wallet_address);

CREATE TABLE IF NOT EXISTS mint_config (
  id              INT PRIMARY KEY DEFAULT 1,
  total_supply    INT NOT NULL DEFAULT 5555,
  gtd_allocation  INT NOT NULL DEFAULT 1000,
  fcfs_allocation INT NOT NULL DEFAULT 1000,
  gtd_max_mint    INT NOT NULL DEFAULT 1,
  fcfs_max_mint   INT NOT NULL DEFAULT 2,
  public_max_mint INT NOT NULL DEFAULT 2,
  gtd_active      BOOLEAN NOT NULL DEFAULT FALSE,
  fcfs_active     BOOLEAN NOT NULL DEFAULT FALSE,
  public_active   BOOLEAN NOT NULL DEFAULT FALSE,
  royalty_bps     INT NOT NULL DEFAULT 690,
  CHECK (id = 1),
  CHECK (total_supply >= 0),
  CHECK (gtd_allocation >= 0),
  CHECK (fcfs_allocation >= 0),
  CHECK (gtd_allocation + fcfs_allocation <= total_supply),
  CHECK (royalty_bps >= 0 AND royalty_bps <= 10000)
);

-- Touch updated_at on user rows.
CREATE OR REPLACE FUNCTION touch_users_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_touch_updated_at ON users;
CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_users_updated_at();
