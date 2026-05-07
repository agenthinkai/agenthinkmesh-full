import { useState, useCallback, useRef } from "react";

export type CopyState = "idle" | "copied" | "failed";

export interface UseProspectCopyLinkResult {
  copyState: CopyState;
  copyLink: () => void;
  currentUrl: string;
}

/**
 * Shared hook for copying the current page URL (including prospect query params)
 * to the clipboard. Manages copy state and resets it after 2 seconds.
 */
export function useProspectCopyLink(): UseProspectCopyLinkResult {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setCopyState("idle");
      timerRef.current = null;
    }, 2000);
  }, []);

  const copyLink = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopyState("copied");
          reset();
        })
        .catch(() => {
          setCopyState("failed");
          reset();
        });
    } else {
      try {
        const el = document.createElement("textarea");
        el.value = url;
        el.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopyState("copied");
        reset();
      } catch {
        setCopyState("failed");
        reset();
      }
    }
  }, [reset]);

  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return { copyState, copyLink, currentUrl };
}
