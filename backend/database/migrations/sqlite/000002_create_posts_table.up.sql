CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content TEXT,
    image TEXT,
    privacy TEXT CHECK(privacy IN ('public', 'followers', 'custom')) DEFAULT 'public',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
