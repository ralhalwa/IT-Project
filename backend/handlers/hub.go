package handlers

import "sync"

type Client interface {
	SendJSON(v any) error 
	Close() error
	UserID() string
}
type Hub struct{
	mu sync.RWMutex
	clients  map[string]map[Client]struct{} 
}
func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]map[Client]struct{}),
	}
}
func (h *Hub) isOnline(userID string)bool{
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID]) > 0
}
func (h *Hub) OnlineUsers() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]string, 0, len(h.clients))
	for uid, set := range h.clients {
		if len(set) > 0 {
			out = append(out, uid)
		}
	}
	return out
}
func (h *Hub) broadcastPresence(userID string, online bool) {
    
    h.mu.RLock()
    var conns []Client
    for _, set := range h.clients {
        for c := range set {
            conns = append(conns, c)
        }
    }
    h.mu.RUnlock()

    payload := map[string]any{
        "type": "presence",
        "data": map[string]any{"userId": userID, "online": online},
    }

    for _, c := range conns {
        _ = c.SendJSON(payload)
    }
}

func (h *Hub) Add(c Client) {
	h.mu.Lock()
	uid := c.UserID()
	if h.clients[uid] == nil {
		h.clients[uid] = make(map[Client]struct{})
	}
	first := len(h.clients[uid]) == 0 // first connection for this user?
	h.clients[uid][c] = struct{}{}
	h.mu.Unlock()

	if first {
		h.broadcastPresence(uid, true)
	}
}

func (h *Hub) Remove(c Client) {
	h.mu.Lock()
	uid := c.UserID()
	last := false
	if set, ok := h.clients[uid]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.clients, uid)
			last = true 
		}
	}
	h.mu.Unlock()

	if last {
		h.broadcastPresence(uid, false)
	}
}
func (h *Hub) SendToUser(userID string, payload any) {
	h.mu.RLock()
	set, ok := h.clients[userID]
	if !ok || len(set) == 0 {
		h.mu.RUnlock()
		return
	}
	for c := range set {
		_ = c.SendJSON(payload)
	}
	h.mu.RUnlock()

}
func (h *Hub) BroadcastAll(payload any) {
	h.mu.RLock()
	var conns []Client
	for _, set := range h.clients {
		for c := range set {
			conns = append(conns, c)
		}
	}
	h.mu.RUnlock()
	for _, c := range conns {
		_ = c.SendJSON(payload)
	}
}