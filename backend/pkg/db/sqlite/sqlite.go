package sqlite

import (
	"database/sql"
	"log"
	"strings"

	_ "github.com/mattn/go-sqlite3"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
    var err error

    DB, err = sql.Open("sqlite3", "./social_network.db?_journal_mode=WAL&_synchronous=NORMAL")
    if err != nil {
        log.Fatal(" Failed to connect to DB:", err)
    }

    applyPragmaSettings(DB)

    // Prepare migration driver
    driver, err := sqlite3.WithInstance(DB, &sqlite3.Config{})
    if err != nil {
        log.Fatal(" Failed to initialize SQLite migration driver:", err)
    }

    migrationsPath :="file://database/migrations/sqlite"

    m, err := migrate.NewWithDatabaseInstance(
        migrationsPath,
        "sqlite3", driver)

    if err != nil {
        log.Fatal(" Failed to load migrations:", err)
    }

    // Apply migrations
    if err := m.Up(); err != nil && err.Error() != "no change" {
        log.Fatal("Migration failed:", err)
    }

    log.Println("  SQLite connected and migrations applied")
}

func CheckEmailExists(email string) (bool, error) {
	var exists bool
	err := DB.QueryRow("SELECT COUNT(1) FROM users WHERE email = ?", strings.ToLower(email)).Scan(&exists)
	return exists, err
}

func InsertUser(email, password, first_name, last_name, dob, avatar, nickname, about_me string) error {
    userID := uuid.New().String()
	stmt, err := DB.Prepare(`
		INSERT INTO users (id, email, password_hash, first_name, last_name, dob, avatar, nickname, about_me)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}

	// profile_color and created_at will use their default values
	_, err = stmt.Exec(userID, strings.ToLower(email), password, first_name, last_name, dob, avatar, nickname, about_me)
	return err
}

func GetUserID(email string) (string, error) {
    var userID string
    err := DB.QueryRow("SELECT id FROM users WHERE email = ?", strings.ToLower(email)).Scan(&userID)
    if err != nil {
        return "", err
    }
    return userID, nil
}

func GetHashedPassword(email string) (string, error) {
    var hashedPassword string
    err := DB.QueryRow("SELECT password_hash FROM users WHERE email = ?", strings.ToLower(email)).Scan(&hashedPassword)
    if err != nil {
        return "", err
    }
    return hashedPassword, nil
}

func CheckNicknameExists(nickname string) (bool, error) {
	var exists bool
	err := DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE nickname = ?)", nickname).Scan(&exists)
	return exists, err
}

func applyPragmaSettings(db *sql.DB) {
    pragmas := []string{
        "PRAGMA journal_mode = WAL",
        "PRAGMA synchronous = NORMAL",
        "PRAGMA cache_size = -10000",     // 10MB cache
        "PRAGMA mmap_size = 268435456",   // 256MB memory mapping
        "PRAGMA temp_store = MEMORY",
        "PRAGMA foreign_keys = ON",       // Enable foreign key constraints
        "PRAGMA busy_timeout = 5000",     // 5 second timeout for busy handlers
    }

    for _, pragma := range pragmas {
        _, err := db.Exec(pragma)
        if err != nil {
            log.Printf("Warning: Failed to set %s: %v", pragma, err)
        }
    }
}