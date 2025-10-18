package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"backend/pkg/db/sqlite"
)

type Group struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatorID   string `json:"creator_id"`
	CreatedAt   string `json:"createdAt"`
	MemberCount int    `json:"member_count"`
	IsMember    bool   `json:"is_member"`
}

// to make my groups section, not done!
func GetGroupsByUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
}

// to browse through all groups

func GetAllGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	const query = `
        SELECT 
            g.id,
            g.title,
            g.description,
            g.creator_id,
            g.created_at,
            COUNT(gm.user_id) as member_count,
            EXISTS(
                SELECT 1 FROM group_members 
                WHERE group_id = g.id AND user_id = ? AND status = 'accepted'
            ) as is_member
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.status = 'accepted'
        GROUP BY g.id
        ORDER BY g.created_at DESC
    `
	rows, err := sqlite.DB.Query(query, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch groups")
		return
	}
	defer rows.Close()

	groups := make([]Group, 0, 32)
	for rows.Next() {
		var g Group
		var isMemberInt int // 0/1 from sqlite
		if err := rows.Scan(
			&g.ID, &g.Title, &g.Description, &g.CreatorID,
			&g.CreatedAt, &g.MemberCount, &isMemberInt,
		); err != nil {
			fmt.Printf("scan groups: %v\n", err)
			continue
		}

		g.IsMember = isMemberInt == 1
		groups = append(groups, g)
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "groups": groups})
}

// to create a new group
func CreateGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := r.ParseForm(); err != nil {
		writeErr(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	title := r.FormValue("title")
	description := r.FormValue("description")
	// groupIcon := r.FormFile("groupIcon")
	members := r.FormValue("members")

	if title == "" || description == "" || members == "" {
		writeErr(w, http.StatusBadRequest, "Title, description, and members are required")
		return
	}

	// start a transaction so that if one part fails , no group will be created
	tx, err := sqlite.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	// create group
	result, err := tx.Exec(`
	INSERT INTO groups (title, description, creator_id) VALUES (?, ?, ?)
	`, title, description, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to create group")
		return
	}

	groupID, err := result.LastInsertId()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to get group ID")
		return
	}

	// add creator as member of group
	_, err = tx.Exec(`
	INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, ?)
	`, groupID, userID, "accepted")

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to add creator to group")
		return
	}

	// process invited members if there are any
	if members != "" {
		var invitedUsers []string

		if err := json.Unmarshal([]byte(members), &invitedUsers); err == nil {
			for _, invitedUserID := range invitedUsers {
				// user doesn't invite himself
				if invitedUserID != userID {

					_, err := tx.Exec(`
					INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, ?)
					`, groupID, invitedUserID, "invited")
					if err != nil {
						fmt.Printf("Failed to invite user %s: %v\n", invitedUserID, err)
						continue
					}
_, _ = insertNotification(tx, invitedUserID, "group_invite", map[string]any{
	"groupId":    groupID,
	"groupTitle": title,
	"creatorId":  userID,
})

					PushToUser(invitedUserID, map[string]any{
						"type": "group_invite",
						"data": map[string]any{
							"groupId":    groupID,
							"groupTitle": title,
							"creatorId":  userID,
						},
					})
				}
			}
		}

	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"message": "Group created successfully",
		"groupID": groupID,
	})
}

