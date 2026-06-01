import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const railwayDataPath = "/data";
const railwayDataPathExists = existsSync(railwayDataPath);
const configuredFrameLabDataDir = absoluteDataRoot(process.env.FRAME_LAB_DATA_DIR);
const configuredRailwayVolumeMountPath = absoluteDataRoot(process.env.RAILWAY_VOLUME_MOUNT_PATH);
const dataDirWarnings = [
  dataRootWarning("FRAME_LAB_DATA_DIR", process.env.FRAME_LAB_DATA_DIR),
  dataRootWarning("RAILWAY_VOLUME_MOUNT_PATH", process.env.RAILWAY_VOLUME_MOUNT_PATH)
].filter(Boolean);
const persistentDataRoot = configuredFrameLabDataDir || configuredRailwayVolumeMountPath || (railwayDataPathExists ? railwayDataPath : "");
const dataDirSource = configuredFrameLabDataDir
  ? "FRAME_LAB_DATA_DIR"
  : configuredRailwayVolumeMountPath
    ? "RAILWAY_VOLUME_MOUNT_PATH"
    : railwayDataPathExists
      ? railwayDataPath
      : "";
const dataDir = persistentDataRoot ? persistentDataRoot : join(root, "data");
const dbPath = join(dataDir, "frame-lab-db.json");
const port = Number(process.env.PORT || 4173);
const adminEmails = new Set(
  (process.env.FRAME_LAB_ADMIN_EMAILS || "s.nyderek@proton.me")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".3mf": "model/3mf",
  ".stl": "model/stl",
  ".step": "model/step",
  ".stp": "model/step"
};

function absoluteDataRoot(value) {
  const trimmed = String(value || "").trim();
  return trimmed && isAbsolute(trimmed) ? trimmed : "";
}

function dataRootWarning(name, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || isAbsolute(trimmed)) return "";
  return `${name} is set to "${trimmed}", but Railway volumes need an absolute path. Ignoring it and using ${railwayDataPath} when available.`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const planProductIds = ["personal_lifetime", "commercial_lifetime", "personal_year", "commercial_year", "supporter", "ultra_support"];
const accessPlanIds = ["free", "basic", "pro", "studio"];

const defaultContentSettings = {
  makerWorldUrl: "",
  plans: [
    {
      plan: "personal_lifetime",
      access: "basic",
      name: "Lifetime Personal",
      price: "$99",
      period: "one-time",
      exports: "Lifetime Creator access",
      description: "Personal use license for your own frames and fit experiments.",
      benefits: ["Lifetime access to the Creator", "Personal use for your own printed frames"]
    },
    {
      plan: "commercial_lifetime",
      access: "pro",
      name: "Lifetime Commercial",
      price: "$199",
      period: "one-time",
      exports: "Lifetime commercial Creator access",
      description: "Commercial use license for paid work, products and client projects.",
      benefits: ["Lifetime access to the Creator", "Commercial use for exported frame designs"]
    },
    {
      plan: "personal_year",
      access: "basic",
      name: "Personal Year",
      price: "$25",
      period: "/ year",
      exports: "One-year Creator access",
      description: "Personal Creator access for one year.",
      benefits: ["Creator access for personal projects", "Export production files for your own prints", "One-year access activated by code"]
    },
    {
      plan: "commercial_year",
      access: "pro",
      name: "Commercial Year",
      price: "$49",
      period: "/ year",
      exports: "One-year commercial Creator access",
      description: "Commercial Creator access for one year.",
      benefits: ["Creator access for client and product work", "Commercial use for exported frame designs", "One-year access activated by code"]
    },
    {
      plan: "supporter",
      access: "free",
      name: "Supporter",
      price: "$10",
      period: "one-time support",
      exports: "No Creator access included",
      description: "Support Frame Lab development without plan benefits.",
      benefits: []
    },
    {
      plan: "ultra_support",
      access: "studio",
      name: "Ultra Support",
      price: "$999",
      period: "lifetime",
      exports: "Lifetime commercial Creator access",
      description: "Top supporter tier with lifetime commercial use.",
      benefits: ["Lifetime commercial Creator access", "Unlimited creator exports", "Top supporter tier for Frame Lab"]
    }
  ],
  sizes: {
    heading: "Sizes",
    intro: "Pick the size from your face width, nose bridge and preferred temple length. The recommendation is a starting point for 3D printed test fits.",
    rows: [
      { size: "S", label: "Narrow", headMin: 125, headMax: 137, frameWidth: "126-134 mm", lensWidth: "49-52 mm", bridgeMin: 14, bridgeMax: 17, templeMin: 130, templeMax: 140, note: "Slim faces and smaller nose bridges." },
      { size: "M", label: "Regular", headMin: 138, headMax: 149, frameWidth: "135-144 mm", lensWidth: "52-55 mm", bridgeMin: 17, bridgeMax: 20, templeMin: 140, templeMax: 150, note: "Most adult fits and balanced sunglasses proportions." },
      { size: "L", label: "Wide", headMin: 150, headMax: 162, frameWidth: "145-155 mm", lensWidth: "55-59 mm", bridgeMin: 20, bridgeMax: 23, templeMin: 150, templeMax: 160, note: "Wider heads, stronger wrap and longer temples." }
    ]
  },
  printGuide: {
    heading: "How to print it",
    intro: "Use any stiff filament for the frame. For lenses, cut the exported lens template from 1 mm clear acrylic, or print lens inserts with honeycomb infill and 0 top and bottom shell layers.",
    image: "./assets/print-guide-honeycomb.svg"
  },
  roadmap: {
    heading: "Roadmap",
    items: [
      { title: "Crowdfunding release", status: "Next", description: "Backer codes, stable exports and first production-ready sunglasses." },
      { title: "Lens library", status: "Planned", description: "Printable lens placeholders and templates for cutting transparent sheet lenses." },
      { title: "Fit calibration", status: "Planned", description: "Guided measurements with size recommendations stored in each account." }
    ]
  },
  license: {
    heading: "License",
    body: "Backer access codes unlock downloads according to the selected tier. Personal use is included by default; commercial use can be reserved for a higher tier if needed."
  },
  faq: {
    heading: "FAQ",
    items: [
      { question: "Can I configure before I unlock a plan?", answer: "Yes. All frames can be configured first; downloads unlock after activating a code." },
      { question: "What files do I receive?", answer: "The export is a clean 3MF production file for the selected front, temples, lenses and colors." },
      { question: "How should I make the lenses?", answer: "Use the lens template to cut 1 mm clear acrylic, or print honeycomb lens inserts for a printed texture effect." }
    ]
  }
};

