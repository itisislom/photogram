CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT    NOT NULL,
    email         TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    display_name  TEXT    NOT NULL DEFAULT '',
    bio           TEXT    NOT NULL DEFAULT '',
    avatar_key    TEXT    NOT NULL DEFAULT '',
    is_verified   INTEGER NOT NULL DEFAULT 0,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower    ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS posts (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_key     TEXT    NOT NULL,
    caption       TEXT    NOT NULL DEFAULT '',
    skin_score    REAL    NOT NULL DEFAULT 0,
    is_sensitive  INTEGER NOT NULL DEFAULT 0,
    reports_count INTEGER NOT NULL DEFAULT 0,
    shares_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id       ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_created  ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_desc  ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_sensitive     ON posts(is_sensitive, reports_count, skin_score);

CREATE TABLE IF NOT EXISTS post_shares (
    post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id);

CREATE TABLE IF NOT EXISTS follows (
    follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following_id       ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_follower ON follows(following_id, follower_id);

CREATE TABLE IF NOT EXISTS username_changes (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_username_changes_user ON username_changes(user_id, created_at);

CREATE TABLE IF NOT EXISTS likes (
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user_id      ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_user    ON likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_created ON likes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_reports (
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key          TEXT PRIMARY KEY,
    attempts     INTEGER NOT NULL DEFAULT 1,
    locked_until BIGINT  NOT NULL DEFAULT 0,
    updated_at   BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_locked ON auth_rate_limits(locked_until);

CREATE TABLE IF NOT EXISTS comments (
    id         SERIAL PRIMARY KEY,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content    TEXT    NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id    ON comments(parent_id);

CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user    ON comment_likes(user_id);

CREATE TABLE IF NOT EXISTS user_interactions (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    impressions  INTEGER NOT NULL DEFAULT 0,
    dwell_ms     INTEGER NOT NULL DEFAULT 0,
    opened       INTEGER NOT NULL DEFAULT 0,
    skips        INTEGER NOT NULL DEFAULT 0,
    is_hidden    INTEGER NOT NULL DEFAULT 0,
    event_type   TEXT    NOT NULL DEFAULT 'impression',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_interactions_user_seen         ON user_interactions(user_id, is_hidden, impressions);
CREATE INDEX IF NOT EXISTS idx_interactions_user_post_created ON user_interactions(user_id, post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_user_last_seen    ON user_interactions(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_post_event        ON user_interactions(post_id, event_type);
CREATE INDEX IF NOT EXISTS idx_interactions_post_impressions  ON user_interactions(post_id) WHERE impressions > 0;

CREATE TABLE IF NOT EXISTS user_affinity (
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    affinity_score REAL    NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_affinity_user ON user_affinity(user_id, affinity_score DESC);

CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag     TEXT    NOT NULL,
    PRIMARY KEY (post_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag      ON post_tags(LOWER(tag));
CREATE INDEX IF NOT EXISTS idx_post_tags_post_tag ON post_tags(post_id, tag);

CREATE TABLE IF NOT EXISTS user_tag_affinity (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag        TEXT    NOT NULL,
    score      REAL    NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_user_tag_affinity         ON user_tag_affinity(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_tag_affinity_updated ON user_tag_affinity(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
    id                      SERIAL PRIMARY KEY,
    user1_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_id         BIGINT,
    last_message_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user1_cleared_before_id BIGINT NOT NULL DEFAULT 0,
    user2_cleared_before_id BIGINT NOT NULL DEFAULT 0,
    user1_hidden            INTEGER NOT NULL DEFAULT 0,
    user2_hidden            INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (user1_id < user2_id),
    UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user1_recent ON conversations(user1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_recent ON conversations(user2_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id                  BIGSERIAL PRIMARY KEY,
    conversation_id     INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body                TEXT    NOT NULL DEFAULT '',
    image_key           TEXT    NOT NULL DEFAULT '',
    is_encrypted        INTEGER NOT NULL DEFAULT 0,
    sender_device_id    INTEGER NOT NULL DEFAULT 0,
    ciphertext_envelope TEXT    NOT NULL DEFAULT '',
    read_at             TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ,
    deleted_for_user1   INTEGER NOT NULL DEFAULT 0,
    deleted_for_user2   INTEGER NOT NULL DEFAULT 0,
    edited_at           TIMESTAMPTZ,
    edit_version        INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_id_desc ON messages(conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, sender_id) WHERE read_at IS NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS message_reactions (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);

CREATE TABLE IF NOT EXISTS notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT    NOT NULL CHECK (type IN ('like', 'comment', 'comment_like', 'comment_reply', 'follow')),
    post_id         INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    comment_id      INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    comment_preview TEXT    NOT NULL DEFAULT '',
    is_read         INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON notifications(user_id, is_read) WHERE is_read = 0;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT    NOT NULL UNIQUE,
    p256dh     TEXT    NOT NULL,
    auth       TEXT    NOT NULL,
    lang       TEXT    NOT NULL DEFAULT 'ru',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS e2ee_devices (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id         INTEGER NOT NULL,
    registration_id   INTEGER NOT NULL,
    identity_key_pub  TEXT    NOT NULL,
    signed_prekey_id  INTEGER NOT NULL,
    signed_prekey_pub TEXT    NOT NULL,
    signed_prekey_sig TEXT    NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_devices_user ON e2ee_devices(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS e2ee_prekeys (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id   INTEGER NOT NULL,
    key_id      INTEGER NOT NULL,
    public_key  TEXT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_prekeys_lookup ON e2ee_prekeys(user_id, device_id, id ASC);

CREATE OR REPLACE FUNCTION datetime(t text) RETURNS timestamptz AS $$
  SELECT CASE WHEN t = 'now' THEN clock_timestamp() ELSE t::timestamptz END
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION julianday(val timestamptz) RETURNS double precision AS $$
  SELECT 2440587.5 + EXTRACT(EPOCH FROM val) / 86400.0
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION julianday(val text) RETURNS double precision AS $$
  SELECT CASE WHEN val = 'now' THEN 2440587.5 + EXTRACT(EPOCH FROM clock_timestamp()) / 86400.0
              ELSE 2440587.5 + EXTRACT(EPOCH FROM val::timestamptz) / 86400.0 END
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION max(a numeric, b numeric) RETURNS numeric AS $$
  SELECT GREATEST(a, b)
$$ LANGUAGE sql;
