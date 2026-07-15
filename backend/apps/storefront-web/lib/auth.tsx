"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { customerLogin, customerMe, customerRegister, getBootstrap } from "./api";
import type { StoreLite } from "./types";

interface AuthContextValue {
  ready: boolean;
  orgId: string | null;
  stores: StoreLite[];
  token: string | null;
  customer: { id: string; name: string; email: string } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "sellivo.customer.token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreLite[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] =
    useState<{ id: string; name: string; email: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const boot = await getBootstrap();
        setOrgId(boot.org.id);
        setStores(boot.stores);
        const saved = localStorage.getItem(TOKEN_KEY);
        if (saved) {
          setToken(saved);
          try {
            setCustomer(await customerMe(saved));
          } catch {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function persist(accessToken: string) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setCustomer(await customerMe(accessToken));
  }

  const value: AuthContextValue = {
    ready,
    orgId,
    stores,
    token,
    customer,
    login: async (email, password) => {
      if (!orgId) throw new Error("Storefront not ready");
      const { accessToken } = await customerLogin(orgId, { email, password });
      await persist(accessToken);
    },
    register: async (name, email, password) => {
      if (!orgId) throw new Error("Storefront not ready");
      const { accessToken } = await customerRegister(orgId, { name, email, password });
      await persist(accessToken);
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setCustomer(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
