package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type listPost struct {
	PostID       int64  `json:"post_id"`
	GroupID      int64  `json:"group_id"`
	UserID       string `json:"user_id"`
	Nickname     string `json:"nickname"`
	FirstName    string `json:"firstName"`
	LastName     string `json:"lastName"`
	Avatar       string `json:"avatar"`
	Image        string `json:"image"`
	Content      string `json:"content"`
	CommentCount int    `json:"comment_count"`
	CreatedAt    string `json:"created_at"`
}
type CommentRow struct {
	ID        int64  `json:"id"`
	PostID    int64  `json:"post_id"`
	UserID    string `json:"user_id"`
	Nickname  string `json:"nickname"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Avatar    string `json:"avatar"`
	Content   string `json:"content"`
	Image     string `json:"image"`
	CreatedAt string `json:"created_at"`
}

func ListGroupPostsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}
		userID, err := GetUserIDFromRequest(r)
		if err != nil || userID == "" {
			writeErr(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		groupIDStr := r.URL.Query().Get("group_id")
		if groupIDStr == "" {
			writeErr(w, http.StatusBadRequest, "group_id is required")
			return
		}
		groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid group_id")
			return
		}

		// must be a member
		isMember, err := isGroupMember(userID, groupIDStr)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Database error")
			return
		}
		if !isMember {
			writeErr(w, http.StatusForbidden, "You must be a member of the group to create a group event")
			return
		}

		limit := 20
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, e := strconv.Atoi(v); e == nil && n > 0 && n <= 100 {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				offset = n
			}
		}
		const q = `
SELECT 
  p.id                             AS post_id,
  p.group_id,
  p.user_id,
  COALESCE(u.nickname,'')          AS nickname,
  COALESCE(u.first_name,'')        AS first_name,
  COALESCE(u.last_name,'')         AS last_name,
  COALESCE(u.avatar,'')            AS avatar,
  COALESCE(p.image,'')             AS image,
  p.content,
  p.created_at,
  (SELECT COUNT(*) FROM post_Comments c WHERE c.post_id = p.id) AS comment_count
FROM group_posts p
LEFT JOIN users u ON u.id = p.user_id
WHERE p.group_id = ?
ORDER BY p.created_at DESC
LIMIT ? OFFSET ?;
`

		rows, err := db.Query(q, groupID, limit, offset)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "query failed")
			return
		}
		defer rows.Close()

		var out []listPost
		for rows.Next() {
			var (
				p            listPost
				created      time.Time
				commentCount int64
			)
			if err := rows.Scan(
				&p.PostID, &p.GroupID, &p.UserID,
				&p.Nickname, &p.FirstName, &p.LastName, &p.Avatar,
				&p.Image, &p.Content, &created, &commentCount,
			); err != nil {

				writeErr(w, http.StatusInternalServerError, "scan failed")
				return
			}
			p.CreatedAt = created.UTC().Format(time.RFC3339)
			p.CommentCount = int(commentCount)
			out = append(out, p)
		}
		if err := rows.Err(); err != nil {
			writeErr(w, http.StatusInternalServerError, "rows failed")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":    true,
			"posts": out,
		})
	}
}
func ListPostCommentsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method != http.MethodGet {
			writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}
		userID, err := GetUserIDFromRequest(r)
		if err != nil || userID == "" {
			writeErr(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		postIDStr := r.URL.Query().Get("post_id")
		if postIDStr == "" {
			writeErr(w, http.StatusBadRequest, "post_id is required")
			return
		}
		postID, err := strconv.ParseInt(postIDStr, 10, 64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid post_id")
			return
		}

		limit := 20
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, e := strconv.Atoi(v); e == nil && n > 0 && n <= 100 {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				offset = n
			}
		}

		const q = `
SELECT 
  c.id,
  c.post_id,
  c.user_id,
  COALESCE(u.nickname,'')  AS nickname,
  COALESCE(u.first_name,'') AS first_name,
  COALESCE(u.last_name,'')  AS last_name,
  COALESCE(u.avatar,'')     AS avatar,
  COALESCE(c.content,'')    AS content,
  COALESCE(c.image,'')      AS image,
  c.created_at
FROM post_Comments c
LEFT JOIN users u ON u.id = c.user_id
WHERE c.post_id = ?
ORDER BY c.created_at Desc
LIMIT ? OFFSET ?;
`
		rows, err := db.Query(q, postID, limit, offset)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "query failed")
			return
		}
		defer rows.Close()

		var out []CommentRow
		for rows.Next() {
			var cr CommentRow
			var created time.Time
			if err := rows.Scan(
				&cr.ID, &cr.PostID, &cr.UserID,
				&cr.Nickname, &cr.FirstName, &cr.LastName, &cr.Avatar,
				&cr.Content, &cr.Image, &created,
			); err != nil {
				writeErr(w, http.StatusInternalServerError, "scan failed")
				return
			}
			cr.CreatedAt = created.UTC().Format(time.RFC3339)
			out = append(out, cr)
		}
		if err := rows.Err(); err != nil {
			writeErr(w, http.StatusInternalServerError, "rows failed")
			return
		}
		if out == nil {
			out = []CommentRow{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "comments": out})
	}
}

func CreatePostCommentHandler(db *sql.DB) http.HandlerFunc {
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

		if err := r.ParseForm(); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid form")
			return
		}

		postIDStr := r.FormValue("post_id")
		content := strings.TrimSpace(r.FormValue("content"))
		if postIDStr == "" {
			writeErr(w, http.StatusBadRequest, "post_id is required")
			return
		}
		postID, err := strconv.ParseInt(postIDStr, 10, 64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "invalid post_id")
			return
		}
		if content == "" {
			writeErr(w, http.StatusBadRequest, "content required")
			return
		}

		const ins = `INSERT INTO post_Comments (post_id, user_id, content) VALUES (?,?,?);`
		res, err := db.Exec(ins, postID, userID, content)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "insert failed")
			return
		}

		commentID, _ := res.LastInsertId()

		var newCount int
		if err := db.QueryRow(`SELECT COUNT(*) FROM post_Comments WHERE post_id = ?`, postID).Scan(&newCount); err != nil {
			writeErr(w, http.StatusInternalServerError, "count failed")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":         true,
			"new_count":  newCount,
			"comment_id": commentID,
		})
	}
}
