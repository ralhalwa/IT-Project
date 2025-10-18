CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  STRING NOT NULL,
    post_id INTEGER,
    is_like BOOLEAN NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
    UNIQUE(user_id, post_id) 
);