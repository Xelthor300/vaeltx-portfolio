"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Script from "next/script";

type Turnstile = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

export default function OwnerSignIn({ siteKey }: { siteKey: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  const render = useCallback(() => {
    if (!box.current || !siteKey || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(box.current, {
      sitekey: siteKey,
      action: "signin",
      theme: "dark",
      size: box.current.clientWidth < 300 ? "compact" : "flexible",
      callback: (value: string) => setToken(value),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
  }, [siteKey]);

  useEffect(() => {
    render();
    return () => {
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [render]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/vaeltx/admin/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captchaToken: token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Secure sign-in is unavailable.");
      setSent(true);
      setMessage("Secure owner sign-in link sent. Open the newest VAELTX admin email to continue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Secure sign-in is unavailable.");
    } finally {
      setBusy(false);
      setToken("");
      if (widget.current && window.turnstile) {
        window.turnstile.remove(widget.current);
        widget.current = null;
      }
      setTimeout(render, 0);
    }
  }

  return (
    <form className="owner-signin-card" onSubmit={submit}>
      <p className="hosting-kicker">VAELTX · OWNER ACCESS</p>
      <h1>Private operations</h1>
      <p>
        Request a single-use secure link for the configured VAELTX owner account.
        The owner email is never displayed on this page.
      </p>
      {!siteKey ? (
        <div className="owner-signin-notice">Secure owner sign-in is being configured.</div>
      ) : (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onReady={render}
          />
          <div ref={box} className="owner-signin-captcha" />
          <button type="submit" disabled={busy || !token}>
            {busy ? "Sending secure link…" : sent ? "Send a new secure link" : "Send secure owner link"}
          </button>
        </>
      )}
      {message ? <div className="owner-signin-notice" role="status">{message}</div> : null}
    </form>
  );
}
