CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    datetime DATETIME,
    created_by TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