// for invite while creating group, by creator only
func GetUsersForInitialInvite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// get all users except creator
	rows, err := sqlite.DB.Query(`
	SELECT id, first_name, last_name, nickname, avatar
	FROM users
	WHERE ID != ?
	ORDER BY nickname
	`, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}
	defer rows.Close()

	type User struct {
		ID        string `json:"id"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Nickname  string `json:"nickname"`
		Avatar    string `json:"avatar"`
	}

	users := make([]User,0)

	for rows.Next() {

		var user User

		if err := rows.Scan(&user.ID, &user.FirstName, &user.LastName, &user.Nickname, &user.Avatar); err != nil {
			continue
		}

		users = append(users, user)
	}
	//get the intial invite
	PushToUser(userID, map[string]any{
		"type": "initial_group_invite_list",
		"data": map[string]any{
			"type":    "initial_group_invite_list",
			"content": users,
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"users": users,
	})
}

func GetUserPanelItems(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get invites where user is invited
	inviteRows, err := sqlite.DB.Query(
		`SELECT g.id, g.title, g.description, g.creator_id, 
		       u.first_name || ' ' || u.last_name as creator_name,
		       'invite' as type
		FROM group_members gm
		JOIN groups g ON gm.group_id = g.id
		JOIN users u ON g.creator_id = u.id
		WHERE gm.user_id = ? AND gm.status = 'invited'
		`, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch invites")
		return
	}
	defer inviteRows.Close()

	type User struct {
		ID        string `json:"id"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Nickname  string `json:"nickname,omitempty"`
		Avatar    string `json:"avatar,omitempty"`
	}

	type GroupItem struct {
		GroupID     int    `json:"group_id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		CreatorID   string `json:"creator_id"`
		CreatorName string `json:"creator_name"`
		Type        string `json:"type"` // "invite" or "request"
		User        *User  `json:"user,omitempty"`
	}

	var items []GroupItem

	// Process invites
	for inviteRows.Next() {
		var item GroupItem
		err := inviteRows.Scan(&item.GroupID, &item.Title, &item.Description,
			&item.CreatorID, &item.CreatorName, &item.Type)
		if err != nil {
			continue
		}
		items = append(items, item)
	}

	// Get join requests for groups where user is admin
	requestRows, err := sqlite.DB.Query(`
	SELECT g.id, g.title, 
           u.id as user_id, u.first_name, u.last_name, u.nickname, u.avatar
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    JOIN users u ON gm.user_id = u.id
    WHERE g.creator_id = ? AND gm.status = 'requested'
	`, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch join requests")
		return
	}
	defer requestRows.Close()

	// Process join requests
	for requestRows.Next() {
		var item GroupItem
		var user User
		err := requestRows.Scan(&item.GroupID, &item.Title,
			&user.ID, &user.FirstName, &user.LastName, &user.Nickname, &user.Avatar)
		if err != nil {
			continue
		}

		item.Type = "request"
		item.User = &user
		item.CreatorName = user.FirstName + " " + user.LastName

		items = append(items, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"items": items,
	})
}

func RespondToInvite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := r.ParseForm(); err != nil {
		writeErr(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	groupID := r.FormValue("group_id")
	response := r.FormValue("response")

	if groupID == "" || (response != "accept" && response != "decline") {
		writeErr(w, http.StatusBadRequest, "Group ID and valid response are required")
		return
	}

	// Check if the user has a pending invite for this group
	var exists bool
	err = sqlite.DB.QueryRow(`
        SELECT EXISTS(
            SELECT 1 FROM group_members 
            WHERE group_id = ? AND user_id = ? AND status = 'invited'
        )
    `, groupID, userID).Scan(&exists)

	if err != nil || !exists {
		writeErr(w, http.StatusNotFound, "Invite not found")
		return
	}
	var creatorID string
	_ = sqlite.DB.QueryRow(`SELECT creator_id FROM groups WHERE id=?`, groupID).Scan(&creatorID)
	if response == "accept" {
		_, err = sqlite.DB.Exec(`UPDATE group_members SET status='accepted' WHERE group_id=? AND user_id=?`, groupID, userID)

		if err == nil {
			_, _ = insertNotification(sqlite.DB, creatorID, "group_invite.accepted", map[string]any{
				"groupId": groupID,
				"userId":  userID,
			})
			if creatorID != "" {
				PushToUser(creatorID, map[string]any{
					"type": "group_invite.accepted",
					"data": map[string]any{
						"type":    "group_invite.accepted",
						"groupId": groupID,
						"userId":  userID,
					},
				})
			}
		}
	} else {
		_, err = sqlite.DB.Exec(`
            DELETE FROM group_members 
            WHERE group_id = ? AND user_id = ?
        `, groupID, userID)
		if err == nil && creatorID != "" {
						_, _ = insertNotification(sqlite.DB, creatorID, "group_invite.declined", map[string]any{
				"groupId": groupID,
				"userId":  userID,
			})
			PushToUser(creatorID, map[string]any{
				"type": "group_invite.declined",
				"data": map[string]any{
					"groupId": groupID,
					"userId":  userID,
				},
			})
		}
	}

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to process response")
		return
	}
	if response == "accept" {
	_, _ = insertNotification(sqlite.DB, creatorID, "group_invite.accepted", map[string]any{
		"groupId": groupID,
		"userId":  userID,
	})
} else {
	_, _ = insertNotification(sqlite.DB, creatorID, "group_invite.declined", map[string]any{
		"groupId": groupID,
		"userId":  userID,
	})
}

	PushToUser(userID, map[string]any{
		"type": "remove_initial_group_invite_list",
		"data": map[string]any{
			"type":    "remove_initial_group_invite_list",
			"groupId": groupID,
		}})
	//notify the respond to invite to the group creator
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": fmt.Sprintf("Invite %sd successfully", response),
	})
}

func LeaveGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	groupID := r.URL.Query().Get("group_id")

	if groupID == "" {

		// as alternative take from JSON body
		var req struct {
			GroupID int `json:"group_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, http.StatusBadRequest, "Invalid request")
			return
		}
		groupID = strconv.Itoa(req.GroupID)
	}

	// Check if user is the creator of the group
	var creatorID string
	err = sqlite.DB.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	// If user is the creator, they can't leave - they must delete the group
	if userID == creatorID {
		writeErr(w, http.StatusBadRequest, "Group creators cannot leave their own group. Use delete instead.")
		return
	}

	// check if user is a member in this group
	var memberID string
	err = sqlite.DB.QueryRow(
		`SELECT user_id FROM group_members WHERE user_id = ? AND group_id = ?`,
		userID, groupID).Scan(&memberID)

	if err != nil {
		writeErr(w, http.StatusBadRequest, "User is not a member of this group")
		return
	}

	// remove user from group
	_, err = sqlite.DB.Exec(`
	DELETE FROM group_members WHERE user_id = ? AND group_id = ?
	`, userID, groupID)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to leave group")
		return
	}
		_, _ = insertNotification(sqlite.DB, userID, "group_left", map[string]any{
		"groupId": groupID,
	})
	PushToUser(userID, map[string]any{
		"type": "user_left_group",
		"data": map[string]any{
			"type":    "user_left_group",
			"groupId": groupID,
		}})
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

