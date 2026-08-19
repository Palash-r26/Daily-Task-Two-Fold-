import { Router, type IRouter, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import { sendPasswordResetEmail } from "../lib/mailer";
import webpush from "web-push";
import {
  db,
  appSettingsTable,
  messagesTable,
  sessionsTable,
  tasksTable,
  usersTable,
  pushSubscriptionsTable,
} from "../db";
import {
  CreateTaskBody,
  EditMessageBody,
  EditMessageParams,
  ListTasksQueryParams,
  LoginBody,
  SendMessageBody,
  UpdateSettingsBody,
  UpdateTaskBody,
  UpdateTaskParams,
  DeleteTaskParams,
  DeleteMessageParams,
} from "../api-zod";
import { randomUUID } from "node:crypto";

// ─── VAPID / Web Push setup ────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       ?? "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

const router: IRouter = Router();
const SESSION_COOKIE = "iu_session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "development-session-secret";
const DEFAULT_JOURNEY_URL = "https://www.google.com";

type UserRecord = typeof usersTable.$inferSelect;
type SessionRecord = typeof sessionsTable.$inferSelect;

const publicUser = (user: UserRecord) => ({
  id: user.id,
  displayName: user.displayName,
  email: user.email,
  profilePhotoUrl: user.profilePhotoUrl,
});

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

let seedPromise: Promise<void> | undefined;
const ensureSeed = () => {
  if (!seedPromise) {
    seedPromise = (async () => {
      const settings = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global")).limit(1);
      if (settings.length === 0) {
        await db.insert(appSettingsTable).values({
          id: "global",
          theme: "dark",
          bubbleStyle: "emoji",
          autoLock: "five_minutes",
          notifications: true,
          journeyUrl: DEFAULT_JOURNEY_URL,
        });
      }
    })();
  }
  return seedPromise;
};

const getSession = async (req: Request) => {
  await ensureSeed();
  const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!sessionId) return null;
  const result = await db
    .select({ session: sessionsTable, user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.id, sessionId), isNull(sessionsTable.revokedAt)))
    .limit(1);
  if (!result[0]) return null;
  await db
    .update(sessionsTable)
    .set({ lastActiveAt: new Date() })
    .where(eq(sessionsTable.id, sessionId));
  return result[0];
};

const requireSession = async (req: Request, res: Response) => {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ error: "Sign in required" });
    return null;
  }
  return session;
};

const mapTask = (task: typeof tasksTable.$inferSelect) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  status: task.status,
  assignedTo: task.assignedTo,
  createdBy: task.createdBy,
  dueDate: task.dueDate,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
});

const mapMessage = (row: { message: typeof messagesTable.$inferSelect; senderName: string }) => ({
  id: row.message.id,
  senderId: row.message.senderId,
  senderName: row.senderName,
  content: row.message.deletedAt ? "Message deleted" : row.message.content,
  createdAt: row.message.createdAt.toISOString(),
  editedAt: toIso(row.message.editedAt),
  deletedAt: toIso(row.message.deletedAt),
  deliveryStatus: row.message.deliveryStatus,
  readAt: toIso(row.message.readAt),
});

router.get("/auth/me", async (req, res) => {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: "Sign in required" });
  return res.json(publicUser(session.user));
});

router.post(["/login", "/auth/login"], async (req, res) => {
  await ensureSeed();
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password" });

  const userResult = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.trim().toLowerCase()))
    .limit(1);
  const user = userResult[0];
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const sessionId = `${randomUUID()}.${SESSION_SECRET.slice(0, 8)}`;
  const now = new Date();
  await db.insert(sessionsTable).values({
    id: sessionId,
    userId: user.id,
    deviceLabel: req.get("user-agent")?.slice(0, 80) || "Mobile browser",
    createdAt: now,
    lastActiveAt: now,
  });
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: true,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  return res.json(publicUser(user));
});

