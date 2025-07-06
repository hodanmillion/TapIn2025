package middleware

import (
    "net/http"
    "sync"
    "time"

    "github.com/gin-gonic/gin"
    "golang.org/x/time/rate"
)

type visitor struct {
    limiter  *rate.Limiter
    lastSeen time.Time
}

var (
    visitors = make(map[string]*visitor)
    mu       sync.RWMutex
)

func RateLimit(ratePerMinute int) gin.HandlerFunc {
    go cleanupVisitors()

    return func(c *gin.Context) {
        ip := c.ClientIP()
        
        mu.Lock()
        v, exists := visitors[ip]
        if !exists {
            limiter := rate.NewLimiter(rate.Limit(ratePerMinute)/60, ratePerMinute)
            visitors[ip] = &visitor{limiter, time.Now()}
            v = visitors[ip]
        }
        v.lastSeen = time.Now()
        mu.Unlock()

        if !v.limiter.Allow() {
            c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
            c.Abort()
            return
        }

        c.Next()
    }
}

func cleanupVisitors() {
    for {
        time.Sleep(time.Minute)
        
        mu.Lock()
        for ip, v := range visitors {
            if time.Since(v.lastSeen) > 3*time.Minute {
                delete(visitors, ip)
            }
        }
        mu.Unlock()
    }
}