const defaultBrandSettings = {
  accentColor: "#c96b34",
  backgroundColor: "#0c0d0d",
  surfaceColor: "#141616",
  textColor: "#f1eee9",
  mutedColor: "#9a9690",
  borderColor: "#292c2c",
  sceneColor: "#070909",
  heroTitle: "Your next frame is 3D printed.",
  heroText: "Choose a collection, combine a front with temples, and prepare a clean production kit for additive manufacturing.",
  heroImage: "",
  heroModelId: "",
  publishingEnabled: false,
  content: cloneJson(defaultContentSettings)
};
const maxRequestBodySize = 80_000_000;
const maxComponentFileDataSize = 60_000_000;
const planRank = { free: 0, basic: 1, pro: 2, studio: 3 };
const monthlyDownloadLimits = { free: 0, basic: 15, pro: 50, studio: null };
const licenseCodeTypes = {
  personal_year: { label: "Personal Year", plan: "basic", duration: "year" },
  commercial_year: { label: "Commercial Year", plan: "pro", duration: "year" },
  personal_lifetime: { label: "Lifetime Personal", plan: "basic", duration: "lifetime" },
  commercial_lifetime: { label: "Lifetime Commercial", plan: "pro", duration: "lifetime" },
  ultra_support: { label: "Ultra Support / lifetime commercial", plan: "studio", duration: "lifetime" },
  basic_month: { label: "Legacy Basic / 1 month", plan: "basic", duration: "month" },
  pro_month: { label: "Legacy Pro / 1 month", plan: "pro", duration: "month" },
  plus_month: { label: "Legacy Plus / 1 month", plan: "studio", duration: "month" },
  basic_year: { label: "Legacy Basic / 1 year", plan: "basic", duration: "year" },
  pro_year: { label: "Legacy Pro / 1 year", plan: "pro", duration: "year" },
  plus_year: { label: "Legacy Plus / 1 year", plan: "studio", duration: "year" },
  basic_lifetime: { label: "Legacy Basic / lifetime", plan: "basic", duration: "lifetime" },
  pro_lifetime: { label: "Legacy Pro / lifetime", plan: "pro", duration: "lifetime" },
  plus_lifetime: { label: "Legacy Plus / lifetime", plan: "studio", duration: "lifetime" }
};
const staticLicenseCodes = [
  { id: "static-personal-year", code: "3184-1815-3029", type: "personal_year", label: "Personal Year reusable code" },
  { id: "static-commercial-year", code: "6752-1850-6811", type: "commercial_year", label: "Commercial Year reusable code" },
  { id: "static-personal-lifetime", code: "1847-2294-6103", type: "personal_lifetime", label: "Lifetime Personal reusable code" },
  { id: "static-commercial-lifetime", code: "5729-6041-8832", type: "commercial_lifetime", label: "Lifetime Commercial reusable code" },
  { id: "static-ultra-support", code: "9364-1558-2706", type: "ultra_support", label: "Ultra Support reusable code" }
];

function defaultDb() {
  return { users: [], sessions: [], collections: [], components: [], downloads: [], licenseCodes: [], designSubmissions: [], settings: { ...defaultBrandSettings } };
}

function sanitizeHexColor(value, fallback) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function sanitizeAccentColor(value, fallback = defaultBrandSettings.accentColor) {
  return sanitizeHexColor(value, fallback);
}

function cleanText(value, fallback = "", limit = 500) {
  const text = String(value ?? fallback).trim();
  return (text || fallback).slice(0, limit);
}

function sanitizeExternalUrl(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href.slice(0, 600) : fallback;
  } catch {
    return fallback;
  }
}

function sanitizePlanBenefits(value, fallback = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split("\n");
  const fallbackList = Array.isArray(fallback) ? fallback : [];
  const benefits = source
    .map((item) => cleanText(item, "", 120))
    .filter(Boolean)
    .slice(0, 6);
  return benefits.length ? benefits : fallbackList.slice(0, 6);
}

function sanitizeContentImage(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const image = String(value || "").trim();
  if (!image) return "";
  if ((image.startsWith("data:image/") || image.startsWith("./assets/")) && image.length < 5_000_000) return image;
  return fallback;
}

function cleanPrintGuideIntro(value, fallback) {
  const intro = cleanText(value, fallback, 500);
  return /^Use PETG, PA-CF or a tough PLA blend/i.test(intro) ? fallback : intro;
}

function sanitizePlanContent(item = {}, fallback = {}) {
  const plan = planProductIds.includes(item.plan) ? item.plan : fallback.plan;
  const access = accessPlanIds.includes(item.access) ? item.access : fallback.access;
  return {
    plan,
    access,
    name: cleanText(item.name, fallback.name, 40),
    price: cleanText(item.price, fallback.price, 24),
    period: cleanText(item.period, fallback.period, 32),
    exports: cleanText(item.exports, fallback.exports, 90),
    description: cleanText(item.description, fallback.description, 180),
    benefits: plan === "supporter" ? [] : sanitizePlanBenefits(item.benefits, fallback.benefits)
  };
}

function sanitizeSizeRow(row = {}, fallback = {}) {
  const numberValue = (value, defaultValue, min = 0, max = 300) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return defaultValue;
    return Math.min(max, Math.max(min, Math.round(numeric)));
  };
  return {
    size: ["S", "M", "L"].includes(row.size) ? row.size : fallback.size,
    label: cleanText(row.label, fallback.label, 48),
    headMin: numberValue(row.headMin, fallback.headMin, 90, 220),
    headMax: numberValue(row.headMax, fallback.headMax, 90, 220),
    frameWidth: cleanText(row.frameWidth, fallback.frameWidth, 48),
    lensWidth: cleanText(row.lensWidth, fallback.lensWidth, 48),
    bridgeMin: numberValue(row.bridgeMin, fallback.bridgeMin, 8, 34),
    bridgeMax: numberValue(row.bridgeMax, fallback.bridgeMax, 8, 34),
    templeMin: numberValue(row.templeMin, fallback.templeMin, 100, 190),
    templeMax: numberValue(row.templeMax, fallback.templeMax, 100, 190),
    note: cleanText(row.note, fallback.note, 160)
  };
}

function sanitizeFaqItem(item = {}, fallback = {}) {
  const question = cleanText(item.question, fallback.question || "Question", 120);
  const answer = cleanText(item.answer, fallback.answer || "", 360);
  const developerOnlyCopy = /developer tools|add new fronts|frame variants/i.test(`${question} ${answer}`);
  return developerOnlyCopy
    ? {
        question: fallback.question || defaultContentSettings.faq.items[2].question,
        answer: fallback.answer || defaultContentSettings.faq.items[2].answer
      }
    : { question, answer };
}

function sanitizeContentSettings(content = {}) {
  const defaults = cloneJson(defaultContentSettings);
  const planById = new Map((Array.isArray(content.plans) ? content.plans : []).map((item) => [item.plan, item]));
  const sizeById = new Map((Array.isArray(content.sizes?.rows) ? content.sizes.rows : []).map((item) => [item.size, item]));
  return {
    makerWorldUrl: sanitizeExternalUrl(content.makerWorldUrl, defaults.makerWorldUrl),
    plans: defaults.plans.map((fallback) => sanitizePlanContent(planById.get(fallback.plan), fallback)),
    sizes: {
      heading: cleanText(content.sizes?.heading, defaults.sizes.heading, 80),
      intro: cleanText(content.sizes?.intro, defaults.sizes.intro, 320),
      rows: defaults.sizes.rows.map((fallback) => sanitizeSizeRow(sizeById.get(fallback.size), fallback))
    },
    printGuide: {
      heading: cleanText(content.printGuide?.heading, defaults.printGuide.heading, 80),
      intro: cleanPrintGuideIntro(content.printGuide?.intro, defaults.printGuide.intro),
      image: sanitizeContentImage(content.printGuide?.image, defaults.printGuide.image)
    },
    roadmap: {
      heading: cleanText(content.roadmap?.heading, defaults.roadmap.heading, 80),
      items: (Array.isArray(content.roadmap?.items) ? content.roadmap.items : defaults.roadmap.items)
        .slice(0, 8)
        .map((item, index) => ({
          title: cleanText(item.title, defaults.roadmap.items[index]?.title || "Roadmap item", 90),
          status: cleanText(item.status, defaults.roadmap.items[index]?.status || "Planned", 40),
          description: cleanText(item.description, defaults.roadmap.items[index]?.description || "", 220)
        }))
    },
    license: {
      heading: cleanText(content.license?.heading, defaults.license.heading, 80),
      body: cleanText(content.license?.body, defaults.license.body, 800)
    },
    faq: {
      heading: cleanText(content.faq?.heading, defaults.faq.heading, 80),
      items: (Array.isArray(content.faq?.items) ? content.faq.items : defaults.faq.items)
        .slice(0, 10)
        .map((item, index) => sanitizeFaqItem(item, defaults.faq.items[index] || defaults.faq.items[2]))
    }
  };
}

