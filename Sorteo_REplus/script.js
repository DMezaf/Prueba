const STORAGE_KEY = "vms-energy-wheel-stock-v2";

const wheelOptions = [
  { id: "giftbox", label: "Giftbox", type: "prize", image: "assets/img/gift_box.png" },
  { id: "thermo-plus", label: "Thermo Plus", type: "prize", image: "assets/img/Thermo_plus.png" },
  { id: "welcome-pack", label: "Welcome Pack", type: "prize", image: "assets/img/welcome_pack.png" },
  { id: "pluma", label: "Pluma", type: "prize", image: "assets/img/pluma.png" },
  { id: "flexometro", label: "Flexometro", type: "prize", image: "assets/img/flexo.png" },
  { id: "yeti", label: "Yeti", type: "prize", image: "assets/img/yeti.png" },
  { id: "retry", label: "Gira otra vez", type: "retry", image: null },
  { id: "try-next", label: "Suerte para la proxima", type: "miss", image: null }
];

const initialStock = {
  giftbox: 3,
  "thermo-plus": 3,
  "welcome-pack": 10,
  pluma: 25,
  flexometro: 25,
  yeti: 3
};

const totalPrizeCount = Object.values(initialStock).reduce((sum, value) => sum + value, 0);
const wheel = document.getElementById("wheel");
const spinButton = document.getElementById("spinButton");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const resultMedia = document.getElementById("resultMedia");
const resultImage = document.getElementById("resultImage");
const prizeList = document.getElementById("prizeList");
const inventorySummary = document.getElementById("inventorySummary");

let stock = loadStock();
let currentRotation = 0;
let isSpinning = false;

buildWheel();
renderPrizeList();
updateInventorySummary();

spinButton.addEventListener("click", spinWheel);

function loadStock() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== "object") {
      return { ...initialStock };
    }

    return Object.keys(initialStock).reduce((acc, key) => {
      const value = Number(stored[key]);
      acc[key] = Number.isFinite(value) && value >= 0 ? value : initialStock[key];
      return acc;
    }, {});
  } catch (error) {
    return { ...initialStock };
  }
}

function saveStock() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
}

function buildWheel() {
  wheel.innerHTML = "";
  const sliceAngle = 360 / wheelOptions.length;

  wheelOptions.forEach((option, index) => {
    const segment = document.createElement("div");
    segment.className = "wheel-segment";
    segment.style.transform = `rotate(${index * sliceAngle}deg) translate(0, -50%)`;

    const label = document.createElement("span");
    label.textContent = option.label;
    label.style.transform = `rotate(${sliceAngle / 2}deg) translate(118px, -50%)`;

    segment.appendChild(label);
    wheel.appendChild(segment);
  });
}

function renderPrizeList() {
  prizeList.innerHTML = "";

  wheelOptions
    .filter((option) => option.type === "prize")
    .forEach((option) => {
      const li = document.createElement("li");
      li.className = "prize-item";

      const name = document.createElement("strong");
      name.textContent = option.label;

      const qty = document.createElement("span");
      qty.textContent = `${stock[option.id]} disponibles`;

      li.append(name, qty);
      prizeList.appendChild(li);
    });
}

function updateInventorySummary() {
  const remaining = Object.values(stock).reduce((sum, value) => sum + value, 0);
  inventorySummary.textContent = `${remaining} premios disponibles de ${totalPrizeCount}`;

  if (remaining === 0) {
    spinButton.disabled = true;
    hideResultMedia();
    resultTitle.textContent = "Premios agotados";
    resultText.textContent = "La dinamica termino. Puedes actualizar los QR con tus enlaces reales para futuras activaciones.";
  }
}

function getWeightedResult() {
  const prizePool = [];

  wheelOptions.forEach((option) => {
    if (option.type === "prize") {
      const count = stock[option.id];
      for (let index = 0; index < count; index += 1) {
        prizePool.push(option);
      }
      return;
    }

    if (option.id === "retry") {
      for (let index = 0; index < 18; index += 1) {
        prizePool.push(option);
      }
      return;
    }

    for (let index = 0; index < 12; index += 1) {
      prizePool.push(option);
    }
  });

  if (!prizePool.length) {
    return wheelOptions.find((option) => option.id === "try-next");
  }

  return prizePool[Math.floor(Math.random() * prizePool.length)];
}

function spinWheel() {
  if (isSpinning) {
    return;
  }

  const remaining = Object.values(stock).reduce((sum, value) => sum + value, 0);
  if (remaining === 0) {
    updateInventorySummary();
    return;
  }

  isSpinning = true;
  spinButton.disabled = true;

  const selected = getWeightedResult();
  const selectedIndex = wheelOptions.findIndex((option) => option.id === selected.id);
  const sliceAngle = 360 / wheelOptions.length;
  const sliceCenter = (selectedIndex * sliceAngle) + (sliceAngle / 2);
  const fullSpins = 7 * 360;
  const targetRotation = fullSpins + (360 - sliceCenter);

  currentRotation += targetRotation;
  wheel.style.setProperty("--rotation", `${currentRotation}deg`);

  window.setTimeout(() => {
    applyResult(selected);
    isSpinning = false;

    const remainingAfterSpin = Object.values(stock).reduce((sum, value) => sum + value, 0);
    spinButton.disabled = remainingAfterSpin === 0;
  }, 6000);
}

function applyResult(selected) {
  if (selected.type === "prize" && stock[selected.id] > 0) {
    stock[selected.id] -= 1;
    saveStock();
    renderPrizeList();
    updateInventorySummary();
    showResultMedia(selected);
    resultTitle.textContent = selected.label;
    resultText.textContent = "Felicidades, este regalo ya quedo asignado en la dinamica.";
    return;
  }

  hideResultMedia();

  if (selected.id === "retry") {
    resultTitle.textContent = "Gira otra vez";
    resultText.textContent = "Tuviste una nueva oportunidad. Presiona el boton y vuelve a intentarlo.";
    return;
  }

  resultTitle.textContent = "Suerte para la proxima";
  resultText.textContent = "Esta vez no cayo premio, pero puedes escanear los QR y sumar una oportunidad extra.";
}

function showResultMedia(selected) {
  if (selected.image) {
    resultImage.src = selected.image;
    resultImage.alt = selected.label;
    resultMedia.hidden = false;
    return;
  }

  const fallbackSvg = createFallbackPrizeImage(selected.label);
  resultImage.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(fallbackSvg)}`;
  resultImage.alt = selected.label;
  resultMedia.hidden = false;
}

function hideResultMedia() {
  resultMedia.hidden = true;
  resultImage.removeAttribute("src");
  resultImage.alt = "";
}

function createFallbackPrizeImage(label) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#006fba"/>
          <stop offset="100%" stop-color="#00b3a4"/>
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="36" fill="#f5fbfd"/>
      <rect x="28" y="28" width="184" height="184" rx="30" fill="url(#g)" opacity="0.16"/>
      <circle cx="120" cy="92" r="30" fill="#006fba"/>
      <path d="M88 144h64a18 18 0 0 1 18 18v2a18 18 0 0 1-18 18H88a18 18 0 0 1-18-18v-2a18 18 0 0 1 18-18Z" fill="#003f70"/>
      <text x="120" y="214" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#0f2942">${label}</text>
    </svg>
  `;
}
