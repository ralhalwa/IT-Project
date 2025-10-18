package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"backend/pkg/db/sqlite"
)

// create an event in a group
func CreateEvent(w http.ResponseWriter, r *http.Request) {
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
		writeErr(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	groupID := r.FormValue("group_id")
	title := r.FormValue("event_title")
	description := r.FormValue("event_description")
	dayAndTime := r.FormValue("event_day_and_time")
	userTimezone := r.FormValue("timezone")
	loc, err := time.LoadLocation(userTimezone)
	if err != nil {
		loc = time.Local // Fallback
	}

	if groupID == "" || title == "" || description == "" || dayAndTime == "" {
		writeErr(w, http.StatusBadRequest, "group id, title, description, day and time are required")
		return
	}

	// must be a member
	isMember, err := isGroupMember(userID, groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}
	if !isMember {
		writeErr(w, http.StatusForbidden, "You must be a member of the group to create a group event")
		return
	}

	// Parse the datetime string from the form (in local time)
	localTime, err := time.ParseInLocation("2006-01-02T15:04", dayAndTime, loc)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "Invalid datetime format")
		return
	}

	// Convert local time to UTC for storage
	utcTime := localTime.UTC()

	// create event
	res, err := sqlite.DB.Exec(`
		INSERT INTO events (group_id, title, description, datetime, created_by)
		VALUES (?, ?, ?, ?, ?)
	`, groupID, title, description, utcTime.Format("2006-01-02 15:04:05"), userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to create event")
		return
	}

	eventID, _ := res.LastInsertId()
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		writeErr(w, http.StatusInternalServerError, "No rows affected - event not created")
		return
	}

	// group title
	var groupTitle string
	_ = sqlite.DB.QueryRow(`SELECT title FROM groups WHERE id = ?`, groupID).Scan(&groupTitle)

	// creator public fields
	var fn, ln, nn, av string
	_ = sqlite.DB.QueryRow(`
		SELECT first_name, last_name, nickname, avatar
		FROM users WHERE id = ?
	`, userID).Scan(&fn, &ln, &nn, &av)

	content := map[string]any{
		"eventId":     eventID,
		"groupId":     groupID,
		"groupTitle":  groupTitle,
		"title":       title,
		"description": description,
		"datetime":    dayAndTime,
		"createdBy":   userID,
		"firstName":   fn,
		"lastName":    ln,
		"nickname":    nn,
		"avatar":      av,
	}

	rows, err := sqlite.DB.Query(`SELECT user_id FROM group_members WHERE group_id = ?`, groupID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var uid string
			if err := rows.Scan(&uid); err != nil {
				continue
			}
			if uid == userID {
				continue
			}

			PushToUser(uid, map[string]any{
				"type": "notification.created",
				"data": map[string]any{
					"type":    "group_event_created",
					"content": content,
				},
			})

			_, _ = insertNotification(sqlite.DB, uid, "group_event_created", content)
			if uc, err := unreadCount(sqlite.DB, uid); err == nil {
				PushToUser(uid, map[string]any{
					"type": "badge.unread",
					"data": map[string]any{"count": uc},
				})
			}
		}
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"message": "Event created successfully",
	})
}

