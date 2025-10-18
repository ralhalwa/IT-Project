CREATE TABLE followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'accepted', 'declined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id)
);
