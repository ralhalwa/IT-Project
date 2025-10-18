package handlers

import (
	"backend/pkg/db/sqlite"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	 "time" 
)

func ToggleProfilePrivacyHandler(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var isPublic bool
	if err := sqlite.DB.QueryRow(`SELECT is_public FROM users WHERE id = ?`, userID).Scan(&isPublic); err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	newIsPublic := !isPublic

	if _, err := sqlite.DB.Exec(`UPDATE users SET is_public = ? WHERE id = ?`, newIsPublic, userID); err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	if newIsPublic {
		var pendingFollowerIDs []string
		rows, err := sqlite.DB.Query(`
			SELECT follower_id
			FROM followers
			WHERE following_id = ? AND status = 'pending'
		`, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var fid string
				if err := rows.Scan(&fid); err == nil {
					pendingFollowerIDs = append(pendingFollowerIDs, fid)
				}
			}
		}

		_, _ = sqlite.DB.Exec(`
			UPDATE followers
			SET status = 'accepted', created_at = CURRENT_TIMESTAMP
			WHERE following_id = ? AND status = 'pending'
		`, userID)

		var fn2, ln2, nn2, av2 string
		_ = sqlite.DB.QueryRow(`
			SELECT firstName, lastName, nickname, avatar
			FROM users WHERE id = ?
		`, userID).Scan(&fn2, &ln2, &nn2, &av2)

		for _, fid := range pendingFollowerIDs {
			PushToUser(fid, map[string]any{
				"type": "notification.created",
				"data": map[string]any{
					"type": "follow_request.update",
					"content": map[string]any{
						"status":      "accepted",
						"followingId": userID,
						"firstName":  fn2,
						"lastName":   ln2,
						"nickname":    nn2,
						"avatar":      av2,
					},
				},
			})
			_, _ = insertNotification(sqlite.DB, fid, "follow_request.update", map[string]any{
				"status":      "accepted",
				"followingId": userID,
				"firstName":  fn2,
				"lastName":   ln2,
				"nickname":    nn2,
				"avatar":      av2,
			})
			if uc, err := unreadCount(sqlite.DB, fid); err == nil {
				PushToUser(fid, map[string]any{
					"type": "badge.unread",
					"data": map[string]any{"count": uc},
				})
			}
		}

		var pendingCount int
		_ = sqlite.DB.QueryRow(`
			SELECT COUNT(*) FROM followers
			WHERE following_id = ? AND status = 'pending'
		`, userID).Scan(&pendingCount)
		PushToUser(userID, map[string]any{
			"type": "badge.follow_requests",
			"data": map[string]any{"count": pendingCount},
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"isPublic": newIsPublic,
	})
}


func GetUserFollowers(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if userID == "" || err != nil {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	ProfileUserID := strings.TrimPrefix(r.URL.Path, "/api/users/")
	ProfileUserID = strings.TrimSuffix(ProfileUserID, "/followers")

	rows, err := sqlite.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar
		FROM followers f
		JOIN users u ON f.follower_id = u.id
		WHERE f.following_id = ? AND f.status = 'accepted'
	`, ProfileUserID)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	defer rows.Close()

	type Follower struct {
		ID        string `json:"id"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Avatar    string `json:"avatar"`
	}

	var followers []Follower

	for rows.Next() {
		var f Follower

		err := rows.Scan(&f.ID, &f.FirstName, &f.LastName, &f.Avatar)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Database error")
			return
		}

		followers = append(followers, f)
	}

	if err := rows.Err(); err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"followers": followers,
	})
}

