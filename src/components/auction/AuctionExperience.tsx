"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import dynamic from "next/dynamic";
import { createClient } from "@supabase/supabase-js";
import {
  isActive,
  money,
  parseAmount,
  statusLabel,
  type PublicState,
} from "@/lib/auction/model";

const AuctionMotion = dynamic(() => import("./AuctionMotion"), {
  ssr: false,
  loading: () => (
    <div className="au-motion-placeholder">Design · Development · Launch</div>
  ),
});
type Config = {
  url: string;
  publishableKey: string;
  turnstileSiteKey: string | null;
  qa: boolean;
};
type Account = {
  email: string;
  profile: Record<string, string | null> | null;
  bids: Bid[];
  offers: Offer[];
  leading: boolean;
  leadingBidId: number | null;
};
type Bid = {
  id: number;
  amount: number;
  created_at: string;
  status?: string;
  alias?: string;
};
type Offer = {
  id: string;
  amount: number;
  status: string;
  is_backup: boolean;
  deadline: string;
  paid_at: string | null;
  can_pay: boolean;
};
type Turnstile = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
async function api(action: string, value?: unknown) {
  const response = await fetch(
    `/api/website-auction/${action}`,
    value === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
  );
  const data = await response.json();
  if (!response.ok) {
    const messages: Record<string, string> = {
      bid_too_low: `Another bid changed the minimum. The next bid is ${money(data.nextMinimum || data.state?.next_minimum || 10000)} USD.`,
      auction_not_active: "Bidding is currently closed.",
      auction_ended: "The auction has ended.",
      profile_required:
        "Complete your bidder profile and accept the current terms.",
      card_verification_required: "Verify your card before bidding.",
    };
    throw new Error(
      data.error ||
        messages[data.code] ||
        "This request could not be completed. Refresh and try again.",
    );
  }
  return data;
}
function Checkbox({
  name,
  children,
  checked,
  onChange,
}: {
  name: string;
  children: React.ReactNode;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <label className="au-check">
      <input
        type="checkbox"
        name={name}
        required
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
      />
      <span>{children}</span>
    </label>
  );
}
function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={`au-notice${error ? " error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
function SecurityCheck({
  siteKey,
  onToken,
  action,
}: {
  siteKey: string | null;
  onToken: (value: string) => void;
  action: "signin" | "setup" | "bid";
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const render = useCallback(() => {
    if (box.current && siteKey && window.turnstile && !id.current)
      id.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        action,
        theme: "dark",
        size: "flexible",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
  }, [siteKey, onToken, action]);
  useEffect(() => {
    render();
    return () => {
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, [render]);
  if (!siteKey)
    return (
      <Notice>
        Secure sign-in is being configured. Bidding has not opened.
      </Notice>
    );
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={render}
      />
      <div ref={box} className="au-captcha" />
    </>
  );
}
function SignIn({ config }: { config: Config | null }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [challenge, setChallenge] = useState(0);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    setBusy(true);
    setError(false);
    try {
      const r = await api("signin", {
        email: String(values.get("email")).trim(),
        captchaToken: token,
      });
      setMessage(r.message);
    } catch (err) {
      setMessage((err as Error).message);
      setError(true);
    } finally {
      setBusy(false);
      setToken("");
      setChallenge((n) => n + 1);
    }
  }
  return (
    <section className="au-panel au-form-panel">
      <span className="au-eyebrow">YOUR BIDDER ACCOUNT</span>
      <h2>Sign in securely.</h2>
      <p>
        Use an email link to create your account or return to it. One account
        can place as many valid bids as needed. Bidding is free.
      </p>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <SecurityCheck
          key={challenge}
          siteKey={config?.turnstileSiteKey || null}
          onToken={setToken}
          action="signin"
        />
        <button className="au-primary" disabled={busy || !token}>
          {busy ? "Sending link…" : "Send sign-in link ↗"}
        </button>
      </form>
      {message && <Notice error={error}>{message}</Notice>}
      <p className="au-small">
        No marketing subscription. Read the{" "}
        <Link href="/website-auction/terms">
          auction terms and privacy information
        </Link>
        .
      </p>
    </section>
  );
}
function Profile({
  account,
  refresh,
}: {
  account: Account;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(
      ["full_name", "business_name", "phone", "country", "city", "website"].map(
        (k) => [k, String(form.get(k) || "").trim()],
      ),
    );
    data.country = data.country.toUpperCase();
    try {
      await api("profile", {
        ...data,
        adult_confirmed: form.has("adult_confirmed"),
        privacy_accepted: form.has("privacy_accepted"),
        commitment_accepted: form.has("commitment_accepted"),
        terms_accepted: form.has("terms_accepted"),
      });
      await refresh();
      setMessage("Profile saved.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="au-panel au-form-panel">
      <h2>Your bidder profile</h2>
      <p>Verified email: {account.email}</p>
      <form onSubmit={submit}>
        <div className="au-form-grid">
          {[
            ["full_name", "Full name", "name"],
            ["business_name", "Business name", "organization"],
            ["phone", "Phone", "tel"],
            ["country", "Country · two-letter code", "country"],
            ["city", "City", "address-level2"],
            ["website", "Website · optional", "url"],
          ].map(([name, label, auto]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type={
                  name === "website" ? "url" : name === "phone" ? "tel" : "text"
                }
                autoComplete={auto}
                required={name !== "website"}
                maxLength={
                  name === "country" ? 2 : name === "website" ? 500 : 160
                }
                defaultValue={account.profile?.[name] || ""}
              />
            </label>
          ))}
        </div>
        <Checkbox name="adult_confirmed">
          I am at least 18 and can enter a service agreement.
        </Checkbox>
        <Checkbox name="terms_accepted">
          I read and accept the{" "}
          <Link href="/website-auction/terms">auction terms</Link>.
        </Checkbox>
        <Checkbox name="privacy_accepted">
          I accept the use of my information to administer this auction and
          deliver the website service.
        </Checkbox>
        <Checkbox name="commitment_accepted">
          If my valid bid wins and meets the reserve, I commit to paying that
          bid within 24 hours of the winner offer.
        </Checkbox>
        <button className="au-primary" disabled={busy}>
          {busy ? "Saving…" : "Save bidder profile"}
        </button>
      </form>
      {message && <Notice>{message}</Notice>}
    </section>
  );
}
function Countdown({ state, offset }: { state: PublicState; offset: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const start = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);
  if (!state.starts_at || !state.ends_at)
    return (
      <div className="au-clock">
        <strong>25 days</strong>
        <span>Begins only after final activation</span>
      </div>
    );
  if (state.status === "paused")
    return (
      <div className="au-clock">
        <strong>Paused</strong>
        <span>The server will preserve the remaining time</span>
      </div>
    );
  if (state.status !== "active")
    return (
      <div className="au-clock">
        <strong>Closed</strong>
        <span>{statusLabel[state.status]}</span>
      </div>
    );
  const seconds =
    now === null
      ? null
      : Math.max(
          0,
          Math.floor((Date.parse(state.ends_at) - now - offset) / 1000),
        );
  return (
    <div className="au-clock" aria-label="Time remaining">
      <strong suppressHydrationWarning>
        {seconds === null
          ? "Syncing…"
          : `${Math.floor(seconds / 86400)}d ${String(Math.floor((seconds % 86400) / 3600)).padStart(2, "0")}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`}
      </strong>
      <span>Server deadline · {new Date(state.ends_at).toUTCString()}</span>
    </div>
  );
}
function BidForm({
  state,
  account,
  refresh,
  config,
}: {
  state: PublicState;
  account: Account | null;
  refresh: () => Promise<void>;
  config: Config | null;
}) {
  const [value, setValue] = useState(String(state.next_minimum / 100));
  const [review, setReview] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [challenge, setChallenge] = useState(0);
  const modal = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const requestId = useRef<string | null>(null);
  const active = isActive(state);
  const verified =
    account?.profile?.verified_mode === (config?.qa ? "test" : "live") &&
    !!account?.profile?.verified_at;
  function begin(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const amount = parseAmount(value);
      if (amount < state.next_minimum)
        throw new Error(`Minimum bid: ${money(state.next_minimum)} USD.`);
      setReview(amount);
      setConfirmation(false);
      requestId.current = crypto.randomUUID();
      modal.current?.showModal();
      setOpen(true);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function commit() {
    if (!review || !confirmation || !requestId.current || !token) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api("bid", {
        amount: review,
        requestId: requestId.current,
        confirmed: true,
        captchaToken: token,
      });
      if (result.ok) {
        setMessage(
          `Bid ${money(review)} USD accepted. Your account shows the current result.`,
        );
        modal.current?.close();
        await refresh();
      }
    } catch (error) {
      setMessage((error as Error).message);
      await refresh();
    } finally {
      setBusy(false);
      setToken("");
      setChallenge((n) => n + 1);
    }
  }
  return (
    <section className="au-panel au-bid-panel">
      <span className="au-eyebrow">YOUR NEXT MOVE</span>
      <h2>{config?.qa ? "Place a test bid." : "Place a real bid."}</h2>
      <p>
        Minimum now: <strong>{money(state.next_minimum)} USD</strong>. There is
        no bidding fee.
      </p>
      {!active ? (
        <Notice>
          Bidding has not opened or is currently closed. The auction timer
          starts only after final activation.
        </Notice>
      ) : !account ? (
        <Notice>
          <Link href="/website-auction/account">Sign in</Link> to complete your
          bidder profile.
        </Notice>
      ) : !verified ? (
        <Notice>
          <Link href="/website-auction/account">
            Complete your profile and verify a card
          </Link>{" "}
          before your first bid.
        </Notice>
      ) : null}
      <form onSubmit={begin}>
        <label>
          Your bid · USD
          <div className="au-amount">
            <span aria-hidden="true">$</span>
            <input
              name="amount"
              aria-label="Your bid in USD"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              disabled={!active || !verified}
            />
          </div>
        </label>
        <div className="au-quick" aria-label="Quick bid amounts">
          {[1000, 2500, 5000, 10000].map((n) => (
            <button
              type="button"
              key={n}
              disabled={!active || !verified}
              onClick={() =>
                setValue(String(((state.current_amount ?? 10000) + n) / 100))
              }
            >
              +{money(n)}
            </button>
          ))}
        </div>
        <button
          ref={trigger}
          className="au-primary"
          disabled={!active || !verified}
        >
          Review bid ↗
        </button>
        <p className="au-small">
          Any amount at or above the minimum is valid. Bids need not be
          multiples of $10.
        </p>
      </form>
      {message && !open && <Notice>{message}</Notice>}
      <dialog
        ref={modal}
        className="au-dialog"
        aria-labelledby="au-confirm-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setOpen(false);
          setToken("");
          setChallenge((n) => n + 1);
          trigger.current?.focus();
        }}
      >
        <h2 id="au-confirm-title">Confirm {review ? money(review) : ""} USD</h2>
        <p>
          No payment is collected now. If this is the highest valid bid at
          closing and meets the $350 reserve, you must pay your own bid within
          24 hours.
        </p>
        <Checkbox
          name="confirm_bid"
          checked={confirmation}
          onChange={setConfirmation}
        >
          I understand and confirm this bid.
        </Checkbox>
        {open && (
          <SecurityCheck
            key={challenge}
            siteKey={config?.turnstileSiteKey || null}
            onToken={setToken}
            action="bid"
          />
        )}
        <div className="au-actions">
          <button
            className="au-primary"
            disabled={!confirmation || busy || !token}
            onClick={commit}
          >
            {busy ? "Submitting…" : "Confirm and place bid"}
          </button>
          <button
            className="au-secondary"
            disabled={busy}
            onClick={() => modal.current?.close()}
          >
            Go back
          </button>
        </div>
        {message && <Notice error>{message}</Notice>}
      </dialog>
    </section>
  );
}
function Offers({
  account,
  payment = false,
}: {
  account: Account;
  payment?: boolean;
}) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function pay(id: string) {
    setBusy(true);
    try {
      const r = await api("checkout", { winnerId: id, accepted });
      if (r.url) window.location.assign(r.url);
    } catch (error) {
      setMessage((error as Error).message);
      setBusy(false);
    }
  }
  if (!account.offers.length)
    return (
      <Notice>
        You do not have a winner or backup offer. Payment is available only for
        an eligible offer after closing.
      </Notice>
    );
  return (
    <section className="au-panel">
      <h2>{payment ? "Winner payment" : "Your website offers"}</h2>
      {account.offers.map((offer) => (
        <article className="au-offer" key={offer.id}>
          <span className="au-eyebrow">
            {offer.is_backup ? "BACKUP OFFER · YOUR OWN BID" : "WINNING BID"}
          </span>
          <h3>{money(offer.amount)} USD</h3>
          <p>
            Status: {offer.status}. Deadline:{" "}
            {new Date(offer.deadline).toUTCString()}.
          </p>
          {offer.status === "paid" ? (
            <Link className="au-primary" href="/website-auction/onboarding">
              Start your website brief ↗
            </Link>
          ) : offer.can_pay ? (
            <>
              <Checkbox
                name={`accept-${offer.id}`}
                checked={accepted}
                onChange={setAccepted}
              >
                I accept this service offer at {money(offer.amount)} USD and the{" "}
                <Link href="/website-auction/terms">
                  auction scope and payment terms
                </Link>
                .
              </Checkbox>
              <button
                className="au-primary"
                disabled={!accepted || busy}
                onClick={() => pay(offer.id)}
              >
                {busy
                  ? "Opening secure checkout…"
                  : `Pay ${money(offer.amount)} USD with Stripe ↗`}
              </button>
            </>
          ) : (
            <p>No payment can be started for this offer.</p>
          )}
        </article>
      ))}
      {message && <Notice error>{message}</Notice>}
      <p className="au-small">
        A checkout return is not payment confirmation. This page updates after a
        verified Stripe payment. No automatic card charges.
      </p>
    </section>
  );
}
function BidHistory({
  bids,
  state,
  own = false,
  leadingBidId,
  title,
}: {
  bids: Bid[];
  state: PublicState | null;
  own?: boolean;
  leadingBidId?: number | null;
  title?: string;
}) {
  return (
    <section className="au-panel">
      <h2>{title || (own ? "Your bid history" : "Real bid history")}</h2>
      <p>
        {own
          ? "Every accepted bid is saved. Your account has no lifetime bid limit."
          : "Only accepted bids appear. Public bidder aliases protect personal information."}
      </p>
      {!bids.length ? (
        <Notice>No accepted bids yet.</Notice>
      ) : (
        <ol className="au-history">
          {bids.map((b) => (
            <li key={b.id}>
              <div>
                <strong>{money(b.amount)} USD</strong>
                <span>
                  {own
                    ? b.status === "invalidated"
                      ? "Invalidated"
                      : state?.status === "active"
                        ? leadingBidId === b.id
                          ? "Leading"
                          : "Outbid"
                        : "Accepted · auction closed"
                    : b.alias}
                </span>
              </div>
              <time dateTime={b.created_at}>
                {new Date(b.created_at).toUTCString()}
              </time>
            </li>
          ))}
        </ol>
      )}
      <p className="au-small">
        Reserve {state?.reserve_met ? "met" : "not met"} ·{" "}
        {state?.bid_count || 0} valid bids.
      </p>
    </section>
  );
}
function Onboarding() {
  const [initial, setInitial] = useState<Record<string, string> | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    api("onboarding")
      .then((r) => {
        setInitial(r.responses);
        setReady(true);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      await api("onboarding", {
        ...values,
        no_passwords: form.has("no_passwords"),
      });
      setMessage(
        "Your project brief is saved. VAELTX will review it and coordinate the next step.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    ["business", "Business and decision maker", true],
    ["industry", "Industry", true],
    ["services", "Services or products", true],
    ["pages", "Pages and structure · up to 5 pages or one landing page", true],
    ["goals", "Business goals and main call to action", true],
    ["design", "Design direction and reference sites", true],
    ["brand", "Brand colors and logo notes", false],
    ["content", "Content availability", false],
    ["contact", "Public business contact details for the website", true],
    ["functionality", "Required functionality · extras need agreement", false],
    ["domain", "Existing domain or proposed domain", false],
  ] as const;
  return (
    <section className="au-panel au-form-panel">
      <h2>Your website project brief</h2>
      <p>
        Available only after verified payment. Share assets through a private
        HTTPS folder and grant access to VAELTX through the agreed contact
        channel. Access credentials will be arranged separately.
      </p>
      {ready && (
        <form onSubmit={submit}>
          {fields.map(([name, label, required]) => (
            <label key={name}>
              {label}
              <textarea
                name={name}
                rows={3}
                required={required}
                defaultValue={initial?.[name] || ""}
                maxLength={
                  name === "content"
                    ? 5000
                    : name === "services" || name === "brand"
                      ? 3000
                      : name === "domain"
                        ? 500
                        : name === "contact"
                          ? 1000
                          : name === "business" || name === "industry"
                            ? 160
                            : 2000
                }
              />
            </label>
          ))}
          <label>
            Private asset folder · HTTPS URL
            <input
              type="url"
              name="assets_url"
              defaultValue={initial?.assets_url || ""}
              maxLength={1000}
            />
          </label>
          <Checkbox name="no_passwords">
            I have not included passwords, API keys, card details, or other
            access secrets.
          </Checkbox>
          <button className="au-primary" disabled={busy}>
            {busy ? "Saving…" : "Save website brief ↗"}
          </button>
        </form>
      )}
      {message && <Notice>{message}</Notice>}
    </section>
  );
}
type AdminRow = Record<string, unknown>;
const adminSections = [
  {
    key: "va_participants",
    title: "Private bidder directory",
    columns: [
      "full_name",
      "business_name",
      "email",
      "phone",
      "country",
      "city",
      "website",
      "email_verified_at",
      "verified_mode",
      "verified_at",
      "status",
      "created_at",
    ],
  },
  {
    key: "va_bids",
    title: "Complete bid timeline",
    columns: [
      "id",
      "participant_id",
      "amount",
      "status",
      "created_at",
      "invalidation_reason",
    ],
  },
  {
    key: "va_winners",
    title: "Winner offers & payment",
    columns: [
      "participant_id",
      "amount",
      "status",
      "is_backup",
      "deadline",
      "checkout_state",
      "paid_at",
    ],
  },
  {
    key: "va_extensions",
    title: "Deadline extensions",
    columns: ["bid_id", "previous_end", "extended_end", "created_at"],
  },
  {
    key: "va_outbox",
    title: "Transactional email delivery",
    columns: [
      "kind",
      "audience",
      "status",
      "attempts",
      "provider_id",
      "last_error",
      "sent_at",
    ],
  },
  {
    key: "va_audit",
    title: "Owner action & auction audit",
    columns: ["id", "kind", "actor_id", "details", "created_at"],
  },
];
function Admin({ state }: { state: PublicState | null }) {
  const [bidder, setBidder] = useState<{
    profile: AdminRow;
    bids: Bid[];
    highestBid: number | null;
    validBidCount: number;
  } | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api("admin"));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("admin", {
        action: f.get("action"),
        reason: f.get("reason"),
        confirmed: f.has("confirmed"),
        ...(f.get("bidId") ? { bidId: Number(f.get("bidId")) } : {}),
      });
      await load();
      setMessage("Action completed and recorded in the audit log.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function more(key: string) {
    setBusy(true);
    try {
      const rows = (data?.[key] || []) as AdminRow[];
      const next = await api(
        `admin?table=${encodeURIComponent(key)}&offset=${rows.length}`,
      );
      setData((current) => ({ ...current, [key]: [...rows, ...next.rows] }));
      if (!next.rows.length)
        setMessage("All records for this section are loaded.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const a = (data?.auction || {}) as AdminRow;
  const participants = (data?.va_participants || []) as AdminRow[];

  const leader = data?.leader as AdminRow | null;
  const format = (value: unknown, column: string): string => {
    if (value === null || value === undefined) return "—";
    if (column === "amount") return `${money(Number(value))} USD`;
    if (column === "participant_id" || column === "actor_id") {
      const person = participants.find((p) => p.id === value);
      return person
        ? `${person.full_name} · ${person.business_name}`
        : String(value);
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  return (
    <section className="au-panel">
      <span className="au-eyebrow">PRIVATE OWNER OPERATIONS</span>
      <h1>Website auction.</h1>
      <p>
        Participant identities and payment references are private. Test fixtures
        are labeled and blocked. Auction records below are restricted to this
        production auction.
      </p>
      <button className="au-secondary" onClick={load}>
        Refresh dashboard
      </button>
      <div className="au-admin-overview">
        <div>
          <span>Status</span>
          <strong>{statusLabel[String(a.status)] || "Loading…"}</strong>
        </div>
        <div>
          <span>Current / next minimum</span>
          <strong>
            {state?.current_amount ? money(state.current_amount) : "No bids"} /{" "}
            {state ? money(state.next_minimum) : "—"}
          </strong>
        </div>
        <div>
          <span>Public reserve</span>
          <strong>$350 · {state?.reserve_met ? "MET" : "NOT MET"}</strong>
        </div>
        <div>
          <span>Valid bids / bidders</span>
          <strong>
            {state?.bid_count || 0} / {state?.participant_count || 0}
          </strong>
        </div>
        <div>
          <span>Card-verified live profiles loaded</span>
          <strong>
            {
              participants.filter(
                (p) =>
                  p.verified_mode === "live" &&
                  p.verified_at &&
                  p.status === "eligible",
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Current leader</span>
          <strong>
            {leader
              ? `${leader.full_name} · ${leader.business_name}`
              : "No leader"}
          </strong>
        </div>
        <div>
          <span>Start</span>
          <strong>{String(a.starts_at || "Not started")}</strong>
        </div>
        <div>
          <span>Original end</span>
          <strong>{String(a.original_ends_at || "Not started")}</strong>
        </div>
        <div>
          <span>Current end / extensions</span>
          <strong>
            {String(a.ends_at || "Not started")} /{" "}
            {String(a.extension_count || 0)}
          </strong>
        </div>
      </div>
      <section className="au-admin-section">
        <h2>Inspect a bidder</h2>
        <label>
          Private bidder
          <select
            value={String(bidder?.profile.id || "")}
            onChange={async (e) => {
              if (!e.target.value) {
                setBidder(null);
                return;
              }
              try {
                setBidder(
                  await api(
                    `admin-bidder?id=${encodeURIComponent(e.target.value)}`,
                  ),
                );
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            <option value="">Choose a bidder</option>
            {participants.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.full_name)} · {String(p.business_name)}
              </option>
            ))}
          </select>
        </label>
        {bidder && (
          <>
            <p>
              Highest valid bid:{" "}
              {bidder.highestBid
                ? `${money(bidder.highestBid)} USD`
                : "No valid bids"}{" "}
              · {bidder.validBidCount} valid bids ·{" "}
              {String(bidder.profile.status)}
            </p>
            <BidHistory
              bids={bidder.bids}
              state={state}
              own
              title="Selected bidder history"
              leadingBidId={
                bidder.bids.find(
                  (b) =>
                    b.status === "valid" && b.amount === state?.current_amount,
                )?.id
              }
            />
            {bidder.bids.length >= 1000 && (
              <button
                className="au-secondary"
                onClick={async () => {
                  try {
                    const next = await api(
                      `admin-bidder?id=${encodeURIComponent(String(bidder.profile.id))}&offset=${bidder.bids.length}`,
                    );
                    setBidder({
                      ...next,
                      bids: [...bidder.bids, ...next.bids],
                    });
                  } catch (error) {
                    setMessage((error as Error).message);
                  }
                }}
              >
                Load more bidder bids
              </button>
            )}
          </>
        )}
      </section>
      <details className="au-faq">
        <summary>Launch checks · activation remains locked</summary>
        <ul>
          {Object.entries(
            (a.activation_checks || {}) as Record<string, boolean>,
          ).map(([key, value]) => (
            <li key={key}>
              {key.replaceAll("_", " ")}: {value ? "Reviewed" : "Pending"}
            </li>
          ))}
        </ul>
      </details>
      <details className="au-faq">
        <summary>Audited owner actions</summary>
        <form onSubmit={submit}>
          <label>
            Action
            <select name="action">
              <option value="pause">Pause</option>
              <option value="resume">Resume</option>
              <option value="cancel">Cancel</option>
              <option value="invalidate">Invalidate fraudulent bid</option>
              <option value="backup">
                Offer next eligible bidder their own price
              </option>
              <option value="activate">Activate · final owner decision</option>
            </select>
          </label>
          <label>
            Bid ID · for invalidation
            <input name="bidId" inputMode="numeric" />
          </label>
          <label>
            Reason
            <textarea name="reason" required minLength={12} maxLength={1000} />
          </label>
          <Checkbox name="confirmed">
            I reviewed this action and confirm it.
          </Checkbox>
          <button className="au-primary" disabled={busy}>
            {busy ? "Applying…" : "Apply audited action"}
          </button>
        </form>
      </details>
      {message && <Notice>{message}</Notice>}
      {data &&
        adminSections.map((section) => {
          const rows = (data[section.key] || []) as AdminRow[];
          return (
            <section className="au-admin-section" key={section.key}>
              <h2>{section.title}</h2>
              <p>
                {rows.length} loaded{" "}
                {rows.length >= 1000
                  ? "· load subsequent pages to see the full history"
                  : ""}
              </p>
              {!rows.length ? (
                <p>No records yet.</p>
              ) : (
                <div
                  className="au-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={section.title}
                >
                  <table>
                    <thead>
                      <tr>
                        {section.columns.map((c) => (
                          <th key={c} scope="col">
                            {c.replaceAll("_", " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={String(row.id || i)}>
                          {section.columns.map((c) => (
                            <td key={c}>{format(row[c], c)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length >= 1000 && (
                <button
                  className="au-secondary"
                  onClick={() => more(section.key)}
                  disabled={busy}
                >
                  Load more records
                </button>
              )}
            </section>
          );
        })}
    </section>
  );
}

const concepts = [
  ["northstar-roofing", "Northstar Roofing"],
  ["mira-atelier", "Mira Atelier"],
  ["axiom-strategy", "Axiom Strategy"],
  ["vault-tcg", "Vault TCG"],
];
function Scope() {
  return (
    <>
      <section className="au-section">
        <div className="au-section-title">
          <span className="au-eyebrow">THE WEBSITE SERVICE</span>
          <h2>
            From your business
            <br />
            to a working website.
          </h2>
          <p>
            A custom website commissioned at the winning bid. A practical scope,
            designed and developed by VAELTX.
          </p>
        </div>
        <div className="au-scope-grid">
          {[
            [
              "01",
              "Design & build",
              "Custom design and responsive development. Up to 5 pages or one detailed landing page.",
            ],
            [
              "02",
              "A clear next action",
              "Lead contact form, mobile usability, basic metadata and technical setup.",
            ],
            [
              "03",
              "Launch essentials",
              "Deployment, launch support, first-year standard domain up to $20 USD, and first month of hosting.",
            ],
            [
              "04",
              "Review & handoff",
              "Two revision rounds within the agreed scope. Keep hosting or migrate after the included month.",
            ],
          ].map(([n, title, description]) => (
            <article className="au-panel" key={n}>
              <span className="au-eyebrow">{n}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <p className="au-small">
          Premium domains, renewal fees, ongoing hosting and additional scope
          need separate agreement. No SEO service, revenue promise or search
          ranking guarantee.{" "}
          <Link href="/website-auction/terms">Full scope and terms ↗</Link>
        </p>
      </section>
      <section className="au-section">
        <div className="au-section-title">
          <span className="au-eyebrow">DESIGN PROOF</span>
          <h2>Four independent concepts.</h2>
          <p>
            VAELTX concept work. These are fictional businesses, presented to
            demonstrate design and development capabilities.
          </p>
        </div>
        <div className="au-proof-grid">
          {concepts.map(([slug, title]) => (
            <Link className="au-proof" href={`/concepts/${slug}`} key={slug}>
              <Image
                src={`/images/preview-${slug}.webp`}
                alt={`${title} independent concept website preview`}
                width={960}
                height={600}
                sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 24vw"
              />
              <div>
                <h3>{title} ↗</h3>
                <span>Independent concept project</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
function FAQ() {
  return (
    <section className="au-section">
      <div className="au-section-title">
        <span className="au-eyebrow">BEFORE YOU BID</span>
        <h2>Clear rules. Real commitment.</h2>
      </div>
      {[
        [
          "Does it cost anything to bid?",
          "No. There is no entry or bidding fee. Card verification is required before your first real bid. Only a winning bidder who accepts checkout pays.",
        ],
        [
          "What if the reserve is not met?",
          "If the highest valid bid is below $350 USD at closing, the auction closes without a sale or winner charge.",
        ],
        [
          "How do last-minute bids work?",
          "Every valid bid accepted with 120 seconds or less remaining adds 120 seconds to the existing deadline. This can repeat.",
        ],
        [
          "What happens if the winner does not pay?",
          "The payment offer expires after 24 hours. VAELTX may offer the next eligible bidder the website at that bidder’s own highest valid bid, with a new 24-hour deadline. There is no automatic charge.",
        ],
        [
          "When will my website be delivered?",
          "The delivery timeline must be agreed and published before activation. It depends on the confirmed scope, supplied content and review responses.",
        ],
        [
          "What happens after the included hosting month?",
          "You can agree to ongoing hosting or migrate the website. Any renewal costs require a separate agreement.",
        ],
      ].map(([question, answer]) => (
        <details className="au-faq" key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </section>
  );
}

export default function AuctionExperience({
  initialState,
  page = "home",
}: {
  initialState: PublicState | null;
  page?: string;
}) {
  const [state, setState] = useState(initialState);
  const [offset, setOffset] = useState(0);
  const [config, setConfig] = useState<Config | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [bids, setBids] = useState<Bid[]>([]);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const stateRef = useRef(initialState);
  const refreshAccount = useCallback(async () => {
    try {
      setAccount(await api("account"));
    } catch {
      setAccount(null);
    } finally {
      setAccountReady(true);
    }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const r = await api("state");
      const previous = stateRef.current;
      setState(r.state);
      stateRef.current = r.state;
      setOffset(Date.parse(r.serverTime) - Date.now());
      setError("");
      if (
        previous &&
        (previous.current_amount !== r.state.current_amount ||
          previous.status !== r.state.status)
      )
        setAnnouncement(
          `${statusLabel[r.state.status] || r.state.status}. ${r.state.current_amount ? `Current bid ${money(r.state.current_amount)} USD.` : "No accepted bids."}`,
        );
      await refreshAccount();
      if (page === "history") setBids((await api("history")).bids);
    } catch {
      setError(
        "Live auction data is temporarily unavailable. Refresh before bidding.",
      );
    }
  }, [page, refreshAccount]);
  useEffect(() => {
    api("config")
      .then(setConfig)
      .catch(() => setError("Auction services are being configured."));
    void Promise.resolve().then(refresh);
    const id = setInterval(() => void refresh(), 15000);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!config?.url || !config.publishableKey || !state?.auction_id) return;
    const client = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let disposed = false;
    const channel = client
      .channel("website-auction-public", {
        config: { postgres_changes_options: { wait: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "va_public_state",
          filter: `auction_id=eq.${state.auction_id}`,
        },
        () => void refresh(),
      );
    void (async () => {
      if (config.qa) {
        try {
          const session = await api("qa-session");
          await client.realtime.setAuth(session.accessToken);
        } catch {
          return;
        }
      }
      if (!disposed) channel.subscribe();
    })();
    return () => {
      disposed = true;
      void client.removeChannel(channel);
    };
  }, [config, state?.auction_id, refresh, account?.email]);
  async function signout() {
    await api("signout", {});
    setAccount(null);
  }
  const privatePage = ["account", "winner", "payment", "onboarding"].includes(
    page,
  );
  return (
    <div className="au">
      <a className="au-skip" href="#auction-main">
        Skip to content
      </a>
      <header className="au-header">
        <Link className="au-logo" href="/">
          VAELTX<span>.</span>
        </Link>
        <nav aria-label="Auction navigation">
          <Link
            href="/website-auction"
            aria-current={page === "home" ? "page" : undefined}
          >
            Auction
          </Link>
          <Link href="/website-auction/history">Bid history</Link>
          <Link href="/website-auction/account">My account ↗</Link>
        </nav>
      </header>
      <main
        id="auction-main"
        className={page === "home" ? "au-home" : undefined}
      >
        <div className="au-live-announcement" role="status" aria-live="polite">
          {announcement}
        </div>
        {error && <Notice error>{error}</Notice>}
        {config?.qa && (
          <Notice>
            ISOLATED QA · Stripe TEST payments only. All businesses and bids
            here are QA fixtures. The production auction has not started.
          </Notice>
        )}
        {page === "admin" ? (
          <Admin state={state} />
        ) : page === "home" ? (
          <>
            <section className="au-hero">
              <div className="au-hero-copy">
                <span className="au-eyebrow">
                  VAELTX · WEBSITE SERVICE AUCTION
                </span>
                <h1>
                  Your business.
                  <br />A better website.
                  <br />
                  <em>Your bid.</em>
                </h1>
                <p>
                  A custom website, built for your next chapter. Bid freely. The
                  highest valid bid wins when the public reserve is met.
                </p>
                <div className="au-actions">
                  <Link className="au-primary" href="/website-auction/bid">
                    {state?.status === "active"
                      ? "Review a bid ↗"
                      : "Explore the auction ↗"}
                  </Link>
                  <a className="au-text-link" href="#auction-status">
                    View auction status ↓
                  </a>
                </div>
                <p className="au-small">
                  Starts at $100 USD · Reserve $350 USD · No bidding fee
                </p>
              </div>
              <AuctionMotion />
            </section>
            <section
              className="au-status"
              id="auction-status"
              aria-label="Auction status"
            >
              {state ? (
                <>
                  <div className="au-status-top">
                    <span className="au-status-badge">
                      {statusLabel[state.status] || state.status}
                    </span>
                    <span>
                      {config?.qa
                        ? "ISOLATED QA · STRIPE TEST · PRODUCTION NOT STARTED"
                        : "USD · REAL ACCEPTED BIDS ONLY"}
                    </span>
                  </div>
                  <div className="au-stat-grid">
                    <div>
                      <span>Current highest bid</span>
                      <strong>
                        {state.current_amount === null
                          ? "No bids yet"
                          : money(state.current_amount)}
                      </strong>
                    </div>
                    <div>
                      <span>Next minimum bid</span>
                      <strong>{money(state.next_minimum)}</strong>
                    </div>
                    <div>
                      <span>Public reserve</span>
                      <strong>$350</strong>
                      <small>
                        {state.reserve_met ? "Reserve met" : "Reserve not met"}
                      </small>
                    </div>
                    <div>
                      <span>Valid bids / bidders</span>
                      <strong>
                        {state.bid_count} / {state.participant_count}
                      </strong>
                    </div>
                  </div>
                  <Countdown state={state} offset={offset} />
                  <p className="au-small">
                    {state.extension_count > 0
                      ? `${state.extension_count} deadline extensions. `
                      : ""}
                    A valid bid in the final two minutes adds two minutes to the
                    existing deadline.
                  </p>
                </>
              ) : (
                <Notice>
                  Auction data is unavailable. No timer or bid figures are shown
                  until the server is connected.
                </Notice>
              )}
            </section>
            <Scope />
            <section className="au-section au-how">
              <div className="au-section-title">
                <span className="au-eyebrow">HOW IT WORKS</span>
                <h2>A website. Four clear steps.</h2>
              </div>
              <ol>
                <li>
                  <b>01</b>
                  <h3>Create your account</h3>
                  <p>
                    Verify your email, complete your business profile and accept
                    the terms.
                  </p>
                </li>
                <li>
                  <b>02</b>
                  <h3>Verify a card, then bid</h3>
                  <p>
                    No bidding fee. Review and confirm every bid before
                    submitting it.
                  </p>
                </li>
                <li>
                  <b>03</b>
                  <h3>Win and pay your bid</h3>
                  <p>
                    The highest valid bid must meet the $350 reserve. Winner
                    payment is due within 24 hours.
                  </p>
                </li>
                <li>
                  <b>04</b>
                  <h3>Build your website</h3>
                  <p>
                    Submit your project brief after confirmed payment. VAELTX
                    designs, develops and launches the agreed scope.
                  </p>
                </li>
              </ol>
            </section>
            <FAQ />
          </>
        ) : page === "bid" ? (
          <>
            <div className="au-page-title">
              <span className="au-eyebrow">BID WITH INTENT</span>
              <h1>Your next website starts here.</h1>
            </div>
            {state && (
              <>
                <Countdown state={state} offset={offset} />
                <BidForm
                  state={state}
                  account={account}
                  refresh={refresh}
                  config={config}
                />
              </>
            )}
            {!account && accountReady && <SignIn config={config} />}
          </>
        ) : page === "history" ? (
          <>
            <div className="au-page-title">
              <h1>Bid history.</h1>
              <p>
                Server records. Anonymous bidder aliases. No simulated activity.
              </p>
            </div>
            <BidHistory bids={bids} state={state} />
          </>
        ) : privatePage ? (
          <>
            <div className="au-page-title">
              <span className="au-eyebrow">YOUR WEBSITE AUCTION</span>
              <h1>
                {page === "onboarding"
                  ? "Let’s shape your website."
                  : page === "payment"
                    ? "Pay your winning bid."
                    : page === "winner"
                      ? "Your auction result."
                      : "Your account."}
              </h1>
            </div>
            {!accountReady ? (
              <Notice>Checking your secure session…</Notice>
            ) : !account ? (
              <SignIn config={config} />
            ) : (
              <>
                <div className="au-account-top">
                  <span>{account.email}</span>
                  <button className="au-secondary" onClick={signout}>
                    Sign out
                  </button>
                </div>
                {page === "onboarding" ? (
                  <Onboarding />
                ) : (
                  <>
                    <Offers account={account} payment={page === "payment"} />
                    {page === "account" && (
                      <>
                        <Profile account={account} refresh={refreshAccount} />
                        {account.profile && (
                          <CardVerification
                            config={config}
                            profile={account.profile}
                          />
                        )}
                        <BidHistory
                          bids={account.bids}
                          state={state}
                          own
                          leadingBidId={account.leadingBidId}
                        />
                        <Link
                          className="au-primary"
                          href="/website-auction/bid"
                        >
                          Review your next bid ↗
                        </Link>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        ) : null}
      </main>
      <footer className="au-footer">
        <Link className="au-logo" href="/">
          VAELTX.
        </Link>
        <p>
          Independent web &amp; conversion studio.
          <br />A website service auction. No charge to bid.
        </p>
        <nav aria-label="Auction footer">
          <Link href="/website-auction/terms">Auction terms &amp; privacy</Link>
          <Link href="/work">Portfolio</Link>
          <Link href="/contact">Contact VAELTX ↗</Link>
        </nav>
      </footer>
    </div>
  );
}
function CardVerification({
  config,
  profile,
}: {
  config: Config | null;
  profile: Record<string, string | null>;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [challenge, setChallenge] = useState(0);
  async function verify() {
    setBusy(true);
    try {
      const r = await api("setup", { captchaToken: token });
      if (r.url) window.location.assign(r.url);
    } catch (error) {
      setMessage((error as Error).message);
      setBusy(false);
      setToken("");
      setChallenge((n) => n + 1);
    }
  }
  const verified =
    profile.verified_mode === (config?.qa ? "test" : "live") &&
    profile.verified_at;
  return (
    <section className="au-panel">
      <h2>Card verification</h2>
      <p>
        {verified
          ? "Your card verification is confirmed. You can bid while the auction is open."
          : "Stripe securely verifies your card before your first real bid. No bidding fee. Your winning payment requires a separate checkout confirmation."}
      </p>
      {!verified && (
        <>
          <SecurityCheck
            key={challenge}
            siteKey={config?.turnstileSiteKey || null}
            onToken={setToken}
            action="setup"
          />
          <button
            className="au-primary"
            disabled={!token || busy}
            onClick={verify}
          >
            {busy ? "Opening Stripe…" : "Verify card with Stripe ↗"}
          </button>
        </>
      )}
      {message && <Notice error>{message}</Notice>}
    </section>
  );
}
