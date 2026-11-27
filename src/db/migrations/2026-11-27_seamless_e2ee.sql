ALTER TABLE users ADD COLUMN IF NOT EXISTS link_previews_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS signing_key_pub TEXT NOT NULL DEFAULT '';
ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS signing_key_binding_sig TEXT NOT NULL DEFAULT '';
ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS trust_origin TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS is_primary INTEGER NOT NULL DEFAULT 0;
ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS device_label TEXT NOT NULL DEFAULT '';
ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS approved_by_device_id INTEGER;
ALTER TABLE e2ee_devices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_e2ee_devices_one_primary
  ON e2ee_devices(user_id)
  WHERE is_primary = 1;

CREATE INDEX IF NOT EXISTS idx_e2ee_devices_user_status
  ON e2ee_devices(user_id, approval_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS e2ee_device_challenges (
  challenge_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_device_id INTEGER NOT NULL,
  target_device_id INTEGER NOT NULL,
  target_identity_key_pub TEXT NOT NULL,
  target_signing_key_pub TEXT NOT NULL DEFAULT '',
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e2ee_challenges_user
  ON e2ee_device_challenges(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS e2ee_device_lists (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  list_version INTEGER NOT NULL DEFAULT 1,
  signer_device_id INTEGER NOT NULL,
  device_list_json TEXT NOT NULL,
  ecdsa_signature TEXT NOT NULL DEFAULT '',
  signal_signature TEXT NOT NULL DEFAULT '',
  is_recovery_reset INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
