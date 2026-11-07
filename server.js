const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const GRID_SIZE = 50;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(p => [p.type, p.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function validStudentId(id) {
  return typeof id === "string" &&
    /^[a-f0-9-]{36}$/i.test(id);
}

function validColor(color) {
  return typeof color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(color);
}

// Restituisce lo stato della griglia
app.get("/api/state", (req, res) => {
  const studentId = req.query.studentId;

  if (!validStudentId(studentId)) {
    return res.status(400).json({
      error: "Identificativo non valido"
    });
  }

  const pixels = db.prepare(`
    SELECT x, y, color
    FROM pixels
  `).all();

  const used = db.prepare(`
    SELECT 1 FROM daily_claims
    WHERE student_id = ? AND day = ?
  `).get(studentId, today());

  res.json({
    size: GRID_SIZE,
    pixels,
    canPaint: !used,
    today: today()
  });
});

// Query database
const insertPixel = db.prepare(`
  INSERT INTO pixels (x, y, color, created_at)
  VALUES (?, ?, ?, ?)
`);

const updatePixel = db.prepare(`
  UPDATE pixels
  SET color = ?, created_at = ?
  WHERE id = ?
`);

const insertClaim = db.prepare(`
  INSERT INTO daily_claims (student_id, day, pixel_id)
  VALUES (?, ?, ?)
`);

const getClaim = db.prepare(`
  SELECT 1 FROM daily_claims
  WHERE student_id = ? AND day = ?
`);

const getPixel = db.prepare(`
  SELECT id FROM pixels
  WHERE x = ? AND y = ?
`);

// Operazione atomica: crea oppure sovrascrive
const paintTransaction = db.transaction(
  (studentId, x, y, color) => {
    const day = today();

    // Controlla il limite giornaliero
    if (getClaim.get(studentId, day)) {
      throw new Error("DAILY_LIMIT");
    }

    const existing = getPixel.get(x, y);

    let pixelId;

    if (existing) {
      // Il pixel esiste: cambia colore
      updatePixel.run(
        color.toUpperCase(),
        new Date().toISOString(),
        existing.id
      );

      pixelId = existing.id;

    } else {
      // Il pixel non esiste: crealo
      const result = insertPixel.run(
        x,
        y,
        color.toUpperCase(),
        new Date().toISOString()
      );

      pixelId = result.lastInsertRowid;
    }

    // Registra l'utilizzo giornaliero
    insertClaim.run(studentId, day, pixelId);

    return pixelId;
  }
);

// Endpoint per colorare o modificare un pixel
app.post("/api/paint", (req, res) => {
  const { studentId, x, y, color } = req.body || {};

  if (
    !validStudentId(studentId) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 || x >= GRID_SIZE ||
    y < 0 || y >= GRID_SIZE ||
    !validColor(color)
  ) {
    return res.status(400).json({
      error: "Dati non validi"
    });
  }

  try {
    paintTransaction(studentId, x, y, color);

    res.json({
      success: true,
      message: "Pixel aggiornato correttamente!"
    });

  } catch (error) {
    if (error.message === "DAILY_LIMIT") {
      return res.status(409).json({
        error: "Hai già modificato un pixel oggi!"
      });
    }

    console.error(error);

    res.status(500).json({
      error: "Errore durante il salvataggio"
    });
  }
});

// Controllo server
app.get("/api/health", (req, res) => {
  res.json({ online: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PixelClasse attivo sulla porta ${PORT}`);
});