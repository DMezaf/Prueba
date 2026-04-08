const STORAGE_KEY = "replus-leads-v1";
const WEBHOOK_URL = "";

const form = document.querySelector("#lead-form");
const feedback = document.querySelector("#form-feedback");
const networkStatus = document.querySelector("#network-status");
const savedCount = document.querySelector("#saved-count");
const pendingCount = document.querySelector("#pending-count");
const leadList = document.querySelector("#lead-list");
const syncButton = document.querySelector("#sync-button");
const exportButton = document.querySelector("#export-button");
const exportCutButton = document.querySelector("#export-cut-button");
const emailButton = document.querySelector("#email-button");
const clearButton = document.querySelector("#clear-button");
const serviceSearch = document.querySelector("#service-search");
const expandServicesButton = document.querySelector("#expand-services");
const collapseServicesButton = document.querySelector("#collapse-services");
const serviceGroups = Array.from(document.querySelectorAll(".service-group"));
const businessCardInput = document.querySelector("#business-card-image");
const businessCardPreview = document.querySelector("#business-card-preview");
const cardUploadFeedback = document.querySelector("#card-upload-feedback");
const scanCardButton = document.querySelector("#scan-card-button");
const applyOcrButton = document.querySelector("#apply-ocr-button");
const toggleOcrTextButton = document.querySelector("#toggle-ocr-text");
const ocrDebugContent = document.querySelector("#ocr-debug-content");
const ocrTextOutput = document.querySelector("#ocr-text-output");
const ocrDetectedFields = document.querySelector("#ocr-detected-fields");
const ocrProposalInputs = Array.from(document.querySelectorAll("[data-ocr-field]"));
const ocrProposalToggles = Array.from(document.querySelectorAll("[data-ocr-toggle]"));
const reviewDialog = document.querySelector("#review-dialog");
const reviewContent = document.querySelector("#review-content");
const closeReviewButton = document.querySelector("#close-review");
const editReviewButton = document.querySelector("#edit-review");
const confirmSaveButton = document.querySelector("#confirm-save");

let leadDraft = null;
let selectedBusinessCardFile = null;
let tesseractLoader = null;
let ocrWorkerPromise = null;
let extractedCardDraft = null;

const OCR_LANGUAGE = "spa+eng";
const OCR_ASSET_PATHS = {
  script: "./assets/ocr/lib/tesseract.min.js",
  worker: new URL("./assets/ocr/lib/worker.min.js", window.location.href).href,
  core: new URL("./assets/ocr/core/", window.location.href).href,
  lang: new URL("./assets/ocr/lang-data/", window.location.href).href
};

const FIELD_LABELS = {
  nombreContacto: "Nombre",
  empresa: "Empresa",
  paisCiudad: "Pais / Ciudad",
  cargoContacto: "Cargo",
  email: "Email",
  telefono: "Telefono"
};

function getLeads() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function setLeads(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function getFormValues(formElement) {
  const data = new FormData(formElement);
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    nombreContacto: data.get("nombreContacto")?.toString().trim() || "",
    empresa: data.get("empresa")?.toString().trim() || "",
    paisCiudad: data.get("paisCiudad")?.toString().trim() || "",
    industria: data.get("industria")?.toString().trim() || "",
    cargoContacto: data.get("cargoContacto")?.toString().trim() || "",
    email: data.get("email")?.toString().trim() || "",
    telefono: data.get("telefono")?.toString().trim() || "",
    asesorEquipo: data.get("asesorEquipo")?.toString().trim() || "",
    consumoMensual: data.get("consumoMensual")?.toString().trim() || "",
    demandaMaxima: data.get("demandaMaxima")?.toString().trim() || "",
    nivelTension: data.get("nivelTension")?.toString().trim() || "",
    penalizacionesDemanda: data.get("penalizacionesDemanda")?.toString().trim() || "",
    plantaSolar: data.get("plantaSolar")?.toString().trim() || "",
    respaldo: data.getAll("respaldo"),
    interesPrincipal: data.getAll("interesPrincipal"),
    serviciosInteres: data.getAll("serviciosInteres"),
    horizonteProyecto: data.get("horizonteProyecto")?.toString().trim() || "",
    notas: data.get("notas")?.toString().trim() || "",
    ctaEvaluacion: data.get("ctaEvaluacion") === "on",
    syncStatus: "pending",
    syncAttempts: 0
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(isoDate));
}

function updateCounters() {
  const leads = getLeads();
  savedCount.textContent = leads.length.toString();
  pendingCount.textContent = leads.filter((lead) => lead.syncStatus !== "sent").length.toString();
}

