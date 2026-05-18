import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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
  return { users: [], sessions: [], payments: [] };
}

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
      if (body.length > 1_000_000) {
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

async function handleApi(req, res, pathname) {
  const db = readDb();

  if (req.method === "POST" && pathname === "/api/auth/email") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || password.length < 6) return sendJson(res, 400, { error: "Email and a password with at least 6 characters are required." });
    let user = db.users.find((item) => item.email === email);
    if (user) {
      if (!verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { error: "Incorrect password." });
      user.role = userRole(email);
      user.plan = planForUser(email, user.plan);
      user.updatedAt = new Date().toISOString();
    } else {
      user = {
        id: randomBytes(12).toString("hex"),
        email,
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
