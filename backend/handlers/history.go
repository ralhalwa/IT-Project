package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type historyRow struct {
	ID   string `json:"id"`
	From string `json:"from"`
	To   string `json:"to"`
	Text string `json:"text"`
	TS   string `json:"ts"`
}

func HistoryHandler(db *sql.DB, auth func(*http.Request) (string, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me, err := auth(r)
		if err != nil || me == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		peer := r.URL.Query().Get("peer_id")
		if peer == "" {
			http.Error(w, "peer_id required", http.StatusBadRequest)
			return
		}
		if peer == me {
			// disallow self-history. 
			http.Error(w, "cannot load self history", http.StatusBadRequest)
			return
		}

		//  Enforce DM policy BEFORE querying messages.
		// allowed, err := canDM(me, peer) // allows if either direction follow exists
		// if err != nil {
		// 	http.Error(w, "relationship check failed", http.StatusInternalServerError)
		// 	return
		// }
		// if !allowed {
		// 	http.Error(w, "dm locked by relationship policy", http.StatusForbidden)
		// 	return
		// }

		rows, err := db.Query(`
			SELECT id, sender_id, receiver_id, content, sent_at
			FROM messages
			WHERE (sender_id = ? AND receiver_id = ?)
			   OR (sender_id = ? AND receiver_id = ?)
			ORDER BY sent_at ASC
			LIMIT 200
		`, me, peer, peer, me)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		out := make([]historyRow, 0, 64)
		for rows.Next() {
			var (
				id             int64
				from, to, text string
				ts             time.Time
			)
			if err := rows.Scan(&id, &from, &to, &text, &ts); err != nil {
				// If a single row fails to scan, bail safely.
				http.Error(w, "decode error", http.StatusInternalServerError)
				return
			}
			out = append(out, historyRow{
				ID:   fmt.Sprint(id),
				From: from,
				To:   to,
				Text: text,
				TS:   ts.Format(time.RFC3339),
			})
		}

		// rows.Err() check in case of driver-level errors while iterating.
		if err := rows.Err(); err != nil {
			http.Error(w, "rows error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out) 
	}
}