// only for admin of group
func DeleteGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Extract group ID
	groupID := r.URL.Query().Get("group_id")
	if groupID == "" {
		var req struct {
			GroupID int `json:"group_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, http.StatusBadRequest, "Invalid request")
			return
		}
		groupID = strconv.Itoa(req.GroupID)
	}

	// Check if user is the creator of the group
	var creatorID string
	err = sqlite.DB.QueryRow("SELECT creator_id FROM groups WHERE id = ?", groupID).Scan(&creatorID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	if userID != creatorID {
		writeErr(w, http.StatusForbidden, "Only group creator can delete the group")
		return
	}

	// Begin transaction
	tx, err := sqlite.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback()

	// Delete all group messages
	_, err = tx.Exec("DELETE FROM group_chat WHERE group_id = ?", groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to delete group messages")
		return
	}

	// Delete all group members
	_, err = tx.Exec("DELETE FROM group_members WHERE group_id = ?", groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to delete group members")
		return
	}

	// Delete the group
	result, err := tx.Exec("DELETE FROM groups WHERE id = ?", groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to delete group")
		return
	}

	// Check if any rows were actually deleted
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeErr(w, http.StatusNotFound, "Group not found")
		return
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}
		_, _ = insertNotification(sqlite.DB, userID, "group_deleted", map[string]any{
		"groupId": groupID,
	})
	PushToUser(userID, map[string]any{
		"type": "group_deleted",
		"data": map[string]any{
			"type":    "group_deleted",
			"groupId": groupID,
		}})
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

// if i accept to invite already requested to join, then when user accepts invite (remove request to join, i think already clearing the record in db, but make sure front is comlient too)
// and when creator accepts his request, invite is removed
// oh wait status cannot be requested and invited already!!!!

// for all members
func InviteUsersToGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := r.ParseForm(); err != nil {
		writeErr(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	groupID := r.FormValue("group_id")
	members := r.FormValue("members")

	if groupID == "" || members == "" {
		writeErr(w, http.StatusBadRequest, "Group ID and members are required")
		return
	}

	// verify inviter is member
	var isMember bool
	if err = sqlite.DB.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM group_members
			WHERE user_id = ? AND group_id = ? AND status = 'accepted'
		)
	`, userID, groupID).Scan(&isMember); err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}
	if !isMember {
		writeErr(w, http.StatusForbidden, "You must be a member of the group to invite others")
		return
	}

	var invitedUsers []string
	if err := json.Unmarshal([]byte(members), &invitedUsers); err != nil {
		writeErr(w, http.StatusBadRequest, "Invalid members format")
		return
	}

	// fetch group title once for WS payloads
	var groupTitle string
	_ = sqlite.DB.QueryRow(`SELECT title FROM groups WHERE id = ?`, groupID).Scan(&groupTitle)

	tx, err := sqlite.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	for _, invitedUserID := range invitedUsers {
		if invitedUserID == userID {
			continue
		}
		var exists bool
		if err = sqlite.DB.QueryRow(
			`SELECT EXISTS(
				SELECT 1 FROM group_members
				WHERE user_id = ? AND group_id = ? AND status IN ('accepted', 'invited', 'requested')
			)`, invitedUserID, groupID).Scan(&exists); err != nil {
			continue
		}
		if exists {
			continue
		}
		if _, err := tx.Exec(`
			INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, 'invited')
		`, groupID, invitedUserID); err != nil {
			fmt.Printf("Failed to invite user %s: %v\n", invitedUserID, err)
			continue
		}
		_, _ = insertNotification(tx, invitedUserID, "group_invite", map[string]any{
	"groupId":    groupID,
	"groupTitle": groupTitle,
	"creatorId":  userID,    
})

		PushToUser(invitedUserID, map[string]any{
			"type": "group_invite",
			"data": map[string]any{
				"groupId":    groupID,
				"groupTitle": groupTitle,
				"creatorId":  userID,
			},
		})
	}

	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	PushToUser(userID, map[string]any{
		"type": "invite_users_to_group",
		"data": map[string]any{
			"type":    "invite_users_to_group",
			"groupId": groupID,
			"users":   invitedUsers,
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Users invited successfully",
	})
}

