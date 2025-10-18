package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"backend/pkg/db/sqlite"

	"github.com/gorilla/websocket"
)

type GroupMsgIn struct {
	GroupID string `json:"group_id"`
	Text    string `json:"text"`
}

type GroupMsgOut struct {
	ID      string `json:"id"`
	From    string `json:"from"`
	GroupID string `json:"group_id"`
	Text    string `json:"text"`
	TS      string `json:"ts"` // RFC3339
}

type Server struct {
	Hub               *Hub
	DB                *sql.DB
	UserIDFromRequest func(*http.Request) (string, error)
}
type wsConn struct {
	conn    *websocket.Conn
	userID  string
	srv     *Server
	writeMu sync.Mutex
}

func (c *wsConn) UserID() string { return c.userID }
func (c *wsConn) SendJSON(v any) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteJSON(v)
}
func (c *wsConn) Close() error { return c.conn.Close() }

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}

		hostOnly := r.Host
		if h, _, err := net.SplitHostPort(r.Host); err == nil {
			hostOnly = h
		}
		originHost := u.Hostname()
		return originHost == hostOnly
	},
}

type Envelope struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type DMIn struct {
	To   string `json:"to"`
	Text string `json:"text"`
}

type DMOut struct {
	ID   string `json:"id"`
	From string `json:"from"`
	To   string `json:"to"`
	Text string `json:"text"`
	TS   string `json:"ts"` // RFC3339
}

func errPayload(code, msg string) map[string]any {
	return map[string]any{"type": "error", "data": map[string]string{"code": code, "message": msg}}
}

func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	userID, err := s.UserIDFromRequest(r)
	if err != nil || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "upgrade failed", http.StatusBadRequest)
		return
	}

	client := &wsConn{conn: conn, userID: userID, srv: s}
	s.Hub.Add(client)
	defer func() {
		s.Hub.Remove(client)
		_ = client.Close()
	}()

	// hello
	_ = client.SendJSON(map[string]any{"type": "hello", "data": map[string]any{"userId": userID}})
	_ = client.SendJSON(map[string]any{
		"type": "presence_snapshot",
		"data": map[string]any{"online": s.Hub.OnlineUsers()},
	})
	var pendingCount int
	_ = s.DB.QueryRow(`
    SELECT COUNT(*) FROM followers
    WHERE following_id = ? AND status = 'pending'
`, userID).Scan(&pendingCount)

	s.Hub.SendToUser(userID, map[string]any{
		"type": "badge.follow_requests",
		"data": map[string]any{"count": pendingCount},
	})
	// Main read loop
	for {
		var env Envelope
		if err := conn.ReadJSON(&env); err != nil {
			// client closed or read error -> exit
			return
		}

		switch env.Type {
		case "dm":
			var in DMIn
			if err := json.Unmarshal(env.Data, &in); err != nil {
				_ = client.SendJSON(errPayload("bad_json", err.Error()))
				continue
			}
			if in.To == "" || in.Text == "" {
				_ = client.SendJSON(errPayload("bad_dm", "missing to/text"))
				continue
			}
			if in.To == userID {
				_ = client.SendJSON(errPayload("bad_dm", "cannot DM yourself"))
				continue
			}

			// check follow relationship before sending
			allowed, err := canDM(userID, in.To)
			if err != nil {
				_ = client.SendJSON(errPayload("db_error", "failed to check relationship"))
				continue
			}
			if !allowed {
				_ = client.SendJSON(errPayload("dm_denied", "Direct messages require a follow relationship"))
				continue
			}

			// Only now do we insert and broadcast
			msgID, sentAt, err := insertMessage(s.DB, userID, in.To, in.Text)
			if err != nil {
				_ = client.SendJSON(errPayload("db_error", err.Error()))
				continue
			}

			out := DMOut{
				ID:   msgID,
				From: userID,
				To:   in.To,
				Text: in.Text,
				TS:   sentAt.Format(time.RFC3339),
			}

			_ = client.SendJSON(map[string]any{"type": "dm", "data": out})      // sender echo
			s.Hub.SendToUser(userID, map[string]any{"type": "dm", "data": out}) // other tabs
			s.Hub.SendToUser(in.To, map[string]any{"type": "dm", "data": out})  // recipient
			nid, _ := insertNotification(s.DB, in.To, "dm", map[string]any{
				"from":      out.From,
				"text":      out.Text,
				"messageId": out.ID,
				"ts":        out.TS,
			})
			uc, _ := unreadCount(s.DB, in.To)
			s.Hub.SendToUser(in.To, map[string]any{
				"type": "notification.created",
				"data": map[string]any{
					"id":   nid,
					"type": "dm",
					"content": map[string]any{
						"from":      out.From,
						"text":      out.Text,
						"messageId": out.ID,
						"ts":        out.TS,
					},
				},
			})
			s.Hub.SendToUser(in.To, map[string]any{
				"type": "badge.unread",
				"data": map[string]any{"count": uc},
			})
		case "typing":
			var in struct {
				To string `json:"to"`
			}
			if err := json.Unmarshal(env.Data, &in); err != nil {
				_ = client.SendJSON(errPayload("bad_json", err.Error()))
				continue
			}
			if in.To == "" || in.To == userID {
				// ignore bad/self targets
				continue
			}
			allowed, _ := canDM(userID, in.To)
			if !allowed {
				continue
			}
			// forward to the recipient (all their tabs)
			s.Hub.SendToUser(in.To, map[string]any{
				"type": "typing",
				"data": map[string]any{
					"from": userID,
					"to":   in.To, // <-- include 'to' so the client can verify it's for them
					"ts":   time.Now().Format(time.RFC3339),
				},
			})

		case "group_message":
			var in GroupMsgIn

			if err := json.Unmarshal(env.Data, &in); err != nil {
				_ = client.SendJSON(errPayload("bad_json", err.Error()))
				continue
			}

			if in.GroupID == "" || in.Text == "" {
				_ = client.SendJSON(errPayload("bad_group_message", "missing group_id/text"))
				continue
			}

			// check user is member of group
			isMember, err := isGroupMember(userID, in.GroupID)
			if err != nil {
				_ = client.SendJSON(errPayload("db_error", "failed to check group membership"))
				continue
			}
			if !isMember {
				_ = client.SendJSON(errPayload("not_member", "You are not a member of this group"))
				continue
			}

			// insert group msg
			msgID, sentAt, err := insertGroupMessage(s.DB, userID, in.GroupID, in.Text)
			if err != nil {
				_ = client.SendJSON(errPayload("db_error", err.Error()))
				continue
			}

			// to send to others
			out := GroupMsgOut{
				ID:      msgID,
				From:    userID,
				GroupID: in.GroupID,
				Text:    in.Text,
				TS:      sentAt.Format(time.RFC3339),
			}

			// send to sender
			_ = client.SendJSON(map[string]any{"type": "group_message", "data": out})
			s.Hub.SendToUser(userID, map[string]any{"type": "group_message", "data": out})

			// send to all group members
			members, err := getGroupMembers(s.DB, in.GroupID)
			if err == nil {
				for _, memberID := range members {
					if memberID != userID {
						s.Hub.SendToUser(memberID, map[string]any{"type": "group_message", "data": out})
					}
				}
			}

		default:
			_ = client.SendJSON(errPayload("unsupported_type", env.Type))
		}
	}
}

