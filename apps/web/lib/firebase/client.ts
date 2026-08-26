"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { api } from "@/lib/api";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let emulatorsConnected = false;
let authPromise: Promise<void> | null = null;

function useEmulator(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1";
}

export function firebaseEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseEnabled()) return null;
  if (app) return app;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "rodiumai-local";
  app =
    getApps()[0] ??
    initializeApp({
      projectId,
      apiKey: "forge-emulator-api-key",
      appId: "forge-emulator",
    });
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  if (!db) {
    const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE || "rodiumaidb";
    db = getFirestore(a, databaseId);
  }
  if (useEmulator() && !emulatorsConnected && auth && db) {
    const fsHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
    const authHost =
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
    const [fsHostname, fsPortRaw] = fsHost.split(":");
    connectFirestoreEmulator(db, fsHostname, Number(fsPortRaw || 8085));
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    emulatorsConnected = true;
  }
  return db;
}

type TokenResponse = {
  token: string;
  project_id: string;
  database_id: string;
  enabled: boolean;
};

/** Sign into Firebase Auth with a Forge JWT → custom token exchange. */
export async function ensureFirebaseAuth(): Promise<boolean> {
  if (!firebaseEnabled()) return false;
  const a = getFirebaseAuth();
  getFirestoreDb();
  if (!a) return false;
  if (a.currentUser) return true;
  if (!authPromise) {
    authPromise = (async () => {
      const res = await api<TokenResponse>("/auth/firebase-custom-token", {
        method: "POST",
      });
      await signInWithCustomToken(a, res.token);
    })().finally(() => {
      authPromise = null;
    });
  }
  try {
    await authPromise;
    return true;
  } catch {
    return false;
  }
}
