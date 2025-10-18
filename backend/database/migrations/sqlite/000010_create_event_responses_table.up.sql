CREATE TABLE event_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    response TEXT CHECK(response IN ('going', 'not_going')),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
