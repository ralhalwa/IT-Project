package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	db "backend/pkg/db/sqlite"
)

func MeHandler(w http.ResponseWriter, r *http.Request) {
	uid, err := GetUserIDFromRequest(r)
	if err != nil || uid == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "id": "", "nickname": ""})
		return
	}

	var nickname string
	// simple lookup
	if err := db.DB.QueryRow(`SELECT nickname FROM users WHERE id = ?`, uid).Scan(&nickname); err != nil {
		nickname = ""
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"id":       uid,
		"nickname": nickname,
	})
}

func GetUserProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// extract user id from url path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		writeErr(w, http.StatusBadRequest, "Invalid user ID format")
		return
	}
	profileUserID := pathParts[3]


	var isPublic bool
	err = db.DB.QueryRow(`
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

	// Check if we should return limited profile data
	returnLimitedData := false
	if !isPublic && userID != profileUserID {
		// Check if the requesting user follows the profile user
		var followsMe bool
		err = db.DB.QueryRow(`
			SELECT COUNT(*) > 0 
			FROM followers 
			WHERE follower_id = ? 
			AND following_id = ? 
			AND status = 'accepted'
		`, userID, profileUserID).Scan(&followsMe)
		
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Database error")
			return
		}
		
		if !followsMe {
			returnLimitedData = true
		}
	}

	// Fetch user data based on access level
	if returnLimitedData {
		var limitedUser struct {
			ID        string `json:"id"`
			FirstName string `json:"firstName"`
			LastName  string `json:"lastName"`
			Nickname  string `json:"nickname"`
			Avatar    string `json:"avatar"`
			IsPublic  bool   `json:"is_public"`
		}

		err = db.DB.QueryRow(`
			SELECT id, first_name, last_name, nickname, avatar, is_public
			FROM users 
			WHERE id = ?
		`, profileUserID).Scan(
			&limitedUser.ID, &limitedUser.FirstName, &limitedUser.LastName, 
			&limitedUser.Nickname, &limitedUser.Avatar, &limitedUser.IsPublic,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				writeErr(w, http.StatusNotFound, "User not found")
			} else {
				writeErr(w, http.StatusInternalServerError, "Database error")
			}
			return
		}

		writeJSON(w, http.StatusOK, limitedUser)
		return
	}

	// Return full profile data for public accounts, owners, or followers
	var user struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Nickname  string `json:"nickname"`
		AboutMe   string `json:"aboutMe"`
		Avatar    string `json:"avatar"`
		DOB       string `json:"dob"`
		IsPublic  bool   `json:"is_public"`
	}

	err = db.DB.QueryRow(`
		SELECT id, email, first_name, last_name, nickname, about_me, avatar, dob, is_public
		FROM users 
		WHERE id = ?
	`, profileUserID).Scan(
		&user.ID, &user.Email, &user.FirstName, &user.LastName, 
		&user.Nickname, &user.AboutMe, &user.Avatar, &user.DOB, &user.IsPublic,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			writeErr(w, http.StatusNotFound, "User not found")
		} else {
			writeErr(w, http.StatusInternalServerError, "Database error")
		}
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// extract user id from url path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		writeErr(w, http.StatusBadRequest, "Invalid user ID format")
		return
	}
	userId := pathParts[3]
	var user struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Nickname  string `json:"nickname"`
		AboutMe   string `json:"aboutMe"`
		Avatar    string `json:"avatar"`
		DOB       string `json:"dob"`
		IsPublic  bool   `json:"is_public"`
	}

	err := db.DB.QueryRow(
		`
		SELECT id, email, first_name, last_name, nickname, about_me, avatar, date(dob), is_public
		FROM users
		WHERE id = ?
		`, userId).Scan(
		&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.Nickname, &user.AboutMe, &user.Avatar, &user.DOB, &user.IsPublic,
	)
	if err != nil {
		writeErr(w, http.StatusNotFound, "User not found")
		return
	}

	writeJSON(w, http.StatusOK, user)
}