router.post(["/signup", "/auth/signup"], async (req, res) => {
  await ensureSeed();
  const { displayName, email, password } = req.body || {};

  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return res.status(400).json({ error: "Please enter your full display name." });
  }

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();

  const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
  if (existingUser[0]) {
    return res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const inviteCode = `PAIR-${userId.slice(0, 5).toUpperCase()}`;

  await db.insert(usersTable).values({
    id: userId,
    displayName: cleanName,
    email: cleanEmail,
    passwordHash,
    inviteCode,
    profilePhotoUrl: null,
  });

  const sessionId = `${randomUUID()}.${SESSION_SECRET.slice(0, 8)}`;
  const now = new Date();
  await db.insert(sessionsTable).values({
    id: sessionId,
    userId: userId,
    deviceLabel: req.get("user-agent")?.slice(0, 80) || "Mobile browser",
    createdAt: now,
    lastActiveAt: now,
  });

  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: true,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  const newUser = {
    id: userId,
    displayName: cleanName,
    email: cleanEmail,
    passwordHash,
    inviteCode,
    profilePhotoUrl: null,
    partnerId: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: now,
  };

  return res.status(201).json(publicUser(newUser));
});

router.post("/auth/logout", async (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (sessionId) {
    await db.update(sessionsTable).set({ revokedAt: new Date() }).where(eq(sessionsTable.id, sessionId));
  }
  res.clearCookie(SESSION_COOKIE);
  return res.status(204).send();
});

router.get("/auth/devices", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const devices = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, session.user.id), isNull(sessionsTable.revokedAt)))
    .orderBy(desc(sessionsTable.lastActiveAt));
  return res.json(
    devices.map((device) => ({
      id: device.id,
      label: device.deviceLabel,
      createdAt: device.createdAt.toISOString(),
      lastActiveAt: device.lastActiveAt.toISOString(),
      current: device.id === session.session.id,
    })),
  );
});

router.post("/auth/devices/logout-everywhere", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  await db
    .update(sessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(sessionsTable.userId, session.user.id));
  res.clearCookie(SESSION_COOKIE);
  return res.status(204).send();
});

router.get("/tasks", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const parsed = ListTasksQueryParams.safeParse(req.query);
  const status = parsed.success ? parsed.data.status : "all";
  const rows = await db
    .select()
    .from(tasksTable)
    .where(status && status !== "all" ? eq(tasksTable.status, status) : undefined)
    .orderBy(asc(tasksTable.status), desc(tasksTable.updatedAt));
  return res.json(rows.map(mapTask));
});

router.post("/tasks", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a task title" });
  const now = new Date();
  const task = {
    id: randomUUID(),
    title: parsed.data.title.trim(),
    description: parsed.data.description ?? null,
    status: parsed.data.status ?? "pending",
    assignedTo: parsed.data.assignedTo ?? null,
    createdBy: session.user.id,
    dueDate: parsed.data.dueDate ? parsed.data.dueDate.toISOString().slice(0, 10) : null,
    createdAt: now,
    updatedAt: now,
  } as const;
  await db.insert(tasksTable).values(task);
  return res.status(201).json(mapTask(task));
});

router.get("/tasks/summary", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const rows = await db.select({ status: tasksTable.status }).from(tasksTable);
  return res.json({
    total: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    inProgress: rows.filter((row) => row.status === "in_progress").length,
    complete: rows.filter((row) => row.status === "complete").length,
  });
});

router.patch("/tasks/:id", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const params = UpdateTaskParams.safeParse(req.params);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!params.success || !parsed.success) return res.status(400).json({ error: "Task update is invalid" });
  const existing = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id)).limit(1);
  if (!existing[0]) return res.status(404).json({ error: "Task not found" });
  const updateData = {
    ...parsed.data,
    title: parsed.data.title?.trim(),
    dueDate:
      parsed.data.dueDate === undefined
        ? undefined
        : parsed.data.dueDate
          ? parsed.data.dueDate.toISOString().slice(0, 10)
          : null,
    updatedAt: new Date(),
  };
  await db
    .update(tasksTable)
    .set(updateData)
    .where(eq(tasksTable.id, params.data.id));
  const updated = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .limit(1);
  return res.json(mapTask(updated[0]));
});

router.delete("/tasks/:id", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Task id is invalid" });
  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id));
  return res.status(204).send();
});

