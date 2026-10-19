CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    email         TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    display_name  TEXT    NOT NULL DEFAULT '',
    bio           TEXT    NOT NULL DEFAULT '',
    avatar_key    TEXT    NOT NULL DEFAULT '',
    is_verified   INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
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
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_sensitive ON posts(is_sensitive, reports_count, skin_score);


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
    content    TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at DESC);

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


