package handlers
import "backend/pkg/db/sqlite"

func canDM(me, peer string) (bool, error) {                                
	if me == "" || peer == "" || me == peer {
		return false, nil
	}
	var aToB int // me → peer
	var bToA int // peer → me

	 // does me follow peer?
	    if err := sqlite.DB.QueryRow(`
        SELECT COUNT(*) FROM followers
        WHERE follower_id = ? AND following_id = ? AND status = 'accepted'
    `, me, peer).Scan(&aToB); err != nil {
        return false, err
    }
	    // does peer follow me?
	    if err := sqlite.DB.QueryRow(`
        SELECT COUNT(*) FROM followers
        WHERE follower_id = ? AND following_id = ? AND status = 'accepted'
    `, peer, me).Scan(&bToA); err != nil {
        return false, err
    }
	    switch DMPermissionPolicy {
    case "mutual":
        return aToB > 0 && bToA > 0, nil
    case "either":
        return aToB > 0 || bToA > 0, nil
    default:
        return false, nil
    }

}
