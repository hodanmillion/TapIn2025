package redis

import (
    "context"
    "time"

    "github.com/redis/go-redis/v9"
)

type Client struct {
    client *redis.Client
}

func New(redisURL string) *Client {
    opt, err := redis.ParseURL(redisURL)
    if err != nil {
        panic(err)
    }

    client := redis.NewClient(opt)
    
    // Test connection
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := client.Ping(ctx).Err(); err != nil {
        panic(err)
    }

    return &Client{client: client}
}

func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
    return c.client.Set(ctx, key, value, expiration).Err()
}

func (c *Client) Get(ctx context.Context, key string) (string, error) {
    return c.client.Get(ctx, key).Result()
}

func (c *Client) Delete(ctx context.Context, keys ...string) error {
    return c.client.Del(ctx, keys...).Err()
}

func (c *Client) Exists(ctx context.Context, key string) (bool, error) {
    n, err := c.client.Exists(ctx, key).Result()
    return n > 0, err
}

func (c *Client) Close() error {
    return c.client.Close()
}