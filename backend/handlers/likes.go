package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
)

func LikesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		postID, err := strconv.Atoi(r.FormValue("post_id"))
		if err != nil || postID <= 0 {
			http.Error(w, "Invalid post ID", http.StatusBadRequest)
			return
		}
		userID, err := GetUserIDFromRequest(r)
		if err != nil || userID == "" {
			writeErr(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		var existingLikeCount int
		err = db.QueryRow("SELECT COUNT(*) FROM likes WHERE user_id = ? AND post_id = ? AND is_like = 1", userID, postID).Scan(&existingLikeCount)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to check existing likes")
			return
		}

		// If the user already liked this post, do nothing
		if existingLikeCount > 0 {
			_, err := db.Exec("DELETE FROM likes WHERE user_id = ? AND post_id = ? AND is_like = 1", userID, postID)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, "Failed to remove like")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}

		// Insert a new like into the likes table
		_, err = db.Exec("INSERT INTO likes (user_id, post_id, is_like) VALUES (?, ?, 1)", userID, postID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to insert like")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}
