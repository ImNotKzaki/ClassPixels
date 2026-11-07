
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "pixelclasse.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS pixels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(x, y)
  );

  CREATE TABLE IF NOT EXISTS daily_claims (
    student_id TEXT NOT NULL,
    day TEXT NOT NULL,
    pixel_id INTEGER NOT NULL,
    PRIMARY KEY(student_id, day),
    FOREIGN KEY(pixel_id) REFERENCES pixels(id)
  );
`);

module.exports = db;
