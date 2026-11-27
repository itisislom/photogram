CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    email         TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    display_name  TEXT    NOT NULL DEFAULT '',
    bio           TEXT    NOT NULL DEFAULT '',
    avatar_key    TEXT    NOT NULL DEFAULT '',
    is_verified           INTEGER NOT NULL DEFAULT 0,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    link_previews_enabled INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    expires_at TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    image_key     TEXT    NOT NULL,
    caption       TEXT    NOT NULL DEFAULT '',
    skin_score    REAL    NOT NULL DEFAULT 0,
    is_sensitive  INTEGER NOT NULL DEFAULT 0,
    reports_count INTEGER NOT NULL DEFAULT 0,
    shares_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_sensitive ON posts(is_sensitive, reports_count, skin_score);

CREATE TABLE IF NOT EXISTS post_shares (
    post_id      INTEGER NOT NULL,
    user_id      INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (post_id, user_id, recipient_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id);


CREATE TABLE IF NOT EXISTS follows (
    follower_id  INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

CREATE TABLE IF NOT EXISTS username_changes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_username_changes_user ON username_changes(user_id, created_at);

CREATE TABLE IF NOT EXISTS likes (
    post_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

CREATE TABLE IF NOT EXISTS post_reports (
    post_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key          TEXT PRIMARY KEY,
    attempts     INTEGER NOT NULL DEFAULT 1,
    locked_until INTEGER NOT NULL DEFAULT 0,
    updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_locked ON auth_rate_limits(locked_until);

CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    parent_id  INTEGER,
    content    TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id    ON comments(parent_id);

CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user    ON comment_likes(user_id);

CREATE TABLE IF NOT EXISTS user_interactions (
    user_id      INTEGER NOT NULL,
    post_id      INTEGER NOT NULL,
    impressions  INTEGER NOT NULL DEFAULT 0,
    dwell_ms     INTEGER NOT NULL DEFAULT 0,
    opened       INTEGER NOT NULL DEFAULT 0,
    is_hidden    INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interactions_user_seen ON user_interactions(user_id, is_hidden, impressions);

CREATE TABLE IF NOT EXISTS user_affinity (
    user_id        INTEGER NOT NULL,
    author_id      INTEGER NOT NULL,
    affinity_score REAL    NOT NULL DEFAULT 0,
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, author_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_affinity_user ON user_affinity(user_id, affinity_score DESC);

CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL,
    tag     TEXT    NOT NULL COLLATE NOCASE,
    PRIMARY KEY (post_id, tag),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);

CREATE TABLE IF NOT EXISTS user_tag_affinity (
    user_id INTEGER NOT NULL,
    tag     TEXT    NOT NULL COLLATE NOCASE,
    score   REAL    NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, tag),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_tag_affinity ON user_tag_affinity(user_id, score DESC);

CREATE TABLE IF NOT EXISTS conversations (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id                INTEGER NOT NULL,
    user2_id                INTEGER NOT NULL,
    last_message_id         INTEGER,
    last_message_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    user1_cleared_before_id INTEGER NOT NULL DEFAULT 0,
    user2_cleared_before_id INTEGER NOT NULL DEFAULT 0,
    user1_hidden            INTEGER NOT NULL DEFAULT 0,
    user2_hidden            INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK (user1_id < user2_id),
    UNIQUE (user1_id, user2_id),
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_user1_recent ON conversations(user1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_recent ON conversations(user2_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id     INTEGER NOT NULL,
    sender_id           INTEGER NOT NULL,
    body                TEXT    NOT NULL DEFAULT '',
    image_key           TEXT    NOT NULL DEFAULT '',
    is_encrypted        INTEGER NOT NULL DEFAULT 0,
    sender_device_id    INTEGER NOT NULL DEFAULT 0,
    ciphertext_envelope TEXT    NOT NULL DEFAULT '',
    read_at             TEXT,
    listened_at         TEXT,
    deleted_at          TEXT,
    deleted_for_user1   INTEGER NOT NULL DEFAULT 0,
    deleted_for_user2   INTEGER NOT NULL DEFAULT 0,
    edited_at           TEXT,
    edit_version        INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_id_desc ON messages(conversation_id, id DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
    message_id INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    emoji      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);

CREATE TABLE IF NOT EXISTS notifications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    actor_id        INTEGER NOT NULL,
    type            TEXT    NOT NULL CHECK (type IN ('like', 'comment', 'comment_like', 'comment_reply', 'follow')),
    post_id         INTEGER,
    comment_id      INTEGER,
    comment_preview TEXT    NOT NULL DEFAULT '',
    is_read         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    endpoint   TEXT    NOT NULL UNIQUE,
    p256dh     TEXT    NOT NULL,
    auth       TEXT    NOT NULL,
    lang       TEXT    NOT NULL DEFAULT 'ru',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS e2ee_devices (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                 INTEGER NOT NULL,
    device_id               INTEGER NOT NULL,
    registration_id         INTEGER NOT NULL,
    identity_key_pub        TEXT    NOT NULL,
    signed_prekey_id        INTEGER NOT NULL,
    signed_prekey_pub       TEXT    NOT NULL,
    signed_prekey_sig       TEXT    NOT NULL,
    signing_key_pub         TEXT    NOT NULL DEFAULT '',
    signing_key_binding_sig TEXT    NOT NULL DEFAULT '',
    approval_status         TEXT    NOT NULL DEFAULT 'approved',
    trust_origin            TEXT    NOT NULL DEFAULT 'legacy',
    is_primary              INTEGER NOT NULL DEFAULT 0,
    device_label            TEXT    NOT NULL DEFAULT '',
    approved_by_device_id   INTEGER,
    approved_at             TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, device_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_e2ee_devices_user ON e2ee_devices(user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_e2ee_devices_one_primary ON e2ee_devices(user_id) WHERE is_primary = 1;
CREATE INDEX IF NOT EXISTS idx_e2ee_devices_user_status ON e2ee_devices(user_id, approval_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS e2ee_device_challenges (
    challenge_id            TEXT    PRIMARY KEY,
    user_id                 INTEGER NOT NULL,
    approver_device_id      INTEGER NOT NULL,
    target_device_id        INTEGER NOT NULL,
    target_identity_key_pub TEXT    NOT NULL,
    target_signing_key_pub  TEXT    NOT NULL DEFAULT '',
    nonce                   TEXT    NOT NULL,
    expires_at              TEXT    NOT NULL,
    used_at                 TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_e2ee_challenges_user ON e2ee_device_challenges(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS e2ee_device_lists (
    user_id           INTEGER PRIMARY KEY,
    list_version      INTEGER NOT NULL DEFAULT 1,
    signer_device_id  INTEGER NOT NULL,
    device_list_json  TEXT    NOT NULL,
    ecdsa_signature   TEXT    NOT NULL DEFAULT '',
    signal_signature  TEXT    NOT NULL DEFAULT '',
    is_recovery_reset INTEGER NOT NULL DEFAULT 0,
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS e2ee_prekeys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    device_id   INTEGER NOT NULL,
    key_id      INTEGER NOT NULL,
    public_key  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, device_id, key_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_e2ee_prekeys_lookup ON e2ee_prekeys(user_id, device_id, id ASC);

CREATE TABLE IF NOT EXISTS e2ee_backups (
    user_id          INTEGER PRIMARY KEY,
    enabled          INTEGER NOT NULL DEFAULT 0,
    backup_epoch     INTEGER NOT NULL DEFAULT 1,
    backup_version   INTEGER NOT NULL DEFAULT 0,
    kdf_salt         TEXT    NOT NULL DEFAULT '',
    signer_device_id INTEGER NOT NULL DEFAULT 0,
    manifest_sig     TEXT    NOT NULL DEFAULT '',
    chunk_count      INTEGER NOT NULL DEFAULT 0,
    base_chunk_count INTEGER NOT NULL DEFAULT 0,
    total_size_bytes INTEGER NOT NULL DEFAULT 0,
    message_count    INTEGER NOT NULL DEFAULT 0,
    last_msg_id      INTEGER NOT NULL DEFAULT 0,
    last_backup_at   TEXT,
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS e2ee_backup_chunks (
    user_id      INTEGER NOT NULL,
    backup_epoch INTEGER NOT NULL,
    chunk_seq    INTEGER NOT NULL,
    r2_key       TEXT    NOT NULL,
    iv_b64       TEXT    NOT NULL,
    sha256_b64   TEXT    NOT NULL,
    size_bytes   INTEGER NOT NULL,
    msg_count    INTEGER NOT NULL DEFAULT 0,
    max_msg_id   INTEGER NOT NULL DEFAULT 0,
    is_staged    INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, backup_epoch, chunk_seq),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_e2ee_backup_chunks_user_epoch ON e2ee_backup_chunks(user_id, backup_epoch, chunk_seq ASC);

CREATE TABLE IF NOT EXISTS e2ee_device_transfers (
    transfer_id         TEXT    PRIMARY KEY,
    user_id             INTEGER NOT NULL,
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
    expires_at          TEXT    NOT NULL,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_e2ee_transfers_user_status ON e2ee_device_transfers(user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_e2ee_transfers_expires ON e2ee_device_transfers(expires_at);