function sanitizeSettings(settings = {}) {
  const heroImage = typeof settings.heroImage === "string" && settings.heroImage.startsWith("data:image/")
    ? settings.heroImage.slice(0, 8_000_000)
    : "";
  return {
    accentColor: sanitizeAccentColor(settings.accentColor),
    backgroundColor: sanitizeHexColor(settings.backgroundColor, defaultBrandSettings.backgroundColor),
    surfaceColor: sanitizeHexColor(settings.surfaceColor, defaultBrandSettings.surfaceColor),
    textColor: sanitizeHexColor(settings.textColor, defaultBrandSettings.textColor),
    mutedColor: sanitizeHexColor(settings.mutedColor, defaultBrandSettings.mutedColor),
    borderColor: sanitizeHexColor(settings.borderColor, defaultBrandSettings.borderColor),
    sceneColor: sanitizeHexColor(settings.sceneColor, defaultBrandSettings.sceneColor),
    heroTitle: String(settings.heroTitle || defaultBrandSettings.heroTitle).trim().slice(0, 120) || defaultBrandSettings.heroTitle,
    heroText: String(settings.heroText || defaultBrandSettings.heroText).trim().slice(0, 320) || defaultBrandSettings.heroText,
    heroImage,
    heroModelId: String(settings.heroModelId || "").trim().slice(0, 120),
    publishingEnabled: settings.publishingEnabled === true,
    content: sanitizeContentSettings(settings.content)
  };
}

function sanitizeMeasurements(measurements = {}) {
  const numeric = (value, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : null;
  };
  return {
    headWidth: numeric(measurements.headWidth, 90, 220),
    bridgeWidth: numeric(measurements.bridgeWidth, 8, 34),
    templeLength: numeric(measurements.templeLength, 100, 190),
    updatedAt: measurements.updatedAt || null
  };
}

function storageStatus() {
  const persistent = Boolean(persistentDataRoot);
  const message = persistent
    ? "Persistent data directory is configured."
    : "Persistent data directory is not configured, so accounts and settings can reset after each deploy.";
  return {
    persistent,
    source: dataDirSource || "application filesystem",
    message: dataDirWarnings.length ? `${message} ${dataDirWarnings.join(" ")}` : message,
    warnings: dataDirWarnings
  };
}

function storageDebug(db) {
  let file = {
    exists: false,
    bytes: 0,
    updatedAt: null
  };
  try {
    const stat = statSync(dbPath);
    file = {
      exists: true,
      bytes: stat.size,
      updatedAt: stat.mtime.toISOString()
    };
  } catch {
    file = {
      exists: false,
      bytes: 0,
      updatedAt: null
    };
  }

  return {
    storage: storageStatus(),
    dataDir,
    dbPath,
    file,
    counts: {
      users: Array.isArray(db.users) ? db.users.length : 0,
      sessions: Array.isArray(db.sessions) ? db.sessions.length : 0,
      collections: Array.isArray(db.collections) ? db.collections.length : 0,
      components: Array.isArray(db.components) ? db.components.length : 0,
      downloads: Array.isArray(db.downloads) ? db.downloads.length : 0,
      licenseCodes: Array.isArray(db.licenseCodes) ? db.licenseCodes.length : 0,
      designSubmissions: Array.isArray(db.designSubmissions) ? db.designSubmissions.length : 0
    }
  };
}

function readDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify(defaultDb(), null, 2));
  try {
    const parsed = JSON.parse(readFileSync(dbPath, "utf8"));
    return { ...defaultDb(), ...parsed, settings: sanitizeSettings(parsed.settings) };
  } catch {
    return defaultDb();
  }
}

function writeDb(db) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const safeDb = { ...defaultDb(), ...db, settings: sanitizeSettings(db.settings) };
  const tmpPath = `${dbPath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(safeDb, null, 2));
  renameSync(tmpPath, dbPath);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendHtml(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxRequestBodySize) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) return false;
  const candidate = Buffer.from(passwordHash(password, salt).split(":")[1], "hex");
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    role: user.role,
    plan: normalizePlan(user.plan),
    subscriptionStatus: user.subscriptionStatus || "none",
    subscriptionMode: user.subscriptionMode || "free",
    planEndsAt: user.planEndsAt || null,
    measurements: sanitizeMeasurements(user.measurements || {}),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function createSession(db, userId) {
  const token = randomBytes(32).toString("hex");
  db.sessions = db.sessions.filter((session) => session.userId !== userId);
  db.sessions.push({ tokenHash: createHash("sha256").update(token).digest("hex"), userId, createdAt: new Date().toISOString() });
  return token;
}

function currentUser(req, db) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = db.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function userRole(email) {
  return adminEmails.has(String(email).toLowerCase()) ? "developer" : "customer";
}

function planForUser(email, requested = "free") {
  if (adminEmails.has(String(email).toLowerCase())) return "studio";
  return Object.prototype.hasOwnProperty.call(planRank, requested) ? requested : "free";
}

function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return host ? `${proto}://${host}` : `http://localhost:${port}`;
}

function googleRedirectUri(req) {
  return String(process.env.GOOGLE_REDIRECT_URI || "").trim() || `${requestOrigin(req)}/api/auth/oauth/google/callback`;
}

function oauthStateSecret() {
  return String(process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || "frame-lab-dev-oauth-state");
}

function signOauthState(body) {
  return createHmac("sha256", oauthStateSecret()).update(body).digest("base64url");
}

function createOauthState(provider) {
  const body = Buffer.from(JSON.stringify({
    provider,
    createdAt: Date.now(),
    nonce: randomBytes(12).toString("hex")
  })).toString("base64url");
  return `${body}.${signOauthState(body)}`;
}

function verifyOauthState(state, provider) {
  const [body, signature] = String(state || "").split(".");
  if (!body || !signature) return false;
  const expected = signOauthState(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.provider === provider && Date.now() - Number(payload.createdAt) < 10 * 60 * 1000;
  } catch {
    return false;
  }
}

function googleOauthConfig(req) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  return {
    clientId,
    clientSecret,
    redirectUri: googleRedirectUri(req),
    configured: Boolean(clientId && clientSecret)
  };
}

async function exchangeGoogleCode(code, config) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.error || "Google token exchange failed.");
  return payload;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.error || "Could not read Google profile.");
  return payload;
}

function namePartsFromGoogleProfile(profile) {
  const fullName = String(profile.name || "").trim();
  return {
    firstName: String(profile.given_name || fullName.split(/\s+/)[0] || "Frame").trim().slice(0, 80),
    lastName: String(profile.family_name || fullName.split(/\s+/).slice(1).join(" ") || "Lab").trim().slice(0, 80)
  };
}

