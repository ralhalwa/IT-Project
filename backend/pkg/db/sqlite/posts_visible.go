package sqlite

import "database/sql"

type PostRow struct {
	ID        int64          `json:"post_id"`
	UserID    string         `json:"user_id"`
	Content   string         `json:"content"`
	Image     sql.NullString `json:"image"`
	Privacy   string         `json:"privacy"`
	CreatedAt string         `json:"created_at"`
	// add fields you already return (nickname, avatar, like_count, comment_count, is_liked, following_likes, ...)
}

func GetVisiblePostsForViewer(viewerID, profileUserID string) ([]PostRow, error) {
	const q = `
	SELECT
	  p.id, p.user_id, p.content, p.image, p.privacy, p.created_at
	  -- keep your extra joins/CTEs here for counts, avatar, nickname, is_liked, following_likes, etc.
	FROM posts p
	WHERE p.user_id = ?
	  AND (
	    p.privacy = 'public'
	    OR ? = p.user_id
	    OR (p.privacy = 'followers' AND EXISTS (
	          SELECT 1 FROM followers f
	          WHERE f.follower_id = ? AND f.following_id = p.user_id AND f.status = 'accepted'
	       ))
	    -- If you add custom visibility later:
	    -- OR (p.privacy = 'custom' AND EXISTS (SELECT 1 FROM post_visibility pv WHERE pv.post_id = p.id AND pv.user_id = ?))
	  )
	ORDER BY p.created_at DESC;
	`

	rows, err := DB.Query(q, profileUserID, viewerID, viewerID /*, viewerID*/)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []PostRow
	for rows.Next() {
		var r PostRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.Content, &r.Image, &r.Privacy, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
