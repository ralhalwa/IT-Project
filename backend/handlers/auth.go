package handlers

import (
	db "backend/pkg/db/sqlite"
	"encoding/json"
	"fmt"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		writeErr(w, http.StatusBadRequest, "Bad Request")
		return
	}

	hashedPassword, err := db.GetHashedPassword(creds.Email)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(creds.Password)) != nil {
		writeErr(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Get UUID user ID (string)
	uidStr, err := db.GetUserID(creds.Email)
	if err != nil || uidStr == "" {
		writeErr(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Create session with string userID
	if err := setSession(w, uidStr); err != nil {
		fmt.Println("LoginHandler: setSession error:", err) // Debugging line
		writeErr(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Logged in successfully",
	})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Parse multipart form data
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB max
		writeErr(w, http.StatusBadRequest, "Error parsing form data")
		return
	}

	// Get form values
	email := r.FormValue("email")
	password := r.FormValue("password")
	firstName := strings.TrimSpace(r.FormValue("firstName"))
	lastName := strings.TrimSpace(r.FormValue("lastName"))
	dob := r.FormValue("dateOfBirth")
	nickname := strings.TrimSpace(r.FormValue("nickname"))
	aboutMe := r.FormValue("aboutMe")
	avatarPath := r.FormValue("avatar")

	if email == "" || password == "" || dob == "" || firstName == "" || lastName == ""{
		writeErr(w, http.StatusBadRequest, "Email, Password, Date of birth, First name, and Last name are required")
		return
	}

	// Parse the date of birth
	dobTime, err := time.Parse("2006-01-02", dob)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "Invalid date of birth format. Use YYYY-MM-DD")
		return
	}

	// Calculate age
	now := time.Now()
	age := now.Year() - dobTime.Year()
	
	// Adjust age if birthday hasn't occurred yet this year
	if now.YearDay() < dobTime.YearDay() {
		age--
	}

	// Check if user is at least 18 years old
	if age < 18 {
		writeErr(w, http.StatusBadRequest, "You must be at least 18 years old to register")
		return
	}

	if len(password) < 4 {
		writeErr(w, http.StatusBadRequest, "Password must be at least 4 characters")
		return
	}

	if strings.TrimSpace(password) != password {
		writeErr(w, http.StatusBadRequest, "Password cannot start or end with spaces")
		return
	}

	if strings.Contains(password, " ") {
		writeErr(w, http.StatusBadRequest, "Password cannot contain spaces")
		return
	}

	if _, err := mail.ParseAddress(email); err != nil {
		writeErr(w, http.StatusBadRequest, "Invalid email format")
		return
	}

	// Check if email already exists
	exists, err := db.CheckEmailExists(email)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}
	if exists {
		writeErr(w, http.StatusConflict, "Email already registered")
		return
	}


	nicknameExists, err := db.CheckNicknameExists(nickname)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}
	if nicknameExists && nickname!= ""{
		writeErr(w, http.StatusConflict, "Nickname already taken")
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}
	// Insert user into DB
	if err := db.InsertUser(email, string(hashedPassword), firstName, lastName, dob, avatarPath, nickname, aboutMe); err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to register user")
		return
	}

	// Fetch UUID user ID (string)
	uidStr, err := db.GetUserID(email)
	if err != nil || uidStr == "" {
		writeErr(w, http.StatusInternalServerError, "Failed to retrieve user ID")
		return
	}

	// Create session with string userID
	if err := setSession(w, uidStr); err != nil {
		fmt.Println("RegisterHandler: setSession error:", err) // Debugging line
		writeErr(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Registered successfully",
	})
}

// handlers/auth.go (or wherever your LogoutHandler lives)
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// 1) Let CORS preflight pass through
	if r.Method == http.MethodOptions {
		// gorilla/handlers will add the CORS headers; a 204 is enough
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// 2) Try to read cookie; if it's there, delete the server row
	c, err := r.Cookie(sessionCookieName) // "session_token"
	if err != nil {
		// No cookie found is not an error for logout—still expire client cookie below
	}

	if err == nil && c.Value != "" {
		if derr := db.DeleteSessionByToken(c.Value); derr != nil {
			// Log but don't fail the request; logout should be idempotent
			fmt.Printf("logout: delete session failed: %v\n", derr)
		}
	}

	// 3) Expire the cookie on the client
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false, // true in HTTPS
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Logged out",
	})
}
