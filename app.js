
const GRID_SIZE = 50;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;

const colorPicker = document.getElementById("colorPicker");
const hexInput = document.getElementById("hexInput");
const redInput = document.getElementById("redInput");
const greenInput = document.getElementById("greenInput");
const blueInput = document.getElementById("blueInput");

const selectedDot = document.getElementById("selectedDot");
const selectedHex = document.getElementById("selectedHex");
const grid = document.getElementById("pixelGrid");
const paintButton = document.getElementById("paintButton");

const selectionInfo = document.getElementById("selectionInfo");
const message = document.getElementById("message");
const dailyNote = document.getElementById("dailyNote");

let selectedPixel = null;
let canPaint = true;
let pixels = new Map();
let isPainting = false;

function getStudentId() {
  let id = localStorage.getItem("pixelclasse_student");

  if (!id) {
    id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
      .replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 3 | 8);
        return v.toString(16);
      });

    localStorage.setItem("pixelclasse_student", id);
  }

  return id;
}

const studentId = getStudentId();

// Messaggi
function showMessage(text, type = "") {
  message.textContent = text;
  message.className = "message " + type;
}

// Conversione colori
function clamp(value) {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b]
    .map(v => clamp(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");

  return {
    r: parseInt(value.substring(0, 2), 16),
    g: parseInt(value.substring(2, 4), 16),
    b: parseInt(value.substring(4, 6), 16)
  };
}

// Aggiorna il color picker
function updateColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;

  hex = hex.toUpperCase();

  const rgb = hexToRgb(hex);

  colorPicker.value = hex;
  hexInput.value = hex;

  redInput.value = rgb.r;
  greenInput.value = rgb.g;
  blueInput.value = rgb.b;

  selectedDot.style.background = hex;
  selectedHex.textContent = hex;
}

// Color picker nativo
colorPicker.addEventListener("input", () => {
  updateColor(colorPicker.value);
});

// Campo HEX
hexInput.addEventListener("input", () => {
  if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) {
    updateColor(hexInput.value);
  }
});

// Campi RGB
function updateFromRGB() {
  updateColor(rgbToHex(
    redInput.value,
    greenInput.value,
    blueInput.value
  ));
}

[redInput, greenInput, blueInput].forEach(input => {
  input.addEventListener("input", updateFromRGB);
});

// Crea la griglia
function createGrid() {
  const fragment = document.createDocumentFragment();

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement("button");

      cell.className = "pixel";
      cell.type = "button";

      cell.dataset.x = x;
      cell.dataset.y = y;

      cell.setAttribute(
        "aria-label",
        `Pixel ${x + 1}, ${y + 1}`
      );

      cell.addEventListener("click", () => {
        selectPixel(x, y);
      });

      fragment.appendChild(cell);
    }
  }

  grid.replaceChildren(fragment);
}

// Seleziona QUALSIASI pixel, anche già colorato
function selectPixel(x, y) {
  if (!canPaint || isPainting) return;

  selectedPixel = { x, y };

  document.querySelectorAll(".pixel.selected")
    .forEach(el => el.classList.remove("selected"));

  const cell = grid.children[y * GRID_SIZE + x];

  cell.classList.add("selected");

  const key = `${x},${y}`;
  const existingColor = pixels.get(key);

  if (existingColor) {
    selectionInfo.textContent =
      `Pixel ${x + 1}, ${y + 1} · Colore attuale: ${existingColor}`;

    paintButton.textContent = "Sovrascrivi questo pixel";
  } else {
    selectionInfo.textContent =
      `Pixel ${x + 1}, ${y + 1} · Attualmente bianco`;

    paintButton.textContent = "Colora questo pixel";
  }

  paintButton.disabled = false;

  showMessage("");
}

// Aggiorna la griglia con i dati del server
function renderPixels(newPixels) {
  const newMap = new Map();

  for (const pixel of newPixels) {
    newMap.set(
      `${pixel.x},${pixel.y}`,
      pixel.color
    );
  }

  for (const [key, color] of newMap) {
    const [x, y] = key.split(",").map(Number);

    const cell = grid.children[y * GRID_SIZE + x];

    if (cell && pixels.get(key) !== color) {
      cell.style.backgroundColor = color;
      cell.classList.add("taken");

      // I pixel colorati rimangono selezionabili
      cell.disabled = false;
    }
  }

  pixels = newMap;

  document.getElementById("coloredCount").textContent =
    pixels.size;

  document.getElementById("remainingCount").textContent =
    TOTAL_PIXELS - pixels.size;
}

// Scarica lo stato aggiornato
async function refreshState() {
  try {
    const response = await fetch(
      `/api/state?studentId=${encodeURIComponent(studentId)}`
    );

    if (!response.ok) {
      throw new Error("Impossibile caricare la griglia");
    }

    const data = await response.json();

    renderPixels(data.pixels);

    canPaint = data.canPaint;

    if (!canPaint) {
      selectedPixel = null;

      document.querySelectorAll(".pixel.selected")
        .forEach(el => el.classList.remove("selected"));

      paintButton.disabled = true;
      paintButton.textContent = "Hai già modificato oggi";

      selectionInfo.textContent =
        "Hai già utilizzato il tuo pixel giornaliero.";

      dailyNote.textContent =
        "Potrai modificare un altro pixel domani!";

    } else if (!isPainting) {
      dailyNote.textContent =
        "Hai ancora una modifica disponibile oggi.";
    }

  } catch (error) {
    console.error(error);

    showMessage(
      "Connessione al server non disponibile.",
      "error"
    );
  }
}

// Salva il pixel
paintButton.addEventListener("click", async () => {
  if (!selectedPixel || !canPaint || isPainting) return;

  isPainting = true;

  paintButton.disabled = true;
  paintButton.textContent = "Salvataggio...";

  const color = colorPicker.value;

  try {
    const response = await fetch("/api/paint", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        studentId,
        x: selectedPixel.x,
        y: selectedPixel.y,
        color
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Errore");
    }

    showMessage(
      "Pixel salvato correttamente!",
      "success"
    );

    selectedPixel = null;

    await refreshState();

    selectionInfo.textContent =
      "Il tuo pixel è stato aggiornato!";

  } catch (error) {
    showMessage(error.message, "error");

    await refreshState();

  } finally {
    isPainting = false;

    if (canPaint && selectedPixel) {
      paintButton.disabled = false;
      paintButton.textContent = pixels.has(
        `${selectedPixel.x},${selectedPixel.y}`
      )
        ? "Sovrascrivi questo pixel"
        : "Colora questo pixel";
    }
  }
});

// Avvio
createGrid();

updateColor("#3980F6");

refreshState();

// Sincronizzazione ogni 5 secondi
setInterval(refreshState, 5000);
