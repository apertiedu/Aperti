import { toast } from "sonner";

interface NotifyOptions {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export function useNotify() {
  const success = (title: string, opts?: NotifyOptions) =>
    toast.success(title, {
      description: opts?.description,
      duration: opts?.duration ?? 3500,
      action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined,
    });

  const error = (title: string, opts?: NotifyOptions) =>
    toast.error(title, {
      description: opts?.description,
      duration: opts?.duration ?? 5000,
      action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined,
    });

  const info = (title: string, opts?: NotifyOptions) =>
    toast.info(title, {
      description: opts?.description,
      duration: opts?.duration ?? 4000,
    });

  const loading = (title: string, opts?: NotifyOptions) =>
    toast.loading(title, {
      description: opts?.description,
    });

  const milestone = (title: string, description?: string) =>
    toast.success(title, {
      description,
      duration: 6000,
      icon: "🎉",
    });

  return { success, error, info, loading, milestone, toast };
}

export { toast };
