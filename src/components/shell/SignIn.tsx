"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowLeft, Leaf, ShieldCheck } from "lucide-react";
import { ApiError, apiRequest } from "../../lib/api";
import { useSession, type AdminUser } from "../../lib/session";
import { DEV_OTP_VISIBLE } from "../../config/constants";
import { Button, Label, TextInput } from "../ui/primitives";

type Step = "identifier" | "code";

export function SignIn() {
  const { signIn, notice } = useSession();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idField = useId();
  const codeField = useId();

  const body = () => {
    const id = identifier.trim();
    return id.includes("@") ? { email: id } : { phoneNumber: id };
  };

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setBusy(true);
    setError(null);
    setDevCode(null);
    try {
      const res = await apiRequest<{ otpInDev?: string }>("/auth/request-otp", { method: "POST", body: body() });
      if (DEV_OTP_VISIBLE && typeof res?.otpInDev === "string") setDevCode(res.otpInDev);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ accessToken: string; user: AdminUser }>("/auth/verify-otp", {
        method: "POST",
        body: { ...body(), code: code.trim() },
      });
      if (res.user?.userType !== "ADMIN") {
        setError("This account is not an administrator. The console is for Voluntree admins only.");
        return;
      }
      signIn(res.accessToken, res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code did not work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="enter-up w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-forest text-mint">
            <Leaf aria-hidden className="size-6" strokeWidth={2.25} />
          </span>
          <span className="leading-tight">
            <span className="block text-xl font-bold text-forest">Voluntree</span>
            <span className="block text-meta text-ink-2">Admin console</span>
          </span>
        </div>

        <div className="rounded-xl bg-surface p-6 shadow-card ring-1 ring-line-soft sm:p-8">
          {step === "identifier" ? (
            <form onSubmit={requestCode} noValidate>
              <h1 className="text-2xl font-bold text-forest">Sign in</h1>
              <p className="mt-1 text-meta text-ink-2">
                We will send a one-time code to the email or phone on your administrator account.
              </p>
              {notice ? (
                <p role="status" className="mt-4 rounded-md bg-sunken px-3 py-2.5 text-meta text-ink-2">
                  {notice}
                </p>
              ) : null}
              <div className="mt-6">
                <Label htmlFor={idField}>Email or phone number</Label>
                <TextInput
                  id={idField}
                  autoComplete="username"
                  inputMode="email"
                  autoFocus
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="you@voluntree.org or +91…"
                />
              </div>
              {error ? (
                <p role="alert" className="mt-3 text-meta text-danger">
                  {error}
                </p>
              ) : null}
              <Button type="submit" variant="primary" className="mt-6 w-full" loading={busy} disabled={!identifier.trim()}>
                Send code
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} noValidate>
              <button
                type="button"
                onClick={() => {
                  setStep("identifier");
                  setCode("");
                  setError(null);
                }}
                className="-ml-1 mb-4 inline-flex items-center gap-1.5 rounded-sm px-1 text-meta font-semibold text-forest hover:underline"
              >
                <ArrowLeft aria-hidden className="size-4" />
                Use a different account
              </button>
              <h1 className="text-2xl font-bold text-forest">Enter your code</h1>
              <p className="mt-1 text-meta text-ink-2">
                If <span className="font-semibold text-ink">{identifier.trim()}</span> belongs to an administrator, a
                6-digit code is on its way. It expires in 5 minutes.
              </p>
              {devCode ? (
                <p className="mt-4 rounded-md bg-mint-soft px-3 py-2.5 text-meta text-growth-ink">
                  Local development code: <span className="tabular font-bold tracking-[0.2em]">{devCode}</span>
                </p>
              ) : null}
              <div className="mt-6">
                <Label htmlFor={codeField}>6-digit code</Label>
                <TextInput
                  id={codeField}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  className="tabular text-center text-xl tracking-[0.5em]"
                  placeholder="••••••"
                />
              </div>
              {error ? (
                <p role="alert" className="mt-3 text-meta text-danger">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                className="mt-6 w-full"
                loading={busy}
                disabled={code.trim().length < 6}
                icon={ShieldCheck}
              >
                Verify and open console
              </Button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-label text-ink-3">Access is limited to Voluntree administrators.</p>
      </div>
    </div>
  );
}
