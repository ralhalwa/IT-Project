CREATE TABLE post_visibility (
    post_id INTEGER,
    user_id TEXT,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
