CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id TEXT NOT NULL,
    type TEXT,
    content TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipient_id) REFERENCES users(id)
);
