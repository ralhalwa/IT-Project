package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Notification struct {
	ID          int64           `json:"id"`
	RecipientID string          `json:"recipient_id"`
	Type        string          `json:"type"`    
	Content     json.RawMessage `json:"content"` 
	IsRead      bool            `json:"is_read"`
	CreatedAt   time.Time       `json:"created_at"`
}


type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

func insertNotification(exec execer, recipientID, ntype string, content any) (int64, error) {
	if exec == nil {
		return 0, sql.ErrConnDone
	}
	b, err := json.Marshal(content)
	if err != nil {
		return 0, err
	}
	res, err := exec.Exec(`
		INSERT INTO notifications(recipient_id, type, content)
		VALUES(?,?,?)`,
		recipientID, ntype, string(b),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func unreadCount(db *sql.DB, userID string) (int, error) {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM notifications WHERE recipient_id=? AND is_read=0`, userID).Scan(&n)
	return n, err
}
// GET /api/notifications/unread-count
func (s *Server) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	uid, err := s.UserIDFromRequest(r)
	if err != nil || uid == "" { http.Error(w, "unauthorized", 401); return }
	n, _ := unreadCount(s.DB, uid)
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "count": n})
}

// POST /api/notifications/:id/read
// POST /api/notifications/:id/read
func (s *Server) ReadNotification(w http.ResponseWriter, r *http.Request) {
	uid, err := s.UserIDFromRequest(r)
	if err != nil || uid == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// URL is /api/notifications/{id}/read
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	id := parts[2]

	_, _ = s.DB.Exec(`UPDATE notifications SET is_read=1 WHERE id=? AND recipient_id=?`, id, uid)

	// respond with fresh count and also push new badge value
	n, _ := unreadCount(s.DB, uid)
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "unread": n})
	s.Hub.SendToUser(uid, map[string]any{
		"type": "badge.unread",
		"data": map[string]any{"count": n},
	})
}


// POST /api/notifications/read-by-message
// convenience: auto-clear a DM notification by messageId when the user is in that chat
func (s *Server) ReadByMessageID(w http.ResponseWriter, r *http.Request) {
	uid, err := s.UserIDFromRequest(r)
	if err != nil || uid == "" { http.Error(w, "unauthorized", 401); return }
	var body struct{ MessageID string `json:"messageId"` }
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.MessageID == "" { http.Error(w, "bad messageId", 400); return }

	// mark any DM notification with that messageId read
	_, _ = s.DB.Exec(`
		UPDATE notifications
		SET is_read=1
		WHERE recipient_id=? AND type='dm' AND json_extract(content,'$.messageId') = ?`,
		uid, body.MessageID,
	)
	n, _ := unreadCount(s.DB, uid)
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "unread": n})
	s.Hub.SendToUser(uid, map[string]any{"type": "badge.unread", "data": map[string]any{"count": n}})
}