// get members not in group, to invite
func GetUsersForGroupInvite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// make sure list doesn't include already members of certain group

	// Extract group ID
	groupID := r.URL.Query().Get("group_id")
	if groupID == "" {
		writeErr(w, http.StatusBadRequest, "Group ID is required")
		return
	}

	var isMember bool

	// verify this guy is a member
	err = sqlite.DB.QueryRow(`
	SELECT EXISTS(
		SELECT 1 FROM group_members
		WHERE group_id = ? AND user_id = ? AND status = 'accepted'
	)
	`, groupID, userID).Scan(&isMember)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	if !isMember {
		writeErr(w, http.StatusForbidden, "You must be a member of the group to invite others")
		return
	}

	// get all users except : already member, already has invite pending (status invited)
	rows, err := sqlite.DB.Query(`
		SELECT u.id, u.first_name, u.last_name, u.nickname, u.avatar
		FROM users u
		WHERE u.id != ?
		AND u.id NOT IN (
			SELECT user_id
			FROM group_members
			WHERE group_id = ?
			AND status IN ('accepted', 'invited', 'requested')
		)
		ORDER BY u.nickname
	`, userID, groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}
	defer rows.Close()

	type User struct {
		ID        string `json:"id"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Nickname  string `json:"nickname"`
		Avatar    string `json:"avatar"`
	}

	users := make([]User,0)

	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.FirstName, &user.LastName, &user.Nickname, &user.Avatar); err != nil {
			continue
		}
		users = append(users, user)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"users": users,
	})
}

// not member, not inivited, not already requested
func RequestToJoinGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := r.ParseForm(); err != nil {
		writeErr(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	// Extract group ID
	groupID := r.FormValue("group_id")
	if groupID == "" {
		writeErr(w, http.StatusBadRequest, "Group ID is required")
		return
	}

	// check that user is not already a member, or invited or already requested to join

	var exists bool

	err = sqlite.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM group_members 
			WHERE user_id = ? AND group_id = ? 
			AND status IN ('accepted', 'invited', 'requested')
		 )
	`, userID, groupID).Scan(&exists)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	if exists {
		writeErr(w, http.StatusBadRequest, "Already a member, invited by members, or request pending approval from group admin")
		return
	}
	_, err = sqlite.DB.Exec(`
			INSERT INTO group_members (user_id, group_id, status) VALUES (?, ?, 'requested')
		`, userID, groupID)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to request join to group")
		return
	}
	PushToUser(userID, map[string]any{
		"type": "request_to_join_group",
		"data": map[string]any{
			"type":    "request_to_join_group",
			"groupId": groupID,
		}})
	var creatorID, groupTitle string
	if err := sqlite.DB.QueryRow(`SELECT creator_id, title FROM groups WHERE id = ?`, groupID).Scan(&creatorID, &groupTitle); err == nil && creatorID != "" {
				_, _ = insertNotification(sqlite.DB, creatorID, "group_request.created", map[string]any{
			"groupId":    groupID,
			"groupTitle": groupTitle,
			"userId":     userID,
		})
		PushToUser(creatorID, map[string]any{
			"type": "group_request.created",
			"data": map[string]any{
				"groupId":    groupID,
				"groupTitle": groupTitle,
				"userId":     userID,
			},
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "request to join group successful",
	})
}