function renderLeads() {
  const leads = getLeads().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!leads.length) {
    leadList.innerHTML = '<p class="empty-state">Todavia no hay registros.</p>';
    updateCounters();
    return;
  }

  leadList.innerHTML = leads.map((lead) => {
    const statusClass = lead.syncStatus === "sent" ? "sent" : "pending";
    const statusLabel = lead.syncStatus === "sent" ? "Enviado" : "Pendiente";
    const interest = lead.interesPrincipal.length ? lead.interesPrincipal.join(", ") : "Sin definir";
    return `
      <article class="lead-item">
        <header>
          <div>
            <h3>${escapeHtml(lead.nombreContacto || "Lead sin nombre")} · ${escapeHtml(lead.empresa || "Empresa no capturada")}</h3>
            <p class="lead-meta">${escapeHtml(lead.paisCiudad || "Ubicacion no capturada")} | ${escapeHtml(lead.email || "Sin email")}</p>
          </div>
          <div class="lead-tags">
            <span class="tag ${statusClass}">${statusLabel}</span>
            <span class="tag">${escapeHtml(lead.horizonteProyecto || "Sin horizonte")}</span>
          </div>
        </header>
        <p class="lead-meta">Capturado: ${formatDate(lead.createdAt)}</p>
        <p><strong>Interes:</strong> ${escapeHtml(interest)}</p>
      </article>
    `;
  }).join("");

  updateCounters();
}

function setFeedback(message, tone = "neutral") {
  feedback.textContent = message;
  feedback.style.color = tone === "error"
    ? "var(--danger)"
    : tone === "success"
      ? "var(--success)"
      : "var(--muted)";
}

function updateNetworkStatus() {
  if (navigator.onLine) {
    networkStatus.textContent = "Conexion disponible";
    networkStatus.style.background = "rgba(31, 143, 87, 0.14)";
    networkStatus.style.color = "var(--success)";
  } else {
    networkStatus.textContent = "Modo offline";
    networkStatus.style.background = "rgba(199, 108, 20, 0.12)";
    networkStatus.style.color = "var(--warning)";
  }
}

async function sendLead(lead) {
  if (!WEBHOOK_URL) {
    return false;
  }

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...lead,
      respaldoTexto: lead.respaldo.join(" | "),
      interesPrincipalTexto: lead.interesPrincipal.join(" | "),
      serviciosInteresTexto: lead.serviciosInteres.join(" | ")
    })
  });

  return response.ok;
}

async function syncPendingLeads() {
  const leads = getLeads();
  const pending = leads.filter((lead) => lead.syncStatus !== "sent");

  if (!pending.length) {
    setFeedback("No hay leads pendientes de envio.", "success");
    renderLeads();
    return;
  }

  if (!navigator.onLine) {
    setFeedback("Sin red disponible. Los leads siguen protegidos en este dispositivo.", "error");
    return;
  }

  if (!WEBHOOK_URL) {
    setFeedback("Configura WEBHOOK_URL en app.js para habilitar el envio automatico.", "error");
    return;
  }

  let sentCount = 0;
  for (const lead of pending) {
    try {
      const ok = await sendLead(lead);
      lead.syncAttempts += 1;
      if (ok) {
        lead.syncStatus = "sent";
        sentCount += 1;
      }
    } catch {
      lead.syncAttempts += 1;
    }
  }

  setLeads(leads);
  renderLeads();
  setFeedback(`Sincronizacion terminada. ${sentCount} lead(s) enviados.`, "success");
}

function toCsvValue(value) {
  const prepared = Array.isArray(value) ? value.join(" | ") : value ?? "";
  const text = String(prepared).replaceAll('"', '""');
  return `"${text}"`;
}

function getCsvHeaders() {
  return [
    "id",
    "createdAt",
    "nombreContacto",
    "empresa",
    "paisCiudad",
    "industria",
    "cargoContacto",
    "email",
    "telefono",
    "asesorEquipo",
    "consumoMensual",
    "demandaMaxima",
    "nivelTension",
    "penalizacionesDemanda",
    "plantaSolar",
    "respaldo",
    "interesPrincipal",
    "serviciosInteres",
    "horizonteProyecto",
    "notas",
    "ctaEvaluacion",
    "syncStatus",
    "syncAttempts",
    "ultimoCorte"
  ];
}

function getTimestampLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function setCardFeedback(message, tone = "neutral") {
  cardUploadFeedback.textContent = message;
  cardUploadFeedback.style.color = tone === "error"
    ? "var(--danger)"
    : tone === "success"
      ? "var(--success)"
      : "var(--muted)";
}

