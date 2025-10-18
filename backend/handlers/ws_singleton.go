package handlers

var WS *Server

func PushToUser(userID string, payload any) {
	if WS == nil || WS.Hub == nil || userID == "" {
		return
	}
	WS.Hub.SendToUser(userID, payload)
}
