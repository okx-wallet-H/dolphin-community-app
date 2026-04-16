import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();

        if (!apiUser) {
          setUser(null);
          await Auth.clearUserInfo();
          return;
        }

        const userInfo: Auth.User = {
          id: apiUser.id,
          openId: apiUser.openId,
          name: apiUser.name,
          email: apiUser.email,
          loginMethod: apiUser.loginMethod,
          lastSignedIn: new Date(apiUser.lastSignedIn),
        };

        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
        return;
      }

      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        setUser(null);
        return;
      }

      const cachedUser = await Auth.getUserInfo();
      setUser(cachedUser ?? null);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error("获取登录状态失败");
      setError(nextError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      // 远端退出失败时仍继续本地清理，保证用户可安全退出。
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }

    if (Platform.OS === "web") {
      void fetchUser();
      return;
    }

    let cancelled = false;

    Auth.getUserInfo()
      .then((cachedUser) => {
        if (cancelled) {
          return;
        }

        if (cachedUser) {
          setUser(cachedUser);
          setLoading(false);
          return;
        }

        void fetchUser();
      })
      .catch(() => {
        if (!cancelled) {
          void fetchUser();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
