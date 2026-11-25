CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT    NOT NULL,
    email         TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    display_name  TEXT    NOT NULL DEFAULT '',
    bio           TEXT    NOT NULL DEFAULT '',
    avatar_key    TEXT    NOT NULL DEFAULT '',
    is_verified   INTEGER NOT NULL DEFAULT 0,
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
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id       ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_created  ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_desc  ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_sensitive     ON posts(is_sensitive, reports_count, skin_score);

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
    content    TEXT    NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at DESC);

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