// for group admin only, accept or decline user request
func RespondToUserRequestToGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := r.ParseForm(); err != nil {
		writeErr(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	groupID := r.FormValue("group_id")
	response := r.FormValue("response")
	requestedUserID := r.FormValue("requested_user_id")

	if groupID == "" || requestedUserID == "" || (response != "accept" && response != "decline") {
		writeErr(w, http.StatusBadRequest, "Group ID, user ID and valid response are required")
		return
	}

	// verify this user is admin of group
	var creatorID string

	err = sqlite.DB.QueryRow(`
		SELECT creator_id FROM groups WHERE id = ?
	`, groupID).Scan(&creatorID)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Group not found")
		return
	}

	if creatorID != userID {
		writeErr(w, http.StatusForbidden, "Only group admin can respond to requests")
		return
	}

	// verify user has a request status
	var status string
	err = sqlite.DB.QueryRow(`
        SELECT status FROM group_members 
        WHERE user_id = ? AND group_id = ?
    `, requestedUserID, groupID).Scan(&status)

	if err != nil || status != "requested" {
		writeErr(w, http.StatusBadRequest, "No pending request found for this user")
		return
	}

	// accept or decline request:
	if response == "accept" {
		_, err = sqlite.DB.Exec(`
			UPDATE group_members
			SET status = 'accepted'
			WHERE user_id = ? AND group_id = ?
		`, requestedUserID, groupID)
	} else {
		_, err = sqlite.DB.Exec(`
			DELETE FROM group_members
			WHERE user_id = ? AND group_id = ?
		`, requestedUserID, groupID)
	}

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to process request")
		return
	}
		_, _ = insertNotification(sqlite.DB, requestedUserID, "group_request.update", map[string]any{
		"groupId": groupID,
		"status":  response, // "accept" | "decline"
	})
	PushToUser(requestedUserID, map[string]any{
		"type": "group_request.update",
		"data": map[string]any{
			"groupId": groupID,
			"status":  response,
		},
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": fmt.Sprintf("Request %sed successfully by group admin", response),
	})
}

// check user status in group
func CheckUserJoinStatus(w http.ResponseWriter, r *http.Request) {
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
	if groupID == "" {
		writeErr(w, http.StatusBadRequest, "Group ID is required")
		return
	}

	var status string
	err = sqlite.DB.QueryRow(`
        SELECT status FROM group_members 
        WHERE user_id = ? AND group_id = ?
    `, userID, groupID).Scan(&status)

	if err != nil {
		// User has no relationship with this group
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":     true,
			"status": "none",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"status": status,
	})
}
