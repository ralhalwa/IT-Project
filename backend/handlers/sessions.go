package handlers

import (
	db "backend/pkg/db/sqlite"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"
)

const sessionCookieName = "session_token"

// setSession creates a session row and sets the cookie.
func setSession(w http.ResponseWriter, userID string) error {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return err
	}
	token := hex.EncodeToString(raw)

	exp := time.Now().Add(1 * time.Hour)

	if err := db.CreateSession(userID, token, exp); err != nil {
		return err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  exp,
		MaxAge:   int(time.Until(exp).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false, // true in HTTPS
	})

	return nil
}

// getUserIDFromRequest validates the session cookie and returns userID (string) or "".
func GetUserIDFromRequest(r *http.Request) (string, error) {
	c, err := r.Cookie(sessionCookieName)
	if err != nil || c.Value == "" {
		return "", err
	}
	return db.GetUserIDBySessionToken(c.Value)
}