func GetUserFollowing(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	ProfileUserID := strings.TrimPrefix(r.URL.Path, "/api/users/")
	ProfileUserID = strings.TrimSuffix(ProfileUserID, "/followings")

	rows, err := sqlite.DB.Query(`
	SELECT u.id, u.first_name, u.last_name, u.avatar
	FROM followers f
	JOIN users u ON u.id=f.following_id
	WHERE f.follower_id = ? AND f.status = 'accepted'
	`, ProfileUserID)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	defer rows.Close()

	type Following struct {
		ID        string `json:"id"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Avatar    string `json:"avatar"`
	}

	var followings []Following

	for rows.Next() {

		var f Following

		err := rows.Scan(&f.ID, &f.FirstName, &f.LastName, &f.Avatar)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Database error")
			return
		}

		followings = append(followings, f)
	}

	if err := rows.Err(); err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"followings": followings,
	})

}

func FollowUser(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	//user who wants to follow another user
	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	//get user to follow
	var req struct {
		FollowingID string `json:"following_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.FollowingID == "" {
		writeErr(w, http.StatusBadRequest, "Following ID is required")
		return
	}

	//user cannot follow himself
	if userID == req.FollowingID {
		writeErr(w, http.StatusBadRequest, "Cannot follow yourself")
		return

	}

	//check if already following that user
	var existingStatus string
	err = sqlite.DB.QueryRow(`
		SELECT status FROM followers
		WHERE follower_id = ? AND following_id = ?
		`, userID, req.FollowingID).Scan(&existingStatus)

	if err == nil {

		if existingStatus == "pending" {
			writeErr(w, http.StatusConflict, "Follow request already pending")
			return
		} else if existingStatus == "accepted" {
			writeErr(w, http.StatusConflict, "Already following this user")
			return
		} else if existingStatus == "declined" {

			_, err = sqlite.DB.Exec(`
				UPDATE followers SET status = 'pending' , created_at = CURRENT_TIMESTAMP
				WHERE follower_id = ? AND following_id = ? 
				`, userID, req.FollowingID)

			if err != nil {
				writeErr(w, http.StatusInternalServerError, "Database error")
				return
			}
			var fn, ln, nn, av string
			_ = sqlite.DB.QueryRow(`
				SELECT first_name, last_name, nickname, avatar
				FROM users WHERE id = ?
			`, userID).Scan(&fn, &ln, &nn, &av)

			PushToUser(req.FollowingID, map[string]any{
				"type": "notification.created",
				"data": map[string]any{
					"type": "follow_request",
					"content": map[string]any{
						"followerId": userID,
						"firstName": fn,
						"lastName":  ln,
						"nickname":   nn,
						"avatar":     av,
						"createdAt":  time.Now().Format(time.RFC3339),
					},
				},
			})

			var pendingCount int
			_ = sqlite.DB.QueryRow(`
				SELECT COUNT(*) FROM followers
				WHERE following_id = ? AND status = 'pending'
			`, req.FollowingID).Scan(&pendingCount)

			PushToUser(req.FollowingID, map[string]any{
				"type": "badge.follow_requests",
				"data": map[string]any{"count": pendingCount},
			})

			writeJSON(w, http.StatusOK, map[string]any{
				"ok":      true,
				"status":  "pending",
				"message": "Follow request sent", //if it was declined then for sure account is private, should i do accepted here immediately if account is public, or from frontend? WHAT IF account status changed from prev declined to now, became public now, if became public remove all existing statuses????
			})
			return
		}
	}

	var isPublic bool
	err = sqlite.DB.QueryRow(`
		SELECT is_public FROM users WHERE id = ?
	`, req.FollowingID).Scan(&isPublic)

	if err != nil {
		writeErr(w, http.StatusNotFound, "User not found")
		return
	}

	status := "accepted"
	if !isPublic {
		status = "pending"
	}

	//try to update status, use update cuz if i follow then get declined, then i follow again, its not 2 records !
	result, err := sqlite.DB.Exec(`
        UPDATE followers 
        SET status = ?, created_at = CURRENT_TIMESTAMP
        WHERE follower_id = ? AND following_id = ?
    `, status, userID, req.FollowingID)

    if err != nil {
        fmt.Printf("Update error: %v\n", err)
        writeErr(w, http.StatusInternalServerError, "Database error")
        return
    }

    rowsAffected, _ := result.RowsAffected()
	
	// If no rows updated, insert new record
    if rowsAffected == 0 {
        _, err = sqlite.DB.Exec(`
            INSERT INTO followers (follower_id, following_id, status)
            VALUES (?, ?, ?)
        `, userID, req.FollowingID, status)

        if err != nil {
            fmt.Printf("Insert error: %v\n", err)
            writeErr(w, http.StatusInternalServerError, "Database error")
            return
        }
    }
if status == "pending" {
		// notify the private account owner
		var fn, ln, nn, av string
		_ = sqlite.DB.QueryRow(`
			SELECT first_name, last_name, nickname, avatar
			FROM users WHERE id = ?
		`, userID).Scan(&fn, &ln, &nn, &av)

		PushToUser(req.FollowingID, map[string]any{
			"type": "notification.created",
			"data": map[string]any{
				"type": "follow_request",
				"content": map[string]any{
					"followerId": userID,
					"firstName": fn,
					"lastName":  ln,
					"nickname":   nn,
					"avatar":     av,
					"createdAt":  time.Now().Format(time.RFC3339),
				},
			},
		})
		_, _ = insertNotification(sqlite.DB, req.FollowingID, "follow_request", map[string]any{
			"followerId": userID,
			"firstName": fn,
			"lastName":  ln,
			"nickname":   nn,
			"avatar":     av,
			"createdAt":  time.Now().Format(time.RFC3339),
		})
		var pendingCount int
		_ = sqlite.DB.QueryRow(`
			SELECT COUNT(*) FROM followers
			WHERE following_id = ? AND status = 'pending'
		`, req.FollowingID).Scan(&pendingCount)

		PushToUser(req.FollowingID, map[string]any{
			"type": "badge.follow_requests",
			"data": map[string]any{"count": pendingCount},
		})
	}

	if status == "accepted" {
		PushToUser(userID, map[string]any{
			"type": "notification.created",
			"data": map[string]any{
				"type": "follow_request.update",
				"content": map[string]any{
					"status":      "accepted",
					"followingId": req.FollowingID,
				},
			},
		})
	}
			_, _ = insertNotification(sqlite.DB, userID, "follow_request.update", map[string]any{
			"status":      "accepted",
			"followingId": req.FollowingID,
		})
		if uc, err := unreadCount(sqlite.DB, userID); err == nil {
			PushToUser(userID, map[string]any{
				"type": "badge.unread",
				"data": map[string]any{"count": uc},
			})
		}
	
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"status":  status,
		"message": fmt.Sprintf("Follow %s", status),
	})
}

