import { useEffect, useCallback, useState } from "react";
import { openOfflineDB, queueOfflineAction } from "./use-pwa";

const tok = () => localStorage.getItem("aperti_token") || "";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const getPendingCount = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction("queue", "readonly");
      const req = tx.objectStore("queue").count();
      return new Promise<number>((resolve) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    getPendingCount().then(setPendingCount);
  }, [getPendingCount]);

  const queueAction = useCallback(async (action: string, payload: object) => {
    await queueOfflineAction(action, payload);
    setPendingCount((c) => c + 1);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const db = await openOfflineDB();
      const tx = db.transaction("queue", "readonly");
      const store = tx.objectStore("queue");
      const items: any[] = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!items.length) return;

      const res = await fetch("/api/offline/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok()}`,
        },
        body: JSON.stringify({ actions: items }),
      });

      if (res.ok) {
        const clearTx = db.transaction("queue", "readwrite");
        clearTx.objectStore("queue").clear();
        setPendingCount(0);
      }
    } catch (err) {
      console.error("[offline-sync] error:", err);
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncing]);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow();
    }
  }, [isOnline, pendingCount, syncNow]);

  return { isOnline, pendingCount, syncing, queueAction, syncNow };
}
