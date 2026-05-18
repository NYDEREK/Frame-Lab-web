import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataDir = join(root, "data");
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

function defaultDb() {
  return { users: [], sessions: [], payments: [], collections: [], downloads: [], licenseCodes: [] };
}

const planRank = { free: 0, pro: 1, studio: 2 };
const licenseCodeTypes = {
  pro_month: { label: "Pro / 1 month", plan: "pro", duration: "month" },
  plus_month: { label: "Plus / 1 month", plan: "studio", duration: "month" },
  pro_lifetime: { label: "Pro / lifetime", plan: "pro", duration: "lifetime" },
  plus_lifetime: { label: "Plus / lifetime", plan: "studio", duration: "lifetime" }
};

function readDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify(defaultDb(), null, 2));
  try {
    return { ...defaultDb(), ...JSON.parse(readFileSync(dbPath, "utf8")) };
  } catch {
    return defaultDb();
  }
}

function writeDb(db) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(dbPath, JSON.stringify(db, null, 2));
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000_000) {
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
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus || "none",
    subscriptionMode: user.subscriptionMode || "free",
    planEndsAt: user.planEndsAt || null,
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
  return ["free", "pro", "studio"].includes(requested) ? requested : "free";
}

function addOneMonth(date = new Date()) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
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
  const used = new Set([...(db.licenseCodes || []).map((item) => normalizeLicenseCode(item.code)), ...reserved]);
  let code = "";
  do {
    code = Array.from({ length: 12 }, () => randomInt(0, 10)).join("");
  } while (used.has(code));
  reserved.add(code);
  return formatLicenseCode(code);
}

function publicLicenseCode(item) {
  const type = licenseCodeTypes[item.type] ? item.type : "pro_month";
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

function sanitizeCollection(model) {
  if (!model || typeof model !== "object") return null;
  return {
    id: String(model.id || randomBytes(8).toString("hex")),
    name: String(model.name || "Frame collection").slice(0, 120),
    category: model.category === "optical" ? "optical" : "sun",
    access: ["free", "pro", "studio"].includes(model.access) ? model.access : "free",
    description: String(model.description || "").slice(0, 260),
    scadSource: String(model.scadSource || "").slice(0, 500_000),
    params: model.params && typeof model.params === "object" ? model.params : {},
    lensMode: ["open", "perforated", "cut-template"].includes(model.lensMode) ? model.lensMode : "cut-template",
    thumbnail: typeof model.thumbnail === "string" ? model.thumbnail : "",
    components: model.components && typeof model.components === "object" ? model.components : null,
    createdAt: Number(model.createdAt) || Date.now(),
    updatedAt: Number(model.updatedAt) || Date.now()
  };
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
    plan: ["free", "pro", "studio"].includes(item.plan) ? item.plan : "free",
    lensMode: ["open", "perforated", "cut-template"].includes(item.lensMode) ? item.lensMode : "cut-template",
    lensLabel: String(item.lensLabel || "Cut template").slice(0, 80),
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
  if (hasLifetime && planRank[user.plan] >= planRank[details.plan]) {
    return { error: "This account already has equal or higher lifetime access." };
  }
  if (details.duration === "month" && planRank[user.plan] > planRank[details.plan] && (hasFutureAccess || hasLifetime)) {
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
    user.subscriptionMode = "license_month";
    user.subscriptionStatus = "paid_once";
    user.planEndsAt = addOneMonth(extensionBase);
  }
  user.updatedAt = new Date().toISOString();
  return { message: `${details.label} activated.`, consume: true };
}

async function handleApi(req, res, pathname) {
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

  if (req.method === "POST" && pathname === "/api/downloads") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required." });
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
    return sendJson(res, 200, { download });
  }

  if (req.method === "GET" && pathname === "/api/license-codes") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const codes = (db.licenseCodes || [])
      .map(publicLicenseCode)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { codes });
  }

  if (req.method === "POST" && pathname === "/api/license-codes") {
    const user = currentUser(req, db);
    if (!user || user.role !== "developer") return sendJson(res, 403, { error: "Developer access is required." });
    const body = await readBody(req);
    const type = licenseCodeTypes[body.type] ? body.type : "pro_month";
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

  if (req.method === "POST" && pathname === "/api/checkout") {
    const user = currentUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Login is required before checkout." });
    const body = await readBody(req);
    const plan = body.plan === "studio" ? "studio" : body.plan === "pro" ? "pro" : "";
    const mode = body.mode === "one_time" ? "one_time" : "subscription";
    if (!plan) return sendJson(res, 400, { error: "Choose Pro or Plus." });
    if (user.role === "developer") {
      user.plan = "studio";
      user.subscriptionStatus = "admin";
      user.subscriptionMode = "admin";
      user.planEndsAt = null;
    } else {
      user.plan = plan;
      user.subscriptionMode = mode;
      user.subscriptionStatus = mode === "subscription" ? "active" : "paid_once";
      user.planEndsAt = addOneMonth();
    }
    user.updatedAt = new Date().toISOString();
    db.payments.push({ id: randomBytes(12).toString("hex"), userId: user.id, plan, mode, provider: "local-dev", createdAt: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 200, {
      user: publicUser(user),
      checkout: { provider: "local-dev", mode, message: "Local development checkout completed without charging a card." }
    });
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

  if (req.method === "GET" && pathname.startsWith("/api/auth/oauth/")) {
    const provider = pathname.split("/").pop();
    return sendJson(res, 501, {
      error: `${provider} OAuth is ready to wire, but provider credentials are not configured yet.`,
      required: provider === "apple"
        ? ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY_PATH"]
        : ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
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
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Frame Lab running at http://localhost:${port}/`);
});