// make a vote to an event
func VoteToEvent(w http.ResponseWriter, r *http.Request) {
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
		writeErr(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	groupID := r.FormValue("group_id")
	response := r.FormValue("response")
	eventID := r.FormValue("event_id")

	if groupID == "" || eventID == "" || (response != "I'll be there" && response != "Can't make it" && response != "Might be late") {
		writeErr(w, http.StatusBadRequest, "Group ID and valid response are required")
		return
	}

	// check user is member of this group
	isMember, err := isGroupMember(userID, groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	if !isMember {
		writeErr(w, http.StatusForbidden, "You must be a member of the group to vote to a group event")
		return
	}

	// check there isn't an existing record of this user voting!
	var existingResponse string
	err = sqlite.DB.QueryRow(`
		SELECT response FROM event_responsess 
		WHERE user_id = ? AND event_id = ?
	`, userID, eventID).Scan(&existingResponse)

	//if user has already voted, update their vote
	if err == nil {
		result, err := sqlite.DB.Exec(`
		UPDATE event_responsess
		SET response = ?
		WHERE user_id = ? AND event_id = ?
		`, response, userID, eventID)

		if err != nil {
			fmt.Println("Error updating vote:", err)
			writeErr(w, http.StatusInternalServerError, "Failed to update vote")
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeErr(w, http.StatusInternalServerError, "Vote not updated")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": fmt.Sprintf("you successfully updated your vote to: %s", response),
		})
		return
	} else if err != sql.ErrNoRows {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	// insert response to db, if no existing vote
	result, err := sqlite.DB.Exec(`
		INSERT INTO event_responsess (event_id, user_id, response) VALUES (?,?,?)
	`, eventID, userID, response)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to vote to event")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeErr(w, http.StatusInternalServerError, "Vote not recorded")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": fmt.Sprintf("you successfully voted: %s", response),
	})
}

// get all events associated with a group
func GetEventsForGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeErr(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromRequest(r)
	if err != nil || userID == "" {
		writeErr(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	groupID := r.URL.Query().Get("group_id")

	// check user is member of this group
	isMember, err := isGroupMember(userID, groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Database error")
		return
	}

	if !isMember {
		writeErr(w, http.StatusForbidden, "You must be a member of the group to see group events")
		return
	}

	// get events for this group
	type Event struct {
		ID               int     `json:"id"`
		Title            string  `json:"title"`
		Description      string  `json:"description"`
		Datetime         string  `json:"datetime"`
		CreatedBy        string  `json:"created_by"`
		CreatorName      *string `json:"creator_name"`
		GoingCount       int     `json:"going_count"`
		NotGoingCount    int     `json:"not_going_count"`
		MightBeLateCount int     `json:"might_be_late_count"`
		UserResponse     *string `json:"user_response"`
	}

	timezone := r.URL.Query().Get("timezone")
	if timezone == "" {
		// Default to UTC if no timezone provided
		timezone = "UTC"
	}

	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC // Fallback to UTC
	}

	query := `
        SELECT 
            e.id, 
            e.title, 
            e.description, 
            e.datetime, 
            e.created_by,
            u.first_name || ' ' || u.last_name as creator_name,
            SUM(CASE WHEN er.response = 'I''ll be there' THEN 1 ELSE 0 END) as going_count,
            SUM(CASE WHEN er.response = 'Can''t make it' THEN 1 ELSE 0 END) as not_going_count,
            SUM(CASE WHEN er.response = 'Might be late' THEN 1 ELSE 0 END) as might_be_late_count,
            (SELECT response FROM event_responsess WHERE event_id = e.id AND user_id = ?) as user_response
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN event_responsess er ON e.id = er.event_id
        WHERE e.group_id = ?
        GROUP BY e.id
        ORDER BY e.datetime ASC;
    `

	rows, err := sqlite.DB.Query(query, userID, groupID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "Failed to fetch events")
		return
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var event Event
		var creatorName sql.NullString
		var userResponse sql.NullString
		var dbTime time.Time

		err := rows.Scan(&event.ID, &event.Title, &event.Description, &dbTime, &event.CreatedBy, &creatorName, &event.GoingCount, &event.NotGoingCount, &event.MightBeLateCount, &userResponse)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "Failed to parse event data")
			return
		}

		// Convert UTC time from db to user's local time
		localTime := dbTime.In(loc)
		event.Datetime = localTime.Format("2006-01-02 15:04")

		if creatorName.Valid {
			event.CreatorName = &creatorName.String
		}
		if userResponse.Valid {
			event.UserResponse = &userResponse.String
		}

		events = append(events, event)
	}

	if err = rows.Err(); err != nil {
		writeErr(w, http.StatusInternalServerError, "Error reading events")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"events": events,
	})
}
