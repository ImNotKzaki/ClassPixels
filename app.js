//app.js aggiornato

// Importa Firebase dai CDN ufficiali
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurazione di Firebase del tuo progetto
const firebaseConfig = {
  apiKey: "AIzaSyCrSbPtjAvSdoaOPGPR90GHhlwsOmKMCv0",
  authDomain: "classpixels-89c53.firebaseapp.com",
  projectId: "classpixels-89c53",
  storageBucket: "classpixels-89c53.firebasestorage.app",
  messagingSenderId: "412036982129",
  appId: "1:412036982129:web:0882b805520cd76a01c2d0",
  measurementId: "G-KZLS6YX1LB"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const GRID_SIZE = 50;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;

// Riferimenti agli elementi HTML
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

// Ottieni la data odierna in formato YYYY-MM-DD (fuso orario italiano)
function getTodayString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// ID univoco dello studente salvato nel browser
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

// Messaggi a schermo
function showMessage(text, type = "") {
  if (!message) return;
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

// Aggiorna il selettore colore grafico
function updateColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  hex = hex.toUpperCase();
  const rgb = hexToRgb(hex);

  if (colorPicker) colorPicker.value = hex;
  if (hexInput) hexInput.value = hex;
  if (redInput) redInput.value = rgb.r;
  if (greenInput) greenInput.value = rgb.g;
  if (blueInput) blueInput.value = rgb.b;

  if (selectedDot) selectedDot.style.background = hex;
  if (selectedHex) selectedHex.textContent = hex;
}

if (colorPicker) {
  colorPicker.addEventListener("input", () => {
    updateColor(colorPicker.value);
  });
}

if (hexInput) {
  hexInput.addEventListener("input", () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) {
      updateColor(hexInput.value);
    }
  });
}

function updateFromRGB() {
  updateColor(rgbToHex(redInput.value, greenInput.value, blueInput.value));
}

[redInput, greenInput, blueInput].forEach(input => {
  if (input) input.addEventListener("input", updateFromRGB);
});

// Crea la griglia HTML iniziale
function createGrid() {
  if (!grid) {
    console.error("Elemento #pixelGrid non trovato!");
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement("button");
      cell.className = "pixel";
      cell.type = "button";
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.setAttribute("aria-label", `Pixel ${x + 1}, ${y + 1}`);

      cell.addEventListener("click", () => {
        selectPixel(x, y);
      });

      fragment.appendChild(cell);
    }
  }
  grid.replaceChildren(fragment);
  console.log("Griglia creata con successo!");
}

// Seleziona un pixel sulla griglia
function selectPixel(x, y) {
  if (!canPaint || isPainting) return;

  selectedPixel = { x, y };

  document.querySelectorAll(".pixel.selected")
    .forEach(el => el.classList.remove("selected"));

  const cell = grid.children[y * GRID_SIZE + x];
  if (cell) cell.classList.add("selected");

  const key = `${x},${y}`;
  const existingColor = pixels.get(key);

  if (existingColor) {
    selectionInfo.textContent = `Pixel ${x + 1}, ${y + 1} · Colore attuale: ${existingColor}`;
    paintButton.textContent = "Sovrascrivi questo pixel";
  } else {
    selectionInfo.textContent = `Pixel ${x + 1}, ${y + 1} · Attualmente bianco`;
    paintButton.textContent = "Colora questo pixel";
  }

  paintButton.disabled = false;
  showMessage("");
}

// Disegna i pixel sulla griglia in base ai dati di Firebase
function renderPixels(newPixels) {
  const newMap = new Map();

  for (const pixel of newPixels) {
    newMap.set(`${pixel.x},${pixel.y}`, pixel.color);
  }

  for (const [key, color] of newMap) {
    const [x, y] = key.split(",").map(Number);
    const cell = grid.children[y * GRID_SIZE + x];

    if (cell && pixels.get(key) !== color) {
      cell.style.backgroundColor = color;
      cell.classList.add("taken");
      cell.disabled = false;
    }
  }

  pixels = newMap;

  const coloredElem = document.getElementById("coloredCount");
  const remainingElem = document.getElementById("remainingCount");

  if (coloredElem) coloredElem.textContent = pixels.size;
  if (remainingElem) remainingElem.textContent = TOTAL_PIXELS - pixels.size;
}

// Scarica lo stato aggiornato DIRETTAMENTE da Firebase Firestore
async function refreshState() {
  const today = getTodayString();

  try {
    const querySnapshot = await getDocs(collection(db, "pixels"));
    const fetchedPixels = [];
    querySnapshot.forEach((docSnap) => {
      fetchedPixels.push(docSnap.data());
    });

    renderPixels(fetchedPixels);

    const claimRef = doc(db, "claims", `${studentId}_${today}`);
    const claimSnap = await getDoc(claimRef);
    canPaint = !claimSnap.exists();

    if (!canPaint) {
      selectedPixel = null;
      document.querySelectorAll(".pixel.selected")
        .forEach(el => el.classList.remove("selected"));

      paintButton.disabled = true;
      paintButton.textContent = "Hai già modificato oggi";
      selectionInfo.textContent = "Hai già utilizzato il tuo pixel giornaliero.";
      if (dailyNote) dailyNote.textContent = "Potrai modificare un altro pixel domani!";
    } else if (!isPainting) {
      if (dailyNote) dailyNote.textContent = "Hai ancora una modifica disponibile oggi.";
    }

  } catch (error) {
    console.error("Errore di connessione a Firebase:", error);
    showMessage("Connessione al server non disponibile.", "error");
  }
}

// Salva o aggiorna il pixel su Firebase al click del bottone
if (paintButton) {
  paintButton.addEventListener("click", async () => {
    if (!selectedPixel || !canPaint || isPainting) return;

    isPainting = true;
    paintButton.disabled = true;
    paintButton.textContent = "Salvataggio...";

    const color = colorPicker.value;
    const today = getTodayString();

    try {
      const claimRef = doc(db, "claims", `${studentId}_${today}`);
      const claimSnap = await getDoc(claimRef);

      if (claimSnap.exists()) {
        throw new Error("Hai già modificato un pixel oggi!");
      }

      const pixelDocId = `pixel_${selectedPixel.x}__${selectedPixel.y}`;
      const pixelRef = doc(db, "pixels", pixelDocId);

      await setDoc(pixelRef, {
        x: selectedPixel.x,
        y: selectedPixel.y,
        color: color.toUpperCase(),
        updated_at: new Date().toISOString()
      }, { merge: true });

      await setDoc(claimRef, {
        student_id: studentId,
        day: today,
        pixel_x: selectedPixel.x,
        pixel_y: selectedPixel.y
      });

      showMessage("Pixel salvato correttamente!", "success");
      selectedPixel = null;

      await refreshState();
      selectionInfo.textContent = "Il tuo pixel è stato aggiornato!";

    } catch (error) {
      showMessage(error.message, "error");
      await refreshState();
    } finally {
      isPainting = false;
      if (canPaint && selectedPixel) {
        paintButton.disabled = false;
        paintButton.textContent = pixels.has(`${selectedPixel.x},${selectedPixel.y}`)
          ? "Sovrascrivi questo pixel"
          : "Colora questo pixel";
      }
    }
  });
}

// Avvio dell'applicazione
createGrid();
updateColor("#3980F6");
refreshState();

// Sincronizzazione automatica ogni 5 secondi con il cloud
setInterval(refreshState, 5000);