function upsertGoogleUser(db, profile) {
  const email = String(profile.email || "").trim().toLowerCase();
  if (!email) throw new Error("Google account did not return an email address.");
  if (profile.email_verified === false || profile.email_verified === "false") throw new Error("Google email is not verified.");
  const names = namePartsFromGoogleProfile(profile);
  let user = db.users.find((item) => item.email === email);
  if (user) {
    user.googleSub = String(profile.sub || user.googleSub || "");
    user.authProviders = Array.from(new Set([...(Array.isArray(user.authProviders) ? user.authProviders : []), "google"]));
    user.firstName = user.firstName || names.firstName;
    user.lastName = user.lastName || names.lastName;
    user.role = userRole(email);
    user.plan = planForUser(email, user.plan);
    user.updatedAt = new Date().toISOString();
    return user;
  }
  user = {
    id: randomBytes(12).toString("hex"),
    email,
    firstName: names.firstName,
    lastName: names.lastName,
    passwordHash: "",
    googleSub: String(profile.sub || ""),
    authProviders: ["google"],
    role: userRole(email),
    plan: planForUser(email, "free"),
    subscriptionStatus: "none",
    subscriptionMode: "free",
    planEndsAt: null,
    measurements: sanitizeMeasurements({}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.users.push(user);
  return user;
}

function sendOauthSuccess(res, token) {
  sendHtml(res, 200, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Frame Lab login</title>
</head>
<body>
  <script>
    localStorage.setItem("framelab.sessionToken.v1", ${JSON.stringify(token)});
    window.location.replace("/");
  </script>
  <p>Signing you in to Frame Lab...</p>
</body>
</html>`);
}

function sendOauthError(res, message) {
  sendHtml(res, 400, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Frame Lab login failed</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, system-ui, sans-serif; background: #0c0d0d; color: #f1eee9; }
    main { width: min(32rem, calc(100vw - 2rem)); padding: 2rem; border: 1px solid #292c2c; border-radius: 12px; background: #141616; }
    a { color: #e96d25; }
  </style>
</head>
<body>
  <main>
    <h1>Google login failed</h1>
    <p>${escapeHtml(message)}</p>
    <a href="/">Back to Frame Lab</a>
  </main>
</body>
</html>`);
}

function normalizePlan(plan, fallback = "free") {
  return Object.prototype.hasOwnProperty.call(planRank, plan) ? plan : fallback;
}

function normalizeAccess(access) {
  return ["free", "basic", "pro", "studio"].includes(access) ? access : "free";
}

function planLabel(plan) {
  if (plan === "studio") return "Ultra Support";
  if (plan === "pro") return "Commercial";
  if (plan === "basic") return "Personal";
  return "No plan";
}

function downloadQuotaWindow(now = new Date()) {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

function downloadQuotaForUser(user, db, now = new Date()) {
  const plan = user?.role === "developer" ? "studio" : normalizePlan(user?.plan);
  const limit = user?.role === "developer" || Object.prototype.hasOwnProperty.call(monthlyDownloadLimits, plan)
    ? monthlyDownloadLimits[plan]
    : 0;
  const { start, end } = downloadQuotaWindow(now);
  const used = (db.downloads || []).filter((item) => {
    if (item.userId !== user.id) return false;
    const createdAt = new Date(item.createdAt);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end;
  }).length;
  return {
    plan,
    label: planLabel(plan),
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetAt: end.toISOString()
  };
}

function addOneMonth(date = new Date()) {
  return addMonths(date, 1);
}

function addOneYear(date = new Date()) {
  return addMonths(date, 12);
}

function addMonths(date = new Date(), months = 1) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}

function normalizeLicenseCode(code) {
  return String(code || "").replace(/\D/g, "").slice(0, 12);
}

function formatLicenseCode(code) {
  const digits = normalizeLicenseCode(code);
  return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)].filter(Boolean).join("-");
}

function generateLicenseCode(db, reserved = new Set()) {
  const staticCodes = staticLicenseCodes.map((item) => normalizeLicenseCode(item.code));
  const used = new Set([...(db.licenseCodes || []).map((item) => normalizeLicenseCode(item.code)), ...staticCodes, ...reserved]);
  let code = "";
  do {
    code = Array.from({ length: 12 }, () => randomInt(0, 10)).join("");
  } while (used.has(code));
  reserved.add(code);
  return formatLicenseCode(code);
}

function publicLicenseCode(item) {
  const type = licenseCodeTypes[item.type] ? item.type : "commercial_year";
  return {
    id: item.id,
    code: formatLicenseCode(item.code),
    type,
    label: licenseCodeTypes[type].label,
    plan: licenseCodeTypes[type].plan,
    duration: licenseCodeTypes[type].duration,
    status: item.status === "redeemed" ? "redeemed" : "active",
    createdAt: item.createdAt,
    redeemedAt: item.redeemedAt || null,
    redeemedByEmail: item.redeemedByEmail || ""
  };
}

function publicStaticLicenseCode(item) {
  const type = licenseCodeTypes[item.type] ? item.type : "ultra_support";
  return {
    id: item.id,
    code: formatLicenseCode(item.code),
    type,
    label: item.label || licenseCodeTypes[type].label,
    plan: licenseCodeTypes[type].plan,
    duration: licenseCodeTypes[type].duration,
    status: "reusable",
    reusable: true
  };
}

function scadNumberValue(source, key) {
  const match = String(source || "").match(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*(-?\\d*\\.?\\d+)\\s*;`));
  if (!match) return undefined;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : undefined;
}

function scadBooleanValue(source, key) {
  const match = String(source || "").match(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*(true|false)\\s*;`));
  return match ? match[1] === "true" : undefined;
}

