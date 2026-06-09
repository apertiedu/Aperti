import { useState, useEffect, useCallback } from "react";
import { fetchJSON, postJSON } from "@/lib/api";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check push support
    if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true);
      setPushPermission(Notification.permission);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
    return result.outcome === "accepted";
  }, [installPrompt]);

  const subscribeToPush = useCallback(async () => {
    if (!pushSupported) return false;
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;

      // Fetch VAPID key
      const { publicKey } = await fetchJSON("/push/vapid-key");
      if (!publicKey) return false;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await postJSON("/push/subscribe", sub.toJSON());
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[pwa] push subscribe error:", err);
      return false;
    }
  }, [pushSupported]);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await postJSON("/push/unsubscribe", { endpoint: sub.endpoint });
      await sub.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      console.error("[pwa] push unsubscribe error:", err);
    }
  }, []);

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    triggerInstall,
    pushSupported,
    pushPermission,
    isSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
  };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// IndexedDB offline storage helper
export async function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("aperti-offline", 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("content")) {
        db.createObjectStore("content", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function queueOfflineAction(action: string, payload: object) {
  const db = await openOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    tx.objectStore("queue").add({ action, payload, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveOfflineContent(id: string, data: object) {
  const db = await openOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("content", "readwrite");
    tx.objectStore("content").put({ id, ...data, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineContent(id: string): Promise<any> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("content", "readonly");
    const req = tx.objectStore("content").get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
