package database

import (
    "context"
    "embed"
    "fmt"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/jackc/pgx/v5/stdlib"
    "github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

type DB struct {
    pool *pgxpool.Pool
}

func New(databaseURL string) (*DB, error) {
    config, err := pgxpool.ParseConfig(databaseURL)
    if err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }

    config.MaxConns = 25
    config.MinConns = 5

    pool, err := pgxpool.NewWithConfig(context.Background(), config)
    if err != nil {
        return nil, fmt.Errorf("create pool: %w", err)
    }

    // Test connection
    if err := pool.Ping(context.Background()); err != nil {
        return nil, fmt.Errorf("ping database: %w", err)
    }

    return &DB{pool: pool}, nil
}

func (db *DB) Close() {
    db.pool.Close()
}

func (db *DB) Pool() *pgxpool.Pool {
    return db.pool
}

func (db *DB) Migrate() error {
    goose.SetBaseFS(embedMigrations)

    sqlDB := stdlib.OpenDBFromPool(db.pool)
    defer sqlDB.Close()

    if err := goose.SetDialect("postgres"); err != nil {
        return fmt.Errorf("set dialect: %w", err)
    }

    if err := goose.Up(sqlDB, "migrations"); err != nil {
        return fmt.Errorf("run migrations: %w", err)
    }

    return nil
}