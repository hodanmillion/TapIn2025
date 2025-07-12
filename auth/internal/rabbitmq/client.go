package rabbitmq

import (
    "encoding/json"
    "fmt"
    "time"

    "auth-service/internal/events"

    amqp "github.com/rabbitmq/amqp091-go"
)

type Client struct {
    conn    *amqp.Connection
    channel *amqp.Channel
}

func New(url string) (*Client, error) {
    conn, err := amqp.Dial(url)
    if err != nil {
        return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
    }

    ch, err := conn.Channel()
    if err != nil {
        conn.Close()
        return nil, fmt.Errorf("failed to open channel: %w", err)
    }

    // Declare the exchange
    err = ch.ExchangeDeclare(
        "user_events", // name
        "topic",       // type
        true,          // durable
        false,         // auto-deleted
        false,         // internal
        false,         // no-wait
        nil,           // arguments
    )
    if err != nil {
        ch.Close()
        conn.Close()
        return nil, fmt.Errorf("failed to declare exchange: %w", err)
    }

    return &Client{
        conn:    conn,
        channel: ch,
    }, nil
}

func (c *Client) PublishUserEvent(event *events.UserEvent) error {
    body, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("failed to marshal event: %w", err)
    }

    routingKey := string(event.Type)

    err = c.channel.Publish(
        "user_events", // exchange
        routingKey,    // routing key
        false,         // mandatory
        false,         // immediate
        amqp.Publishing{
            ContentType: "application/json",
            Body:        body,
            Timestamp:   time.Now(),
        },
    )
    if err != nil {
        return fmt.Errorf("failed to publish event: %w", err)
    }

    return nil
}

func (c *Client) Close() {
    if c.channel != nil {
        c.channel.Close()
    }
    if c.conn != nil {
        c.conn.Close()
    }
}