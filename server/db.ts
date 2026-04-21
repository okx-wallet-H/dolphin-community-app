import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

export type AgentWalletOtpSession = {
  email: string;
  flowId: string;
  tempPubKey: string;
  expiresAt: number;
};

let _db: ReturnType<typeof drizzle> | null = null;
let _agentWalletOtpTableReady = false;
let _unsupportedDialectWarned = false;

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function getDatabaseScheme(databaseUrl: string) {
  const match = /^([a-z0-9+.-]+):\/\//i.exec(databaseUrl);
  return match?.[1]?.toLowerCase() || "unknown";
}

function isMysqlDatabaseUrl(databaseUrl: string) {
  const scheme = getDatabaseScheme(databaseUrl);
  return scheme === "mysql" || scheme === "mysql2";
}

// 延迟创建 drizzle 实例，使本地工具可在无数据库的情况下运行。
// 当前仓库的数据层与 schema 都按 MySQL 方言编写；若线上暂时注入的是 PostgreSQL，
// 这里主动降级为“无持久化数据库”模式，避免验证码发送在建表阶段直接失败。
export async function getDb() {
  const databaseUrl = getDatabaseUrl();
  if (!_db && databaseUrl) {
    if (!isMysqlDatabaseUrl(databaseUrl)) {
      if (!_unsupportedDialectWarned) {
        console.warn(
          `[Database] DATABASE_URL uses unsupported dialect for current mysql driver: ${getDatabaseScheme(databaseUrl)}. Falling back to stateless mode.`,
        );
        _unsupportedDialectWarned = true;
      }
      return null;
    }

    try {
      _db = drizzle(databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

async function ensureAgentWalletOtpTable() {
  const db = await getDb();
  if (!db || _agentWalletOtpTableReady) {
    return db;
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_wallet_otp_sessions (
      email varchar(320) NOT NULL PRIMARY KEY,
      flowId varchar(255) NOT NULL,
      tempPubKey text NOT NULL,
      expiresAt bigint NOT NULL,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  _agentWalletOtpTableReady = true;
  return db;
}

export async function saveAgentWalletOtpSession(session: AgentWalletOtpSession): Promise<void> {
  const db = await ensureAgentWalletOtpTable();
  if (!db) {
    console.warn("[Database] Cannot save agent wallet OTP session: database not available");
    return;
  }

  await db.execute(sql`
    INSERT INTO agent_wallet_otp_sessions (email, flowId, tempPubKey, expiresAt)
    VALUES (${session.email}, ${session.flowId}, ${session.tempPubKey}, ${session.expiresAt})
    ON DUPLICATE KEY UPDATE
      flowId = VALUES(flowId),
      tempPubKey = VALUES(tempPubKey),
      expiresAt = VALUES(expiresAt)
  `);
}

export async function getAgentWalletOtpSession(email: string): Promise<AgentWalletOtpSession | null> {
  const db = await ensureAgentWalletOtpTable();
  if (!db) {
    return null;
  }

  const result = await db.execute(sql`
    SELECT email, flowId, tempPubKey, expiresAt
    FROM agent_wallet_otp_sessions
    WHERE email = ${email}
    LIMIT 1
  `);

  const resultWithRows = result as unknown as { rows?: unknown[] };
  const rows = Array.isArray(resultWithRows.rows)
    ? (resultWithRows.rows as Record<string, unknown>[])
    : [];
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    email: typeof row.email === "string" ? row.email : email,
    flowId: typeof row.flowId === "string" ? row.flowId : "",
    tempPubKey: typeof row.tempPubKey === "string" ? row.tempPubKey : "",
    expiresAt:
      typeof row.expiresAt === "number"
        ? row.expiresAt
        : Number(typeof row.expiresAt === "string" ? row.expiresAt : 0),
  };
}

export async function deleteAgentWalletOtpSession(email: string): Promise<void> {
  const db = await ensureAgentWalletOtpTable();
  if (!db) {
    return;
  }

  await db.execute(sql`DELETE FROM agent_wallet_otp_sessions WHERE email = ${email}`);
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: 随着 schema 增长，在此添加功能查询
