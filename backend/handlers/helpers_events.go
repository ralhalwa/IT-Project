package handlers

import (
	"backend/pkg/db/sqlite"
)

func groupTitleByID(groupID string) (string, error) {
	var title string
	err := sqlite.DB.QueryRow(`SELECT title FROM groups WHERE id = ?`, groupID).Scan(&title)
	return title, err
}

func groupMemberIDs(groupID string) ([]string, error) {
	rows, err := sqlite.DB.Query(`SELECT user_id FROM group_members WHERE group_id = ?`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func publicUserFields(userID string) (firstName, lastName, nickname, avatar string) {
	_ = sqlite.DB.QueryRow(`
		SELECT first_name, last_name, nickname, avatar
		FROM users WHERE id = ?
	`, userID).Scan(&firstName, &lastName, &nickname, &avatar)
	return
}
