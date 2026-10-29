import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { auth, homeForRole } from "../../lib/auth.js";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const buildTimeClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

function loadGsi() {
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
 * Official Google Identity Services button. Google returns an ID token to the
 * browser, which is verified by the backend at POST /auth/google.
 */
export function GoogleSignInButton({ mode = "signin", onError, disabled = false, termsAccepted = false, redirectTo }) {
  const navigate = useNavigate();
  const location = useLocation();
  const btnRef = useRef(null);
  const [clientId, setClientId] = useState(buildTimeClientId);
  const [configChecked, setConfigChecked] = useState(Boolean(buildTimeClientId));
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState("");

  useEffect(() => {
    if (buildTimeClientId) return;
    let cancelled = false;
    (async () => {
      try {
        const config = await api.get("/auth/config", { skipAuth: true });
        if (!cancelled && config?.googleClientId) setClientId(String(config.googleClientId).trim());
      } catch {
        // Email/password sign-in still works when Google is unavailable.
      } finally {
        if (!cancelled) setConfigChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCredential = useCallback(
    async (response) => {
      const idToken = response?.credential;
      if (!idToken) {
        const message = "Google sign-in was cancelled or failed. Please try again.";
        setBlocked(message);
        onError?.(message);
        return;
      }
      setLoading(true);
      setBlocked("");
      try {
        const session = await api.post(
          "/auth/google",
          { idToken, termsAccepted: mode === "signup" || termsAccepted },
          { skipAuth: true },
        );
        auth.save(session);
        navigate(redirectTo || location.state?.from?.pathname || homeForRole(session.user?.role), { replace: true });
      } catch (reason) {
        const message = reason.message || "Google sign-in failed. Please try again.";
        setBlocked(message);
        onError?.(message);
      } finally {
        setLoading(false);
      }
    },
    [location.state, mode, navigate, onError, redirectTo, termsAccepted],
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
        const width = Math.min(Math.max(btnRef.current.clientWidth || 360, 240), 400);
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "outline",
          size: "large",
          width,
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
        });
      })
      .catch(() => {
        if (!cancelled) {
          const message = "Could not load Google sign-in. Check your connection and refresh.";
          setBlocked(message);
          onError?.(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, disabled, handleCredential, mode, onError]);

  if (disabled) {
    return (
      <div className="google-signin">
        <div className="auth-divider" aria-hidden="true"><span>or continue with</span></div>
        <p className="google-consent">Accept the Terms and Privacy Policy above to continue with Google.</p>
      </div>
    );
  }

  if (!configChecked || !clientId) return null;

  return (
    <div className="google-signin">
      <div className="auth-divider" aria-hidden="true"><span>or continue with</span></div>
      {mode === "signup" && (
        <p className="google-consent">
          By continuing with Google, you agree to the{" "}
          <Link to="/legal/terms" target="_blank">Terms</Link> and{" "}
          <Link to="/legal/privacy" target="_blank">Privacy Policy</Link>.
        </p>
      )}
      <div ref={btnRef} className="google-button" />
      {loading && <p className="google-status" role="status">Signing in with Google…</p>}
      {blocked && !onError && <p className="google-error" role="alert">{blocked}</p>}
    </div>
  );
}
