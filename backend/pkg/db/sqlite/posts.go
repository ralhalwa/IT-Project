package sqlite

import (
	"database/sql"
	"strings"
	"time"
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

func GetPostsByUser(userID string) ([]Post, error) {

	rows, err := DB.Query(`
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
WHERE p.user_id = ?
AND (
      p.privacy != 'custom'                  -- show everything except custom, no extra checks
   OR  p.user_id = ?                         -- owner always sees their own post
   OR (
        p.privacy = 'custom'                 -- for custom posts, enforce post_visibility
        AND EXISTS (
            SELECT 1 FROM post_visibility pv
            WHERE pv.post_id = p.id AND pv.user_id = ?
        )
      )
)
ORDER BY p.created_at DESC;
`, userID, // is_liked
			userID, // followed_likers (unchanged)
			userID, // owner sees own posts
			userID,
			userID) // custom visibility check (pv.user_id = me)
		if err != nil {
			
			return []Post{},err
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
				return []Post{},err
			}
			if followedLikers.Valid && followedLikers.String != "" {
				post.FollowingLikes = strings.Split(followedLikers.String, ", ")
			} else {
				post.FollowingLikes = []string{}
			}
			posts = append(posts, post)
		}

	return posts, nil
}
