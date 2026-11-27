CREATE TABLE IF NOT EXISTS e2ee_backups (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled          INTEGER NOT NULL DEFAULT 0,
  backup_epoch     INTEGER NOT NULL DEFAULT 1,
  backup_version   INTEGER NOT NULL DEFAULT 0,
  kdf_salt         TEXT    NOT NULL DEFAULT '',
  signer_device_id INTEGER NOT NULL DEFAULT 0,
  manifest_sig     TEXT    NOT NULL DEFAULT '',
  chunk_count      INTEGER NOT NULL DEFAULT 0,
  base_chunk_count INTEGER NOT NULL DEFAULT 0,
  total_size_bytes BIGINT  NOT NULL DEFAULT 0,
  message_count    INTEGER NOT NULL DEFAULT 0,
  last_msg_id      BIGINT  NOT NULL DEFAULT 0,
  last_backup_at   TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS e2ee_backup_chunks (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  backup_epoch INTEGER NOT NULL,
  chunk_seq    INTEGER NOT NULL,
  r2_key       TEXT    NOT NULL,
  iv_b64       TEXT    NOT NULL,
  sha256_b64   TEXT    NOT NULL,
  size_bytes   INTEGER NOT NULL,
  msg_count    INTEGER NOT NULL DEFAULT 0,
  max_msg_id   BIGINT  NOT NULL DEFAULT 0,
  is_staged    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, backup_epoch, chunk_seq)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_backup_chunks_user_epoch
  ON e2ee_backup_chunks(user_id, backup_epoch, chunk_seq ASC);

CREATE TABLE IF NOT EXISTS e2ee_device_transfers (
  transfer_id         TEXT    PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_device_id INTEGER NOT NULL,
  requester_eph_pub   TEXT    NOT NULL,
  requester_sig       TEXT    NOT NULL DEFAULT '',
  sender_device_id    INTEGER,
  sender_eph_pub      TEXT    NOT NULL DEFAULT '',
  sender_signature    TEXT    NOT NULL DEFAULT '',
  r2_key              TEXT    NOT NULL DEFAULT '',
  iv_b64              TEXT    NOT NULL DEFAULT '',
  payload_sha256      TEXT    NOT NULL DEFAULT '',
  size_bytes          INTEGER NOT NULL DEFAULT 0,
  status              TEXT    NOT NULL DEFAULT 'pending',
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e2ee_transfers_user_status
  ON e2ee_device_transfers(user_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_e2ee_transfers_expires
  ON e2ee_device_transfers(expires_at)
  WHERE status IN ('pending', 'uploaded');
