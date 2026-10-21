"use client";

import React from "react";
import { DEV_OTP_VISIBLE } from "../../config/constants";

interface AuthModalProps {
  authStep: "identifier" | "otp";
  identifier: string;
  setIdentifier: (val: string) => void;
  otpCode: string;
  setOtpCode: (val: string) => void;
  authError: string;
  authMsg: string;
  devOtp: string;
  isSubmitting: boolean;
  handleRequestOtp: (e: React.FormEvent) => void;
  handleVerifyOtp: (e: React.FormEvent) => void;
  setAuthStep: (step: "identifier" | "otp") => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  authStep,
  identifier,
  setIdentifier,
  otpCode,
  setOtpCode,
  authError,
  authMsg,
  devOtp,
  isSubmitting,
  handleRequestOtp,
  handleVerifyOtp,
  setAuthStep,
}) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0b0f19",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#131a2c",
          border: "1px solid #334155",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "440px",
          padding: "36px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              height: "44px",
              width: "44px",
              borderRadius: "12px",
              backgroundColor: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
              }}
            >
              Admin Gateway
            </h2>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
              Voluntree Secure Platform Authentication
            </p>
          </div>
        </div>

        {authError && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#ef4444",
              padding: "12px",
              borderRadius: "10px",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            {authError}
          </div>
        )}

        {authMsg && (
          <div
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: "1px solid #10b981",
              color: "#10b981",
              padding: "12px",
              borderRadius: "10px",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            {authMsg}
          </div>
        )}

        {/* Only for a local API in a non-production build (WEB-21). */}
        {DEV_OTP_VISIBLE && devOtp && (
          <div
            style={{
              backgroundColor: "rgba(234, 179, 8, 0.15)",
              border: "1px dashed #eab308",
              color: "#eab308",
              padding: "12px",
              borderRadius: "10px",
              fontSize: "13px",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            Dev OTP Code: <strong>{devOtp}</strong>
          </div>
        )}

        {authStep === "identifier" ? (
          <form
            onSubmit={handleRequestOtp}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div>
              <label
                htmlFor="admin-identifier"
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "#cbd5e1",
                  marginBottom: "8px",
                  fontWeight: "600",
                }}
              >
                Admin Email or Phone
              </label>
              <input
                id="admin-identifier"
                type="text"
                required
                autoComplete="username"
                placeholder="Email address or +91 phone number"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "#0b0f19",
                  border: "1px solid #334155",
                  color: "white",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  fontSize: "14px",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "14px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
              }}
            >
              {isSubmitting ? "Requesting OTP..." : "Send Security OTP"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleVerifyOtp}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div>
              <label
                htmlFor="admin-otp"
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "#cbd5e1",
                  marginBottom: "8px",
                  fontWeight: "600",
                }}
              >
                6-Digit Security OTP
              </label>
              <input
                id="admin-otp"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                title="The code is 6 digits"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                style={{
                  width: "100%",
                  backgroundColor: "#0b0f19",
                  border: "1px solid #334155",
                  color: "white",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  fontSize: "16px",
                  letterSpacing: "4px",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "14px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
              }}
            >
              {isSubmitting ? "Verifying..." : "Verify OTP & Access Console"}
            </button>

            <button
              type="button"
              onClick={() => setAuthStep("identifier")}
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ← Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
