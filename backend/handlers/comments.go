package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Comment struct {
	UserID    string    `json:"user_id"`
	FirstName string    `json:"firstName,omitempty"`
	LastName  string    `json:"lastName,omitempty"`
	Avatar    string    `json:"avatar,omitempty"`
	Nickname  string    `json:"nickname"`
	Text      string    `json:"text"`
	Image     string    `json:"image"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

func CommentsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		postID, err := strconv.Atoi(strings.TrimSpace(r.FormValue("post_id")))
		if err != nil || postID <= 0 {
			http.Error(w, "Invalid post ID", http.StatusBadRequest)
			return
		}
		userID, err := GetUserIDFromRequest(r)
		if err != nil || userID == "" {
			writeErr(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		content := strings.TrimSpace(r.FormValue("content"))
		if content != "" {
			if err := r.ParseMultipartForm(25 << 20); err != nil { // 25MB
				writeErr(w, http.StatusBadRequest, "Error parsing form")
				return
			}
			var imagePath string
			file, handler, err := r.FormFile("image")
			if err == nil {
				defer file.Close()

				// Validate image
				if err := validateImage(file, handler); err != nil {
					writeErr(w, http.StatusBadRequest, err.Error())
					return
				}

				uploadDir := filepath.Join(".", "uploads")
				// Ensure uploads dir exists
				if mkErr := os.MkdirAll(uploadDir, os.ModePerm); mkErr != nil {
					writeErr(w, http.StatusInternalServerError, "Failed to prepare upload folder")
					return
				}

				// Simple unique filename to avoid collisions
				filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), path.Base(handler.Filename))
				filepath := filepath.Join(uploadDir, filename)
				dst, createErr := os.Create(filepath)
				if createErr != nil {
					writeErr(w, http.StatusInternalServerError, "Failed to save image")
					return
				}
				defer dst.Close()

				if _, copyErr := io.Copy(dst, file); copyErr != nil {
					writeErr(w, http.StatusInternalServerError, "Failed to save image")
					return
				}
				imagePath = filename
			}
			// Insert post (server-side userID from session)
			stmt, err := db.Prepare(`INSERT INTO comments (post_id, user_id, content, image) VALUES (?, ?, ?, ?)`)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, "Failed to prepare insert")
				return
			}
			defer stmt.Close()
			_, err = stmt.Exec(postID, userID, content, imagePath)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, "Failed to insert post")
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{
				"ok":      true,
				"message": "Comment created successfully",
				"id":      postID,
			})
		} else {
			rows, err := db.Query(`
    SELECT 
        c.user_id,
        u.nickname,
        u.first_name,
        u.last_name,
		u.avatar,
        c.content,
        c.image,
        c.created_at
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at DESC
`, postID)
			if err != nil {
				http.Error(w, "Failed to query comments", http.StatusInternalServerError)
				return
			}
			defer rows.Close()

			var Comments []Comment
			for rows.Next() {
				var comment Comment
				if err := rows.Scan(
					&comment.UserID,
					&comment.Nickname,
					&comment.FirstName,
					&comment.LastName,
					&comment.Avatar,
					&comment.Text,
					&comment.Image,
					&comment.CreatedAt,
				); err != nil {
					http.Error(w, "Error scanning posts", http.StatusInternalServerError)
					return
				}
				Comments = append(Comments, comment)
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(Comments)
		}
	}
}