router.get("/chat/messages", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const rows = await db
    .select({ message: messagesTable, senderName: usersTable.displayName })
    .from(messagesTable)
    .innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .orderBy(asc(messagesTable.createdAt));
  await db.update(messagesTable).set({ deliveryStatus: "read", readAt: new Date() })
    .where(and(ne(messagesTable.senderId, session.user.id), isNull(messagesTable.readAt)));
  return res.json(rows.map(mapMessage));
});

router.post("/chat/messages", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Message is empty" });
  const message = {
    id: randomUUID(),
    senderId: session.user.id,
    content: parsed.data.content.trim(),
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
    deliveryStatus: "delivered",
    readAt: null,
  } as const;
  await db.insert(messagesTable).values(message);

  // ── Send Web Push to the partner's subscribed devices ─────────────────
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    try {
      // Find the actual partner via partnerId (not just any random user)
      const currentUser = await db
        .select({ partnerId: usersTable.partnerId })
        .from(usersTable)
        .where(eq(usersTable.id, session.user.id))
        .limit(1);
      const partnerId = currentUser[0]?.partnerId;

      if (partnerId) {
        const subs = await db
          .select()
          .from(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.userId, partnerId));

        const payload = JSON.stringify({
          title: `New message from ${session.user.displayName}`,
          body: "A sealed message has arrived. Tap to reveal!",
          url: "/chat",
        });

        // Fire-and-forget — don't block the response
        Promise.allSettled(
          subs.map((sub) =>
            webpush
              .sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
              )
              .catch(async (err: { statusCode?: number }) => {
                // 410 Gone / 404 = subscription expired — clean it up
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  await db
                    .delete(pushSubscriptionsTable)
                    .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
                }
              }),
          ),
        );
      }
    } catch {
      // Push errors must never break the message response
    }
  }

  return res.status(201).json(mapMessage({ message, senderName: session.user.displayName }));
});

router.patch("/chat/messages/:id", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const params = EditMessageParams.safeParse(req.params);
  const parsed = EditMessageBody.safeParse(req.body);
  if (!params.success || !parsed.success) return res.status(400).json({ error: "Message update is invalid" });
  await db
    .update(messagesTable)
    .set({ content: parsed.data.content.trim(), editedAt: new Date() })
    .where(and(eq(messagesTable.id, params.data.id), eq(messagesTable.senderId, session.user.id), isNull(messagesTable.deletedAt)));
  const updated = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, params.data.id), eq(messagesTable.senderId, session.user.id), isNull(messagesTable.deletedAt)))
    .limit(1);
  if (!updated[0]) return res.status(404).json({ error: "Message not found" });
  return res.json(mapMessage({ message: updated[0], senderName: session.user.displayName }));
});

router.delete("/chat/messages/:id", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const params = DeleteMessageParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Message id is invalid" });
  await db.update(messagesTable).set({ deletedAt: new Date() })
    .where(and(eq(messagesTable.id, params.data.id), eq(messagesTable.senderId, session.user.id)));
  return res.status(204).send();
});

router.get("/chat/partner", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  
  const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id)).limit(1);
  if (currentUser[0]?.partnerId) {
    const partner = await db.select().from(usersTable).where(eq(usersTable.id, currentUser[0].partnerId)).limit(1);
    if (partner[0]) return res.json(publicUser(partner[0]));
  }

  return res.status(404).json({ error: "No partner connected yet" });
});

router.get("/chat/partner/code", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const user = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id)).limit(1);
  if (!user[0]) return res.status(404).json({ error: "User not found" });

  let inviteCode = user[0].inviteCode;
  if (!inviteCode) {
    inviteCode = `PAIR-${user[0].id.slice(0, 5).toUpperCase()}`;
    await db.update(usersTable).set({ inviteCode }).where(eq(usersTable.id, session.user.id));
  }

  return res.json({ inviteCode, userId: user[0].id });
});