function renderDetectedFields(fields) {
  const entries = Object.entries(fields).filter(([key, value]) => FIELD_LABELS[key] && value);

  if (!entries.length) {
    ocrDetectedFields.innerHTML = '<p class="empty-state">Aun no hay datos extraidos.</p>';
    return;
  }

  ocrDetectedFields.innerHTML = entries.map(([key, value]) => `
    <div class="ocr-chip">
      <span>${escapeHtml(FIELD_LABELS[key] || key)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function setOcrProposalFields(fields = {}) {
  extractedCardDraft = { ...fields };

  ocrProposalInputs.forEach((input) => {
    const fieldName = input.dataset.ocrField;
    const hasValue = Boolean(fields[fieldName]);
    input.value = fields[fieldName] || "";
    const toggle = ocrProposalToggles.find((item) => item.dataset.ocrToggle === fieldName);
    if (toggle) {
      toggle.checked = hasValue;
      toggle.disabled = !hasValue;
    }
  });

  applyOcrButton.disabled = !ocrProposalInputs.some((input) => input.value.trim());
}

function getEditedOcrFields() {
  return ocrProposalInputs.reduce((accumulator, input) => {
    const fieldName = input.dataset.ocrField;
    accumulator[fieldName] = input.value.trim();
    return accumulator;
  }, {});
}

function loadTesseract() {
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (tesseractLoader) {
    return tesseractLoader;
  }

  tesseractLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = OCR_ASSET_PATHS.script;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => {
      tesseractLoader = null;
      reject(new Error("No se pudo cargar el motor OCR."));
    };
    document.head.appendChild(script);
  });

  return tesseractLoader;
}

async function getOcrWorker() {
  if (ocrWorkerPromise) {
    return ocrWorkerPromise;
  }

  ocrWorkerPromise = (async () => {
    const Tesseract = await loadTesseract();
    return Tesseract.createWorker(OCR_LANGUAGE, 1, {
      workerPath: OCR_ASSET_PATHS.worker,
      corePath: OCR_ASSET_PATHS.core,
      langPath: OCR_ASSET_PATHS.lang,
      logger: () => {}
    });
  })().catch((error) => {
    ocrWorkerPromise = null;
    throw error;
  });

  return ocrWorkerPromise;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });
}

function normalizeWhitespace(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[|]{2,}/g, "|")
    .trim();
}

function toTitleCase(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function removeDiacritics(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeComparable(value) {
  return removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLineGeometry(line) {
  const bbox = line?.bbox || {};
  const x0 = Number.isFinite(bbox.x0) ? bbox.x0 : 0;
  const y0 = Number.isFinite(bbox.y0) ? bbox.y0 : 0;
  const x1 = Number.isFinite(bbox.x1) ? bbox.x1 : x0;
  const y1 = Number.isFinite(bbox.y1) ? bbox.y1 : y0;
  return {
    x0,
    y0,
    x1,
    y1,
    width: Math.max(0, x1 - x0),
    height: Math.max(0, y1 - y0)
  };
}

function splitOcrLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function sanitizeOcrLine(line) {
  return normalizeWhitespace(
    line
      .replace(/[|~`_^]+/g, " ")
      .replace(/[^\p{L}\p{N}@&.,'+\-/:() ]+/gu, " ")
  );
}

function looksLikeNoise(line) {
  const cleaned = sanitizeOcrLine(line);
  if (!cleaned) {
    return true;
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return true;
  }

  const singleCharCount = tokens.filter((token) => token.length === 1).length;
  if (singleCharCount >= Math.ceil(tokens.length / 2) && tokens.length >= 4) {
    return true;
  }

  const digitCount = (cleaned.match(/\d/g) || []).length;
  const letterCount = (cleaned.match(/\p{L}/gu) || []).length;
  if (!letterCount && digitCount) {
    return true;
  }

  return false;
}

function getUsefulLines(text) {
  return splitOcrLines(text)
    .map((line) => sanitizeOcrLine(line))
    .filter((line) => line && !looksLikeNoise(line));
}

function getEmailNameHints(email) {
  const localPart = email.split("@")[0]?.toLowerCase() || "";
  if (!localPart) {
    return { tokens: [], initials: [] };
  }

  const normalized = localPart
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])(\d+)/g, "$1 $2")
    .trim();

  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  const compactToken = normalized.replace(/\s+/g, "");
  const splitCompact = compactToken.match(/[a-z]+/g) || [];
  const tokens = [...new Set([...rawTokens, ...splitCompact].filter((token) => token.length >= 2))];
  const initials = [...new Set(rawTokens.filter((token) => token.length === 1))];
  return { tokens, initials };
}

