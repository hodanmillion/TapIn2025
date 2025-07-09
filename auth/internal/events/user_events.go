package events

import (
    "encoding/json"
    "time"
)

type EventType string

const (
    UserLogin    EventType = "user:login"
    UserLogout   EventType = "user:logout"
    UserRegister EventType = "user:register"
    UserUpdate   EventType = "user:update"
)

type UserEvent struct {
    Type      EventType              `json:"type"`
    UserID    string                 `json:"user_id"`
    Username  string                 `json:"username"`
    Timestamp time.Time              `json:"timestamp"`
    Data      map[string]interface{} `json:"data,omitempty"`
}

func NewUserEvent(eventType EventType, userID, username string) *UserEvent {
    return &UserEvent{
        Type:      eventType,
        UserID:    userID,
        Username:  username,
        Timestamp: time.Now().UTC(),
        Data:      make(map[string]interface{}),
    }
}

func (e *UserEvent) ToJSON() (string, error) {
    data, err := json.Marshal(e)
    if err != nil {
        return "", err
    }
    return string(data), nil
}

func ParseUserEvent(data string) (*UserEvent, error) {
    var event UserEvent
    err := json.Unmarshal([]byte(data), &event)
    if err != nil {
        return nil, err
    }
    return &event, nil
}