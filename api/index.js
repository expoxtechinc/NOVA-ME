// server/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*key", async (req, res) => {
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join("/") : rawKey;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/learningNotesUpload.ts
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}

// server/learningNotesUpload.ts
var maxBytes = 10 * 1024 * 1024;
var allowedContentTypes = /* @__PURE__ */ new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown"
]);
function headerValue(value) {
  return Array.isArray(value) ? value[0] : value;
}
function safeFilename(value) {
  return decodeURIComponent(value).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "").slice(0, 120) || "learning-note";
}
function sessionClient(token) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NIU identity service is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: token } }
  });
}
var uploadLearningNote = async (req, res) => {
  try {
    const token = headerValue(req.headers["x-supabase-authorization"]);
    const lessonId = headerValue(req.headers["x-lesson-id"]);
    const encodedFilename = headerValue(req.headers["x-file-name"]);
    const contentType = (headerValue(req.headers["content-type"]) || "").split(";")[0].toLowerCase();
    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before uploading learning notes." });
    if (!z.string().uuid().safeParse(lessonId).success) return res.status(400).json({ error: "Choose a valid NIU lesson before uploading." });
    if (!encodedFilename || !allowedContentTypes.has(contentType)) return res.status(400).json({ error: "Upload a PDF, Word document, text, or Markdown learning note." });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Choose a non-empty learning-note file." });
    if (req.body.length > maxBytes) return res.status(413).json({ error: "Learning notes must be 10 MB or smaller." });
    const supabase = sessionClient(token);
    const { data: identity } = await supabase.auth.getUser();
    if (!identity.user) return res.status(401).json({ error: "Your NIU session is no longer valid." });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
    if (profileError || !profile || !["instructor", "administrator", "super_admin"].includes(profile.role)) return res.status(403).json({ error: "Academic staff authority is required to upload learning notes." });
    const { data: lesson, error: lessonError } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle();
    if (lessonError || !lesson) return res.status(403).json({ error: "You are not authorised to attach notes to this lesson." });
    const filename2 = safeFilename(encodedFilename);
    const { key } = await storagePut(`niu-learning-notes/${lessonId}/${filename2}`, req.body, contentType);
    const { error: updateError } = await supabase.from("lessons").update({ media_path: key }).eq("id", lessonId);
    if (updateError) return res.status(403).json({ error: "The note was stored but could not be attached to this lesson." });
    return res.status(201).json({ message: "Learning note uploaded and attached to the protected lesson.", mediaPath: key });
  } catch (error) {
    console.error("NIU learning-note upload failed", error);
    return res.status(500).json({ error: "NIU could not upload this learning note. Please try again." });
  }
};

// server/contentLibrary.ts
import { createClient as createClient2 } from "@supabase/supabase-js";
import { z as z2 } from "zod";
var maxBytes2 = 10 * 1024 * 1024;
var categorySchema = z2.enum(["document", "presentation", "image", "audio", "video", "research", "study_guide"]);
var fileTypes = {
  document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  presentation: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
  video: ["video/mp4", "video/webm"],
  research: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  study_guide: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"]
};
function headerValue2(value) {
  return Array.isArray(value) ? value[0] : value;
}
function safeText(value, max) {
  return decodeURIComponent(value).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}