func insertMessage(db *sql.DB, from, to, text string) (id string, sentAt time.Time, err error) {
	if db == nil {
		return "", time.Time{}, errors.New("nil DB")
	}
	res, err := db.Exec(`INSERT INTO messages (sender_id, receiver_id, content) VALUES (?,?,?)`, from, to, text)
	if err != nil {
		return "", time.Time{}, err
	}
	lastID, err := res.LastInsertId()
	if err != nil {
		return "", time.Time{}, err
	}
	// Read back the timestamp as stored by SQLite
	if err := db.QueryRow(`SELECT sent_at FROM messages WHERE id = ?`, lastID).Scan(&sentAt); err != nil {
		sentAt = time.Now()
	}
	return fmt.Sprint(lastID), sentAt, nil
}

func isGroupMember(userID string, groupID string) (bool, error) {
	var isMember bool
	err := sqlite.DB.QueryRow(`
		SELECT EXISTS (
		SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'accepted'
		)
	`, groupID, userID).Scan(&isMember)

	return isMember, err
}

func insertGroupMessage(db *sql.DB, senderID, groupID, text string) (id string, sentAt time.Time, err error) {
	res, err := db.Exec(`INSERT INTO group_chat (group_id, sender_id, content)
	VALUES (?, ?, ?)`,
		groupID, senderID, text)
	if err != nil {
		return "", time.Time{}, err
	}

	lastID, err := res.LastInsertId()
	if err != nil {
		return "", time.Time{}, err
	}

	if err := db.QueryRow(`SELECT sent_at FROM group_chat WHERE id = ?`, lastID).Scan(&sentAt); err != nil {
		sentAt = time.Now()
	}

	return fmt.Sprint(lastID), sentAt, nil
}

func getGroupMembers(db *sql.DB, groupID string) ([]string, error) {
	rows, err := db.Query(`
        SELECT user_id FROM group_members 
        WHERE group_id = ? AND status = 'accepted'
    `, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		members = append(members, userID)
	}
	return members, nil
}
