package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"time"
)

type groupPost struct {
	PostID       int64  `json:"post_id,omitempty"`
	GroupID      int64  `json:"group_id,omitempty"`
	UserID       string `json:"user_id,omitempty"`
	Nickname     string `json:"nickname"`
	FirstName    string `json:"firstName,omitempty"`
	LastName     string `json:"lastName,omitempty"`
	Avatar       string `json:"avatar,omitempty"`
	Image        string `json:"image"`
	CommentCount int    `json:"comment_count,omitempty"`
	LikeCount    int    `json:"like_count,omitempty"`
	IsLiked      bool   `json:"is_liked,omitempty"`
	Content      string `json:"content,omitempty"`
	CreatedAt    string `json:"created_at,omitempty"`
}

func CreateGroupPostHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}
		userID, err := GetUserIDFromRequest(r)
		if err != nil || userID == "" {
			writeErr(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		if err := r.ParseMultipartForm(25 << 20); err != nil { // 25MB
			writeErr(w, http.StatusBadRequest, "Error parsing form")
			return
		}
		content := r.FormValue("content")
		groupID := r.FormValue("group_id")
		if content == "" || groupID == "" {
			writeErr(w, http.StatusBadRequest, "Content and Group ID are required")
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

		// must be a member
		isMember, err := isGroupMember(userID, groupID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Database error")
			return
		}
		if !isMember {
			writeErr(w, http.StatusForbidden, "You must be a member of the group to make a group post")
			return
		}
		stmt, err := db.Prepare(`INSERT INTO group_posts ( group_id ,user_id, content, image) VALUES (?, ?, ?, ?)`)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to prepare insert")
			return
		}
		defer stmt.Close()

		result, err := stmt.Exec(groupID, userID, content, imagePath)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to insert post")
			return
		}
		postID, err := result.LastInsertId()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to get last insert ID")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"ok":      true,
			"message": "Post created successfully",
			"id":      postID,
		})
	}
}
