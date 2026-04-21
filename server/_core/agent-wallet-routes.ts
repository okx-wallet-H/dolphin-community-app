import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, upsertUser } from "../db";
import { sendWalletOtp, verifyWalletOtp } from "./agent-wallet";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

type SessionUserInput = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
};

async function syncAgentWalletUser(userInfo: SessionUserInput) {
  if (!userInfo.openId) {
    throw new Error("openId missing from Agent Wallet user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name ?? null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? "agent_wallet_email",
    lastSignedIn,
  });

  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name ?? null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? "agent_wallet_email",
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        id?: number | null;
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | string | null;
      },
) {
  const lastSignedInValue = user?.lastSignedIn ?? new Date();
  const lastSignedIn =
    typeof lastSignedInValue === "string"
      ? lastSignedInValue
      : (lastSignedInValue as Date).toISOString();

  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn,
  };
}

// 安全的请求体字符串提取函数，包含长度限制
function getBodyString(body: unknown, key: string, maxLength: number = 500) {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") return "";
  
  // 防止过长的输入
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${key} 超过最大长度 ${maxLength}`);
  }
  
  return trimmed;
}

export function registerAgentWalletRoutes(app: Express) {
  const handleSendOtpInfo = (_req: Request, res: Response) => {
    res.status(405).json({
      error: "Method not allowed",
      allowedMethods: ["POST"],
      route: "/api/agent-wallet/send-code",
    });
  };

  const handleSendOtp = async (req: Request, res: Response) => {
    try {
      const email = getBodyString(req.body, "email", 254); // RFC 5321

      if (!email) {
        res.status(400).json({ error: "邮箱不能为空" });
        return;
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: "不是有效的邮箱地址" });
        return;
      }

      const result = await sendWalletOtp(email);
      res.json(result);
    } catch (error) {
      console.error("[Agent Wallet] send otp failed", error);
      // 不详细暴露内部错误信息
      const statusCode = error instanceof Error && error.message.includes("超过") ? 400 : 500;
      res.status(statusCode).json({ error: "发送验证码失败" });
    }
  };

  app.get("/api/agent-wallet/send-code", handleSendOtpInfo);
  app.get("/api/agent-wallet/send-otp", handleSendOtpInfo);

  app.post("/api/agent-wallet/send-code", handleSendOtp);
  app.post("/api/agent-wallet/send-otp", handleSendOtp);

  const handleVerifyInfo = (_req: Request, res: Response) => {
    res.status(405).json({
      error: "Method not allowed",
      allowedMethods: ["POST"],
      route: "/api/agent-wallet/verify",
    });
  };

  const handleVerify = async (req: Request, res: Response) => {
    const email =
      getBodyString(req.body, "email") ||
      getBodyString(req.body, "walletEmail") ||
      getBodyString(req.body, "account");
    const code =
      getBodyString(req.body, "code") ||
      getBodyString(req.body, "otp") ||
      getBodyString(req.body, "verificationCode");
    const requestId = getBodyString(req.body, "requestId", 4000) || getBodyString(req.body, "flowId", 4000);

    if (!email || !code) {
      res.status(400).json({ error: "email and code are required" });
      return;
    }

    try {
      const result = await verifyWalletOtp({ email, code, requestId });
      const user = await syncAgentWalletUser(result.sessionUser);
      const sessionToken = await sdk.createSessionToken(result.sessionUser.openId, {
        name: result.sessionUser.name,
        expiresInMs: ONE_YEAR_MS,
        wallet: {
          email: result.wallet.email,
          evmAddress: result.wallet.evmAddress,
          solanaAddress: result.wallet.solanaAddress,
        },
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
        wallet: result.wallet,
        isNewWallet: result.isNewWallet,
        mockMode: result.mockMode,
      });
    } catch (error) {
      console.error("[Agent Wallet] verify otp failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to verify OTP",
      });
    }
  };

  app.get("/api/agent-wallet/verify", handleVerifyInfo);
  app.post("/api/agent-wallet/verify", handleVerify);

  app.get("/api/agent-wallet/me", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : undefined;
      const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
      const sessionCookie = cookieHeader
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
        ?.slice(COOKIE_NAME.length + 1);
      const session = await sdk.verifySession(bearerToken || sessionCookie);
      const user = await sdk.authenticateRequest(req);
      res.json({
        user: buildUserResponse(user),
        wallet: session?.wallet
          ? {
              email: session.wallet.email ?? user.email ?? null,
              evmAddress: session.wallet.evmAddress ?? "",
              solanaAddress: session.wallet.solanaAddress ?? "",
            }
          : null,
      });
    } catch (error) {
      console.error("[Agent Wallet] get current user failed", error);
      res.status(401).json({ error: "Not authenticated", user: null, wallet: null });
    }
  });

  const handleLogout = (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  };

  app.post("/api/agent-wallet/logout", handleLogout);
}
