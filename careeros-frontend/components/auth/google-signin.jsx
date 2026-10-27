"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { auth } from "@/lib/auth";

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsi() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (document.querySelector(`script[src="${GSI_SRC}"]`)) {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          resolve();
        } else if (tries > 50) {
          clearInterval(timer);
          reject(new Error("Google script failed to load"));
        }
      }, 100);
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * Official Google Sign-In button (Google Identity Services).
 * Sends the ID token to POST /auth/google, which verifies it server-side
 * and returns the normal CareerOS session (access + refresh + user).
 */
export function GoogleSignInButton({
  mode = "signin",
  onError,
  disabled = false,
  termsAccepted = false,
}) {
  const router = useRouter();
  const btnRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState("");
  const buildTimeId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const [runtimeId, setRuntimeId] = useState("");
  const [configChecked, setConfigChecked] = useState(Boolean(buildTimeId));

  // Runtime fallback: the live frontend may have been built before
  // GOOGLE_CLIENT_ID was set in backend.env (NEXT_PUBLIC_* is baked at
  // build time). In that case ask the backend — GET /auth/config is public
  // and returns the same ID — so the button appears without a rebuild.
  useEffect(() => {
    if (buildTimeId) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.get("/auth/config");
        if (!cancelled && cfg?.googleClientId) setRuntimeId(cfg.googleClientId);
      } catch {
        // Email/password still works; keep the Google button hidden.
      } finally {
        if (!cancelled) setConfigChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildTimeId]);

  const clientId = buildTimeId || runtimeId;

  const handleCredential = useCallback(
    async (response) => {
      const idToken = response?.credential;
      if (!idToken) {
        const msg = "Google sign-in was cancelled or failed. Please try again.";
        setBlocked(msg);
        onError?.(msg);
        return;
      }
      setLoading(true);
      setBlocked("");
      try {
        const data = await api.post("/auth/google", { idToken, termsAccepted });
        auth.save(data);
        router.replace(data.user?.role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard");
      } catch (err) {
        const msg = err.message || "Google sign-in failed. Please try again.";
        setBlocked(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    },
    [onError, router, termsAccepted],
  );

  useEffect(() => {
    if (disabled || !clientId) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !btnRef.current) return;
        btnRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
        });
      })
      .catch(() => {
        if (!cancelled) setBlocked("Could not load Google sign-in. Check your connection and refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, mode, handleCredential, disabled]);

  if (disabled) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground">or continue with</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <p className="rounded-xl border border-dashed px-3.5 py-3 text-center text-xs text-muted-foreground">
          Accept the Terms and Privacy Policy above to continue with Google.
        </p>
      </div>
    );
  }

  if (!configChecked) return null;
  if (!clientId) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="relative">
        <div ref={btnRef} className="flex justify-center [&>div]:w-full!" />
        {loading && (
          <p className="mt-2 text-center text-xs text-muted-foreground" role="status">
            Signing in with Google…
          </p>
        )}
        {blocked && (
          <p className="mt-2 text-center text-xs text-destructive" role="alert">
            {blocked}
          </p>
        )}
      </div>
    </div>
  );
}