function scadArrayValue(source, key) {
  return String(source || "").match(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`))?.[1] || "";
}

function boundedScadNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
}

function scadPointListValue(source, key, bounds, limit) {
  const [minX, maxX, minY, maxY] = bounds;
  return [...scadArrayValue(source, key).matchAll(/\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/g)]
    .slice(0, limit)
    .map((match) => [
      boundedScadNumber(match[1], minX, maxX),
      boundedScadNumber(match[2], minY, maxY)
    ])
    .filter(([x, y]) => x !== null && y !== null);
}

function scadNumberListValue(source, key, min, max, limit) {
  return [...scadArrayValue(source, key).matchAll(/-?\d*\.?\d+/g)]
    .slice(0, limit)
    .map((match) => boundedScadNumber(match[0], min, max))
    .filter((number) => number !== null);
}

function mergeScadConstructionHints(design = {}, scadSource = "") {
  const construction = { ...(design.construction || {}) };
  const numberFields = {
    lensSeatWidth: "lens_seat_width",
    lensSeatDepth: "lens_seat_depth",
    lensClearance: "lens_clearance",
    lensChannelOffset: "lens_channel_offset",
    hingeMountHeight: "hinge_mount_height",
    hingeMountOffset: "hinge_mount_offset",
    bridgeThickness: "bridge_thickness",
    bridgeTopJoinOffset: "bridge_top_join_offset",
    bridgeBottomJoinOffset: "bridge_bottom_join_offset",
    templeStraight: "temple_straight",
    templeHook: "temple_hook",
    templeHookAngle: "temple_hook_angle",
    templeBarHeight: "temple_bar_height",
    templeDepth: "temple_depth",
    templeCornerRadius: "temple_corner_radius",
    templeChamferAmount: "temple_chamfer_amount",
    templeTextureDepth: "temple_texture_depth",
    templePatternStart: "temple_pattern_start",
    templePatternEnd: "temple_pattern_end",
    templePatternSpacing: "temple_pattern_spacing",
    templePatternSize: "temple_pattern_size",
    templeTextSize: "temple_text_size",
    templeTextPosition: "temple_text_position",
    templeTextYOffset: "temple_text_y_offset",
    templeTextDepth: "temple_text_depth"
  };
  Object.entries(numberFields).forEach(([field, key]) => {
    const number = scadNumberValue(scadSource, key);
    if (number !== undefined) construction[field] = number;
  });
  const enabled = scadBooleanValue(scadSource, "temple_chamfer_enabled");
  if (enabled !== undefined) construction.templeChamferEnabled = enabled;
  const nextDesign = { ...design, construction };
  const sketchPoints = scadPointListValue(scadSource, "profile_points", [-0.7, 0.7, -0.7, 0.7], 20);
  if (sketchPoints.length >= 4) {
    const cornerRadii = scadNumberListValue(scadSource, "profile_corner_radii", 0, 16, sketchPoints.length);
    nextDesign.sketch = {
      ...(design.sketch || {}),
      points: sketchPoints,
      cornerRadii: cornerRadii.length ? cornerRadii : design.sketch?.cornerRadii
    };
  }
  const templePoints = scadPointListValue(scadSource, "temple_profile_points", [0, 150, -80, 20], 24);
  if (templePoints.length >= 4) {
    const cornerRadii = scadNumberListValue(scadSource, "temple_profile_corner_radii", 0, 12, templePoints.length);
    nextDesign.templeSketch = {
      ...(design.templeSketch || {}),
      points: templePoints,
      cornerRadii: cornerRadii.length ? cornerRadii : design.templeSketch?.cornerRadii
    };
  }
  return nextDesign;
}

function sanitizeCollection(model) {
  if (!model || typeof model !== "object") return null;
  const scadSource = String(model.scadSource || "").slice(0, 500_000);
  const design = model.design && typeof model.design === "object"
    ? sanitizeParametricDesign(mergeScadConstructionHints(model.design, scadSource))
    : null;
  return {
    id: String(model.id || randomBytes(8).toString("hex")),
    name: String(model.name || "Frame collection").slice(0, 120),
    category: model.category === "optical" ? "optical" : "sun",
    access: normalizeAccess(model.access),
    description: String(model.description || "").slice(0, 260),
    scadSource,
    params: model.params && typeof model.params === "object" ? model.params : {},
    design,
    lensMode: ["none", "component"].includes(model.lensMode) ? model.lensMode : "none",
    thumbnail: typeof model.thumbnail === "string" ? model.thumbnail : "",
    thumbnailSource: model.thumbnailSource === "custom" ? "custom" : (model.thumbnailSource === "creator" ? "creator" : ""),
    components: model.components && typeof model.components === "object" ? model.components : null,
    assembly: model.assembly && typeof model.assembly === "object" ? model.assembly : null,
    order: Number.isFinite(Number(model.order)) ? Number(model.order) : 0,
    createdAt: Number(model.createdAt) || Date.now(),
    updatedAt: Number(model.updatedAt) || Date.now()
  };
}

function sanitizeParametricDesign(style = {}) {
  const color = (key, fallback) => sanitizeHexColor(style[key], fallback);
  const boolean = (next, fallback = false) => {
    if (next === undefined || next === null) return fallback;
    if (typeof next === "string") {
      const normalized = next.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
      return fallback;
    }
    return Boolean(next);
  };
  const validParameterKeys = new Set([
    "head_width", "bridge_width", "lens_width", "lens_height", "rim_thickness",
    "temple_length", "temple_drop", "temple_spread"
  ]);
  const suppliedPoints = Array.isArray(style.sketch?.points) ? style.sketch.points : [];
  const sketchPoints = suppliedPoints.slice(0, 20).map((point) => {
    const x = Math.max(-0.7, Math.min(0.7, Number(Array.isArray(point) ? point[0] : point?.x) || 0));
    const y = Math.max(-0.7, Math.min(0.7, Number(Array.isArray(point) ? point[1] : point?.y) || 0));
    return [x, y];
  });
  const value = (next, min, max, fallback) => {
    const number = Number(next);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  const suppliedRadii = Array.isArray(style.sketch?.cornerRadii) ? style.sketch.cornerRadii : [];
  const defaultCornerRadii = [5, 2.5, 5, 4, 6, 6, 4, 5];
  const pointCount = sketchPoints.length >= 4 ? sketchPoints.length : defaultCornerRadii.length;
  const cornerRadii = Array.from({ length: pointCount }, (_, index) => value(
    suppliedRadii[index],
    0,
    16,
    pointCount === defaultCornerRadii.length ? defaultCornerRadii[index] : 0
  ));
  const sliderLimits = {
    head_width: [118, 172, 1],
    bridge_width: [12, 30, 0.5],
    lens_width: [40, 64, 0.5],
    lens_height: [28, 50, 0.5],
    rim_thickness: [2.5, 9, 0.1],
    temple_length: [70, 180, 1],
    temple_drop: [0, 42, 1],
    temple_spread: [0, 28, 0.5]
  };
  const sliderRanges = Object.fromEntries(Object.entries(sliderLimits).map(([key, [min, max, step]]) => {
    const source = style.sliderRanges?.[key] || {};
    const first = value(source.min, min, max, min);
    const second = value(source.max, min, max, max);
    return [key, { min: Math.min(first, second), max: Math.max(first, second), step }];
  }));
  const rawTemplePattern = String(style.templePattern || "");
  const templePattern = ["none", "ribs", "micro-ribs", "slots", "dots", "diamond", "wave"].includes(rawTemplePattern)
    ? rawTemplePattern
    : rawTemplePattern === "perforated" ? "diamond" : "none";
  const leftTempleText = cleanText(style.leftTempleText ?? style.templeText, "", 24);
  const rightTempleText = cleanText(style.rightTempleText ?? style.templeText, "", 24);
  const inferredTempleDetailMode = leftTempleText || rightTempleText
    ? "text"
    : templePattern !== "none" ? "texture" : "none";
  const templeDetailMode = ["none", "text", "texture"].includes(style.templeDetailMode)
    ? style.templeDetailMode
    : inferredTempleDetailMode;
  const construction = {
    hingeStandard: "FL-H1",
    lensThickness: 1,
    lensSeatWidth: value(style.construction?.lensSeatWidth, 1, 2, 1.2),
    lensSeatDepth: value(style.construction?.lensSeatDepth, 0.15, 1.2, 0.35),
    lensClearance: value(style.construction?.lensClearance, 0, 0.6, 0.2),
    lensChannelOffset: value(style.construction?.lensChannelOffset, -1, 1, 0),
    hingeMountHeight: value(style.construction?.hingeMountHeight, -12, 12, 10),
    hingeMountOffset: value(style.construction?.hingeMountOffset, -4, 0, 0),
    bridgeThickness: value(style.construction?.bridgeThickness, 3, 12, 6),
    bridgeTopJoinOffset: value(style.construction?.bridgeTopJoinOffset, -18, 18, 3),
    bridgeBottomJoinOffset: value(style.construction?.bridgeBottomJoinOffset, -18, 18, -3),
    templeStraight: value(style.construction?.templeStraight, 35, 120, 65),
    templeHook: value(style.construction?.templeHook, 10, 60, 30),
    templeHookAngle: value(style.construction?.templeHookAngle, 10, 75, 45),
    templeBarHeight: value(style.construction?.templeBarHeight, 3, 10, 5.4),
    templeDepth: value(style.construction?.templeDepth, 2.4, 6, 3.6),
    templeCornerRadius: value(style.construction?.templeCornerRadius, 0, 4, 1.4),
    templeChamferEnabled: boolean(style.construction?.templeChamferEnabled, false),
    templeChamferAmount: value(style.construction?.templeChamferAmount, 0, 1.2, 0.35),
    templeTextureDepth: value(style.construction?.templeTextureDepth, 0.2, 1.2, 0.45),
    templePatternStart: value(style.construction?.templePatternStart, 0, 110, 14),
    templePatternEnd: value(style.construction?.templePatternEnd, 8, 120, 76),
    templePatternSpacing: value(style.construction?.templePatternSpacing, 4, 28, 9),
    templePatternSize: value(style.construction?.templePatternSize, 0.5, 8, 4.2),
    templeTextSize: value(style.construction?.templeTextSize, 2, 8, 4),
    templeTextPosition: value(style.construction?.templeTextPosition, 0, 120, 36),
    templeTextYOffset: value(style.construction?.templeTextYOffset, -5, 5, 0),
    templeTextDepth: value(style.construction?.templeTextDepth, 0.15, 1.2, 0.45)
  };
  const templeFallback = (() => {
    const height = construction.templeBarHeight;
    const straight = construction.templeStraight;
    const hook = construction.templeHook;
    const angle = construction.templeHookAngle * Math.PI / 180;
    const tipX = straight + hook * Math.cos(angle);
    const tipY = -hook * Math.sin(angle);
    return {
      points: [
        [0, height / 2],
        [Math.max(2, straight - 3), height / 2],
        [straight, height / 2 - 0.35],
        [tipX, tipY + height / 2],
        [tipX, tipY - height / 2],
        [straight, -height / 2],
        [0, -height / 2]
      ],
      cornerRadii: [0.5, 1.3, 2, Math.min(2.2, height / 2), Math.min(2.2, height / 2), 1.6, 0.5]
    };
  })();
  const suppliedTemplePoints = Array.isArray(style.templeSketch?.points) ? style.templeSketch.points : templeFallback.points;
  const templePoints = suppliedTemplePoints.slice(0, 24).map((point) => {
    const x = value(Array.isArray(point) ? point[0] : point?.x, 0, 150, 0);
    const y = value(Array.isArray(point) ? point[1] : point?.y, -80, 20, 0);
    return [x, y];
  });
  const suppliedTempleRadii = Array.isArray(style.templeSketch?.cornerRadii)
    ? style.templeSketch.cornerRadii
    : templeFallback.cornerRadii;
  const templeCornerRadii = templePoints.map((_, index) => value(suppliedTempleRadii[index], 0, 12, templeFallback.cornerRadii[index] || 0));
  return {
    type: "parametric-openscad",
    lensShape: ["soft-square", "round", "sharp"].includes(style.lensShape) ? style.lensShape : "soft-square",
    templeDetailMode,
    templePattern,
    templeText: leftTempleText,
    leftTempleText,
    rightTempleText,
    browBar: false,
    frameColor: color("frameColor", "#ff741f"),
    templeColor: color("templeColor", color("frameColor", "#ff741f")),
    lensColor: color("lensColor", "#202529"),
    detailColor: color("detailColor", "#e59a62"),
    sketch: {
      symmetric: style.sketch?.symmetric !== false,
      points: sketchPoints.length >= 4 ? sketchPoints : [
        [-0.42, 0.5], [0.36, 0.5], [0.5, 0.34], [0.47, -0.3],
        [0.34, -0.5], [-0.38, -0.5], [-0.5, -0.3], [-0.5, 0.3]
      ],
      cornerRadii
    },
    templeSketch: templePoints.length >= 4
      ? { points: templePoints, cornerRadii: templeCornerRadii }
      : templeFallback,
    features: {
      extrude: {
        enabled: style.features?.extrude?.enabled !== false,
        depth: value(style.features?.extrude?.depth, 3, 12, 3)
      },
      fillet: {
        enabled: Boolean(style.features?.fillet?.enabled),
        radius: value(style.features?.fillet?.radius, 0, 2.4, 0.3)
      },
      chamfer: {
        enabled: Boolean(style.features?.chamfer?.enabled),
        amount: value(style.features?.chamfer?.amount, 0, 2.4, 0.4)
      },
      lensRecess: {
        enabled: style.features?.lensRecess?.enabled !== false,
        depth: value(style.features?.lensRecess?.depth, 0.1, 3, 0.35)
      }
    },
    construction,
    publicParameters: [...new Set(Array.isArray(style.publicParameters)
      ? style.publicParameters.filter((key) => validParameterKeys.has(key))
      : ["head_width", "bridge_width", "temple_length"])],
    sliderRanges
  };
}

function sanitizeDesignParams(params = {}) {
  const limits = {
    head_width: [118, 172],
    bridge_width: [12, 30],
    lens_width: [40, 64],
    lens_height: [28, 50],
    rim_thickness: [2.5, 9],
    frame_depth: [3, 12],
    temple_length: [70, 180],
    temple_drop: [0, 42],
    temple_spread: [0, 28],
    nose_pad_width: [3, 14],
    nose_pad_drop: [0, 18],
    hinge_width: [3, 16],
    corner_radius: [2, 14],
    bevel: [0, 2.4]
  };
  return Object.fromEntries(Object.entries(limits).map(([key, [min, max]]) => {
    const number = Number(params[key]);
    return [key, Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : undefined];
  }).filter(([, value]) => value !== undefined));
}

function sanitizeDesignThumbnail(value) {
  const thumbnail = String(value || "");
  return thumbnail.startsWith("data:image/") && thumbnail.length < 3_000_000 ? thumbnail : "";
}

function publicDesignSubmission(item, includeOwner = false) {
  const scadSource = String(item.scadSource || "").slice(0, 500_000);
  const result = {
    id: item.id,
    name: item.name,
    description: item.description,
    params: sanitizeDesignParams(item.params),
    design: sanitizeParametricDesign(mergeScadConstructionHints(item.design || {}, scadSource)),
    scadSource,
    thumbnail: item.thumbnail,
    status: ["pending", "approved", "rejected"].includes(item.status) ? item.status : "pending",
    collectionId: item.collectionId || "",
    createdAt: item.createdAt,
    reviewedAt: item.reviewedAt || null
  };
  if (includeOwner) {
    result.authorName = item.authorName || "";
    result.authorEmail = item.authorEmail || "";
  }
  return result;
}

function sanitizeDesignSubmission(body = {}, user) {
  const scadSource = String(body.scadSource || "").slice(0, 500_000);
  return {
    id: randomBytes(12).toString("hex"),
    userId: user.id,
    authorName: cleanText([user.firstName, user.lastName].filter(Boolean).join(" "), user.email, 120),
    authorEmail: user.email,
    name: cleanText(body.name, "Custom sunglasses", 120),
    description: cleanText(body.description, "", 260),
    params: sanitizeDesignParams(body.params),
    design: sanitizeParametricDesign(mergeScadConstructionHints(body.design || {}, scadSource)),
    scadSource,
    thumbnail: sanitizeDesignThumbnail(body.thumbnail),
    status: "pending",
    collectionId: "",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: ""
  };
}

function sanitizeComponentRecord(component, options = {}) {
  if (!component || typeof component !== "object") return null;
  const kind = ["front", "temple", "lens"].includes(component.kind) ? component.kind : "front";
  const formatRaw = String(component.format || "").toLowerCase();
  const format = formatRaw === "stp" ? "step" : (["3mf", "step"].includes(formatRaw) ? formatRaw : "3mf");
  const fileData = typeof component.fileData === "string" && component.fileData.startsWith("data:")
    ? component.fileData.slice(0, maxComponentFileDataSize)
    : "";
  const sanitized = {
    id: String(component.id || randomBytes(12).toString("hex")).slice(0, 120),
    name: String(component.name || component.fileName || "Frame Lab component").slice(0, 160),
    kind,
    templeSide: kind === "temple" && ["left", "right", "universal"].includes(component.templeSide) ? component.templeSide : "",
    size: ["S", "M", "L"].includes(component.size) ? component.size : "M",
    connector: String(component.connector || "FL-H8").slice(0, 80),
    format,
    fileName: String(component.fileName || `component.${format}`).slice(0, 180),
    byteSize: Math.max(0, Number(component.byteSize) || 0),
    collectionId: String(component.collectionId || "").slice(0, 120),
    source: "uploaded",
    analysis: component.analysis && typeof component.analysis === "object" ? component.analysis : null,
    materialColor: sanitizeAccentColor(component.materialColor || component.analysis?.materialColor || "", ""),
    createdAt: Number(component.createdAt) || Date.now()
  };
  if (options.includeFileData !== false) sanitized.fileData = fileData;
  return sanitized;
}

function sanitizeDownload(item, userId) {
  if (!item || typeof item !== "object") return null;
  const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
  return {
    id: String(item.id || randomBytes(12).toString("hex")),
    userId,
    fileName: String(item.fileName || "frame-lab-export.3mf").slice(0, 180),
    modelId: String(item.modelId || "").slice(0, 120),
    modelName: String(item.modelName || "Frame Lab model").slice(0, 140),
    plan: normalizeAccess(item.plan),
    lensMode: ["none", "component"].includes(item.lensMode) ? item.lensMode : "none",
    lensLabel: String(item.lensLabel || "No lenses").slice(0, 80),
    configuration: item.configuration && typeof item.configuration === "object" ? item.configuration : {},
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString()
  };
}

function applyLicenseCode(user, license) {
  const details = licenseCodeTypes[license.type];
  if (!details) return { error: "Unknown license code type." };
  if (user.role === "developer") {
    user.plan = "studio";
    user.subscriptionStatus = "admin";
    user.subscriptionMode = "admin";
    user.planEndsAt = null;
    user.updatedAt = new Date().toISOString();
    return { message: "Developer access is already unlimited.", consume: false };
  }

  const now = new Date();
  const currentEnds = user.planEndsAt ? new Date(user.planEndsAt) : null;
  const hasFutureAccess = currentEnds && !Number.isNaN(currentEnds.getTime()) && currentEnds > now;
  const hasLifetime = user.subscriptionStatus === "lifetime";
  if (hasLifetime && planRank[normalizePlan(user.plan)] >= planRank[details.plan]) {
    return { error: "This account already has equal or higher lifetime access." };
  }
  if (details.duration !== "lifetime" && planRank[normalizePlan(user.plan)] > planRank[details.plan] && (hasFutureAccess || hasLifetime)) {
    return { error: "This account already has a higher active plan." };
  }

  const previousPlan = user.plan;
  user.plan = details.plan;
  if (details.duration === "lifetime") {
    user.subscriptionMode = "license_lifetime";
    user.subscriptionStatus = "lifetime";
    user.planEndsAt = null;
  } else {
    const extensionBase = previousPlan === details.plan && hasFutureAccess ? currentEnds : now;
    user.subscriptionMode = details.duration === "year" ? "license_year" : "license_month";
    user.subscriptionStatus = "paid_once";
    user.planEndsAt = details.duration === "year" ? addOneYear(extensionBase) : addOneMonth(extensionBase);
  }
  user.updatedAt = new Date().toISOString();
  return { message: `${details.label} activated.`, consume: true };
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const db = readDb();

  if (req.method === "POST" && pathname === "/api/auth/email") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const mode = body.mode === "register" ? "register" : "login";
    const firstName = String(body.firstName || "").trim().slice(0, 80);
    const lastName = String(body.lastName || "").trim().slice(0, 80);
    if (!email || password.length < 6) return sendJson(res, 400, { error: "Email and a password with at least 6 characters are required." });
    let user = db.users.find((item) => item.email === email);
    if (user) {
      if (mode === "register") return sendJson(res, 409, { error: "This email already has an account. Use login instead." });
      if (!verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { error: "Incorrect password." });
      user.role = userRole(email);
      user.plan = planForUser(email, user.plan);
      user.updatedAt = new Date().toISOString();
    } else {
      if (mode !== "register") return sendJson(res, 404, { error: "Account not found. Create an account first." });
      if (!firstName || !lastName) return sendJson(res, 400, { error: "First and last name are required." });
      user = {
        id: randomBytes(12).toString("hex"),
        email,
        firstName,
        lastName,
        passwordHash: passwordHash(password),
        role: userRole(email),
        plan: planForUser(email, "free"),
        subscriptionStatus: "none",
        subscriptionMode: "free",
        planEndsAt: null,
        measurements: sanitizeMeasurements({}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.users.push(user);
    }
    const token = createSession(db, user.id);
    writeDb(db);
    return sendJson(res, 200, { token, user: publicUser(user) });
  }

  if (req.method === "GET" && pathname === "/api/session") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "No active session." });
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === "PUT" && pathname === "/api/account/measurements") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
    const body = await readBody(req);
    user.measurements = sanitizeMeasurements({ ...(body.measurements || body), updatedAt: new Date().toISOString() });
    user.updatedAt = new Date().toISOString();
    writeDb(db);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    return sendJson(res, 200, { settings: sanitizeSettings(db.settings) });
  }

  if (req.method === "PUT" && pathname === "/api/settings") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const body = await readBody(req);
    db.settings = sanitizeSettings(body.settings || body);
    writeDb(db);
    return sendJson(res, 200, { settings: db.settings, savedAt: new Date().toISOString() });
  }

  if (req.method === "GET" && pathname === "/api/collections") {
    return sendJson(res, 200, { collections: (db.collections || []).map(sanitizeCollection).filter(Boolean) });
  }

  if (req.method === "PUT" && pathname === "/api/collections") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const body = await readBody(req);
    const collections = Array.isArray(body.collections) ? body.collections : [];
    db.collections = collections.map(sanitizeCollection).filter(Boolean).slice(0, 100);
    writeDb(db);
    return sendJson(res, 200, { collections: db.collections, savedAt: new Date().toISOString() });
  }

  if (req.method === "POST" && pathname === "/api/design-submissions") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required to submit a design." });
    const settings = sanitizeSettings(db.settings);
    if (user.role !== "developer" && settings.publishingEnabled !== true) {
      return sendJson(res, 403, { error: "Publishing is coming soon." });
    }
    const body = await readBody(req);
    const submission = sanitizeDesignSubmission(body, user);
    if (!submission.scadSource.trim()) return sendJson(res, 400, { error: "OpenSCAD source is required." });
    db.designSubmissions = [submission, ...(db.designSubmissions || [])].slice(0, 1000);
    writeDb(db);
    return sendJson(res, 201, { submission: publicDesignSubmission(submission) });
  }

  if (req.method === "GET" && pathname === "/api/design-submissions/mine") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
    const submissions = (db.designSubmissions || [])
      .filter((item) => item.userId === user.id)
      .map((item) => publicDesignSubmission(item))
      .slice(0, 20);
    return sendJson(res, 200, { submissions });
  }

  if (req.method === "GET" && pathname === "/api/admin/design-submissions") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const submissions = (db.designSubmissions || [])
      .map((item) => publicDesignSubmission(item, true))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 250);
    return sendJson(res, 200, { submissions });
  }

  const reviewMatch = pathname.match(/^\/api\/admin\/design-submissions\/([^/]+)\/(approve|reject)$/);
  if (req.method === "POST" && reviewMatch) {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const submissionId = decodeURIComponent(reviewMatch[1]);
    const action = reviewMatch[2];
    const submission = (db.designSubmissions || []).find((item) => item.id === submissionId);
    if (!submission) return sendJson(res, 404, { error: "Design submission not found." });
    if (action === "reject") {
      submission.status = "rejected";
      submission.reviewedAt = new Date().toISOString();
      submission.reviewedBy = user.id;
      writeDb(db);
      return sendJson(res, 200, { submission: publicDesignSubmission(submission, true) });
    }
    const currentOrder = (db.collections || [])
      .filter((item) => item.category !== "optical")
      .reduce((max, item) => Math.max(max, Number(item.order) || 0), -1);
    const collection = sanitizeCollection({
      id: submission.collectionId || `design-${submission.id}`,
      name: submission.name,
      category: "sun",
      access: "basic",
      description: submission.description,
      scadSource: submission.scadSource,
      params: submission.params,
      design: submission.design,
      thumbnail: submission.thumbnail,
      thumbnailSource: "creator",
      components: null,
      assembly: null,
      order: currentOrder + 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    db.collections = [
      ...(db.collections || []).filter((item) => item.id !== collection.id),
      collection
    ];
    submission.status = "approved";
    submission.collectionId = collection.id;
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedBy = user.id;
    writeDb(db);
    return sendJson(res, 200, {
      submission: publicDesignSubmission(submission, true),
      collection
    });
  }

  if (req.method === "GET" && pathname === "/api/components") {
    const components = (db.components || [])
      .map((component) => sanitizeComponentRecord(component))
      .filter(Boolean);
    return sendJson(res, 200, { components });
  }

  if (req.method === "PUT" && pathname === "/api/components") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const body = await readBody(req);
    const incoming = Array.isArray(body.components) ? body.components : [body.component || body];
    const sanitized = incoming.map(sanitizeComponentRecord).filter(Boolean);
    if (!sanitized.length) return sendJson(res, 400, { error: "No component data received." });
    const byId = new Map((db.components || []).map((component) => [String(component.id), component]));
    sanitized.forEach((component) => byId.set(component.id, component));
    db.components = [...byId.values()].slice(-500);
    writeDb(db);
    return sendJson(res, 200, { components: sanitized, savedAt: new Date().toISOString() });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/components/")) {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    db.components = (db.components || []).filter((component) => String(component.id) !== id);
    writeDb(db);
    return sendJson(res, 200, { ok: true, id });
  }

  if (req.method === "GET" && pathname === "/api/downloads") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
    const downloads = (db.downloads || [])
      .filter((item) => item.userId === user.id)
      .map((item) => sanitizeDownload(item, user.id))
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 100);
    return sendJson(res, 200, { downloads });
  }

  if (req.method === "GET" && pathname === "/api/download-quota") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
    return sendJson(res, 200, { quota: downloadQuotaForUser(user, db) });
  }

  if (req.method === "POST" && pathname === "/api/downloads") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
    const quota = downloadQuotaForUser(user, db);
    if (quota.limit !== null && quota.remaining <= 0) {
      return sendJson(res, 402, {
        error: `${quota.label} monthly download limit reached. Upgrade your plan to continue exporting 3MF files.`,
        quota
      });
    }
    const body = await readBody(req);
    const download = sanitizeDownload({ ...body, createdAt: new Date().toISOString() }, user.id);
    const existing = db.downloads || [];
    const userDownloads = existing
      .filter((item) => item.userId === user.id && item.id !== download.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 199);
    const otherDownloads = existing.filter((item) => item.userId !== user.id);
    db.downloads = [download, ...userDownloads, ...otherDownloads].slice(0, 5000);
    writeDb(db);
    return sendJson(res, 200, { download, quota: downloadQuotaForUser(user, db) });
  }

  if (req.method === "GET" && pathname === "/api/license-codes") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const codes = (db.licenseCodes || [])
      .map(publicLicenseCode)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { codes });
  }

  if (req.method === "GET" && pathname === "/api/static-license-codes") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    return sendJson(res, 200, { codes: staticLicenseCodes.map(publicStaticLicenseCode) });
  }

  if (req.method === "POST" && pathname === "/api/license-codes") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const body = await readBody(req);
    const type = licenseCodeTypes[body.type] ? body.type : "commercial_year";
    const quantity = Math.min(50, Math.max(1, Number(body.quantity) || 1));
    const reserved = new Set();
    const created = Array.from({ length: quantity }, () => ({
      id: randomBytes(12).toString("hex"),
      code: generateLicenseCode(db, reserved),
      type,
      status: "active",
      createdBy: user.id,
      createdAt: new Date().toISOString()
    }));
    db.licenseCodes = [...created, ...(db.licenseCodes || [])].slice(0, 5000);
    writeDb(db);
    return sendJson(res, 200, { codes: created.map(publicLicenseCode) });
  }

  if (req.method === "POST" && pathname === "/api/license-codes/redeem") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
    const body = await readBody(req);
    const code = normalizeLicenseCode(body.code);
    if (code.length !== 12) return sendJson(res, 400, { error: "Enter a 12 digit activation code." });
    const staticLicense = staticLicenseCodes.find((item) => normalizeLicenseCode(item.code) === code);
    if (staticLicense) {
      const result = applyLicenseCode(user, staticLicense);
      if (result.error) return sendJson(res, 409, { error: result.error });
      writeDb(db);
      return sendJson(res, 200, {
        user: publicUser(user),
        code: publicStaticLicenseCode(staticLicense),
        message: result.message
      });
    }
    const license = (db.licenseCodes || []).find((item) => normalizeLicenseCode(item.code) === code);
    if (!license) return sendJson(res, 404, { error: "Activation code not found." });
    if (license.status === "redeemed") return sendJson(res, 409, { error: "This activation code has already been used." });
    const result = applyLicenseCode(user, license);
    if (result.error) return sendJson(res, 409, { error: result.error });
    if (result.consume !== false) {
      license.status = "redeemed";
      license.redeemedBy = user.id;
      license.redeemedByEmail = user.email;
      license.redeemedAt = new Date().toISOString();
    }
    writeDb(db);
    return sendJson(res, 200, { user: publicUser(user), code: publicLicenseCode(license), message: result.message });
  }

  if (req.method === "POST" && pathname === "/api/auth/sign-out") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.sessions = db.sessions.filter((session) => session.tokenHash !== tokenHash);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/system") {
    return sendJson(res, 200, { storage: storageStatus() });
  }

  if (req.method === "GET" && pathname === "/api/admin/storage-debug") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    return sendJson(res, 200, storageDebug(db));
  }

  if (req.method === "POST" && pathname === "/api/subscription/cancel") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
    if (user.role === "developer") return sendJson(res, 200, { user: publicUser(user), message: "Developer access cannot be cancelled." });
    if (user.subscriptionMode !== "subscription" || user.subscriptionStatus !== "active") {
      return sendJson(res, 400, { error: "There is no active subscription to cancel." });
    }
    user.subscriptionStatus = "cancel_at_period_end";
    user.planEndsAt = user.planEndsAt || addOneMonth();
    user.updatedAt = new Date().toISOString();
    writeDb(db);
    return sendJson(res, 200, { user: publicUser(user), message: "Subscription will end at the current period end." });
  }

  if (req.method === "GET" && pathname === "/api/auth/oauth/google") {
    const config = googleOauthConfig(req);
    if (!config.configured) {
      return sendJson(res, 501, {
        error: "Google OAuth credentials are not configured yet.",
        required: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        redirectUri: config.redirectUri
      });
    }
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: createOauthState("google"),
      prompt: "select_account"
    });
    return sendJson(res, 200, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, redirectUri: config.redirectUri });
  }

  if (req.method === "GET" && pathname === "/api/auth/oauth/google/callback") {
    const config = googleOauthConfig(req);
    if (!config.configured) return sendOauthError(res, "Google OAuth credentials are not configured.");
    if (url.searchParams.get("error")) return sendOauthError(res, url.searchParams.get("error_description") || url.searchParams.get("error"));
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !verifyOauthState(state, "google")) return sendOauthError(res, "Google returned an invalid login state. Try again.");
    try {
      const tokenPayload = await exchangeGoogleCode(code, config);
      const profile = await fetchGoogleProfile(tokenPayload.access_token);
      const user = upsertGoogleUser(db, profile);
      const sessionToken = createSession(db, user.id);
      writeDb(db);
      return sendOauthSuccess(res, sessionToken);
    } catch (error) {
      return sendOauthError(res, error.message || "Could not complete Google login.");
    }
  }

  if (req.method === "GET" && pathname.startsWith("/api/auth/oauth/")) {
    const provider = pathname.split("/").pop();
    return sendJson(res, 501, {
      error: `${provider} OAuth is not enabled for Frame Lab.`,
      required: provider === "google" ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] : []
    });
  }

  return sendJson(res, 404, { error: "Unknown API endpoint." });
}

function serveStatic(req, res, pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath === "/" ? "index.html" : safePath);
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=60"
  });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Frame Lab running at http://localhost:${port}/`);
  console.log(`Frame Lab data directory: ${dataDir} (${storageStatus().source})`);
});