function safeFilename2(value) {
  return safeText(value, 180).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "") || "learning-resource";
}
function sessionClient2(token) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NIU identity service is not configured.");
  return createClient2(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
}
async function requireStaff(token) {
  const supabase = sessionClient2(token);
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) throw new Error("UNAUTHENTICATED");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (!profile || !["instructor", "administrator", "super_admin"].includes(profile.role)) throw new Error("FORBIDDEN");
  return { supabase, userId: identity.user.id };
}
var uploadContentLibraryItem = async (req, res) => {
  try {
    const token = headerValue2(req.headers["x-supabase-authorization"]);
    const titleHeader = headerValue2(req.headers["x-content-title"]);
    const categoryHeader = headerValue2(req.headers["x-content-category"]);
    const filenameHeader = headerValue2(req.headers["x-file-name"]);
    const descriptionHeader = headerValue2(req.headers["x-content-description"]);
    const contentType = (headerValue2(req.headers["content-type"]) || "").split(";")[0].toLowerCase();
    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before uploading learning resources." });
    const category = categorySchema.safeParse(categoryHeader);
    const title2 = titleHeader ? safeText(titleHeader, 180) : "";
    if (!category.success || title2.length < 3 || !filenameHeader) return res.status(400).json({ error: "Provide a title, supported category, and file name." });
    if (!fileTypes[category.data].includes(contentType)) return res.status(400).json({ error: "This file type is not supported for the selected content category." });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Choose a non-empty learning resource." });
    if (req.body.length > maxBytes2) return res.status(413).json({ error: "Learning resources must be 10 MB or smaller." });
    const { supabase, userId } = await requireStaff(token);
    const filename2 = safeFilename2(filenameHeader);
    const { key } = await storagePut(`niu-content-library/${userId}/${filename2}`, req.body, contentType);
    const { data, error } = await supabase.from("content_library_items").insert({ title: title2, category: category.data, file_name: filename2, content_type: contentType, storage_path: key, description: descriptionHeader ? safeText(descriptionHeader, 1e3) || null : null, created_by: userId }).select("id, title, category, file_name, created_at").single();
    if (error) return res.status(403).json({ error: "The resource was stored but its NIU library record could not be saved." });
    return res.status(201).json({ item: data });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500;
    return res.status(status).json({ error: status === 403 ? "Academic staff authority is required to upload learning resources." : "NIU could not upload this learning resource. Please try again." });
  }
};
var attachContentLibraryItem = async (req, res) => {
  try {
    const token = headerValue2(req.headers["x-supabase-authorization"]);
    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before attaching learning resources." });
    const input = z2.object({ lessonId: z2.string().uuid(), contentItemId: z2.string().uuid(), isRequired: z2.boolean().default(true) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Choose a valid NIU lesson and content-library item." });
    const { supabase } = await requireStaff(token);
    const { data: current } = await supabase.from("lesson_content_items").select("position").eq("lesson_id", input.data.lessonId).order("position", { ascending: false }).limit(1);
    const { error } = await supabase.from("lesson_content_items").upsert({ lesson_id: input.data.lessonId, content_item_id: input.data.contentItemId, is_required: input.data.isRequired, position: Number(current?.[0]?.position ?? -1) + 1 }, { onConflict: "lesson_id,content_item_id" });
    if (error) return res.status(403).json({ error: "NIU could not attach this resource to the selected lesson." });
    return res.status(201).json({ message: "Learning resource attached to the selected lesson." });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500;
    return res.status(status).json({ error: status === 403 ? "Academic staff authority is required to attach learning resources." : "NIU could not attach this resource. Please try again." });
  }
};

// server/starterStudyGuide.ts
import { createClient as createClient3 } from "@supabase/supabase-js";
var title = "Digital Foundations: Access, Information, and Responsible Study";
var filename = "niu-digital-foundations-study-guide.md";
var studyGuide = `# Digital Foundations: Access, Information, and Responsible Study

> Draft teaching material\u2014academic review required before publishing.

## Purpose

This original NIU draft study guide supports the first module of **Digital Foundations for Enterprise and Remote Work**. It helps learners establish inclusive, organised, and responsible study habits before using collaboration tools or planning a project. It is a learning resource for a certificate-only programme. It is not professional advice, a licence, or a guarantee of employment.

## Before you begin

You should have a device that can use a modern web browser, a working email address, and a regular place to save study notes. If your connection is limited, download permitted materials when you have reliable access and work through them offline where possible. Contact NIU support if you need a reasonable adjustment or an accessible alternative.

## 1. Protect your learning account

Use a unique, memorable passphrase for each important account. Do not share sign-in links, passwords, or verification codes with anyone. Sign out of shared devices when you finish studying, and keep your browser and device software updated. If you suspect someone else has accessed an account, change the password using the provider\u2019s official recovery process and inform NIU support if your learning account may be affected.

## 2. Organise your digital workspace

Create one clearly named folder for this course. Keep separate subfolders for notes, downloaded readings, activities, and submitted work. Use meaningful names such as \`module-1-information-checklist.md\` rather than \`new-file-final2.docx\`. Add the date when it helps you find the latest version. A simple, consistent system reduces the chance of sharing the wrong file or losing evidence of your learning.

## 3. Check information before you use it

Before relying on information online, pause and ask four questions:

1. **Who created it?** Look for an identifiable author, organisation, or source.
2. **Why was it made?** Consider whether it aims to inform, sell, persuade, entertain, or mislead.
3. **When was it published or updated?** Older information may no longer fit the task.
4. **Can it be checked elsewhere?** Compare important claims with independent, credible sources.

Record the link, author, publication date, and a short note about why you considered the source useful. Do not copy work without acknowledgement. When a task requires sources, follow the citation method provided by NIU.

## 4. Work respectfully with others

Remote collaboration works best when people communicate clearly and respectfully. Use short subject lines, explain the purpose of a message, and state the action or deadline. Do not post another person\u2019s private information, images, work, or contact details without permission. Assume that written messages can be misunderstood: choose respectful language, avoid unnecessary urgency, and ask a clear question when something is unclear.

## 5. Make learning accessible and sustainable

Use captions or transcripts when they are available. Break longer study sessions into shorter focused periods, take regular breaks, and use a format that helps you learn\u2014such as notes, audio review, or a checklist. Tell NIU when a learning barrier affects your ability to participate so that support can be considered early.

## First learning activity

Create a private one-page study plan. Include: the device and connection you will use; where you will store your course work; one habit that protects your account; one method you will use to check information; and one support or accessibility adjustment that would help you learn. Keep this plan for reflection; do not publish personal details in a shared space.

## Reflection

At the end of this module, briefly record what changed in your study practice. What is one digital habit you will keep? What is one question you still have? These notes can help you prepare for the next module on collaborative remote work.

## Source and use note

This is original NIU draft teaching material written for this course structure. It does not reproduce third-party course content. Academic review is required before any authorised programme publication.
`;
function sessionClient3(token) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NIU identity service is not configured.");
  return createClient3(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
}
function headerValue3(value) {
  return Array.isArray(value) ? value[0] : value;
}
var initializeDigitalStudyGuide = async (req, res) => {
  try {
    const token = headerValue3(req.headers["x-supabase-authorization"]);
    if (!token?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to NIU before creating the protected study guide." });
    const supabase = sessionClient3(token);
    const { data: identity } = await supabase.auth.getUser();
    if (!identity.user) return res.status(401).json({ error: "Your NIU session is no longer valid." });
    const { data: profile } = await supabase.from("profiles").select("role,account_status").eq("id", identity.user.id).maybeSingle();
    if (!profile || profile.role !== "super_admin" || profile.account_status !== "active") return res.status(403).json({ error: "Active Super Administrator authority is required to add NIU\u2019s original starter study guide." });
    const { data: course } = await supabase.from("courses").select("id").eq("slug", "digital-foundations-enterprise-remote-work").maybeSingle();
    if (!course) return res.status(409).json({ error: "Create NIU\u2019s starter programme structure before adding the study guide." });
    const { data: module } = await supabase.from("course_modules").select("id").eq("course_id", course.id).eq("position", 0).maybeSingle();
    if (!module) return res.status(409).json({ error: "Create NIU\u2019s starter module outline before adding the study guide." });
    const { data: lesson } = await supabase.from("lessons").select("id").eq("module_id", module.id).eq("position", 0).maybeSingle();
    if (!lesson) return res.status(409).json({ error: "Create NIU\u2019s starter lesson scaffold before adding the study guide." });
    const { data: existingItem } = await supabase.from("content_library_items").select("id").eq("title", title).eq("file_name", filename).maybeSingle();
    let contentItemId = existingItem?.id;
    if (!contentItemId) {
      const { key } = await storagePut(`niu-content-library/${identity.user.id}/${filename}`, Buffer.from(studyGuide, "utf8"), "text/markdown");
      const { data: created, error: insertError } = await supabase.from("content_library_items").insert({ title, category: "study_guide", file_name: filename, content_type: "text/markdown", storage_path: key, description: "Original NIU draft study guide for the first Digital Foundations module. It remains private until an authorised programme release.", created_by: identity.user.id }).select("id").single();
      if (insertError || !created) return res.status(403).json({ error: "NIU could not register the protected study guide." });
      contentItemId = created.id;
    }
    const { data: existingAttachment } = await supabase.from("lesson_content_items").select("lesson_id").eq("lesson_id", lesson.id).eq("content_item_id", contentItemId).maybeSingle();
    if (!existingAttachment) {
      const { data: current } = await supabase.from("lesson_content_items").select("position").eq("lesson_id", lesson.id).order("position", { ascending: false }).limit(1);
      const { error: attachError } = await supabase.from("lesson_content_items").insert({ lesson_id: lesson.id, content_item_id: contentItemId, is_required: true, position: Number(current?.[0]?.position ?? -1) + 1 });
      if (attachError) return res.status(403).json({ error: "The NIU study guide exists but could not be attached to the first lesson." });
    }
    const { error: auditError } = await supabase.rpc("niu_record_digital_starter_study_guide_audit", { target_lesson_id: lesson.id, target_content_item_id: contentItemId });
    if (auditError) return res.status(500).json({ error: "The NIU study guide was stored but its required audit record could not be confirmed. Please retry before relying on this setup." });
    return res.status(201).json({ message: "NIU\u2019s original study guide has been stored privately and attached to the first draft lesson.", contentItemId, lessonId: lesson.id });
  } catch (error) {
    console.error("NIU starter study-guide setup failed", error);
    return res.status(500).json({ error: "NIU could not add the protected study guide. Please try again." });
  }
};

// server/_core/systemRouter.ts
import { z as z3 } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title2 = trimValue(input.title);
  const content = trimValue(input.content);
  if (title2.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title: title2, content };
};
async function notifyOwner(payload) {
  const { title: title2, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title: title2, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z3.object({
      timestamp: z3.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z3.object({
      title: z3.string().min(1, "title is required"),
      content: z3.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/courses.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { createClient as createClient4 } from "@supabase/supabase-js";
import { z as z4 } from "zod";
function publicSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "The NIU public database connection is not configured." });
  return createClient4(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
var courseRouter = router({
  list: publicProcedure.input(z4.object({ search: z4.string().trim().max(80).optional().default("") })).query(async ({ input }) => {
    const search = input.search.replace(/[%,_()]/g, "");
    let query = publicSupabaseClient().from("courses").select("id, slug, title, description, category, level, duration_minutes").eq("status", "published").order("title", { ascending: true }).limit(24);
    if (search) query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Course discovery is temporarily unavailable." });
    return data ?? [];
  }),
  getPublic: publicProcedure.input(z4.object({ slug: z4.string().min(1).max(160) })).query(async ({ input }) => {
    const { data, error } = await publicSupabaseClient().from("courses").select("id, slug, title, description, category, level, duration_minutes, learning_objectives, requirements, certificate_eligible, course_modules(id, title, description, position, lessons(id, title, kind, position, is_required))").eq("slug", input.slug).eq("status", "published").maybeSingle();
    if (error) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Course details are temporarily unavailable." });
    if (!data) throw new TRPCError3({ code: "NOT_FOUND", message: "Published course not found." });
    return data;
  })
});

// server/routers/niu.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { createClient as createClient5 } from "@supabase/supabase-js";
import { z as z5 } from "zod";

// server/niuValidation.ts
var NIU_CREDENTIAL_PATTERN = /^NIU-CERT-\d{4}-\d{6}$/i;
function normalizeCredentialNumber(value) {
  return value.trim().toUpperCase();
}
function isNiuCredentialNumber(value) {
  return NIU_CREDENTIAL_PATTERN.test(normalizeCredentialNumber(value));
}

// server/routers/niu.ts
var requestWindows = /* @__PURE__ */ new Map();
function publicSupabaseClient2() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError4({ code: "PRECONDITION_FAILED", message: "The NIU public database connection is not configured." });
  return createClient5(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function enforceVerificationRateLimit(clientAddress) {
  const now = Date.now();
  const existing = requestWindows.get(clientAddress);
  if (!existing || existing.resetAt <= now) {
    requestWindows.set(clientAddress, { count: 1, resetAt: now + 6e4 });
    return;
  }
  if (existing.count >= 10) throw new TRPCError4({ code: "TOO_MANY_REQUESTS", message: "Please wait a moment before making another verification request." });
  existing.count += 1;
}
var catalogInput = z5.object({ search: z5.string().trim().max(80).optional().default("") });
var catalogRouter = router({
  listPrograms: publicProcedure.input(catalogInput).query(async ({ input }) => {
    const search = input.search.replace(/[%,_()]/g, "");
    let query = publicSupabaseClient2().from("certificate_programs").select("id, code, name, description, duration_hours, difficulty, required_score").eq("status", "published").order("name", { ascending: true }).limit(24);
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Program discovery is temporarily unavailable." });
    return data ?? [];
  }),
  getPublishedProgram: publicProcedure.input(z5.object({ id: z5.string().uuid() })).query(async ({ input }) => {
    const { data, error } = await publicSupabaseClient2().from("certificate_programs").select("id, code, name, description, objectives, learning_outcomes, duration_hours, difficulty, required_score, completion_requirements, program_courses(position, is_required, courses(id, slug, title, description, level, duration_minutes))").eq("id", input.id).eq("status", "published").maybeSingle();
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Program details are temporarily unavailable." });
    if (!data) throw new TRPCError4({ code: "NOT_FOUND", message: "Published certificate program not found." });
    return data;
  })
});
var credentialRouter = router({
  verify: publicProcedure.input(z5.object({ credentialNumber: z5.string().trim().min(1).max(32) })).query(async ({ input, ctx }) => {
    const credentialNumber = normalizeCredentialNumber(input.credentialNumber);
    if (!isNiuCredentialNumber(credentialNumber)) return { found: false, reason: "format" };
    const forwarded = ctx.req.headers["x-forwarded-for"];
    const clientAddress = Array.isArray(forwarded) ? forwarded[0] ?? "unknown" : forwarded?.split(",")[0]?.trim() || ctx.req.ip || "unknown";
    enforceVerificationRateLimit(clientAddress);
    const { data, error } = await publicSupabaseClient2().rpc("verify_niu_credential", { lookup_credential: credentialNumber });
    if (error) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Credential verification is temporarily unavailable." });
    const record = Array.isArray(data) ? data[0] : data;
    if (!record) return { found: false, reason: "not_found" };
    return { found: true, credentialNumber: record.credential_number, credentialTitle: record.credential_title, programName: record.program_name, recipientName: record.recipient_name, issuedAt: record.issued_at, status: record.status };
  })
});

// server/routers/media.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
import { createClient as createClient6 } from "@supabase/supabase-js";
import { z as z6 } from "zod";
function enrolledSupabaseClient(token) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError5({ code: "PRECONDITION_FAILED", message: "The NIU media service is not configured." });
  return createClient6(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
}
var mediaRouter = router({
  getLessonUrl: publicProcedure.input(z6.object({ lessonId: z6.string().uuid() })).query(async ({ input, ctx }) => {
    const header = ctx.req.headers["x-supabase-authorization"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token?.startsWith("Bearer ")) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Sign in to access protected learning materials." });
    const supabase = enrolledSupabaseClient(token);
    const { data, error } = await supabase.from("lessons").select("media_path, video_path").eq("id", input.lessonId).maybeSingle();
    if (error || !data) throw new TRPCError5({ code: "FORBIDDEN", message: "Active enrollment is required to access this material." });
    const path = data.media_path || data.video_path;
    if (!path) return { url: null };
    try {
      return { url: await storageGetSignedUrl(path) };
    } catch (storageError) {
      console.error("NIU lesson media signing failed", storageError instanceof Error ? storageError.message : storageError);
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "The protected lesson media is temporarily unavailable." });
    }
  }),
  getContentUrl: publicProcedure.input(z6.object({ contentItemId: z6.string().uuid() })).query(async ({ input, ctx }) => {
    const header = ctx.req.headers["x-supabase-authorization"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token?.startsWith("Bearer ")) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Sign in to access protected learning materials." });
    const supabase = enrolledSupabaseClient(token);
    const { data, error } = await supabase.from("content_library_items").select("storage_path, category").eq("id", input.contentItemId).maybeSingle();
    if (error || !data) throw new TRPCError5({ code: "FORBIDDEN", message: "Active enrollment is required to access this material." });
    if (data.category === "external_resource") return { url: data.storage_path };
    try {
      return { url: await storageGetSignedUrl(data.storage_path) };
    } catch (storageError) {
      console.error("NIU protected resource signing failed", storageError instanceof Error ? storageError.message : storageError);
      throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "The protected learning resource is temporarily unavailable." });
    }
  })
});

// server/routers/staff.ts
import { TRPCError as TRPCError6 } from "@trpc/server";
import { createClient as createClient7 } from "@supabase/supabase-js";
function sessionClient4(token) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError6({ code: "PRECONDITION_FAILED", message: "NIU identity service is not configured." });
  return createClient7(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
}
var staffRouter = router({
  authorization: publicProcedure.query(async ({ ctx }) => {
    const raw = ctx.req.headers["x-supabase-authorization"];
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token?.startsWith("Bearer ")) throw new TRPCError6({ code: "UNAUTHORIZED", message: "Sign in to NIU." });
    const supabase = sessionClient4(token);
    const { data: identity } = await supabase.auth.getUser();
    if (!identity.user) throw new TRPCError6({ code: "UNAUTHORIZED", message: "NIU session is not valid." });
    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
    if (error || !profile || profile.role === "student") throw new TRPCError6({ code: "FORBIDDEN", message: "Academic staff authority is required." });
    return { role: profile.role };
  })
});

// server/routers/aiBuilder.ts
import { TRPCError as TRPCError7 } from "@trpc/server";
import { z as z7 } from "zod";

// shared/curriculumImport.ts
var difficultyPattern = /^(introductory|intermediate|advanced)$/i;
var clean = (value) => value.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim();
var valueAfter = (line, label) => clean(line.slice(label.length).replace(/^[:\-]\s*/, ""));
function analyzeCurriculumDocument(source, fileName) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const analysis = { courses: [], explicitMaterials: [], missingInformation: [], validationErrors: [], sourceFormat: /\.md$/i.test(fileName) ? "markdown" : "plain_text" };
  let currentCourse;
  let currentModule;
  let currentLesson;
  let lastSection = "";
  for (const raw of lines) {
    const line = raw.replace(/^#+\s*/, "").trim();
    const lower = line.toLowerCase();
    if (/^(department|school department)\s*:/i.test(line)) {
      const name = valueAfter(line, line.match(/^[^:]+/)[0]);
      analysis.department = { name };
      lastSection = "department";
      continue;
    }
    if (/^(programme|program|certificate programme|certificate program)\s*:/i.test(line)) {
      const label = line.match(/^[^:]+/)[0];
      analysis.programme = { name: valueAfter(line, label), objectives: [] };
      lastSection = "programme";
      continue;
    }
    if (/^(course)\s*:/i.test(line)) {
      currentCourse = { title: valueAfter(line, "Course"), position: analysis.courses.length, objectives: [], modules: [], assessments: [] };
      analysis.courses.push(currentCourse);
      currentModule = void 0;
      currentLesson = void 0;
      lastSection = "course";
      continue;
    }
    if (/^(module|unit)\s*(\d+)?\s*:/i.test(line)) {
      if (!currentCourse) {
        analysis.validationErrors.push("A module appears before any course.");
        continue;
      }
      currentModule = { title: valueAfter(line, line.match(/^[^:]+/)[0]), position: currentCourse.modules.length, objectives: [], lessons: [] };
      currentCourse.modules.push(currentModule);
      currentLesson = void 0;
      lastSection = "module";
      continue;
    }
    if (/^(lesson|topic)\s*([\d.]+)?\s*:/i.test(line)) {
      if (!currentModule) {
        analysis.validationErrors.push("A lesson appears before any module.");
        continue;
      }
      currentLesson = { title: valueAfter(line, line.match(/^[^:]+/)[0]), position: currentModule.lessons.length, objectives: [], activities: [], knowledgeChecks: [] };
      currentModule.lessons.push(currentLesson);
      lastSection = "lesson";
      continue;
    }
    if (/^(objective|learning objective|outcome)\s*:/i.test(line)) {
      const text2 = valueAfter(line, line.match(/^[^:]+/)[0]);
      if (currentLesson) currentLesson.objectives.push(text2);
      else if (currentModule) currentModule.objectives.push(text2);
      else if (currentCourse) currentCourse.objectives.push(text2);
      else if (analysis.programme) analysis.programme.objectives.push(text2);
      lastSection = "objective";
      continue;
    }
    if (/^(activity|learning activity)\s*:/i.test(line)) {
      if (currentLesson) currentLesson.activities.push(valueAfter(line, line.match(/^[^:]+/)[0]));
      else analysis.missingInformation.push("A learning activity was declared before a lesson.");
      lastSection = "activity";
      continue;
    }
    if (/^(knowledge check|check|question)\s*:/i.test(line)) {
      if (currentLesson) currentLesson.knowledgeChecks.push(valueAfter(line, line.match(/^[^:]+/)[0]));
      else analysis.missingInformation.push("A knowledge check was declared before a lesson.");
      lastSection = "question";
      continue;
    }
    if (/^(assessment|module assessment)\s*:/i.test(line)) {
      if (currentCourse) currentCourse.assessments.push(valueAfter(line, line.match(/^[^:]+/)[0]));
      else analysis.missingInformation.push("An assessment was declared before a course.");
      lastSection = "assessment";
      continue;
    }
    if (/^(final examination|final exam|examination)\s*:/i.test(line)) {
      if (currentCourse) currentCourse.finalExamination = valueAfter(line, line.match(/^[^:]+/)[0]);
      else analysis.missingInformation.push("A final examination was declared before a course.");
      lastSection = "final";
      continue;
    }
    if (/^(material|learning material|protected material)\s*:/i.test(line)) {
      analysis.explicitMaterials.push(valueAfter(line, line.match(/^[^:]+/)[0]));
      lastSection = "material";
      continue;
    }
    if (/^(difficulty|level)\s*:/i.test(line)) {
      const value = valueAfter(line, line.match(/^[^:]+/)[0]).toLowerCase();
      if (!difficultyPattern.test(value)) analysis.validationErrors.push(`Unsupported difficulty "${value}". Use introductory, intermediate, or advanced.`);
      else if (currentModule) currentModule.difficulty = value;
      else if (currentCourse) currentCourse.difficulty = value;
      else if (analysis.programme) analysis.programme.difficulty = value;
      lastSection = "difficulty";
      continue;
    }
    if (/^(certificate|certificate template|template)\s*:/i.test(line)) {
      const value = valueAfter(line, line.match(/^[^:]+/)[0]);
      analysis.certificateSettings = { templateKey: value, awardScope: "certificate_only" };
      lastSection = "certificate";
      continue;
    }
    if (/^(description|overview)\s*:/i.test(line)) {
      const value = valueAfter(line, line.match(/^[^:]+/)[0]);
      if (currentCourse) currentCourse.description = value;
      else if (analysis.programme) analysis.programme.description = value;
      lastSection = "description";
      continue;
    }
    if (/^(completion|completion rules|required score)\s*:/i.test(line) && analysis.programme) {
      analysis.programme.completionRules = valueAfter(line, line.match(/^[^:]+/)[0]);
      lastSection = "completion";
      continue;
    }
    if (lastSection === "material" && /^(https?:\/\/|[-*])/.test(line)) analysis.explicitMaterials.push(clean(line));
  }
  if (!analysis.department?.name) analysis.missingInformation.push("Department name and school relationship are missing.");
  if (!analysis.programme?.name) analysis.missingInformation.push("Certificate programme name is missing.");
  if (!analysis.programme?.description || analysis.programme.description.length < 30) analysis.missingInformation.push("Certificate programme description of at least 30 characters is missing.");
  if (!analysis.courses.length) analysis.missingInformation.push("At least one course is missing.");
  for (const course of analysis.courses) {
    if (!course.description || course.description.length < 3) analysis.missingInformation.push(`Course "${course.title}" needs an explicit description.`);
    if (!course.modules.length) analysis.missingInformation.push(`Course "${course.title}" has no modules.`);
    if (!course.assessments.length) analysis.missingInformation.push(`Course "${course.title}" has no explicit assessment.`);
    for (const module of course.modules) {
      if (!module.difficulty) analysis.missingInformation.push(`Module "${module.title}" needs introductory, intermediate, or advanced difficulty.`);
      if (!module.lessons.length) analysis.missingInformation.push(`Module "${module.title}" has no lessons.`);
      for (const lesson of module.lessons) {
        if (!lesson.objectives.length) analysis.missingInformation.push(`Lesson "${lesson.title}" has no learning objective.`);
        if (!lesson.activities.length) analysis.missingInformation.push(`Lesson "${lesson.title}" has no learning activity.`);
      }
    }
  }
  if (!analysis.certificateSettings) analysis.missingInformation.push("Certificate template/settings are missing.");
  return analysis;
}

// server/routers/aiBuilder.ts
import { createClient as createClient8 } from "@supabase/supabase-js";

// server/aiOrchestrator.ts
var providerKey = (provider) => provider === "openai" ? ENV.openAiApiKey : ENV.geminiApiKey;
var ensureProviderKey = (provider) => {
  if (!providerKey(provider)) throw new Error(`${provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"} is not configured for server-side AI orchestration.`);
};
var parseJson = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("The AI provider returned malformed structured output.");
  }
};
var toGeminiSchema = (schema) => {
  const converted = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    if (key === "type" && typeof value === "string") {
      converted[key] = value.toUpperCase();
      continue;
    }
    if (key === "properties" && value && typeof value === "object") {
      converted[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, child && typeof child === "object" ? toGeminiSchema(child) : child]));
    } else if (key === "items" && value && typeof value === "object") {
      converted[key] = toGeminiSchema(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
};
var safeProviderError = async (response, provider) => {
  const detail = await response.text().catch(() => "");
  let reason = "request failed";
  try {
    const parsed = JSON.parse(detail);
    reason = parsed.error?.message ?? parsed.message ?? reason;
  } catch {
    if (detail) reason = detail.slice(0, 240);
  }
  return `${provider} AI request failed (${response.status}): ${reason}`;
};
async function listProviderModels(provider) {
  ensureProviderKey(provider);
  if (provider === "openai") {
    const response2 = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${ENV.openAiApiKey}` } });
    if (!response2.ok) throw new Error(await safeProviderError(response2, provider));
    const body2 = await response2.json();
    return (body2.data ?? []).map((item) => item.id).filter((id) => Boolean(id));
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(ENV.geminiApiKey)}`);
  if (!response.ok) throw new Error(await safeProviderError(response, provider));
  const body = await response.json();
  return (body.models ?? []).filter((item) => item.supportedGenerationMethods?.includes("generateContent")).map((item) => item.name?.replace(/^models\//, "")).filter((id) => Boolean(id));
}
var chooseModel = async (provider, requested) => {
  if (requested) return requested;
  const configured = provider === "openai" ? ENV.openAiModel : ENV.geminiModel;
  if (provider === "openai" && configured) return configured;
  const models = await listProviderModels(provider);
  if (provider === "gemini" && configured && models.includes(configured)) return configured;
  const preferred = provider === "openai" ? models.find((model) => /^gpt-/.test(model) && !model.includes("audio")) : models.find((model) => /gemini-2\.5-flash/i.test(model)) ?? models.find((model) => /gemini-2\.0-flash/i.test(model)) ?? models.find((model) => /gemini-1\.5-flash/i.test(model)) ?? models.find((model) => /gemini/i.test(model));
  if (!preferred) throw new Error(`No compatible ${provider} structured-output model is available.`);
  return preferred;
};
async function runStructuredAI(request) {
  ensureProviderKey(request.provider);
  const model = await chooseModel(request.provider, request.model);
  if (request.provider === "openai") {
    const response2 = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.openAiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0.1,
        messages: [{ role: "system", content: request.system }, { role: "user", content: request.prompt }],
        ...request.schema ? { response_format: { type: "json_schema", json_schema: { name: "niu_ai_output", strict: true, schema: request.schema } } } : {}
      })
    });
    if (!response2.ok) throw new Error(await safeProviderError(response2, request.provider));
    const body2 = await response2.json();
    const content2 = body2.choices?.[0]?.message?.content;
    if (!content2) throw new Error("OpenAI returned no usable content.");
    return { provider: request.provider, model, value: request.schema ? parseJson(content2) : content2 };
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${request.system}

${request.prompt}` }] }],
      generationConfig: { temperature: request.temperature ?? 0.1, ...request.schema ? { responseMimeType: "application/json", responseSchema: toGeminiSchema(request.schema) } : {} }
    })
  });
  if (!response.ok) throw new Error(await safeProviderError(response, request.provider));
  const body = await response.json();
  const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!content) throw new Error("Gemini returned no usable content.");
  return { provider: request.provider, model, value: request.schema ? parseJson(content) : content };
}
async function runStructuredAIWithFallback(request, fallbackProvider) {
  try {
    return await runStructuredAI(request);
  } catch (primaryError) {
    if (!fallbackProvider || fallbackProvider === request.provider) throw primaryError;
    console.warn(`AI provider ${request.provider} failed; attempting configured ${fallbackProvider} fallback.`);
    return runStructuredAI({ ...request, provider: fallbackProvider, model: void 0 });
  }
}
async function providerHealth(provider = "gemini") {
  const configured = Boolean(providerKey(provider));
  if (!configured) return { configured: false, reachable: false, modelAvailable: false, model: null };
  try {
    const models = await listProviderModels(provider);
    const configuredModel = provider === "gemini" ? ENV.geminiModel : ENV.openAiModel;
    const model = configuredModel || await chooseModel(provider);
    return { configured: true, reachable: true, modelAvailable: models.includes(model), model };
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/(api[_-]?key|authorization|bearer)\s*[:=]\s*\S+/gi, "$1=[REDACTED]").slice(0, 240) : "unknown provider health failure";
    console.error(`[AI health:${provider}] ${detail}`);
    return { configured: true, reachable: false, modelAvailable: false, model: null };
  }
}

// shared/lessonKinds.ts
var LESSON_KIND_OPTIONS = [
  { value: "article", label: "Reading / article" },
  { value: "video", label: "Video" },
  { value: "flashcards", label: "Flashcards" },
  { value: "quiz", label: "Quiz / knowledge check" },
  { value: "test", label: "Module test" },
  { value: "final_exam", label: "Final examination" }
];
var DEFAULT_LESSON_KIND = "article";
var LESSON_KIND_VALUES = LESSON_KIND_OPTIONS.map((option) => option.value);

// server/_core/imageGeneration.ts
var DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
var DEFAULT_IMAGE_QUALITY = "medium";
async function generateImage(options) {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();
  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const quality = options.quality ?? (model === DEFAULT_IMAGE_MODEL ? DEFAULT_IMAGE_QUALITY : void 0);
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
      model,
      ...quality ? { quality } : {}
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }
  const result = await response.json();
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");
  const stored = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return {
    url: stored.url,
    key: stored.key,
    mimeType: result.image.mimeType
  };
}

// server/routers/aiBuilder.ts
function aiProviderError(stage, error) {
  const rawMessage = error instanceof Error ? error.message : "unknown AI failure";
  const safeDetail = rawMessage.replace(/(api[_-]?key|authorization|bearer)\\s*[:=]\\s*\\S+/gi, "$1=[REDACTED]").slice(0, 240);
  console.error(`[AI Builder:${stage}] ${safeDetail}`);
  if (/not configured|missing.*key|api key/i.test(rawMessage)) {
    return new TRPCError7({ code: "PRECONDITION_FAILED", message: "AI provider is not configured. No academic records were created." });
  }
  if (/malformed|no usable|structured output|invalid.*json/i.test(rawMessage)) {
    return new TRPCError7({ code: "BAD_GATEWAY", message: "AI returned invalid structured data. No academic records were created." });
  }
  return new TRPCError7({ code: "BAD_GATEWAY", message: "AI provider request failed. No academic records were created." });
}
var settingsSchema = z7.object({
  programmeCode: z7.string().trim().regex(/^[A-Za-z0-9-]{2,40}$/).optional(),
  subject: z7.string().trim().max(240).optional(),
  category: z7.string().trim().max(160).optional(),
  department: z7.string().trim().max(160).optional(),
  difficulty: z7.enum(["introductory", "intermediate", "advanced"]).optional(),
  learningHours: z7.number().int().positive().max(2e3).optional(),
  academicDepth: z7.enum(["foundation", "applied", "advanced"]).optional(),
  targetLearner: z7.string().trim().max(240).optional(),
  numberOfCourses: z7.number().int().positive().max(24).optional(),
  estimatedModulesPerCourse: z7.number().int().positive().max(12).optional(),
  estimatedLessonsPerModule: z7.number().int().positive().max(20).optional(),
  preferredAssessmentDifficulty: z7.enum(["introductory", "intermediate", "advanced"]).optional(),
  minimumPassingScore: z7.number().int().min(1).max(100).optional(),
  certificateTemplate: z7.string().trim().max(160).optional(),
  generationDepth: z7.enum(["starter", "standard", "premium"]).default("standard"),
  researchDepth: z7.enum(["standard", "deep"]).optional(),
  visualGeneration: z7.boolean().default(false),
  assessmentGeneration: z7.boolean().default(true),
  referenceRequirements: z7.string().trim().max(1200).optional()
});
async function getStaffSession(req) {
  const headers = req.headers ?? {};
  const raw = headers["x-supabase-authorization"];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token?.startsWith("Bearer ")) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Sign in to NIU." });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "NIU identity service is not configured." });
  const supabase = createClient8(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: token } } });
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) throw new TRPCError7({ code: "UNAUTHORIZED", message: "NIU session is not valid." });
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (error || !profile || !["instructor", "administrator", "super_admin"].includes(profile.role)) throw new TRPCError7({ code: "FORBIDDEN", message: "Academic staff authority is required." });
  return { supabase, userId: identity.user.id };
}
var blueprintSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    programme: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] },
        objectives: { type: "array", items: { type: "string" } },
        learningOutcomes: { type: "array", items: { type: "string" } },
        entryRequirements: { type: "array", items: { type: "string" } },
        completionRequirements: { type: "array", items: { type: "string" } },
        recommendedLearningHours: { type: "integer" }
      },
      required: ["title", "description", "difficulty", "objectives", "learningOutcomes", "entryRequirements", "completionRequirements", "recommendedLearningHours"]
    },
    courses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] },
          position: { type: "integer" },
          objectives: { type: "array", items: { type: "string" } },
          modules: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, description: { type: "string" }, difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] }, position: { type: "integer" }, objectives: { type: "array", items: { type: "string" } }, lessons: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, description: { type: "string" }, position: { type: "integer" }, objectives: { type: "array", items: { type: "string" } }, activityIdeas: { type: "array", items: { type: "string" } }, materialNeeds: { type: "array", items: { type: "string" } }, assessmentIdeas: { type: "array", items: { type: "string" } }, summary: { type: "string" }, keyConcepts: { type: "array", items: { type: "string" } }, notes: { type: "string" }, selfCheckQuestions: { type: "array", items: { type: "string" } } }, required: ["title", "description", "position", "objectives", "activityIdeas", "materialNeeds", "assessmentIdeas"] } } }, required: ["title", "description", "difficulty", "position", "objectives", "lessons"] } }
        },
        required: ["title", "description", "difficulty", "position", "objectives", "modules"]
      }
    },
    researchPlan: { type: "array", items: { type: "object", additionalProperties: false, properties: { claimArea: { type: "string" }, sourceTypes: { type: "array", items: { type: "string" } }, searchQuestions: { type: "array", items: { type: "string" } }, sourceRequiredBeforeWriting: { type: "boolean" } }, required: ["claimArea", "sourceTypes", "searchQuestions", "sourceRequiredBeforeWriting"] } },
    qualityGates: { type: "array", items: { type: "string" } },
    missingInformation: { type: "array", items: { type: "string" } }
  },
  required: ["programme", "courses", "researchPlan", "qualityGates", "missingInformation"]
};
var sourceSchema = z7.object({ title: z7.string().trim().min(2).max(240), url: z7.string().url().refine((value) => value.startsWith("https://"), "Sources must use HTTPS URLs"), sourceType: z7.string().trim().min(2).max(120) });
var visualSpecSchema = { type: "object", additionalProperties: false, properties: { lessonTitle: { type: "string" }, shouldGenerate: { type: "boolean" }, visualType: { type: "string" }, concept: { type: "string" }, learningObjective: { type: "string" }, requiredStructures: { type: "array", items: { type: "string" } }, requiredLabels: { type: "array", items: { type: "string" } }, layout: { type: "string" }, orientation: { type: "string" }, educationalPurpose: { type: "string" }, altText: { type: "string" }, accuracyRequirements: { type: "array", items: { type: "string" } }, accessibilityRequirements: { type: "array", items: { type: "string" } }, reviewStatus: { type: "string", enum: ["draft", "needs_review"] } }, required: ["lessonTitle", "shouldGenerate", "visualType", "concept", "learningObjective", "requiredStructures", "requiredLabels", "layout", "orientation", "educationalPurpose", "altText", "accuracyRequirements", "accessibilityRequirements", "reviewStatus"] };
function validateBlueprint(value, generationDepth = "standard") {
  const blueprint = value;
  if (!blueprint?.programme?.title?.trim() || !blueprint.programme.description?.trim() || !Array.isArray(blueprint.programme.objectives) || !blueprint.programme.objectives.length || !Array.isArray(blueprint.programme.learningOutcomes) || !blueprint.programme.learningOutcomes.length || !Array.isArray(blueprint.courses) || !blueprint.courses.length) throw new Error("AI returned an incomplete programme blueprint.");
  const courseTitles = /* @__PURE__ */ new Set();
  for (const course of blueprint.courses) {
    const courseKey = String(course.title ?? "").trim().toLocaleLowerCase();
    if (!courseKey || courseTitles.has(courseKey) || !Array.isArray(course.modules) || !course.modules.length) throw new Error("AI returned duplicate or incomplete course structure.");
    courseTitles.add(courseKey);
    const moduleTitles = /* @__PURE__ */ new Set();
    for (const module of course.modules) {
      const moduleKey = String(module.title ?? "").trim().toLocaleLowerCase();
      if (!moduleKey || moduleTitles.has(moduleKey) || !Array.isArray(module.objectives) || !module.objectives.length || !Array.isArray(module.lessons) || !module.lessons.length) throw new Error("AI returned duplicate or incomplete module structure.");
      moduleTitles.add(moduleKey);
      const lessonTitles = /* @__PURE__ */ new Set();
      for (const lesson of module.lessons) {
        const lessonKey = String(lesson.title ?? "").trim().toLocaleLowerCase();
        if (!lessonKey || lessonTitles.has(lessonKey) || !Array.isArray(lesson.objectives) || !lesson.objectives.length || !Array.isArray(lesson.activityIdeas) || !Array.isArray(lesson.materialNeeds) || !Array.isArray(lesson.assessmentIdeas) || generationDepth === "premium" && (!lesson.notes || lesson.notes.trim().length < 120)) throw new Error(generationDepth === "premium" ? "AI returned incomplete Premium lesson notes." : "AI returned duplicate or incomplete lesson structure.");
        lessonTitles.add(lessonKey);
      }
    }
  }
}
function blueprintToMarkdown(topic, blueprint, sources, notes) {
  const lines = [`# Department: ${topic.slice(0, 80)} Academic Development`, `# Programme: ${blueprint.programme.title}`, `Description: ${blueprint.programme.description}`, `Difficulty: ${blueprint.programme.difficulty}`, `Learning hours: ${blueprint.programme.recommendedLearningHours}`, `Objectives: ${blueprint.programme.objectives.join("; ")}`, `Learning outcomes: ${blueprint.programme.learningOutcomes.join("; ")}`, `Entry requirements: ${blueprint.programme.entryRequirements.join("; ")}`, `Completion requirements: ${blueprint.programme.completionRequirements.join("; ")}`, "", `Research review: ${notes}`, `Research sources: ${sources.map((source) => `${source.title} (${source.sourceType}) \u2014 ${source.url}`).join("; ")}`, ""];
  for (const course of blueprint.courses.slice().sort((a, b) => a.position - b.position)) {
    lines.push(`## Course: ${course.title}`, `Description: ${course.description}`, `Difficulty: ${course.difficulty}`, `Objective: ${course.objectives.join("; ")}`);
    for (const module of course.modules.slice().sort((a, b) => a.position - b.position)) {
      lines.push(`### Module ${module.position}: ${module.title}`, `Description: ${module.description}`, `Difficulty: ${module.difficulty}`, `Objective: ${module.objectives.join("; ")}`);
      for (const lesson of module.lessons.slice().sort((a, b) => a.position - b.position)) {
        lines.push(`#### Lesson ${lesson.position}: ${lesson.title}`, `Description: ${lesson.description}`, `Objective: ${lesson.objectives.join("; ")}`, `Activity: ${lesson.activityIdeas.join("; ")}`, `Material: ${lesson.materialNeeds.join("; ")}`, `Assessment: ${lesson.assessmentIdeas.join("; ")}`);
      }
    }
  }
  return lines.join("\\n");
}
function compileCompleteDraftPackage(topic, blueprint, reviewPlans, storagePaths) {
  let materialIndex = 0;
  const courses = (blueprint.courses ?? []).slice().sort((a, b) => a.position - b.position).map((course, courseIndex) => ({
    title: course.title,
    description: course.description,
    difficulty: course.difficulty,
    durationMinutes: Math.max(30, Math.round((blueprint.programme?.recommendedLearningHours ?? 1) * 60 / Math.max(1, blueprint.courses?.length ?? 1))),
    objectives: course.objectives,
    learningOutcomes: course.objectives,
    requirements: blueprint.programme?.entryRequirements ?? [],
    modules: course.modules.slice().sort((a, b) => a.position - b.position).map((module, moduleIndex) => ({
      title: module.title,
      description: module.description,
      difficulty: module.difficulty,
      estimatedMinutes: Math.max(15, Math.round(blueprint.programme?.recommendedLearningHours ? blueprint.programme.recommendedLearningHours * 60 / Math.max(1, course.modules.length) : 60)),
      objectives: module.objectives,
      supportGuidance: "Administrator must verify inclusive support, device access, language, and accommodation guidance before approval.",
      lessons: module.lessons.slice().sort((a, b) => a.position - b.position).map((lesson) => {
        const file = storagePaths[materialIndex++];
        const evidenceLabel = reviewPlans?.contentPlan?.find((item) => String(item.section).toLowerCase().includes(lesson.title.toLowerCase()))?.evidenceUrls ?? [];
        const visualPlan = reviewPlans?.visualPlan?.filter((item) => String(item.placement).toLowerCase().includes(lesson.title.toLowerCase()) || String(item.placement).toLowerCase().includes(module.title.toLowerCase())) ?? [];
        return {
          kind: DEFAULT_LESSON_KIND,
          title: lesson.title,
          description: lesson.description,
          draftText: lesson.notes?.trim() || `DRAFT LEARNING MATERIAL \u2014 ${lesson.title}\\n\\nThis lesson is an administrator-review draft for ${topic}. Use only verified evidence before approval.\\n\\nLearning objectives\\n${lesson.objectives.map((item) => `- ${item}`).join("\\n")}\\n\\nSource evidence to verify\\n${evidenceLabel.length ? evidenceLabel.join("\\n") : "Missing evidence: administrator must attach authoritative sources."}`,
          objectives: lesson.objectives,
          activities: lesson.activityIdeas,
          accessibility: ["Provide an accessible text alternative.", "Verify headings, contrast, captions/transcripts, and keyboard access."],
          videoScript: "Missing: administrator must author a video script if video is required.",
          transcript: "Missing: administrator must author or verify a transcript.",
          diagrams: visualPlan.length ? visualPlan : [{ placement: lesson.title, purpose: "Missing: administrator must confirm whether a learning visual is required.", altText: "Missing: administrator must provide alt text if a visual is approved.", accessibilityChecks: ["Missing: administrator must define an accessible alternative."], verificationRequired: true }],
          references: evidenceLabel,
          assignment: "Missing: administrator must define an assignment if required.",
          rubric: "Missing: administrator must define and approve a rubric if required.",
          materials: file ? [{ title: `${lesson.title} draft study guide`, fileName: file.fileName, storagePath: file.storagePath, description: "Private AI Builder draft study guide; administrator must verify and edit before approval." }] : [],
          assessment: { assessmentIdeas: lesson.assessmentIdeas, verificationRequired: true },
          estimatedMinutes: 30,
          points: 10
        };
      }),
      assessments: [{
        title: `${module.title} knowledge check`,
        type: "knowledge_check",
        instructions: "Draft assessment blueprint. Administrator must review every item, answer key, points, and objective mapping before approval.",
        passingScore: reviewPlans?.assessmentBlueprint?.passingScore ?? 70,
        attemptLimit: reviewPlans?.assessmentBlueprint?.attemptLimit ?? 2,
        questionBankTitle: `${module.title} Question Bank`,
        visualRequirements: reviewPlans?.visualPlan?.filter((item) => String(item.placement).toLowerCase().includes(module.title.toLowerCase())) ?? [],
        questions: (reviewPlans?.assessmentBlueprint?.questions ?? []).slice(0, 5).map((item, questionIndex) => ({
          prompt: `Draft question purpose: ${item.promptPurpose}. Administrator must author and verify the final question before approval.`,
          choices: ["Draft option pending authoring", "Draft option pending authoring", "Draft option pending authoring", "Draft option pending authoring"],
          answerKey: { status: "pending_administrator_verification" },
          explanation: "Answer key intentionally withheld pending authorised academic review.",
          difficulty: item.difficulty,
          topic: module.title,
          objective: item.objective,
          points: Math.max(1, item.points ?? 1)
        }))
      }]
    }))
  }));
  return {
    school: { name: "NIU Academic Development" },
    department: { name: blueprint.programme?.title ? `${blueprint.programme.title} Academic Development` : `${topic} Academic Development` },
    programme: { title: blueprint.programme?.title ?? topic, description: blueprint.programme?.description ?? "Draft certificate programme; administrator verification required.", difficulty: blueprint.programme?.difficulty ?? "intermediate", objectives: blueprint.programme?.objectives ?? [], learningOutcomes: blueprint.programme?.learningOutcomes ?? [], learningHours: blueprint.programme?.recommendedLearningHours ?? 0, completionRequirements: blueprint.programme?.completionRequirements ?? [], certificateTemplateKey: "administrator_review_required" },
    courses
  };
}
var aiBuilderRouter = router({
  health: publicProcedure.query(async ({ ctx }) => {
    await getStaffSession(ctx.req);
    const health = await providerHealth("gemini");
    return { geminiConfigured: health.configured, providerReachable: health.reachable, selectedModelAvailable: health.modelAvailable };
  }),
  listJobs: publicProcedure.query(async ({ ctx }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,settings,blueprint,research_plan,validation_errors,missing_information,generated_record_ids,created_at,updated_at").order("updated_at", { ascending: false }).limit(20);
    if (error) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "NIU could not load saved AI Builder planning jobs." });
    return data ?? [];
  }),
  getJob: publicProcedure.input(z7.object({ jobId: z7.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,settings,blueprint,research_plan,validation_errors,missing_information,generated_record_ids,created_at,updated_at").eq("id", input.jobId).maybeSingle();
    if (error || !data) throw new TRPCError7({ code: "NOT_FOUND", message: "That AI Builder planning job is not available." });
    return data;
  }),
  submitResearchReview: publicProcedure.input(z7.object({ jobId: z7.string().uuid(), researchSources: z7.array(sourceSchema).min(1).max(40), researchNotes: z7.string().trim().min(20).max(12e3) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").update({ research_sources: input.researchSources, research_notes: input.researchNotes, status: "generation_review", reviewed_by: userId, reviewed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", input.jobId).eq("status", "research_review").select("id,status,research_sources,research_notes").maybeSingle();
    if (error || !data) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: error?.message ?? "Research review is blocked until the saved job is in Research Review status." });
    return data;
  }),
  saveBlueprintEdits: publicProcedure.input(z7.object({ jobId: z7.string().uuid(), blueprint: z7.record(z7.string(), z7.unknown()) })).mutation(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data, error } = await supabase.from("ai_academic_builder_jobs").update({ blueprint: input.blueprint }).eq("id", input.jobId).in("status", ["research_review", "generation_review", "ready_for_review"]).select("id,status,blueprint").maybeSingle();
    if (error || !data) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Blueprint editing is available only while the AI Builder job remains in a private review state." });
    return data;
  }),
  generateReviewPlans: publicProcedure.input(z7.object({ jobId: z7.string().uuid(), evidence: z7.array(z7.object({ sourceUrl: z7.string().url().refine((value) => value.startsWith("https://"), "Evidence sources must use HTTPS URLs"), excerpt: z7.string().trim().min(20).max(4e3), claimAreas: z7.array(z7.string().trim().min(2).max(160)).min(1).max(12) })).min(1).max(40) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,blueprint,research_sources,research_notes,settings").eq("id", input.jobId).eq("status", "generation_review").maybeSingle();
    if (jobError || !job) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Generation planning is blocked until research review is complete." });
    const settings = job.settings ?? {};
    const uniqueSources = new Set(input.evidence.map((item) => item.sourceUrl));
    if (settings.researchDepth === "deep" && (input.evidence.length < 3 || uniqueSources.size < 3)) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Deep research planning requires at least three distinct HTTPS evidence sources with excerpts." });
    let plans;
    try {
      const result = await runStructuredAIWithFallback({
        provider: "gemini",
        system: "You are NIU's evidence-bound academic planning assistant. Produce only reviewable plans, never final teaching claims. Use only the supplied blueprint and evidence excerpts. Do not add facts not present in evidence. Every item must include source URLs or an explicit verification label. NIU offers certificate programmes only. Return JSON exactly matching the schema.",
        prompt: JSON.stringify({ topic: job.topic, blueprint: job.blueprint, researchSources: job.research_sources, researchNotes: job.research_notes, evidence: input.evidence }),
        schema: { type: "object", additionalProperties: false, properties: { contentPlan: { type: "array", items: { type: "object", additionalProperties: false, properties: { section: { type: "string" }, draftPurpose: { type: "string" }, evidenceUrls: { type: "array", items: { type: "string" } }, verificationRequired: { type: "boolean" } }, required: ["section", "draftPurpose", "evidenceUrls", "verificationRequired"] } }, visualPlan: { type: "array", items: { type: "object", additionalProperties: false, properties: { placement: { type: "string" }, purpose: { type: "string" }, altText: { type: "string" }, accessibilityChecks: { type: "array", items: { type: "string" } }, verificationRequired: { type: "boolean" } }, required: ["placement", "purpose", "altText", "accessibilityChecks", "verificationRequired"] } }, assessmentBlueprint: { type: "object", additionalProperties: false, properties: { passingScore: { type: "integer" }, attemptLimit: { type: "integer" }, questions: { type: "array", items: { type: "object", additionalProperties: false, properties: { promptPurpose: { type: "string" }, objective: { type: "string" }, difficulty: { type: "string", enum: ["introductory", "intermediate", "advanced"] }, points: { type: "integer" }, answerKeyStatus: { type: "string" }, verificationRequired: { type: "boolean" } }, required: ["promptPurpose", "objective", "difficulty", "points", "answerKeyStatus", "verificationRequired"] } } }, required: ["passingScore", "attemptLimit", "questions"] }, missingEvidence: { type: "array", items: { type: "string" } } }, required: ["contentPlan", "visualPlan", "assessmentBlueprint", "missingEvidence"] }
      }, "openai");
      plans = result.value;
      if (!plans || !Array.isArray(plans.contentPlan) || !Array.isArray(plans.visualPlan) || !plans.assessmentBlueprint || !Array.isArray(plans.missingEvidence)) throw new Error("AI returned invalid structured data.");
    } catch (error) {
      throw aiProviderError("generateReviewPlans", error);
    }
    const { error: updateError } = await supabase.from("ai_academic_builder_jobs").update({ research_evidence: input.evidence, content_plan: plans.contentPlan, visual_plan: plans.visualPlan, assessment_blueprint: plans.assessmentBlueprint, missing_information: plans.missingEvidence ?? [], generated_by: userId, generated_at: (/* @__PURE__ */ new Date()).toISOString(), status: "ready_for_review" }).eq("id", job.id).eq("status", "generation_review");
    if (updateError) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: updateError.message });
    return { jobId: job.id, status: "ready_for_review", plans };
  }),
  generateVisualSpecifications: publicProcedure.input(z7.object({ jobId: z7.string().uuid(), lessons: z7.array(z7.object({ lessonTitle: z7.string().trim().min(2).max(240), lessonDescription: z7.string().trim().min(2).max(4e3), learningObjective: z7.string().trim().min(2).max(500), evidenceUrls: z7.array(z7.string().url().refine((value) => value.startsWith("https://"), "Visual evidence URLs must use HTTPS")).max(12) })).min(1).max(120) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,visual_plan").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (error || !job) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Visual planning is available only for a reviewed private AI Builder job." });
    const result = await runStructuredAI({
      provider: "gemini",
      system: "You are NIU's evidence-bound visual learning architect. Decide whether each lesson benefits from a learning-support visual. Do not invent factual labels, sources, measurements, anatomy, scientific structures, or claims. If evidence is insufficient, set shouldGenerate false and explain the missing evidence. Prefer deterministic diagrams or flowcharts for exact relationships and mark every specification needs_review. Return JSON only.",
      prompt: JSON.stringify({ topic: job.topic, lessons: input.lessons }),
      schema: { type: "object", additionalProperties: false, properties: { specifications: { type: "array", items: visualSpecSchema } }, required: ["specifications"] }
    });
    const specifications = result.value.specifications;
    const { error: updateError } = await supabase.from("ai_academic_builder_jobs").update({ visual_plan: specifications, generated_by: userId, generated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", job.id).in("status", ["generation_review", "ready_for_review"]);
    if (updateError) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Visual specifications could not be saved." });
    return { jobId: job.id, provider: result.provider, model: result.model, specifications, status: job.status };
  }),
  generateVisualAssets: publicProcedure.input(z7.object({ jobId: z7.string().uuid(), assets: z7.array(z7.object({ lessonId: z7.string().uuid(), moduleId: z7.string().uuid(), programmeId: z7.string().uuid().nullable().optional(), lessonTitle: z7.string().trim().min(2).max(240), specification: z7.object({ shouldGenerate: z7.boolean(), visualType: z7.string(), concept: z7.string(), learningObjective: z7.string(), requiredStructures: z7.array(z7.string()), requiredLabels: z7.array(z7.string()), layout: z7.string(), orientation: z7.string(), educationalPurpose: z7.string(), altText: z7.string(), accuracyRequirements: z7.array(z7.string()), accessibilityRequirements: z7.array(z7.string()), reviewStatus: z7.enum(["draft", "needs_review"]) }) })).min(1).max(120) })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").select("id,status,topic,visual_generation_cursor,visual_generation_status").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (jobError || !job) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Visual generation is available only for a private reviewed AI Builder job." });
    const requestedAssets = input.assets.filter((asset) => asset.specification.shouldGenerate);
    if (requestedAssets.length > 12) throw new TRPCError7({ code: "PAYLOAD_TOO_LARGE", message: "Generate at most 12 visual drafts per administrator action. Continue with the remaining lessons after this batch is reviewed." });
    const created = [];
    await supabase.from("ai_academic_builder_jobs").update({ visual_generation_status: "running", visual_generation_error: null }).eq("id", input.jobId);
    for (let assetIndex = 0; assetIndex < input.assets.length; assetIndex += 1) {
      const asset = input.assets[assetIndex];
      if (!asset.specification.shouldGenerate) continue;
      const { data: existing } = await supabase.from("content_library_items").select("id,visual_metadata").eq("is_generated_visual", true).contains("visual_metadata", { jobId: input.jobId, lessonId: asset.lessonId }).limit(1);
      if (existing?.[0]) {
        const { data: existingVersion } = await supabase.from("ai_visual_asset_versions").select("id,review_status").eq("content_item_id", existing[0].id).order("version", { ascending: false }).limit(1).maybeSingle();
        if (existingVersion) created.push({ lessonId: asset.lessonId, contentItemId: existing[0].id, visualVersionId: existingVersion.id, status: existingVersion.review_status });
        continue;
      }
      const prompt = `Original educational ${asset.specification.visualType} for the NIU lesson "${asset.lessonTitle}". Purpose: ${asset.specification.educationalPurpose}. Concept: ${asset.specification.concept}. Learning objective: ${asset.specification.learningObjective}. Required structures: ${asset.specification.requiredStructures.join(", ") || "Missing: administrator must confirm structures."}. Required labels: ${asset.specification.requiredLabels.join(", ") || "Missing: administrator must confirm labels."}. Layout: ${asset.specification.layout}. Orientation: ${asset.specification.orientation}. Accuracy requirements: ${asset.specification.accuracyRequirements.join("; ")}. Do not invent facts or labels. Use no decorative imagery. Keep any text large and minimal; the administrator will verify all content before publication.`;
      const image = await generateImage({ prompt, model: "MODEL_GPT_IMAGE_2", quality: "medium" });
      if (!image.key || !image.url) throw new TRPCError7({ code: "BAD_GATEWAY", message: `Visual generation returned no stored image for ${asset.lessonTitle}.` });
      const metadata = { ...asset.specification, jobId: input.jobId, lessonId: asset.lessonId, moduleId: asset.moduleId, source: "NIU AI Visual Learning Engine", generatedBy: userId, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), generationPrompt: prompt, storageKey: image.key, storageUrl: image.url };
      const { data: item, error: itemError } = await supabase.from("content_library_items").insert({ title: `${asset.lessonTitle} learning visual`, category: "image", file_name: `${asset.lessonId}-ai-visual.png`, content_type: image.mimeType ?? "image/png", storage_path: image.key, description: asset.specification.educationalPurpose, status: "draft", governed_workflow: true, is_generated_visual: true, visual_metadata: metadata, created_by: userId }).select("id").single();
      if (itemError || !item) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: itemError?.message ?? "The private visual record could not be created." });
      const { error: linkError } = await supabase.from("lesson_content_items").insert({ lesson_id: asset.lessonId, content_item_id: item.id, position: 999, is_required: false });
      if (linkError) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: linkError.message });
      const { data: version, error: versionError } = await supabase.from("ai_visual_asset_versions").insert({ content_item_id: item.id, lesson_id: asset.lessonId, module_id: asset.moduleId, programme_id: asset.programmeId ?? null, title: `${asset.lessonTitle} learning visual`, caption: asset.specification.educationalPurpose, alt_text: asset.specification.altText, accessibility_description: asset.specification.accessibilityRequirements.join("; "), educational_purpose: asset.specification.educationalPurpose, generation_model: "MODEL_GPT_IMAGE_2", generation_prompt: prompt, version: 1, change_summary: "Initial AI-generated educational visual draft", review_status: "draft", generation_attempts: 1, created_by: userId }).select("id,review_status").single();
      if (versionError || !version) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: versionError?.message ?? "The visual version record could not be created." });
      created.push({ lessonId: asset.lessonId, contentItemId: item.id, visualVersionId: version.id, status: version.review_status });
      await supabase.from("ai_academic_builder_jobs").update({ visual_generation_cursor: assetIndex + 1 }).eq("id", input.jobId);
    }
    await supabase.from("ai_academic_builder_jobs").update({ visual_generation_status: "completed", visual_generation_cursor: input.assets.length }).eq("id", input.jobId);
    return { jobId: job.id, topic: job.topic, created, status: "draft", message: "Generated visuals are private drafts. Academic and accessibility review is required before any approval or publication." };
  }),
  listVisualAssets: publicProcedure.input(z7.object({ jobId: z7.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: items, error } = await supabase.from("content_library_items").select("id,title,file_name,content_type,storage_path,status,visual_metadata,created_at").eq("is_generated_visual", true).contains("visual_metadata", { jobId: input.jobId }).order("created_at", { ascending: false }).limit(120);
    if (error) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "NIU could not load generated visual drafts." });
    const ids = (items ?? []).map((item) => item.id);
    const { data: versions } = ids.length ? await supabase.from("ai_visual_asset_versions").select("id,content_item_id,lesson_id,module_id,programme_id,title,caption,alt_text,accessibility_description,educational_purpose,generation_prompt,generation_model,version,review_status,reviewed_by,created_at").in("content_item_id", ids).order("version", { ascending: false }).limit(240) : { data: [] };
    return { items: items ?? [], versions: versions ?? [] };
  }),
  regenerateVisualAsset: publicProcedure.input(z7.object({ versionId: z7.string().uuid(), promptAdjustment: z7.string().trim().max(2e3).optional() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: current, error: currentError } = await supabase.from("ai_visual_asset_versions").select("id,content_item_id,lesson_id,module_id,programme_id,title,caption,alt_text,accessibility_description,educational_purpose,generation_prompt,generation_model,generation_attempts,version,review_status").eq("id", input.versionId).maybeSingle();
    if (currentError || !current) throw new TRPCError7({ code: "NOT_FOUND", message: "The visual version is not available for regeneration." });
    if (["published", "archived"].includes(current.review_status)) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Published or archived visual versions cannot be regenerated." });
    if ((current.generation_attempts ?? 0) >= 3) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "This visual has reached the maximum of three generation attempts. Edit the specification or create a new governed draft." });
    const prompt = `${current.generation_prompt} Revised draft request: ${input.promptAdjustment || "Improve clarity while preserving the verified educational concept, labels, and accessibility intent."} Do not invent facts. Return a learning-support visual, not decorative media.`;
    let image;
    try {
      image = await generateImage({ prompt, model: current.generation_model || "MODEL_GPT_IMAGE_2", quality: "medium" });
    } catch (error) {
      const safeError = error instanceof Error ? error.message.slice(0, 500) : "Unknown provider error";
      await supabase.from("ai_visual_asset_versions").update({ generation_attempts: (current.generation_attempts ?? 0) + 1, last_generation_error: safeError }).eq("id", current.id);
      throw new TRPCError7({ code: "BAD_GATEWAY", message: "Visual regeneration failed. The provider error was recorded; retry remains bounded." });
    }
    if (!image.key || !image.url) throw new TRPCError7({ code: "BAD_GATEWAY", message: "Visual regeneration returned no stored image." });
    const metadata = { regeneratedFromVersionId: current.id, storageKey: image.key, storageUrl: image.url, generatedBy: userId, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), generationPrompt: prompt };
    const { data: item, error: itemError } = await supabase.from("content_library_items").insert({ title: current.title, category: "image", file_name: `${current.lesson_id}-ai-visual-v${current.version + 1}.png`, content_type: image.mimeType ?? "image/png", storage_path: image.key, description: current.educational_purpose, status: "draft", governed_workflow: true, is_generated_visual: true, visual_metadata: metadata, created_by: userId }).select("id").single();
    if (itemError || !item) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: itemError?.message ?? "The regenerated visual draft could not be registered." });
    const { error: linkError } = await supabase.from("lesson_content_items").insert({ lesson_id: current.lesson_id, content_item_id: item.id, position: 999, is_required: false });
    if (linkError) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: linkError.message });
    const { data: version, error: versionError } = await supabase.from("ai_visual_asset_versions").insert({ content_item_id: item.id, lesson_id: current.lesson_id, module_id: current.module_id, programme_id: current.programme_id, title: current.title, caption: current.caption, alt_text: current.alt_text, accessibility_description: current.accessibility_description, educational_purpose: current.educational_purpose, generation_model: current.generation_model || "MODEL_GPT_IMAGE_2", generation_prompt: prompt, generation_attempts: (current.generation_attempts ?? 0) + 1, version: current.version + 1, change_summary: `Regenerated from visual version ${current.version}`, review_status: "draft", created_by: userId }).select("id,review_status,version").single();
    if (versionError || !version) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: versionError?.message ?? "The regenerated visual version could not be created." });
    return { contentItemId: item.id, visualVersionId: version.id, version: version.version, status: version.review_status };
  }),
  removeVisualDraft: publicProcedure.input(z7.object({ contentItemId: z7.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: item, error: itemError } = await supabase.from("content_library_items").select("id,status,is_generated_visual").eq("id", input.contentItemId).maybeSingle();
    if (itemError || !item || !item.is_generated_visual) throw new TRPCError7({ code: "NOT_FOUND", message: "Only generated visual drafts can be removed here." });
    if (["published", "archived"].includes(item.status)) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Published or archived visuals cannot be removed." });
    const { error } = await supabase.from("content_library_items").delete().eq("id", input.contentItemId).eq("is_generated_visual", true).in("status", ["draft", "review"]);
    if (error) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "The visual draft could not be removed." });
    return { removed: true, contentItemId: input.contentItemId };
  }),
  updateVisualAssetVersion: publicProcedure.input(z7.object({ versionId: z7.string().uuid(), caption: z7.string().trim().min(3).max(1e3).optional(), altText: z7.string().trim().min(3).max(1e3).optional(), accessibilityDescription: z7.string().trim().min(3).max(4e3).optional(), educationalPurpose: z7.string().trim().min(3).max(2e3).optional(), reviewStatus: z7.enum(["draft", "review", "approved"]).optional() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: current, error: currentError } = await supabase.from("ai_visual_asset_versions").select("id,review_status").eq("id", input.versionId).maybeSingle();
    if (currentError || !current) throw new TRPCError7({ code: "NOT_FOUND", message: "The visual version is not available." });
    if (["published", "archived"].includes(current.review_status)) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Published or archived visual versions are immutable." });
    const patch = { ...input.caption ? { caption: input.caption } : {}, ...input.altText ? { alt_text: input.altText } : {}, ...input.accessibilityDescription ? { accessibility_description: input.accessibilityDescription } : {}, ...input.educationalPurpose ? { educational_purpose: input.educationalPurpose } : {}, ...input.reviewStatus ? { review_status: input.reviewStatus } : {}, reviewed_by: input.reviewStatus === "approved" ? userId : null };
    const { data, error } = await supabase.from("ai_visual_asset_versions").update(patch).eq("id", input.versionId).in("review_status", ["draft", "review"]).select("id,review_status,caption,alt_text,accessibility_description,educational_purpose,reviewed_by").single();
    if (error || !data) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: error?.message ?? "The visual version could not be updated. Check its current governed status." });
    return data;
  }),
  handoffToCurriculumImport: publicProcedure.input(z7.object({ jobId: z7.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,blueprint,research_sources,research_notes").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (jobError || !job) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Draft handoff is blocked until the AI Builder job has completed research review or evidence-bound generation planning." });
    const blueprint = job.blueprint;
    const sources = Array.isArray(job.research_sources) ? job.research_sources : [];
    const notes = typeof job.research_notes === "string" ? job.research_notes : "";
    if (!blueprint || sources.length < 1 || notes.length < 20) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Draft handoff requires a blueprint, at least one reviewed HTTPS source, and research notes." });
    const sourceText = blueprintToMarkdown(job.topic, blueprint, sources, notes);
    const parsed = analyzeCurriculumDocument(sourceText, `ai-builder-${job.id}.md`);
    if (parsed.validationErrors.length || parsed.missingInformation.length) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Draft handoff is blocked because the generated source still has validation or missing-information markers." });
    const uploaded = await storagePut(`ai-builder/${job.id}.md`, sourceText, "text/markdown");
    const { data: inserted, error: insertError } = await supabase.from("curriculum_imports").insert({ source_file_name: `ai-builder-${job.id}.md`, source_mime_type: "text/markdown", source_storage_path: uploaded.key, status: "uploaded", analysis: parsed, validation_errors: parsed.validationErrors, missing_information: parsed.missingInformation, review_notes: notes, created_by: userId }).select("id,status,source_file_name,analysis,validation_errors,missing_information").single();
    if (insertError || !inserted) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: insertError?.message ?? "The private AI Builder handoff could not be saved." });
    const { error: updateError } = await supabase.from("curriculum_imports").update({ status: "generated" }).eq("id", inserted.id);
    if (updateError) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: updateError.message });
    const { error: jobUpdateError } = await supabase.from("ai_academic_builder_jobs").update({ status: "ready_for_review", draft_artifact: { importId: inserted.id, storagePath: uploaded.key }, generated_at: (/* @__PURE__ */ new Date()).toISOString(), generated_by: userId }).eq("id", job.id).in("status", ["generation_review", "ready_for_review"]);
    if (jobUpdateError) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: jobUpdateError.message });
    return { jobId: job.id, importId: inserted.id, status: "ready_for_review" };
  }),
  generateCompletePackage: publicProcedure.input(z7.object({ jobId: z7.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,topic,status,blueprint,content_plan,visual_plan,assessment_blueprint,research_evidence,research_notes,generated_record_ids").eq("id", input.jobId).in("status", ["generation_review", "ready_for_review"]).maybeSingle();
    if (error || !job) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Complete package generation requires a reviewed AI Builder job." });
    if (job.generated_record_ids && Object.keys(job.generated_record_ids).length) throw new TRPCError7({ code: "CONFLICT", message: "This AI Builder job already has a generated draft package." });
    const blueprint = job.blueprint;
    if (!blueprint?.programme || !blueprint.courses?.length) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "A complete package requires a saved programme blueprint and at least one course." });
    if (!Array.isArray(job.research_evidence) || job.research_evidence.length < 1 || String(job.research_notes ?? "").trim().length < 20) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Complete package generation requires administrator research review and source evidence first." });
    const storagePaths = [];
    let materialIndex = 0;
    for (const course of blueprint.courses) for (const module of course.modules) for (const lesson of module.lessons) {
      const fileName = `ai-builder-${job.id}-${materialIndex}.md`;
      const body = `# Draft study guide: ${lesson.title}\\n\\nStatus: private NIU AI Builder draft.\\n\\nThis material is a structured authoring draft for administrator review. It makes no factual claim without verified source evidence.\\n\\n## Learning objectives\\n${lesson.objectives.map((item) => `- ${item}`).join("\\n")}\\n\\n## Activities to author\\n${lesson.activityIdeas.map((item) => `- ${item}`).join("\\n") || "- Administrator must author an activity."}\\n\\n## Evidence boundary\\nAdministrator must attach and verify authoritative sources before approval.`;
      const uploaded = await storagePut(`ai-builder/${job.id}/materials/${fileName}`, body, "text/markdown");
      storagePaths.push({ fileName, storagePath: uploaded.key });
      materialIndex += 1;
    }
    const packagePayload = compileCompleteDraftPackage(job.topic, blueprint, { contentPlan: job.content_plan, visualPlan: job.visual_plan, assessmentBlueprint: job.assessment_blueprint }, storagePaths);
    const { data: created, error: rpcError } = await supabase.rpc("niu_create_ai_draft_package", { p_job_id: input.jobId, p_package: packagePayload });
    if (rpcError || !created) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: rpcError?.message ?? "The governed draft-package generator could not create its private records." });
    return { jobId: input.jobId, status: "ready_for_review", generated: created, createdBy: userId };
  }),
  runQualityGate: publicProcedure.input(z7.object({ jobId: z7.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,status,blueprint,content_plan,visual_plan,research_evidence,generated_record_ids").eq("id", input.jobId).maybeSingle();
    const ids = job?.generated_record_ids;
    if (error || !job || !ids?.programId || !ids.courses?.length) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Quality gate is available after a complete private draft package has been generated." });
    const courseIds = ids.courses.map((course) => course.courseId);
    const { data: links } = await supabase.from("program_courses").select("course_id").eq("program_id", ids.programId).in("course_id", courseIds);
    const { data: courseRows } = await supabase.from("courses").select("id,title,status,governed_workflow").in("id", courseIds);
    const { data: modules } = await supabase.from("course_modules").select("id,course_id,status,governed_workflow").in("course_id", courseIds);
    const moduleIds = (modules ?? []).map((module) => module.id);
    const { data: lessons } = moduleIds.length ? await supabase.from("lessons").select("id,module_id,status,governed_workflow,content_json,learning_objectives").in("module_id", moduleIds) : { data: [] };
    const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
    const { data: materials } = lessonIds.length ? await supabase.from("lesson_content_items").select("lesson_id,content_item_id").in("lesson_id", lessonIds) : { data: [] };
    const { data: assessments } = await supabase.from("assessments").select("id,course_id,status").in("course_id", courseIds);
    const assessmentIds = (assessments ?? []).map((assessment) => assessment.id);
    const { data: assessmentQuestions } = assessmentIds.length ? await supabase.from("assessment_questions").select("assessment_id,question_id").in("assessment_id", assessmentIds) : { data: [] };
    const { data: visualItems } = await supabase.from("content_library_items").select("id").eq("is_generated_visual", true).contains("visual_metadata", { jobId: input.jobId }).limit(120);
    const visualItemIds = (visualItems ?? []).map((item) => item.id);
    const { data: visualVersions } = visualItemIds.length ? await supabase.from("ai_visual_asset_versions").select("content_item_id,review_status").in("content_item_id", visualItemIds).limit(240) : { data: [] };
    const requiredVisuals = Array.isArray(job.visual_plan) ? job.visual_plan.filter((item) => item?.shouldGenerate === true).length : 0;
    const approvedVisuals = (visualVersions ?? []).filter((item) => item.review_status === "approved").length;
    const courseTitles = (courseRows ?? []).map((row) => String(row.title ?? "").trim().toLowerCase()).filter(Boolean);
    const evidenceRecords = Array.isArray(job.research_evidence) ? job.research_evidence : Object.values(job.research_evidence ?? {});
    const checks = [
      { key: "source-provenance", label: "Source provenance is recorded", passed: evidenceRecords.length > 0 },
      { key: "curriculum-completeness", label: "Curriculum has courses, modules, lessons, and objectives", passed: courseIds.length > 0 && moduleIds.length > 0 && lessonIds.length > 0 && (lessons ?? []).every((row) => Array.isArray(row.learning_objectives) && row.learning_objectives.length > 0) },
      { key: "duplicate-content", label: "Course titles contain no duplicates", passed: new Set(courseTitles).size === courseTitles.length },
      { key: "visual-plan", label: "Visual requirements are explicitly planned", passed: Array.isArray(job.visual_plan) },
      { key: "visual-review", label: "Required visuals are approved before publication", passed: approvedVisuals >= requiredVisuals },
      { key: "accessibility", label: "Accessibility metadata is present", passed: lessonIds.length > 0 && (lessons ?? []).every((row) => Array.isArray(row.content_json?.accessibility) && row.content_json.accessibility.length > 0) },
      { key: "programme-course-links", label: "Programme/course relationships", passed: (links ?? []).length === courseIds.length },
      { key: "courses-draft", label: "Courses remain draft", passed: (courseRows ?? []).length === courseIds.length && (courseRows ?? []).every((row) => row.status === "draft" && row.governed_workflow) },
      { key: "modules-draft", label: "Ordered modules remain draft", passed: moduleIds.length > 0 && (modules ?? []).every((row) => row.status === "draft" && row.governed_workflow) },
      { key: "lessons-draft", label: "Lessons remain draft", passed: lessonIds.length > 0 && (lessons ?? []).every((row) => row.status === "draft" && row.governed_workflow) },
      { key: "protected-material-links", label: "Protected material links exist", passed: materials?.length === lessonIds.length && lessonIds.length > 0 },
      { key: "assessments-draft", label: "Assessments and question mappings exist as drafts", passed: (assessments ?? []).length > 0 && (assessments ?? []).every((row) => row.status === "draft") && (assessmentQuestions ?? []).length > 0 },
      { key: "certificate-configuration", label: "Certificate configuration remains reviewable", passed: Boolean(job.blueprint?.programme?.certificateSettings || job.blueprint?.certificateSettings || job.content_plan?.certificateSettings) },
      { key: "publication-boundary", label: "Publication boundary remains closed", passed: ["ready_for_review", "generation_review"].includes(job.status) }
    ];
    return { jobId: input.jobId, checks, passed: checks.every((check) => check.passed), generated: { courses: courseIds.length, modules: moduleIds.length, lessons: lessonIds.length, materials: materials?.length ?? 0, assessments: assessments?.length ?? 0, questions: assessmentQuestions?.length ?? 0 } };
  }),
  learnerPreview: publicProcedure.input(z7.object({ jobId: z7.string().uuid() })).query(async ({ ctx, input }) => {
    const { supabase } = await getStaffSession(ctx.req);
    const { data: job, error } = await supabase.from("ai_academic_builder_jobs").select("id,status,generated_record_ids").eq("id", input.jobId).maybeSingle();
    const ids = job?.generated_record_ids;
    if (error || !job || !ids?.courses?.length) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Learner preview is available after a complete private draft package has been generated." });
    const courseIds = ids.courses.map((course) => course.courseId);
    const { data: courseRows } = await supabase.from("courses").select("id,title,description,level,duration_minutes,learning_objectives,requirements,status").in("id", courseIds);
    const { data: modules } = await supabase.from("course_modules").select("id,course_id,title,description,position,learning_level,learning_objectives,estimated_minutes,status").in("course_id", courseIds).order("position");
    const moduleIds = (modules ?? []).map((module) => module.id);
    const { data: lessons } = moduleIds.length ? await supabase.from("lessons").select("id,module_id,kind,title,description,position,estimated_minutes,points,status").in("module_id", moduleIds).order("position") : { data: [] };
    return { jobId: input.jobId, status: job.status, courses: (courseRows ?? []).map((course) => ({ ...course, modules: (modules ?? []).filter((module) => module.course_id === course.id).map((module) => ({ ...module, lessons: (lessons ?? []).filter((lesson) => lesson.module_id === module.id) })) })) };
  }),
  createPlan: publicProcedure.input(z7.object({ topic: z7.string().trim().min(3).max(240), settings: settingsSchema })).mutation(async ({ ctx, input }) => {
    const { supabase, userId } = await getStaffSession(ctx.req);
    const { data: job, error: jobError } = await supabase.from("ai_academic_builder_jobs").insert({ topic: input.topic, settings: input.settings, status: "planning", created_by: userId }).select("id").single();
    if (jobError || !job) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "The AI Builder planning job could not be started." });
    try {
      const result = await runStructuredAIWithFallback({
        provider: "gemini",
        system: "You are NIU's curriculum architect and instructional designer. NIU offers certificate programmes only. Create an original, reviewable planning blueprint, never publishable records. Use only the topic and explicit settings. Do not invent references, research findings, accreditation, licensing, employment, or recognition claims. Match the requested generation depth: Starter creates architecture only; Standard adds lesson objectives, activities, reading guidance, summaries, and self-checks; Premium adds complete original Markdown notes, examples, case studies, assessments, questions, answer explanations, points, and completion rules. Mark missing information rather than guessing. Return JSON matching the schema exactly.",
        prompt: `Programme topic: ${input.topic}
Settings: ${JSON.stringify(input.settings)}
Design a coherent progression from foundation to assessment. Keep every generated item draft-only and suitable for administrator review.`,
        schema: blueprintSchema
      }, "openai");
      const blueprint = result.value;
      validateBlueprint(blueprint, input.settings.generationDepth);
      const { error: updateError } = await supabase.from("ai_academic_builder_jobs").update({ status: "research_review", blueprint, research_plan: blueprint.researchPlan ?? [], missing_information: blueprint.missingInformation ?? [], validation_errors: [], reviewed_at: null, reviewed_by: null }).eq("id", job.id);
      if (updateError) throw updateError;
      return { jobId: job.id, status: "research_review", blueprint };
    } catch (error) {
      const safeError = aiProviderError("createPlan", error);
      await supabase.from("ai_academic_builder_jobs").update({ status: "failed", validation_errors: [{ message: safeError.message }] }).eq("id", job.id);
      throw safeError;
    }
  })
});

