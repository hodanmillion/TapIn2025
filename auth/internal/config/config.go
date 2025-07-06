package config

import (
    "time"
    "github.com/spf13/viper"
)

type Config struct {
    Port           int
    Environment    string
    DatabaseURL    string
    RedisURL       string
    JWTSecret      string
    JWTExpiry      time.Duration
    RefreshExpiry  time.Duration
    AllowedOrigins []string
    RateLimit      int
    EmailFrom      string
    SMTPHost       string
    SMTPPort       int
    SMTPUser       string
    SMTPPass       string
}

func Load() (*Config, error) {
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath(".")
    viper.AddConfigPath("./config")

    viper.AutomaticEnv()

    // Set defaults
    viper.SetDefault("port", 8080)
    viper.SetDefault("environment", "development")
    viper.SetDefault("jwt_expiry", "15m")
    viper.SetDefault("refresh_expiry", "168h") // 7 days
    viper.SetDefault("rate_limit", 60)

    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
            return nil, err
        }
    }

    jwtExpiry, err := time.ParseDuration(viper.GetString("jwt_expiry"))
    if err != nil {
        jwtExpiry = 15 * time.Minute
    }

    refreshExpiry, err := time.ParseDuration(viper.GetString("refresh_expiry"))
    if err != nil {
        refreshExpiry = 168 * time.Hour
    }

    return &Config{
        Port:           viper.GetInt("port"),
        Environment:    viper.GetString("environment"),
        DatabaseURL:    viper.GetString("database_url"),
        RedisURL:       viper.GetString("redis_url"),
        JWTSecret:      viper.GetString("jwt_secret"),
        JWTExpiry:      jwtExpiry,
        RefreshExpiry:  refreshExpiry,
        AllowedOrigins: viper.GetStringSlice("allowed_origins"),
        RateLimit:      viper.GetInt("rate_limit"),
        EmailFrom:      viper.GetString("email_from"),
        SMTPHost:       viper.GetString("smtp_host"),
        SMTPPort:       viper.GetInt("smtp_port"),
        SMTPUser:       viper.GetString("smtp_user"),
        SMTPPass:       viper.GetString("smtp_pass"),
    }, nil
}