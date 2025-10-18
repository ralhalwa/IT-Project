package handlers

import (
	"net/http"
	"time"

	"backend/pkg/db/sqlite"
)

// can use for view of member group
func GetGroupMembers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	groupID := r.URL.Query().Get("group_id")
	userID, err := GetUserIDFromRequest(r)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Check user is member of group
	isMember, err := isGroupMember(userID, groupID)
	if err != nil || !isMember {
		writeErr(w, http.StatusForbidden, "Not a member of this group")
		return
	}

	rows, err := sqlite.DB.Query(`
    	SELECT u.id, u.first_name, u.last_name, u.nickname, u.avatar 
    	FROM group_members gm
    	JOIN users u ON gm.user_id = u.id
    	WHERE gm.group_id = ? AND gm.status = 'accepted'
  `, groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch members")
		return
	}

	defer rows.Close()

	type Member struct {
		ID        string `json:"id"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Nickname  string `json:"nickname"`
		Avatar    string `json:"avatar"`
	}

	var members []Member
	for rows.Next() {

		var member Member

		err := rows.Scan(&member.ID, &member.FirstName, &member.LastName, &member.Nickname, &member.Avatar)
		if err != nil {
			continue // if error, move to next member
		}

		members = append(members, member)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"members": members,
	})
}

// fetch group messages
func GetGroupMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	groupID := r.URL.Query().Get("group_id")

	// check user is member
	var isMember bool

	err = sqlite.DB.QueryRow(`
		SELECT EXISTS (
		SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'accepted'
		)
	`, groupID, userID).Scan(&isMember)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	if !isMember {
		writeErr(w, http.StatusForbidden, "Not a member of this group")
		return
	}

	// get messages of group

	rows, err := sqlite.DB.Query(`
		SELECT gc.id, gc.sender_id, gc.group_id, gc.content, gc.sent_at,
               u.first_name, u.last_name, u.nickname, u.avatar
        FROM group_chat gc
        JOIN users u ON gc.sender_id = u.id
        WHERE gc.group_id = ?
        ORDER BY gc.sent_at ASC
	`, groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch messages")
		return
	}

	defer rows.Close()

	type GroupMessage struct {
		ID        string    `json:"id"`
		SenderID  string    `json:"sender_id"`
		GroupID   string    `json:"group_id"`
		Content   string    `json:"content"`
		SentAt    time.Time `json:"sent_at"`
		FirstName string    `json:"firstName"`
		LastName  string    `json:"lastName"`
		Nickname  string    `json:"nickname"`
		Avatar    string    `json:"avatar"`
	}

	messages := make([]GroupMessage, 0)
	
	for rows.Next() {

		var msg GroupMessage

		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.GroupID, &msg.Content, &msg.SentAt,
			&msg.FirstName, &msg.LastName, &msg.Nickname, &msg.Avatar)
		if err != nil {
			continue
		}

		messages = append(messages, msg)

	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"messages": messages,
	})
}