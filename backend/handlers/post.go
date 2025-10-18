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
	"strings"
	"time"
	"mime/multipart"
	"backend/pkg/db/sqlite"
)

type Post struct {
	UserID         string    `json:"user_id"`
	PostID         int64     `json:"post_id,omitempty"`
	Nickname       string    `json:"nickname"`
	FirstName      string    `json:"firstName,omitempty"`
	LastName       string    `json:"lastName,omitempty"`
	Avatar         string    `json:"avatar,omitempty"`
	Content        string    `json:"content"`
	Image          string    `json:"image"`
	Privacy        string    `json:"privacy"`
	CreatedAt      time.Time `json:"created_at,omitempty"`
	CommentCount   int       `json:"comment_count,omitempty"`
	LikeCount      int       `json:"like_count,omitempty"`
	IsLiked        bool      `json:"is_liked,omitempty"`        // Indicates if the current user liked this post
	FollowingLikes []string  `json:"following_likes,omitempty"` // Indicates if the current user follows likes on this post
}

func CreatePostHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Require login (reads session cookie -> user id)
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
		privacy := r.FormValue("privacy")
		if privacy == "" {
			privacy = "public"
		}

		// Optional image upload
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
		stmt, err := db.Prepare(`INSERT INTO posts (user_id, content, image, privacy) VALUES (?, ?, ?, ?)`)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to prepare insert")
			return
		}
		defer stmt.Close()

		result, err := stmt.Exec(userID, content, imagePath, privacy)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to insert post")
			return
		}

		postID, err := result.LastInsertId()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to get last insert ID")
			return
		}

		// Custom visibility
		if privacy == "custom" && r.MultipartForm != nil {
			customUsers := r.MultipartForm.Value["custom_users[]"]
			for _, targetUserID := range customUsers {
				if _, err := db.Exec(
					`INSERT INTO post_visibility (post_id, user_id) VALUES (?, ?)`,
					postID, targetUserID,
				); err != nil {
					writeErr(w, http.StatusInternalServerError, "Failed to insert custom visibility")
					return
				}
			}
		}

		writeJSON(w, http.StatusCreated, map[string]any{
			"ok":      true,
			"message": "Post created successfully",
			"id":      postID,
		})
	}
}

func GetAllUsersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(`SELECT id, nickname, first_name, last_name, avatar FROM users`)
		if err != nil {
			http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type UserSummary struct {
			ID        string `json:"id"`
			Nickname  string `json:"nickname"`
			FirstName string `json:"firstName"`
			LastName  string `json:"lastName"`
			Avatar    string `json:"avatar"`
		}

		var users []UserSummary
		for rows.Next() {
			var u UserSummary
			if err := rows.Scan(&u.ID, &u.Nickname, &u.FirstName, &u.LastName, &u.Avatar); err != nil {
				continue
			}
			users = append(users, u)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(users)
	}
}

func GetAllPostsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		currentUserID, err := GetUserIDFromRequest(r)
		if err != nil || currentUserID == "" {
			writeErr(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		rows, err := db.Query(`
SELECT 
    p.user_id,
    p.id,
    u.nickname,
    u.first_name,
    u.last_name,
    u.avatar,
    p.content,
    p.image,
    p.privacy,
    p.created_at,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS is_liked,
    (
      SELECT GROUP_CONCAT(
               CASE 
                   WHEN u2.nickname != '' THEN u2.nickname 
                   ELSE u2.first_name || ' ' || u2.last_name 
               END, ', '
             )
      FROM likes l2
      JOIN users u2 ON u2.id = l2.user_id
      JOIN followers f ON f.following_id = u2.id
      WHERE l2.post_id = p.id
        AND f.follower_id = ?
        AND f.status = 'accepted'
    ) AS followed_likers
FROM posts p
JOIN users u ON u.id = p.user_id
WHERE
    -- Public posts: show to everyone
    p.privacy = 'public'
    
    OR
    
    -- Follower-only posts: show if current user follows the post author
    (
        p.privacy = 'followers' 
        AND EXISTS (
            SELECT 1 FROM followers f
            WHERE f.following_id = p.user_id 
            AND f.follower_id = ?
            AND f.status = 'accepted'
        )
    )
    
    OR
    
    -- Custom posts: show if current user is in the visibility list
    (
        p.privacy = 'custom'
        AND EXISTS (
            SELECT 1 FROM post_visibility pv
            WHERE pv.post_id = p.id 
            AND pv.user_id = ?
        )
    )
    
    OR
    
    -- Always show user's own posts
    p.user_id = ?
    
ORDER BY p.created_at DESC;
`, currentUserID, // is_liked
			currentUserID, // followed_likers
			currentUserID, // followers check
			currentUserID, // custom visibility check
			currentUserID) // own posts check
		if err != nil {
			http.Error(w, "Failed to query posts", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var posts []Post
		for rows.Next() {
			var post Post
			var followedLikers sql.NullString
			if err := rows.Scan(
				&post.UserID,
				&post.PostID,
				&post.Nickname,
				&post.FirstName,
				&post.LastName,
				&post.Avatar,
				&post.Content,
				&post.Image,
				&post.Privacy,
				&post.CreatedAt,
				&post.CommentCount,
				&post.LikeCount,
				&post.IsLiked,
				&followedLikers,
			); err != nil {
				http.Error(w, "Error scanning posts", http.StatusInternalServerError)
				return
			}
			if followedLikers.Valid && followedLikers.String != "" {
				post.FollowingLikes = strings.Split(followedLikers.String, ", ")
			} else {
				post.FollowingLikes = []string{}
			}
			posts = append(posts, post)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(posts)
	}
}

func GetUserPostsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	profileUserID := pathParts[3]

	// Check if user is viewing their own profile
	isOwnProfile := userID == profileUserID

	// Check user privacy setting
	var isPublic bool
	err = sqlite.DB.QueryRow(`
		SELECT is_public FROM users WHERE id = ?
	`, profileUserID).Scan(&isPublic)

	if err != nil {
		if err == sql.ErrNoRows {
			writeErr(w, http.StatusNotFound, "User not found")
		} else {
			writeErr(w, http.StatusInternalServerError, "Database error")
		}
		return
	}

	// Check if the requesting user follows the profile user (if needed)
	var followsUser bool
	if !isPublic && !isOwnProfile {
		err = sqlite.DB.QueryRow(`
			SELECT EXISTS (
			SELECT 1
			FROM followers 
			WHERE follower_id = ? 
			AND following_id = ? 
			AND status = 'accepted'
			) 
			
		`, userID, profileUserID).Scan(&followsUser)

		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Database error")
			return
		}

		if !followsUser {
			writeJSON(w, http.StatusForbidden, map[string]any{
				"ok":      false,
				"message": "must follow user to view their posts",
			})
			return
		}
	}

	// Query db for user's posts with privacy checks
	rows, err := sqlite.DB.Query(`
    SELECT 
        p.user_id,
        p.id,
        u.nickname,
        u.first_name,
        u.last_name,
        u.avatar,
        p.content,
        p.image,
        p.privacy,
        p.created_at,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS is_liked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
    AND (
        -- Show all posts if viewing own profile
        ? = 1
        
        OR
        
        -- Public posts: show to everyone
        p.privacy = 'public'
        
        OR
        
        -- Follower-only posts: show if current user follows the post author
        (
            p.privacy = 'followers' 
            AND EXISTS (
                SELECT 1 FROM followers f
                WHERE f.following_id = p.user_id 
                AND f.follower_id = ?
                AND f.status = 'accepted'
            )
        )
        
        OR
        
        -- Custom posts: show if current user is in the visibility list
        (
            p.privacy = 'custom'
            AND EXISTS (
                SELECT 1 FROM post_visibility pv
                WHERE pv.post_id = p.id 
                AND pv.user_id = ?
            )
        )
    )
    ORDER BY p.created_at DESC
`, userID, // is_liked parameter (1st)
		profileUserID, // posts by this user (2nd)
		isOwnProfile,  // 1 if viewing own profile, 0 otherwise (3rd)
		userID,        // follower check (4th) - This was missing!
		userID)        // custom visibility check (5th)
	if err != nil {
		http.Error(w, "Failed to fetch posts", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var post Post
		if err := rows.Scan(
			&post.UserID,
			&post.PostID,
			&post.Nickname,
			&post.FirstName,
			&post.LastName,
			&post.Avatar,
			&post.Content,
			&post.Image,
			&post.Privacy,
			&post.CreatedAt,
			&post.CommentCount,
			&post.LikeCount,
			&post.IsLiked,
		); err != nil {
			http.Error(w, "Error scanning posts", http.StatusInternalServerError)
			return
		}
		posts = append(posts, post)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func validateImage(file multipart.File, handler *multipart.FileHeader) error {
    // Check file size (25MB max)
    if handler.Size > 25<<20 {
        return fmt.Errorf("file size too large - maximum 25MB")
    }

    // Check file extension
    ext := strings.ToLower(filepath.Ext(handler.Filename))
    allowedExtensions := map[string]bool{
        ".jpg":  true,
        ".jpeg": true,
        ".png":  true,
        ".gif":  true,
    }
    if !allowedExtensions[ext] {
        return fmt.Errorf("invalid file type. Only JPG, PNG, and GIF are allowed")
    }

    // Check MIME type by reading the first 512 bytes
    buffer := make([]byte, 512)
    _, err := file.Read(buffer)
    if err != nil {
        return fmt.Errorf("failed to read file for MIME type detection")
    }

    // Reset file pointer after reading
    _, err = file.Seek(0, 0)
    if err != nil {
        return fmt.Errorf("failed to reset file pointer")
    }

    mimeType := http.DetectContentType(buffer)
    allowedMimeTypes := map[string]bool{
        "image/jpeg":      true,
        "image/png":       true,
        "image/gif":       true,
    }

    if !allowedMimeTypes[mimeType] {
        return fmt.Errorf("invalid file format. Only JPEG, PNG, and GIF images are allowed")
    }

    // Additional check: ensure extension matches MIME type
    if (ext == ".jpg" || ext == ".jpeg") && mimeType != "image/jpeg" {
        return fmt.Errorf("file extension does not match file content")
    }
    if ext == ".png" && mimeType != "image/png" {
        return fmt.Errorf("file extension does not match file content")
    }
    if ext == ".gif" && mimeType != "image/gif" {
        return fmt.Errorf("file extension does not match file content")
    }

    return nil
}