function scoreNameCandidate(line, emailHints) {
  if (!/^[\p{L}.' -]+$/u.test(line)) {
    return -10;
  }

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) {
    return -4;
  }

  const lowered = line.toLowerCase();
  if (/(engineer|manager|director|sales|marketing|project|energy|solutions|inc|llc|sa de|s\.?a\.?|corp|group|company|www|gerente|servicios|service|operations|operaciones|ventas|comercial|procurement|purchasing|business|president|owner|founder|consultant)/i.test(lowered)) {
    return -5;
  }

  let score = 0;
  let uppercaseWordCount = 0;
  let titleCaseWordCount = 0;
  for (const word of words) {
    if (/^\p{Lu}[\p{L}.'-]+$/u.test(word)) {
      score += 2;
      titleCaseWordCount += 1;
    } else if (/^\p{Lu}{2,}$/u.test(word)) {
      score += 1;
      uppercaseWordCount += 1;
    }
  }

  if (!/[a-záéíóúñ]/.test(line)) {
    score -= 4;
  }

  if (uppercaseWordCount >= 2 && titleCaseWordCount === 0) {
    score -= 3;
  }

  const comparableWords = normalizeComparable(line).split(/\s+/).filter(Boolean);
  if (emailHints.tokens.some((token) => comparableWords.includes(token))) {
    score += 4;
  }

  if (emailHints.initials.length && comparableWords.length) {
    const firstWord = comparableWords[0];
    if (emailHints.initials.includes(firstWord.charAt(0))) {
      score += 1;
    }
  }

  return score;
}

function scoreCompanyCandidate(line, email) {
  const lowered = line.toLowerCase();
  if (/@|www\.|https?:\/\/|\+?\d/.test(lowered)) {
    return -5;
  }

  let score = 0;
  if (/(inc|llc|corp|corporation|group|solutions|energy|solar|technologies|systems|mexico|s\.?a\.?|sa de cv|de c\.?v\.?)/i.test(lowered)) {
    score += 4;
  }
  if (/^[A-Z0-9&.,' -]+$/.test(line)) {
    score += 2;
  }
  if (line.split(/\s+/).length >= 2) {
    score += 1;
  }
  if (email) {
    const domain = email.split("@")[1]?.split(".")[0]?.toLowerCase() || "";
    if (domain && lowered.replace(/\s+/g, "").includes(domain.replace(/[^a-z0-9]/g, ""))) {
      score += 4;
    }
  }
  return score;
}

function scoreTitleCandidate(line) {
  if (/@|www\.|https?:\/\/|\+?\d/.test(line)) {
    return -5;
  }

  return /(director|manager|lead|sales|marketing|engineer|developer|consultant|operations|procurement|purchasing|business|owner|founder|president|gerente|director|ingeniero|ventas|comercial|operaciones|compras)/i.test(line)
    ? 4
    : 0;
}

function normalizeTitleCandidate(line) {
  const cleaned = normalizeWhitespace(line);
  if (!cleaned) {
    return "";
  }

  const titleKeywords = [
    "gerente",
    "director",
    "manager",
    "ventas",
    "sales",
    "ingeniero",
    "engineer",
    "operations",
    "operaciones",
    "procurement",
    "compras",
    "business",
    "marketing",
    "consultant"
  ];

  const comparableTokens = normalizeComparable(cleaned).split(/\s+/).filter(Boolean);
  const keywordIndex = comparableTokens.findIndex((token) => titleKeywords.includes(token));
  if (keywordIndex > 0) {
    const originalTokens = cleaned.split(/\s+/).filter(Boolean);
    return normalizeWhitespace(originalTokens.slice(keywordIndex).join(" "));
  }

  return cleaned;
}

function getStructuredOcrLines(ocrData) {
  const rawLines = Array.isArray(ocrData?.lines) ? ocrData.lines : [];
  return rawLines
    .map((line) => {
      const text = sanitizeOcrLine(line.text || "");
      const geometry = getLineGeometry(line);
      return {
        text,
        comparable: normalizeComparable(text),
        ...geometry
      };
    })
    .filter((line) => line.text && !looksLikeNoise(line.text));
}

function scoreStructuredNameCandidate(line, emailHints, layout) {
  let score = scoreNameCandidate(line.text, emailHints);
  if (score <= -5) {
    return score;
  }

  if (layout.maxHeight > 0) {
    score += (line.height / layout.maxHeight) * 4;
  }

  if (layout.maxWidth > 0) {
    score += (line.width / layout.maxWidth) * 1.5;
  }

  const verticalRatio = layout.maxBottom > 0 ? line.y0 / layout.maxBottom : 0;
  if (verticalRatio < 0.35) {
    score += 3;
  } else if (verticalRatio > 0.65) {
    score -= 2;
  }

  const horizontalRatio = layout.maxRight > 0 ? line.x0 / layout.maxRight : 0;
  if (horizontalRatio > 0.4) {
    score += 1.5;
  }

  return score;
}

function scoreStructuredTitleCandidate(line, nameLine, layout) {
  let score = scoreTitleCandidate(line.text);
  if (score <= 0) {
    return score;
  }

  if (nameLine) {
    const verticalDistance = line.y0 - nameLine.y1;
    if (verticalDistance >= -8 && verticalDistance <= Math.max(30, nameLine.height * 2.4)) {
      score += 4;
    }

    if (Math.abs(line.x0 - nameLine.x0) <= Math.max(40, nameLine.width * 0.45)) {
      score += 2;
    }

    if (line.y0 < nameLine.y0) {
      score -= 2;
    }
  }

  if (layout.maxHeight > 0) {
    score += (line.height / layout.maxHeight) * 1.2;
  }

  return score;
}

function scoreStructuredCompanyCandidate(line, email, layout) {
  let score = scoreCompanyCandidate(line.text, email);
  if (score <= -5) {
    return score;
  }

  const verticalRatio = layout.maxBottom > 0 ? line.y0 / layout.maxBottom : 0;
  if (verticalRatio < 0.45) {
    score += 1.5;
  }

  const horizontalRatio = layout.maxRight > 0 ? line.x0 / layout.maxRight : 0;
  if (horizontalRatio < 0.45) {
    score += 1.2;
  }

  if (layout.maxWidth > 0) {
    score += (line.width / layout.maxWidth) * 2;
  }

  if (layout.maxHeight > 0) {
    score += (line.height / layout.maxHeight) * 1.5;
  }

  return score;
}

function scoreLocationCandidate(line) {
  if (/@|www\.|https?:\/\//.test(line)) {
    return -5;
  }

  return /(mexico|cdmx|monterrey|guadalajara|queretaro|jalisco|nuevo leon|puebla|bogota|colombia|chile|peru|usa|texas|california|city|ciudad)/i.test(line)
    ? 3
    : 0;
}

function inferCompanyFromEmail(email) {
  const domain = email.split("@")[1]?.split(".")[0]?.toLowerCase() || "";
  if (!domain || /gmail|outlook|hotmail|yahoo|icloud/.test(domain)) {
    return "";
  }

  const normalized = domain
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(\d+)/g, " $1 ")
    .trim();

  if (!normalized) {
    return "";
  }

  return toTitleCase(normalized);
}

function cleanExtractedName(value) {
  return normalizeWhitespace(
    value
      .replace(/\b(?:gerente|director|engineer|manager|servicios|service|operaciones|operations)\b.*$/i, "")
      .replace(/^[a-z]\s+/i, "")
  );
}

function normalizePhone(value) {
  if (!value) {
    return "";
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 12 && digits.startsWith("52")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+52${digits}`;
  }

  return value.startsWith("+") ? value : `+${digits}`;
}

async function preprocessImageForOcr(file) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo cargar la imagen para OCR."));
      element.src = imageUrl;
    });

    const maxWidth = 1800;
    const scale = Math.min(1, maxWidth / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("No se pudo crear el contexto de imagen para OCR.");
    }
    context.filter = "grayscale(100%) contrast(165%) brightness(112%)";
    context.drawImage(image, 0, 0, width, height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("No se pudo preparar la imagen para OCR."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function createOcrCrop(file, crop) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo cargar la imagen para OCR."));
      element.src = imageUrl;
    });

    const sourceX = Math.max(0, Math.round(image.width * crop.x));
    const sourceY = Math.max(0, Math.round(image.height * crop.y));
    const sourceWidth = Math.max(1, Math.round(image.width * crop.width));
    const sourceHeight = Math.max(1, Math.round(image.height * crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("No se pudo crear el recorte OCR.");
    }

    context.filter = "grayscale(100%) contrast(175%) brightness(115%)";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar el recorte OCR."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function mergeOcrData(...entries) {
  const validEntries = entries.filter(Boolean);
  return {
    text: validEntries
      .map((entry) => entry.text || "")
      .filter(Boolean)
      .join("\n"),
    lines: validEntries.flatMap((entry) => Array.isArray(entry.lines) ? entry.lines : [])
  };
}

function extractBusinessCardData(ocrData) {
  const text = ocrData?.text || "";
  const rawLines = splitOcrLines(text);
  const lines = getUsefulLines(text);
  const structuredLines = getStructuredOcrLines(ocrData);
  const cleanText = normalizeWhitespace(text);
  const emailMatch = cleanText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0].toLowerCase() : "";
  const emailHints = getEmailNameHints(email);
  const phoneCandidates = cleanText.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const phoneMatch = phoneCandidates
    .map((candidate) => normalizeWhitespace(candidate))
    .find((candidate) => candidate.replace(/\D/g, "").length >= 8) || "";

  const layout = structuredLines.reduce((accumulator, line) => ({
    maxHeight: Math.max(accumulator.maxHeight, line.height),
    maxWidth: Math.max(accumulator.maxWidth, line.width),
    maxRight: Math.max(accumulator.maxRight, line.x1),
    maxBottom: Math.max(accumulator.maxBottom, line.y1)
  }), {
    maxHeight: 0,
    maxWidth: 0,
    maxRight: 0,
    maxBottom: 0
  });

  const structuredNameLine = [...structuredLines]
    .sort((a, b) => scoreStructuredNameCandidate(b, emailHints, layout) - scoreStructuredNameCandidate(a, emailHints, layout))
    .find((line) => scoreStructuredNameCandidate(line, emailHints, layout) > 2);

  const fallbackLines = lines.slice(0, 12);
  const fallbackNameCandidate = [...fallbackLines]
    .sort((a, b) => scoreNameCandidate(b, emailHints) - scoreNameCandidate(a, emailHints))
    .find((line) => scoreNameCandidate(line, emailHints) > 1) || "";

  const nameCandidate = structuredNameLine?.text || fallbackNameCandidate;
  const cleanedName = cleanExtractedName(nameCandidate);

  const structuredTitleLine = [...structuredLines]
    .filter((line) => line.text !== nameCandidate)
    .sort((a, b) => scoreStructuredTitleCandidate(b, structuredNameLine, layout) - scoreStructuredTitleCandidate(a, structuredNameLine, layout))
    .find((line) => scoreStructuredTitleCandidate(line, structuredNameLine, layout) > 2);

  const fallbackTitleCandidate = fallbackLines.find((line) => scoreTitleCandidate(line) > 0 && line !== nameCandidate) || "";
  const titleCandidate = normalizeTitleCandidate(structuredTitleLine?.text || fallbackTitleCandidate);
  const emailInferredCompany = inferCompanyFromEmail(email);

  const structuredCompanyLine = [...structuredLines]
    .filter((line) => line.text !== nameCandidate && line.text !== titleCandidate)
    .sort((a, b) => scoreStructuredCompanyCandidate(b, email, layout) - scoreStructuredCompanyCandidate(a, email, layout))
    .find((line) => scoreStructuredCompanyCandidate(line, email, layout) > 2);

  const fallbackCompanyCandidate = [...lines]
    .filter((line) => line !== nameCandidate && line !== titleCandidate)
    .sort((a, b) => scoreCompanyCandidate(b, email) - scoreCompanyCandidate(a, email))
    .find((line) => scoreCompanyCandidate(line, email) > 1) || "";

  const companyCandidate = structuredCompanyLine?.text || fallbackCompanyCandidate;
  const locationCandidate = lines.find((line) => scoreLocationCandidate(line) > 0) || "";
  const resolvedCompanyCandidate = normalizeComparable(companyCandidate) === normalizeComparable(cleanedName || nameCandidate)
    ? ""
    : companyCandidate;
  const finalCompany = resolvedCompanyCandidate && resolvedCompanyCandidate.length > 4
    ? resolvedCompanyCandidate
    : emailInferredCompany;

  return {
    nombreContacto: cleanedName || nameCandidate,
    empresa: finalCompany,
    paisCiudad: locationCandidate,
    cargoContacto: titleCandidate,
    email,
    telefono: normalizePhone(phoneMatch),
    rawText: rawLines.join("\n")
  };
}

function applyExtractedDataToForm(fields) {
  const applied = [];

  Object.entries(FIELD_LABELS).forEach(([fieldName]) => {
    const toggle = ocrProposalToggles.find((item) => item.dataset.ocrToggle === fieldName);
    const input = form.elements.namedItem(fieldName);
    const nextValue = fields[fieldName];
    if (!input || !nextValue || (toggle && !toggle.checked)) {
      return;
    }

    if (!input.value.trim()) {
      input.value = nextValue;
      applied.push(FIELD_LABELS[fieldName]);
    }
  });

  return applied;
}

async function updateBusinessCardPreview(file) {
  if (!file) {
    selectedBusinessCardFile = null;
    businessCardPreview.removeAttribute("src");
    businessCardPreview.classList.add("is-empty");
    ocrTextOutput.value = "";
    setOcrDebugVisibility(false);
    renderDetectedFields({});
    setOcrProposalFields({});
    setCardFeedback("Sube una imagen clara para iniciar el reconocimiento.");
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  selectedBusinessCardFile = file;
  businessCardPreview.src = dataUrl;
  businessCardPreview.classList.remove("is-empty");
  setCardFeedback("Imagen lista. Cuando quieras, extraigo los datos para prellenar el formulario.");
}

async function scanBusinessCard() {
  if (!selectedBusinessCardFile) {
    setCardFeedback("Selecciona primero una imagen de la tarjeta.", "error");
    return;
  }

  scanCardButton.disabled = true;
  scanCardButton.textContent = "Extrayendo...";
  setCardFeedback("Leyendo la tarjeta. Esto puede tardar unos segundos.", "neutral");

  try {
    const worker = await getOcrWorker();
    const preparedImage = await preprocessImageForOcr(selectedBusinessCardFile);
    const topRightCrop = await createOcrCrop(selectedBusinessCardFile, {
      x: 0.38,
      y: 0.02,
      width: 0.6,
      height: 0.48
    });
    const [fullResult, cropResult] = await Promise.all([
      worker.recognize(preparedImage),
      worker.recognize(topRightCrop)
    ]);
    const extracted = extractBusinessCardData(mergeOcrData(fullResult.data || {}, cropResult.data || {}));
    ocrTextOutput.value = extracted.rawText;
    renderDetectedFields(extracted);
    setOcrProposalFields(extracted);
    setCardFeedback("Revisa la propuesta y aplica solo cuando estes conforme con los datos.", "success");
  } catch (error) {
    console.error(error);
    setCardFeedback("No pude procesar la imagen. Revisa la conexion o intenta con una foto mas nitida.", "error");
  } finally {
    scanCardButton.disabled = false;
    scanCardButton.textContent = "Extraer datos";
  }
}

function applyOcrProposal() {
  const editedFields = getEditedOcrFields();
  renderDetectedFields(editedFields);
  const appliedFields = applyExtractedDataToForm(editedFields);

  if (appliedFields.length) {
    setCardFeedback(`Datos aplicados al formulario: ${appliedFields.join(", ")}.`, "success");
    return;
  }

  setCardFeedback("No encontre campos vacios para completar en el formulario. Si quieres, borra alguno y vuelve a aplicar.", "error");
}

function setOcrDebugVisibility(isVisible) {
  ocrDebugContent.hidden = !isVisible;
  toggleOcrTextButton.setAttribute("aria-expanded", String(isVisible));
  toggleOcrTextButton.textContent = isVisible
    ? "Ocultar texto detectado"
    : "Mostrar texto detectado";
}

function buildCsv(leads) {
  if (!leads.length) {
    return null;
  }

  const headers = getCsvHeaders();
  const rows = [
    headers.join(","),
    ...leads.map((lead) => headers.map((header) => toCsvValue(lead[header])).join(","))
  ];

  return rows.join("\n");
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const leads = getLeads();
  const csvContent = buildCsv(leads);
  if (!csvContent) {
    setFeedback("No hay registros para exportar.", "error");
    return;
  }

  downloadCsv(csvContent, `replus-leads-${getTimestampLabel()}.csv`);
  setFeedback("CSV exportado correctamente.", "success");
}

function exportAndMarkCut() {
  const leads = getLeads();
  const csvContent = buildCsv(leads);
  if (!csvContent) {
    setFeedback("No hay registros para exportar.", "error");
    return;
  }

  downloadCsv(csvContent, `replus-corte-${getTimestampLabel()}.csv`);
  const cutTimestamp = new Date().toISOString();
  const updatedLeads = leads.map((lead) => ({
    ...lead,
    ultimoCorte: cutTimestamp
  }));
  setLeads(updatedLeads);
  renderLeads();
  setFeedback("CSV exportado y corte marcado localmente.", "success");
}

function prepareEmail() {
  const leads = getLeads();
  if (!leads.length) {
    setFeedback("No hay registros para enviar por correo.", "error");
    return;
  }

  const subject = encodeURIComponent(`RE+ Leads CSV ${getTimestampLabel()}`);
  const body = encodeURIComponent(
    [
      "Adjunto el corte de leads exportado desde la app de RE+.",
      "",
      "Importante: el navegador no puede adjuntar el CSV automaticamente.",
      "Primero usa 'Exportar CSV' o 'Exportar y marcar corte' y luego adjunta el archivo manualmente.",
      "",
      `Total de leads en este corte: ${leads.length}`
    ].join("\n")
  );

  window.location.href = `mailto:mcalderon@vmsenergy.com?subject=${subject}&body=${body}`;
  setFeedback("Se abrio el cliente de correo. Solo falta adjuntar el CSV exportado.", "success");
}

function clearSentLeads() {
  const remaining = getLeads().filter((lead) => lead.syncStatus !== "sent");
  setLeads(remaining);
  renderLeads();
  setFeedback("Se limpiaron los registros ya enviados.", "success");
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "Sin definir";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  return value || "Sin definir";
}

function renderReviewSection(title, items) {
  return `
    <section class="review-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="review-list">
        ${items.map((item) => `
          <div class="review-item">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(formatValue(item.value))}</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function openReviewDialog(lead) {
  reviewContent.innerHTML = [
    renderReviewSection("Datos generales", [
      { label: "Nombre del contacto", value: lead.nombreContacto },
      { label: "Empresa", value: lead.empresa },
      { label: "Pais / Ciudad", value: lead.paisCiudad },
      { label: "Industria", value: lead.industria },
      { label: "Cargo", value: lead.cargoContacto },
      { label: "Email", value: lead.email },
      { label: "Telefono", value: lead.telefono },
      { label: "Asesor / Equipo", value: lead.asesorEquipo }
    ]),
    renderReviewSection("Perfil energetico", [
      { label: "Consumo mensual", value: lead.consumoMensual ? `${lead.consumoMensual} kWh` : "" },
      { label: "Demanda maxima", value: lead.demandaMaxima ? `${lead.demandaMaxima} kW` : "" },
      { label: "Nivel de tension", value: lead.nivelTension },
      { label: "Penalizaciones por demanda", value: lead.penalizacionesDemanda }
    ]),
    renderReviewSection("Infraestructura e interes", [
      { label: "Planta solar", value: lead.plantaSolar },
      { label: "Respaldo", value: lead.respaldo },
      { label: "Interes principal", value: lead.interesPrincipal },
      { label: "Horizonte de proyecto", value: lead.horizonteProyecto }
    ]),
    renderReviewSection("Servicios y CTA", [
      { label: "Servicios de interes", value: lead.serviciosInteres },
      { label: "Evaluacion tecnica Solar + BESS", value: lead.ctaEvaluacion },
      { label: "Notas", value: lead.notas }
    ])
  ].join("");

  reviewDialog.showModal();
}

async function persistLead(lead) {
  const leads = getLeads();
  leads.push(lead);
  setLeads(leads);
  renderLeads();
  form.reset();
  businessCardInput.value = "";
  await updateBusinessCardPreview(null);
  leadDraft = null;
  form.elements.namedItem("ctaEvaluacion").checked = true;
  serviceGroups.forEach((group, index) => {
    group.open = index === 0;
    group.classList.remove("is-hidden");
  });
  serviceSearch.value = "";
  setFeedback("Lead guardado localmente. No se pierde aunque falle la red.", "success");

  if (navigator.onLine && WEBHOOK_URL) {
    await syncPendingLeads();
  }
}

function filterServiceGroups() {
  const query = serviceSearch.value.trim().toLowerCase();

  serviceGroups.forEach((group) => {
    const text = group.textContent.toLowerCase();
    const matches = !query || text.includes(query);
    group.classList.toggle("is-hidden", !matches);
    if (query && matches) {
      group.open = true;
    }
  });
}

businessCardInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  try {
    await updateBusinessCardPreview(file);
  } catch {
    setCardFeedback("No pude preparar la vista previa de esa imagen.", "error");
  }
});

scanCardButton.addEventListener("click", scanBusinessCard);
applyOcrButton.addEventListener("click", applyOcrProposal);
toggleOcrTextButton.addEventListener("click", () => {
  setOcrDebugVisibility(ocrDebugContent.hidden);
});
ocrProposalInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const toggle = ocrProposalToggles.find((item) => item.dataset.ocrToggle === input.dataset.ocrField);
    if (toggle) {
      toggle.disabled = !input.value.trim();
      toggle.checked = Boolean(input.value.trim());
    }
    applyOcrButton.disabled = !ocrProposalInputs.some((field) => field.value.trim());
  });
});
setOcrDebugVisibility(false);
form.addEventListener("reset", () => {
  window.setTimeout(() => {
    businessCardInput.value = "";
    updateBusinessCardPreview(null).catch(() => {});
  }, 0);
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  leadDraft = getFormValues(form);
  openReviewDialog(leadDraft);
});

syncButton.addEventListener("click", syncPendingLeads);
exportButton.addEventListener("click", exportCsv);
exportCutButton.addEventListener("click", exportAndMarkCut);
emailButton.addEventListener("click", prepareEmail);
clearButton.addEventListener("click", clearSentLeads);
serviceSearch.addEventListener("input", filterServiceGroups);
expandServicesButton.addEventListener("click", () => {
  serviceGroups.forEach((group) => {
    group.classList.remove("is-hidden");
    group.open = true;
  });
});
collapseServicesButton.addEventListener("click", () => {
  serviceGroups.forEach((group) => {
    group.classList.remove("is-hidden");
    group.open = false;
  });
});
closeReviewButton.addEventListener("click", () => reviewDialog.close());
editReviewButton.addEventListener("click", () => reviewDialog.close());
confirmSaveButton.addEventListener("click", async () => {
  if (!leadDraft) {
    reviewDialog.close();
    return;
  }

  reviewDialog.close();
  await persistLead(leadDraft);
});
window.addEventListener("online", () => {
  updateNetworkStatus();
  syncPendingLeads();
});
window.addEventListener("offline", updateNetworkStatus);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      setFeedback("No se pudo registrar el modo instalable offline.", "error");
    });
  });
}

updateNetworkStatus();
renderLeads();
