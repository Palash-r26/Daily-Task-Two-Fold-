import { Router, type IRouter, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import {
  db,
  appSettingsTable,
  messagesTable,
  sessionsTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
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
} from "@workspace/api-zod";
import { randomUUID } from "node:crypto";

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
      const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
      if (existing.length > 0) return;

      const firstId = "user-alex";
      const secondId = "user-sam";
      const passwordHash = await bcrypt.hash("Update!2026", 12);
      await db.insert(usersTable).values([
        {
          id: firstId,
          displayName: "Alex",
          email: "alex@example.com",
          passwordHash,
          profilePhotoUrl: null,
        },
        {
          id: secondId,
          displayName: "Sam",
          email: "sam@example.com",
          passwordHash,
          profilePhotoUrl: null,
        },
      ]);
      await db.insert(appSettingsTable).values({
        id: "global",
        theme: "dark",
        bubbleStyle: "emoji",
        autoLock: "five_minutes",
        notifications: true,
        journeyUrl: DEFAULT_JOURNEY_URL,
      });

      const now = new Date();
      await db.insert(tasksTable).values([
        {
          id: randomUUID(),
          title: "Plan something lovely for this week",
          description: "A small shared plan goes a long way.",
          status: "in_progress",
          assignedTo: secondId,
          createdBy: firstId,
          dueDate: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: randomUUID(),
          title: "Pick up the little things",
          description: "The everyday details that make the day feel easy.",
          status: "pending",
          assignedTo: firstId,
          createdBy: secondId,
          dueDate: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(messagesTable).values([
        {
          id: randomUUID(),
          senderId: secondId,
          content: "The quiet moments are my favorite.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 18),
          deliveryStatus: "read",
          readAt: new Date(now.getTime() - 1000 * 60 * 17),
        },
        {
          id: randomUUID(),
          senderId: firstId,
          content: "Then let's keep making room for them.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 12),
          deliveryStatus: "delivered",
        },
      ]);
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

router.post("/auth/login", async (req, res) => {
  await ensureSeed();
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password" });

  const userResult = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()))
    .limit(1);
  const user = userResult[0];
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Those details did not match" });
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
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  return res.json(publicUser(user));
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
  const updated = await db
    .update(tasksTable)
    .set(updateData)
    .where(eq(tasksTable.id, params.data.id))
    .returning();
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
  return res.status(201).json(mapMessage({ message, senderName: session.user.displayName }));
});

router.patch("/chat/messages/:id", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const params = EditMessageParams.safeParse(req.params);
  const parsed = EditMessageBody.safeParse(req.body);
  if (!params.success || !parsed.success) return res.status(400).json({ error: "Message update is invalid" });
  const updated = await db
    .update(messagesTable)
    .set({ content: parsed.data.content.trim(), editedAt: new Date() })
    .where(and(eq(messagesTable.id, params.data.id), eq(messagesTable.senderId, session.user.id), isNull(messagesTable.deletedAt)))
    .returning();
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
  const partner = await db.select().from(usersTable).where(ne(usersTable.id, session.user.id)).limit(1);
  if (!partner[0]) return res.status(404).json({ error: "Chat partner not found" });
  return res.json(publicUser(partner[0]));
});

router.get("/settings", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  await ensureSeed();
  const settings = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, "global")).limit(1);
  return res.json(settings[0]);
});

router.patch("/settings", async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Settings update is invalid" });
  const updated = await db
    .update(appSettingsTable)
    .set(parsed.data)
    .where(eq(appSettingsTable.id, "global"))
    .returning();
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

export default router;