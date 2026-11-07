import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCrSbPtjAvSdoaOPGPR90GHhlwsOmKMCv0",
  authDomain: "classpixels-89c53.firebaseapp.com",
  projectId: "classpixels-89c53",
  storageBucket: "classpixels-89c53.firebasestorage.app",
  messagingSenderId: "412036982129",
  appId: "1:412036982129:web:0882b805520cd76a01c2d0",
  measurementId: "G-KZLS6YX1LB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const GRID_SIZE = 50;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;

let selectedPixel = null;
let canPaint = true;
let pixels = new Map();
let isPainting = false;

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

function showMessage(text, type = "") {
  const message = document.getElementById("message");
  message.textContent = text;
  message.className = "message " + type;
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Number(v) || 0)).toString(16).padStart(2, "0"))
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

function updateColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  hex = hex.toUpperCase();
  const rgb = hexToRgb(hex);

  document.getElementById("colorPicker").value = hex;
  document.getElementById("hexInput").value = hex;
  document.getElementById("redInput").value = rgb.r;
  document.getElementById("greenInput").value = rgb.g;
  document.getElementById("blueInput").value = rgb.b;

  document.getElementById("selectedDot").style.background = hex;
  document.getElementById("selectedHex").textContent = hex;
}

// 1. CREAZIONE IMMEDIATA DELLA GRIGLIA
function createGrid() {
  const grid = document.getElementById("pixelGrid");
  grid.innerHTML = ""; // Pulisce eventuali residui

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement("button");
      cell.className = "pixel";
      cell.type = "button";
      cell.dataset.x = x;
      cell.dataset.y = y;

      cell.addEventListener("click", () => {
        selectPixel(x, y);
      });

      grid.appendChild(cell);
    }
  }
}

function selectPixel(x, y) {
  if (!canPaint || isPainting) return;

  selectedPixel = { x, y };

  document.querySelectorAll(".pixel.selected")
    .forEach(el => el.classList.remove("selected"));

  const grid = document.getElementById("pixelGrid");
  const index = y * GRID_SIZE + x;
  const cell = grid.children[index];
  if (cell) cell.classList.add("selected");

  const key = `${x},${y}`;
  const existingColor = pixels.get(key);
  const selectionInfo = document.getElementById("selectionInfo");
  const paintButton = document.getElementById("paintButton");

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

function renderPixels(newPixels) {
  const grid = document.getElementById("pixelGrid");
  const newMap = new Map();

  for (const pixel of newPixels) {
    newMap.set(`${pixel.x},${pixel.y}`, pixel.color);
  }

  for (const [key, color] of newMap) {
    const [x, y] = key.split(",").map(Number);
    const index = y * GRID_SIZE + x;
    const cell = grid.children[index];

    if (cell) {
      cell.style.backgroundColor = color;
      cell.classList.add("taken");
    }
  }

  pixels = newMap;
  document.getElementById("coloredCount").textContent = pixels.size;
  document.getElementById("remainingCount").textContent = TOTAL_PIXELS - pixels.size;
}

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
      document.querySelectorAll(".pixel.selected").forEach(el => el.classList.remove("selected"));
      const paintButton = document.getElementById("paintButton");
      paintButton.disabled = true;
      paintButton.textContent = "Hai già modificato oggi";
      document.getElementById("selectionInfo").textContent = "Hai già utilizzato il tuo pixel giornaliero.";
      document.getElementById("dailyNote").textContent = "Potrai modificare un altro pixel domani!";
    }
  } catch (error) {
    console.error("Errore Firebase:", error);
  }
}

// Eventi all'avvio
createGrid();
updateColor("#3980F6");
refreshState();

document.getElementById("colorPicker").addEventListener("input", (e) => updateColor(e.target.value));
document.getElementById("hexInput").addEventListener("input", (e) => {
  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updateColor(e.target.value);
});

["redInput", "greenInput", "blueInput"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    updateColor(rgbToHex(
      document.getElementById("redInput").value,
      document.getElementById("greenInput").value,
      document.getElementById("blueInput").value
    ));
  });
});

document.getElementById("paintButton").addEventListener("click", async () => {
  if (!selectedPixel || !canPaint || isPainting) return;

  isPainting = true;
  const paintButton = document.getElementById("paintButton");
  paintButton.disabled = true;
  paintButton.textContent = "Salvataggio...";

  const color = document.getElementById("colorPicker").value;
  const today = getTodayString();

  try {
    const claimRef = doc(db, "claims", `${studentId}_${today}`);
    const claimSnap = await getDoc(claimRef);
    if (claimSnap.exists()) throw new Error("Hai già modificato un pixel oggi!");

    const pixelRef = doc(db, "pixels", `pixel_${selectedPixel.x}__${selectedPixel.y}`);
    await setDoc(pixelRef, {
      x: selectedPixel.x,
      y: selectedPixel.y,
      color: color.toUpperCase(),
      updated_at: new Date().toISOString()
    }, { merge: true });

    await setDoc(claimRef, { student_id: studentId, day: today });

    showMessage("Pixel salvato!", "success");
    selectedPixel = null;
    await refreshState();
  } catch (error) {
    showMessage(error.message, "error");
    await refreshState();
  } finally {
    isPainting = false;
  }
});