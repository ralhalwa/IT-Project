package sqlite

import (
	"database/sql"
	"time"
)

func CreateSession(userID string, token string, expiresAt time.Time) error {
	_, err := DB.Exec(`
		INSERT OR REPLACE INTO sessions (user_id, session_token, expired_time)
		VALUES (?, ?, ?)
	`, userID, token, expiresAt.UTC())
	return err
}

// Returns userID (string) if token is valid and not expired; otherwise "" + error.
func GetUserIDBySessionToken(token string) (string, error) {
	var userID string
	var exp time.Time
	err := DB.QueryRow(`
		SELECT user_id, expired_time
		FROM sessions
		WHERE session_token = ?
	`, token).Scan(&userID, &exp)
	if err != nil {
		return "", err
	}

	if time.Now().After(exp) {
		_, _ = DB.Exec(`DELETE FROM sessions WHERE session_token = ?`, token)
		return "", sql.ErrNoRows
	}
	return userID, nil
}

func DeleteSessionByToken(token string) error {
	_, err := DB.Exec(`DELETE FROM sessions WHERE session_token = ?`, token)
	return err
}
