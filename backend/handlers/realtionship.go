package handlers

import (
	"backend/pkg/db/sqlite"
	"net/http"
)

func GetRelationships(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
        return
    }

    me, err := GetUserIDFromRequest(r)
    if err != nil || me == "" {
        writeErr(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    rows, err := sqlite.DB.Query(`
        SELECT following_id AS uid, 1 AS iFollow, 0 AS followsMe
        FROM followers
        WHERE follower_id = ? AND status = 'accepted'
        UNION ALL
        SELECT follower_id AS uid, 0 AS iFollow, 1 AS followsMe
        FROM followers
        WHERE following_id = ? AND status = 'accepted'
    `, me, me)
    if err != nil {
        writeErr(w, http.StatusInternalServerError, "Database error")
        return
    }
    defer rows.Close()

    rels := map[string]map[string]bool{}
    for rows.Next() {
        var uid string
        var iFollow, followsMe int
        rows.Scan(&uid, &iFollow, &followsMe)
        if _, ok := rels[uid]; !ok {
            rels[uid] = map[string]bool{"iFollow": false, "followsMe": false}
        }
        if iFollow == 1 {
            rels[uid]["iFollow"] = true
        }
        if followsMe == 1 {
            rels[uid]["followsMe"] = true
        }
    }

    writeJSON(w, http.StatusOK, map[string]any{
        "ok":            true,
        "relationships": rels,
    })
}
func GetRelationshipsForPost(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
        return
    }

    me, err := GetUserIDFromRequest(r)
    if err != nil || me == "" {
        writeErr(w, http.StatusUnauthorized, "Unauthorized")
        return
    }

    // Only get followers (users who follow 'me')
    rows, err := sqlite.DB.Query(`
        SELECT follower_id AS uid, 0 AS iFollow, 1 AS followsMe
        FROM followers
        WHERE following_id = ? AND status = 'accepted'
    `, me)
    if err != nil {
        writeErr(w, http.StatusInternalServerError, "Database error")
        return
    }
    defer rows.Close()

    rels := map[string]map[string]bool{}
    for rows.Next() {
        var uid string
        var iFollow, followsMe int
        rows.Scan(&uid, &iFollow, &followsMe)
        rels[uid] = map[string]bool{
            "iFollow": false,
            "followsMe": followsMe == 1,
        }
    }

    writeJSON(w, http.StatusOK, map[string]any{
        "ok":            true,
        "relationshipsForPost": rels,
    })
}