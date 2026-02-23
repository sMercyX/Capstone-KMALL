package websocket

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to the
// clients.
type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Inbound messages from the clients.
	broadcast chan []byte

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// Room management: roomID -> map[client]bool
	rooms map[string]map[*Client]bool
	mu    sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if _, ok := h.rooms[client.roomID]; !ok {
				h.rooms[client.roomID] = make(map[*Client]bool)
			}
			h.rooms[client.roomID][client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)

				if room, ok := h.rooms[client.roomID]; ok {
					delete(room, client)
					if len(room) == 0 {
						delete(h.rooms, client.roomID)
					}
				}
			}
			h.mu.Unlock()

		// Case for global broadcast (not used much here but good to have)
		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToRoom sends a message to all clients in a specific room
func (h *Hub) BroadcastToRoom(roomID string, message interface{}) {
	bytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WS] Error marshaling websocket message: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.rooms[roomID]; ok {
		log.Printf("[WS] Broadcasting to room %s: %d clients", roomID, len(clients))
		for client := range clients {
			select {
			case client.send <- bytes:
			default:
				// If client buffer is full, we assume it's dead/stuck and will be cleaned up
				log.Printf("[WS] Client buffer full, skipping")
			}
		}
	} else {
		log.Printf("[WS] No clients found in room %s", roomID)
	}
}

func (h *Hub) IsUserInRoom(roomID string, userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients, ok := h.rooms[roomID]
	if !ok {
		return false
	}
	for client := range clients {
		if strings.EqualFold(client.userID, userID) {
			return true
		}
	}
	return false
}

func (h *Hub) LogRoomUsers(roomID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients, ok := h.rooms[roomID]
	if !ok {
		log.Printf("[HUB] room %s: empty", roomID)
		return
	}
	for client := range clients {
		log.Printf("[HUB] room %s: userID=%s", roomID, client.userID)
	}
}
