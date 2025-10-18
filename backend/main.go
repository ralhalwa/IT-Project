package main

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	Handlers "backend/handlers"
	"backend/pkg/db/sqlite"
)

func main() {
	// DB
	sqlite.InitDB()

	// WS
	hub := Handlers.NewHub()
	wsServer := &Handlers.Server{
		Hub:               hub,
		DB:                sqlite.DB,
		UserIDFromRequest: Handlers.GetUserIDFromRequest,
	}
	Handlers.WS = wsServer

	// WebSocket endpoint (needs special handling for CORS)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers for WebSocket
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		wsServer.HandleWS(w, r)
	})

	// Apply CORS to all API endpoints
	http.HandleFunc("/api/messages", corsHandler(Handlers.HistoryHandler(sqlite.DB, wsServer.UserIDFromRequest)))

	http.HandleFunc("/api/me", corsHandler(Handlers.MeHandler))
	http.HandleFunc("/api/logout", corsHandler(Handlers.LogoutHandler))
	http.HandleFunc("/api/register", corsHandler(Handlers.RegisterHandler))
	http.HandleFunc("/api/login", corsHandler(Handlers.LoginHandler))

	http.HandleFunc("/api/posts", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			Handlers.CreatePostHandler(sqlite.DB)(w, r)
		case http.MethodGet:
			Handlers.GetAllPostsHandler(sqlite.DB)(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/comments", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			Handlers.CommentsHandler(sqlite.DB)(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}))

	http.HandleFunc("/api/likes", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			Handlers.LikesHandler(sqlite.DB)(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}))

	// Static file serving with CORS
	uploadsDir := filepath.Join(".", "uploads")
	fs := http.FileServer(http.Dir(uploadsDir))
	http.Handle("/uploads/", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		http.StripPrefix("/uploads/", fs).ServeHTTP(w, r)
	}))

	http.HandleFunc("/api/users/toggle-privacy", corsHandler(Handlers.ToggleProfilePrivacyHandler))
	http.HandleFunc("/api/users", corsHandler(Handlers.GetAllUsersHandler(sqlite.DB)))
	http.HandleFunc("/api/users/follow", corsHandler(Handlers.FollowUser))
	http.HandleFunc("/api/users/unfollow", corsHandler(Handlers.UnFollowAUser))
	http.HandleFunc("/api/users/follow-status", corsHandler(Handlers.GetFollowStatus))
	http.HandleFunc("/api/users/pending-requests", corsHandler(Handlers.GetPendingFollowRequests))
	http.HandleFunc("/api/users/respond-follow-request", corsHandler(Handlers.RespondToFollowRequest))
	http.HandleFunc("/api/relationships", corsHandler(Handlers.GetRelationships))
	http.HandleFunc("/api/relationshipsForPost", corsHandler(Handlers.GetRelationshipsForPost))
	
	http.HandleFunc("/api/users/", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/posts"):
			Handlers.GetUserPostsHandler(w, r)
		case strings.HasSuffix(r.URL.Path, "/followers"):
			Handlers.GetUserFollowers(w, r)
		case strings.HasSuffix(r.URL.Path, "/followings"):
			Handlers.GetUserFollowing(w, r)
		case strings.HasSuffix(r.URL.Path, "/follow-counts"):
			Handlers.GetUserFollowCounts(w, r)
		case strings.HasSuffix(r.URL.Path, "/privacy-status"):
			Handlers.GetUserPrivacyStatus(w, r)
		case strings.HasSuffix(r.URL.Path, "/user"):
			Handlers.GetUser(w, r)
		case r.Method == http.MethodGet &&
			!strings.HasSuffix(r.URL.Path, "/posts") &&
			!strings.HasSuffix(r.URL.Path, "/privacy-status"):
			Handlers.GetUserProfileHandler(w, r)
		default:
			http.NotFound(w, r)
		}
	}))

	http.HandleFunc("/api/group/groups", corsHandler(Handlers.GetAllGroups))
	http.HandleFunc("/api/group/initial-invite", corsHandler(Handlers.GetUsersForInitialInvite))
	http.HandleFunc("/api/group/create-group", corsHandler(Handlers.CreateGroup))
	http.HandleFunc("/api/group/panelItems", corsHandler(Handlers.GetUserPanelItems))
	http.HandleFunc("/api/group/respond-group-invite", corsHandler(Handlers.RespondToInvite))
	http.HandleFunc("/api/group/leave-group", corsHandler(Handlers.LeaveGroup))
	http.HandleFunc("/api/group/delete-group", corsHandler(Handlers.DeleteGroup))
	http.HandleFunc("/api/group/invite-users-list", corsHandler(Handlers.GetUsersForGroupInvite))
	http.HandleFunc("/api/group/invite-users", corsHandler(Handlers.InviteUsersToGroup))
	http.HandleFunc("/api/group/request-to-join", corsHandler(Handlers.RequestToJoinGroup))
	http.HandleFunc("/api/group/respond-group-request", corsHandler(Handlers.RespondToUserRequestToGroup))
	http.HandleFunc("/api/group/check-join-status", corsHandler(Handlers.CheckUserJoinStatus))
	http.HandleFunc("/api/group/messages", corsHandler(Handlers.GetGroupMessages))
	http.HandleFunc("/api/group/members", corsHandler(Handlers.GetGroupMembers))

	http.HandleFunc("/api/group/events", corsHandler(Handlers.GetEventsForGroup))
	http.HandleFunc("/api/group/create-event", corsHandler(Handlers.CreateEvent))
	http.HandleFunc("/api/group/event-vote", corsHandler(Handlers.VoteToEvent))

	http.HandleFunc("/api/group/posts", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			Handlers.ListGroupPostsHandler(sqlite.DB)(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}))
	
	http.HandleFunc("/api/group/posts/create", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			Handlers.CreateGroupPostHandler(sqlite.DB)(w, r)
			return
		}
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}))

	http.HandleFunc("/api/group/post/comments", corsHandler(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			Handlers.ListPostCommentsHandler(sqlite.DB)(w, r)
		case http.MethodPost:
			Handlers.CreatePostCommentHandler(sqlite.DB)(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	}))
http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    _, _ = w.Write([]byte("ok"))
})
	fmt.Println("Starting backend server on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// CORS middleware
func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Content-Length, Accept-Language, Accept-Encoding, Connection, Access-Control-Allow-Origin, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		
		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		// Call the next handler
		next(w, r)
	}
}

func corsHandler(handler http.HandlerFunc) http.HandlerFunc {
	return enableCORS(handler)
}
