CREATE TABLE IF NOT EXISTS event_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    response TEXT CHECK(response IN ('I''ll be there' ,'Can''t make it' ,'Might be late')) NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
