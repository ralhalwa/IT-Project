CREATE TABLE post_Comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES group_posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
