import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api.js";
import { auth, homeForRole } from "../lib/auth.js";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
let googleScriptPromise;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        window.clearTimeout(timeout);
        resolve();
      }
    }, 100);
    const timeout = window.setTimeout(() => {
      window.clearInterval(timer);
      googleScriptPromise = undefined;
      reject(new Error("Google sign-in could not be loaded. Check your connection and try again."));
    }, 10000);
    script.addEventListener("error", () => {
      window.clearInterval(timer);
      window.clearTimeout(timeout);
      googleScriptPromise = undefined;
      reject(new Error("Google sign-in could not be loaded. Check your connection and try again."));
    }, { once: true });
  });
  return googleScriptPromise;
}

export default function GoogleSignInButton({ mode = "signin", onError }) {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api.get("/auth/config", { skipAuth: true })
      .then((config) => {
        if (active) setClientId(config?.googleClientId || "");
      })
      .catch(() => {
        if (active) setError("Google sign-in is unavailable right now.");
      });
    return () => { active = false; };
  }, []);

  const handleCredential = useCallback(async (response) => {
    if (!response?.credential) {
      const message = "Google sign-in was cancelled or failed. Please try again.";
      setError(message);
      onError?.(message);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.post("/auth/google", {
        idToken: response.credential,
        termsAccepted: mode === "signup",
      }, { skipAuth: true });
      auth.save(result);
      navigate(homeForRole(result.user?.role), { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Google sign-in failed. Please try again.");
      onError?.(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [mode, navigate, onError]);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return undefined;
    let active = true;
    loadGoogleScript().then(() => {
      if (!active || !buttonRef.current) return;
      buttonRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: Math.max(220, Math.floor(buttonRef.current.getBoundingClientRect().width)),
        text: mode === "signup" ? "signup_with" : "signin_with",
        shape: "rectangular",
      });
    }).catch((loadError) => {
      if (active) setError(loadError.message);
    });
    return () => { active = false; };
  }, [clientId, handleCredential, mode]);

  if (!clientId && !error) return null;
  return <div className="google-signin">
    <div className="divider"><span>or continue with</span></div>
    {mode === "signup" && <p className="consent-copy">By continuing with Google, you agree to the <Link to="/legal/terms" target="_blank" rel="noreferrer">Terms</Link> and <Link to="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</p>}
    {clientId && <div ref={buttonRef} className="google-button" />}
    {loading && <p className="muted" role="status">Signing in with Google…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