func UnFollowAUser(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	//user that wants to unfollow someone
	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// user that will get unfollowed
	var req struct {
		FollowingID string `json:"following_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.FollowingID == "" {
		writeErr(w, http.StatusBadRequest, "Following ID is required")
		return
	}

	//delete the follow
	result, err := sqlite.DB.Exec(`
	DELETE FROM followers
	WHERE follower_id = ? AND following_id = ?
	`, userID, req.FollowingID)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeErr(w, http.StatusNotFound, "Not following this user")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Unfollowed successfully",
	})

	return
}

func GetFollowStatus(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	//user who sent a follow req
	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	//user who received a follow req
	followingID := r.URL.Query().Get("following_id")
	if followingID == "" {
		writeErr(w, http.StatusBadRequest, "Following ID is required")
		return
	}

	var status string
	err = sqlite.DB.QueryRow(`
	SELECT status FROM followers WHERE follower_id = ? AND following_id = ?
	`, userID, followingID).Scan(&status)

	if err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":     true,
				"status": "not_following",
			})
			return
		}
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"status": status,
	})

}

func GetUserFollowCounts(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := strings.TrimPrefix(r.URL.Path, "/api/users/")
	userID = strings.TrimSuffix(userID, "/follow-counts")

	var followingCount, followersCount int

	err := sqlite.DB.QueryRow(`
	SELECT 
		(SELECT COUNT(*) FROM followers WHERE follower_id = ? AND status = 'accepted') as following_count,
		(SELECT COUNT(*) FROM followers WHERE following_id = ? AND status = 'accepted') as follower_count
	`, userID, userID).Scan(&followingCount, &followersCount)

	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"following_count": followingCount,
		"follower_count":  followersCount,
	})
}

func RespondToFollowRequest(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		FollowerID string `json:"follower_id"`
		Action     string `json:"action"` //action either accept or decline
	}

	if err:= json.NewDecoder(r.Body).Decode(&req); err !=nil{
		writeErr(w, http.StatusBadRequest, "Invalid request body")
        return
	}

	if req.FollowerID == "" || (req.Action != "accept" && req.Action != "decline") {
        writeErr(w, http.StatusBadRequest, "Invalid parameters")
        return
    }

	//get current status to check that its pending
	var currentStatus string
	err = sqlite.DB.QueryRow(`
	SELECT status FROM followers
	WHERE follower_id = ? AND following_id = ?
	`, req.FollowerID, userID).Scan(&currentStatus)

	if err!=nil{
		writeErr(w, http.StatusNotFound, "Follow request not found")
        return
	}

	if currentStatus != "pending"{
		writeErr(w, http.StatusConflict, "Request is not pending")
        return
	}


	newStatus:= "accepted"

	if req.Action == "decline"{
		newStatus = "declined"
	}

	//update status to the action
	_, err = sqlite.DB.Exec(`
	UPDATE followers SET status = ?
	WHERE follower_id = ? AND following_id = ?
	`, newStatus, req.FollowerID, userID)

	if err != nil {
        writeErr(w, http.StatusInternalServerError, "Database error")
        return
    }
	// info about the account owner (who accepted/declined)
	var fn2, ln2, nn2, av2 string
	_ = sqlite.DB.QueryRow(`
		SELECT first_name, last_name, nickname, avatar
		FROM users WHERE id = ?
	`, userID).Scan(&fn2, &ln2, &nn2, &av2)

	// notify the requester (the follower)
	PushToUser(req.FollowerID, map[string]any{
		"type": "notification.created",
		"data": map[string]any{
			"type": "follow_request.update",
			"content": map[string]any{
				"status":      newStatus, // "accepted" or "declined"
				"followingId": userID,
				"firstName":  fn2,
				"lastName":   ln2,
				"nickname":    nn2,
				"avatar":      av2,
			},
		},
	})
		// DB persist for requester
	_, _ = insertNotification(sqlite.DB, req.FollowerID, "follow_request.update", map[string]any{
		"status":      newStatus,
		"followingId": userID,
		"firstName":  fn2,
		"lastName":   ln2,
		"nickname":    nn2,
		"avatar":      av2,
	})
	if uc, err := unreadCount(sqlite.DB, req.FollowerID); err == nil {
		PushToUser(req.FollowerID, map[string]any{
			"type": "badge.unread",
			"data": map[string]any{"count": uc},
		})
	}

	// refresh the pending badge for the account owner
	var pendingCount2 int
	_ = sqlite.DB.QueryRow(`
		SELECT COUNT(*) FROM followers
		WHERE following_id = ? AND status = 'pending'
	`, userID).Scan(&pendingCount2)

	PushToUser(userID, map[string]any{
		"type": "badge.follow_requests",
		"data": map[string]any{"count": pendingCount2},
	})
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"status": newStatus,
		"message": fmt.Sprintf("Request %sed", req.Action),
	})
}

func GetPendingFollowRequests(w http.ResponseWriter, r *http.Request){
	if r.Method != http.MethodGet {
        writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
        return
    }

    userID, err := GetUserIDFromRequest(r)
    if err != nil || userID == "" {
        writeErr(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

	//get all pending requests sent to user
	rows, err := sqlite.DB.Query(`
	SELECT u.id, u.first_name, u.last_name, u.avatar, f.created_at
	FROM followers f
	JOIN users u ON f.follower_id = u.id
	WHERE f.following_id = ? AND f.status = 'pending'
	ORDER BY f.created_at DESC
	`, userID)

	if err != nil {
        writeErr(w, http.StatusInternalServerError, "Database error")
        return
    }
    defer rows.Close()

	type PendingRequest struct{
		ID        string `json:"id"`
        FirstName string `json:"firstName"`
        LastName  string `json:"lastName"`
        Avatar    string `json:"avatar"`
        CreatedAt string `json:"createdAt"`
	}


	var reqs []PendingRequest

	for rows.Next(){

		var req PendingRequest
		err := rows.Scan(&req.ID, &req.FirstName, &req.LastName, &req.Avatar, &req.CreatedAt)

		if err != nil {
            writeErr(w, http.StatusInternalServerError, "Database error")
            return
        }
		reqs = append(reqs, req)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
       "requests": reqs,
	})
}

func GetUserPrivacyStatus(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
        return
    }

    userID := strings.TrimPrefix(r.URL.Path, "/api/users/")
    userID = strings.TrimSuffix(userID, "/privacy-status")

    var isPublic bool
    err := sqlite.DB.QueryRow(`
        SELECT is_public FROM users WHERE id = ?
    `, userID).Scan(&isPublic)

    if err != nil {
        writeErr(w, http.StatusNotFound, "User not found")
        return
    }

    writeJSON(w, http.StatusOK, map[string]any{
        "ok":       true,
        "is_public": isPublic,
    })
}