router.post("/chat/partner/connect", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const { code } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).json({ error: "Invite code is required" });

  const cleanCode = code.trim().toUpperCase();
  const targetUsers = await db.select().from(usersTable).where(
    or(eq(usersTable.inviteCode, cleanCode), eq(usersTable.id, req.body.code.trim()))
  ).limit(1);

  if (!targetUsers[0]) return res.status(404).json({ error: "Invalid partner code. Please check and try again." });
  if (targetUsers[0].id === session.user.id) return res.status(400).json({ error: "You cannot connect with your own code!" });

  const partner = targetUsers[0];

  // Prevent connecting if either user already has a partner
  const currentUserRecord = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id)).limit(1);
  if (currentUserRecord[0]?.partnerId) {
    return res.status(400).json({ error: "You are already connected to a partner. Disconnect first." });
  }
  if (partner.partnerId) {
    return res.status(400).json({ error: "This person is already connected to someone else." });
  }

  await db.update(usersTable).set({ partnerId: partner.id }).where(eq(usersTable.id, session.user.id));
  await db.update(usersTable).set({ partnerId: session.user.id }).where(eq(usersTable.id, partner.id));

  return res.json(publicUser(partner));
});

router.post("/chat/partner/disconnect", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id)).limit(1);
  if (!currentUser[0]?.partnerId) {
    return res.status(400).json({ error: "You are not connected to a partner." });
  }

  const partnerId = currentUser[0].partnerId;

  // Clear partnerId for both users
  await db.update(usersTable).set({ partnerId: null }).where(eq(usersTable.id, session.user.id));
  await db.update(usersTable).set({ partnerId: null }).where(eq(usersTable.id, partnerId));

  return res.json({ message: "Partner disconnected successfully." });
});

router.get("/settings", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  await ensureSeed();
  const settings = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global")).limit(1);
  return res.json(settings[0]);
});

// ─── Web Push subscription endpoints ─────────────────────────────────────

/** Return the VAPID public key so the frontend can subscribe */
router.get("/push/vapid-public-key", (_req, res) => {
  return res.json({ publicKey: VAPID_PUBLIC });
});

/** Save a push subscription for the current user's device */
router.post("/push/subscribe", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid push subscription" });
  }

  // Upsert: delete existing sub for same endpoint, then insert fresh
  await db
    .delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));

  await db.insert(pushSubscriptionsTable).values({
    id: randomUUID(),
    userId: session.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });

  return res.status(201).json({ ok: true });
});

/** Remove a push subscription (called on logout) */
router.delete("/push/unsubscribe", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const { endpoint } = req.body || {};
  if (endpoint) {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, session.user.id),
          eq(pushSubscriptionsTable.endpoint, endpoint),
        ),
      );
  } else {
    // Remove ALL subscriptions for this user (logout everywhere)
    await db
      .delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, session.user.id));
  }

  return res.status(204).send();
});

router.patch("/settings", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Settings update is invalid" });
  await db
    .update(appSettingsTable)
    .set(parsed.data)
    .where(eq(appSettingsTable.id, "global"));
  const updated = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, "global"))
    .limit(1);
  return res.json(updated[0]);
});

router.get("/journey", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const settings = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global")).limit(1);
  return res.json({
    title: "A little place to go",
    description: "One small door, whenever you feel like opening it.",
    url: settings[0]?.journeyUrl ?? DEFAULT_JOURNEY_URL,
  });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email address is required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);

  if (!user[0]) {
    return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await db.update(usersTable).set({
    resetToken: token,
    resetTokenExpiry: expiry,
  }).where(eq(usersTable.id, user[0].id));

  const origin = req.headers.origin || "http://localhost:5173";
  const resetLink = `${origin}/reset-password?token=${token}`;

  await sendPasswordResetEmail(cleanEmail, resetLink);

  return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "Reset token and new password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const targetUsers = await db.select().from(usersTable).where(eq(usersTable.resetToken, token.trim())).limit(1);
  if (!targetUsers[0]) {
    return res.status(400).json({ error: "Invalid or expired password reset link." });
  }

  const user = targetUsers[0];
  if (!user.resetTokenExpiry || new Date() > new Date(user.resetTokenExpiry)) {
    return res.status(400).json({ error: "Password reset link has expired. Please request a new one." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({
    passwordHash,
    resetToken: null,
    resetTokenExpiry: null,
  }).where(eq(usersTable.id, user.id));

  return res.json({ message: "Password updated successfully!" });
});

export default router;