// server/routers.ts
var appRouter = router({ system: systemRouter, auth: router({ me: publicProcedure.query((opts) => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  return { success: true };
}) }), catalog: catalogRouter, course: courseRouter, credential: credentialRouter, media: mediaRouter, staff: staffRouter, aiBuilder: aiBuilderRouter });

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/app.ts
function createApp() {
  const app = express();
  app.set("query parser", "simple");
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ limit: "1mb", extended: false, parameterLimit: 100 }));
  app.post("/api/learning-notes/upload", express.raw({ type: "*/*", limit: "10mb" }), uploadLearningNote);
  app.post("/api/content-library/upload", express.raw({ type: "*/*", limit: "10mb" }), uploadContentLibraryItem);
  app.post("/api/content-library/attach", attachContentLibraryItem);
  app.post("/api/content-library/initialize-digital-study-guide", initializeDigitalStudyGuide);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  app.use((error, _req, res, _next) => {
    const reply = res;
    if (reply.headersSent) return;
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    const message = status === 413 ? "Request is too large." : "NIU server request failed.";
    reply.status(status).type("application/json").json({ success: false, error: message });
  });
  return app;
}

// api/index.source.ts
var appPromise;
async function loadApp() {
  return createApp();
}
function safeErrorMessage(error) {
  const raw = error instanceof Error ? error.message : "unknown runtime failure";
  console.error(`[NIU API bootstrap] ${raw.slice(0, 240)}`);
  if (/not configured|missing.*(key|env)|environment/i.test(raw)) return "NIU server configuration is incomplete.";
  return "NIU server request failed.";
}
function sendJson(res, statusCode, body) {
  const reply = res;
  if (reply.headersSent) return;
  reply.statusCode = statusCode;
  reply.setHeader?.("content-type", "application/json; charset=utf-8");
  reply.end?.(JSON.stringify(body));
}
async function handler(req, res) {
  if (req.url?.split("?")[0] === "/api/healthz") {
    return sendJson(res, 200, {
      success: true,
      service: "niu-api",
      runtime: "vercel",
      build: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown"
    });
  }
  try {
    appPromise ??= loadApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    return sendJson(res, 500, { success: false, error: safeErrorMessage(error) });
  }
}
export {
  handler as default,
  sendJson
};
