"use client";

import React, { useState, useEffect } from "react";

// Types
interface NGO {
  id: string;
  name: string;
  email: string;
  phone: string;
  regNumber: string;
  documents: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface EventItem {
  id: string;
  name: string;
  organizer: string;
  category: string;
  location: string;
  volunteersApplied: number;
  volunteersNeeded: number;
  status: "ACTIVE" | "SUSPENDED" | "FEATURED";
}

interface SafetyReport {
  id: string;
  eventId: string;
  eventName: string;
  category: "SPAM" | "FAKE_EVENT" | "HARASSMENT" | "FRAUD";
  reporter: string;
  reason: string;
  resolved: boolean;
  date: string;
}

interface PaymentTransaction {
  id: string;
  donor: string;
  type: "DONATION" | "PREMIUM_SUBSCRIBER" | "FEATURED_EVENT_FEE";
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  txRef: string;
  date: string;
  eventName?: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "ngos" | "events" | "moderation" | "payments" | "users" | "settings">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  // Auth States
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Login Form States
  const [authStep, setAuthStep] = useState<"identifier" | "otp">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time & Mock Data States
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Load saved credentials from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    const savedUser = localStorage.getItem("admin_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setAdminUser(JSON.parse(savedUser));
    }
    setIsAuthLoading(false);
  }, []);

  // Fetch real-time data from backend once authenticated
  useEffect(() => {
    if (!token) return;

    // 1. Fetch real events
    fetch("http://localhost:3000/events")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((evt: any) => ({
            id: evt.id,
            name: evt.title,
            organizer: evt.organizer?.fullName || "Host Organization",
            category: evt.category,
            location: evt.address,
            volunteersApplied: evt.applications?.length || 0,
            volunteersNeeded: evt.volunteersNeeded,
            status: evt.status as any,
          }));
          setEvents(mapped);
        }
      })
      .catch(err => console.error("Error fetching live events:", err));

    // 2. Fetch real safety reports
    fetch("http://localhost:3000/reports", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map((rep: any) => ({
            id: rep.id,
            eventId: rep.eventId,
            eventName: rep.event?.title || "Reported Drive",
            category: rep.category,
            reporter: rep.reporter?.fullName || "Platform User",
            reason: rep.reason,
            resolved: rep.resolved,
            date: new Date(rep.createdAt).toLocaleDateString(),
          }));
          setReports(mapped);
        }
      })
      .catch(err => console.error("Error fetching live safety reports:", err));

    // 3. Fetch real payment transactions
    fetch("http://localhost:3000/payments/history", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map((tx: any) => ({
            id: tx.id,
            donor: tx.user?.fullName || "Platform Donor",
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            status: tx.status,
            txRef: tx.txRef,
            date: new Date(tx.createdAt).toLocaleDateString(),
            eventName: tx.event?.title,
          }));
          setTransactions(mapped);
        }
      })
      .catch(err => console.error("Error fetching live payment history:", err));

    // 4. Fetch real NGO verifications
    fetch("http://localhost:3000/ngos/pending", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map((ngo: any) => ({
            id: ngo.id,
            name: ngo.ngoName,
            email: ngo.user?.email || "No Email",
            phone: ngo.user?.phoneNumber || "No Phone",
            regNumber: ngo.contactDetails || "N/A",
            documents: ngo.registrationDocs || "N/A",
            status: ngo.status,
          }));
          setNgos(mapped);
        }
      })
      .catch(err => console.error("Error fetching live NGOs:", err));

    // 5. Fetch real platform users
    fetch("http://localhost:3000/auth/users", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map((u: any) => ({
            id: u.id,
            email: u.email,
            phoneNumber: u.phoneNumber,
            fullName: u.fullName,
            userType: u.userType,
            isBanned: u.isBanned,
            createdAt: new Date(u.createdAt).toLocaleDateString(),
            profile: u.profile,
          }));
          setUsersList(mapped);
        }
      })
      .catch(err => console.error("Error fetching live users:", err));

  }, [token]);

  // Auth Operations
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setAuthError("");
    setAuthMsg("");
    setDevOtp("");
    setIsSubmitting(true);

    try {
      const isEmail = identifier.includes("@");
      const body = isEmail ? { email: identifier } : { phoneNumber: identifier };

      const res = await fetch("http://localhost:3000/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to request OTP code.");
      }

      setAuthStep("otp");
      setAuthMsg("A verification OTP code has been issued.");
      if (data.otpInDev) {
        setDevOtp(data.otpInDev);
      }
    } catch (err: any) {
      setAuthError(err.message || "An authentication error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setAuthError("");
    setIsSubmitting(true);

    try {
      const isEmail = identifier.includes("@");
      const body = isEmail 
        ? { email: identifier, code: otpCode } 
        : { phoneNumber: identifier, code: otpCode };

      const res = await fetch("http://localhost:3000/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "OTP verification failed. Check the code.");
      }

      if (data.user.userType !== "ADMIN") {
        throw new Error("Access Denied: Only Administrator accounts can log in here.");
      }

      localStorage.setItem("admin_token", data.accessToken);
      localStorage.setItem("admin_user", JSON.stringify(data.user));
      setToken(data.accessToken);
      setAdminUser(data.user);
      setAuthError("");
      setAuthMsg("");
      setDevOtp("");
    } catch (err: any) {
      setAuthError(err.message || "Invalid OTP code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setToken(null);
    setAdminUser(null);
    setAuthStep("identifier");
    setIdentifier("");
    setOtpCode("");
    setDevOtp("");
    setAuthMsg("");
    setAuthError("");
  };

  // Actions
  const handleApproveNGO = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:3000/ngos/${id}/verify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (res.ok) {
        setNgos(ngos.filter(ngo => ngo.id !== id));
      }
    } catch (err) {
      console.error("Error approving NGO:", err);
    }
  };

  const handleRejectNGO = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:3000/ngos/${id}/verify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      if (res.ok) {
        setNgos(ngos.filter(ngo => ngo.id !== id));
      }
    } catch (err) {
      console.error("Error rejecting NGO:", err);
    }
  };

  const toggleEventStatus = async (id: string) => {
    const targetEvent = events.find(e => e.id === id);
    if (!targetEvent || !token) return;

    let nextStatus: "ACTIVE" | "SUSPENDED" | "FEATURED" = "ACTIVE";
    if (targetEvent.status === "ACTIVE") nextStatus = "FEATURED";
    else if (targetEvent.status === "FEATURED") nextStatus = "SUSPENDED";

    try {
      const res = await fetch(`http://localhost:3000/events/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        setEvents(events.map(evt => evt.id === id ? { ...evt, status: nextStatus } : evt));
      }
    } catch (err) {
      console.error("Error setting event status:", err);
    }
  };

  const handleResolveReport = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:3000/reports/${id}/resolve`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (res.ok) {
        setReports(reports.map(rep => rep.id === id ? { ...rep, resolved: true } : rep));
      }
    } catch (err) {
      console.error("Error resolving report:", err);
    }
  };

  const handleRemoveReportedEvent = async (eventId: string, reportId: string) => {
    if (!token) return;
    try {
      // Suspend the event first
      const resStatus = await fetch(`http://localhost:3000/events/${eventId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "SUSPENDED" }),
      });

      if (resStatus.ok) {
        setEvents(events.map(evt => evt.id === eventId ? { ...evt, status: "SUSPENDED" } : evt));
        // Resolve the safety report
        await handleResolveReport(reportId);
      }
    } catch (err) {
      console.error("Error purging event:", err);
    }
  };

  const handleToggleUserBan = async (id: string, currentBanStatus: boolean) => {
    if (!token) return;
    const nextBanStatus = !currentBanStatus;
    try {
      const res = await fetch(`http://localhost:3000/auth/users/${id}/ban`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ isBanned: nextBanStatus }),
      });
      if (res.ok) {
        setUsersList(usersList.map(u => u.id === id ? { ...u, isBanned: nextBanStatus } : u));
      }
    } catch (err) {
      console.error("Error toggling user suspension:", err);
    }
  };

  // Computations
  const pendingNgosCount = ngos.filter(ngo => ngo.status === "PENDING").length;
  const activeEventsCount = events.filter(evt => evt.status !== "SUSPENDED").length;
  const pendingReportsCount = reports.filter(rep => !rep.resolved).length;
  const totalRevenue = transactions.filter(tx => tx.status === "SUCCESS").reduce((sum, tx) => sum + tx.amount, 0);
  const pendingPaymentsCount = transactions.filter(tx => tx.status === "PENDING").length;

  if (isAuthLoading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#0b0f19", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{
            height: "48px",
            width: "48px",
            border: "3px solid rgba(99, 102, 241, 0.3)",
            borderTopColor: "#6366f1",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>Loading session...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Login View
  if (!token) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#070a13",
        backgroundImage: "radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.08) 0%, transparent 45%)",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}>
        <div style={{
          width: "100%",
          maxWidth: "420px",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          backgroundColor: "rgba(19, 26, 44, 0.65)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "24px",
          padding: "36px 32px",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7)"
        }}>
          {/* Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
            <div style={{
              height: "56px",
              width: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              boxShadow: "0 8px 16px -4px rgba(99, 102, 241, 0.5)"
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: "bold", color: "white", letterSpacing: "0.5px" }}>V-Platform Console</h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "6px" }}>Authorized Administrator Access Only</p>
          </div>

          {authError && (
            <div style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "12px",
              padding: "12px 16px",
              color: "#f87171",
              fontSize: "13px",
              marginBottom: "20px",
              fontWeight: "500"
            }}>
              ⚠️ {authError}
            </div>
          )}

          {authMsg && (
            <div style={{
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              borderRadius: "12px",
              padding: "12px 16px",
              color: "#34d399",
              fontSize: "13px",
              marginBottom: "20px",
              fontWeight: "500"
            }}>
              ✓ {authMsg}
            </div>
          )}

          {/* Form */}
          {authStep === "identifier" ? (
            <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email or Mobile Number</label>
                <input
                  type="text"
                  placeholder="admin@vplatform.org"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  style={{
                    backgroundColor: "#070a13",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    color: "white",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                  onBlur={(e) => e.target.style.borderColor = "#334155"}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
                  transition: "opacity 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "48px"
                }}
              >
                {isSubmitting ? (
                  <div style={{
                    height: "20px",
                    width: "20px",
                    border: "2px solid rgba(255, 255, 255, 0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                ) : "Request OTP Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Verification OTP Code</label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  maxLength={6}
                  onChange={(e) => setOtpCode(e.target.value)}
                  style={{
                    backgroundColor: "#070a13",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    color: "white",
                    fontSize: "16px",
                    fontWeight: "bold",
                    letterSpacing: "4px",
                    textAlign: "center",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                  onBlur={(e) => e.target.style.borderColor = "#334155"}
                />
              </div>

              {devOtp && (
                <div style={{
                  backgroundColor: "rgba(99, 102, 241, 0.1)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  textAlign: "center"
                }}>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>Development OTP (Auto-Intercepted):</p>
                  <p style={{ fontSize: "18px", fontWeight: "bold", color: "#6366f1", margin: "4px 0 0 0", letterSpacing: "2px" }}>{devOtp}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "48px"
                }}
              >
                {isSubmitting ? (
                  <div style={{
                    height: "20px",
                    width: "20px",
                    border: "2px solid rgba(255, 255, 255, 0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                ) : "Verify and Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthStep("identifier");
                  setOtpCode("");
                  setAuthError("");
                  setDevOtp("");
                }}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "13px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textAlign: "center"
                }}
              >
                Back to Identification
              </button>
            </form>
          )}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Dashboard View
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: "260px",
        backgroundColor: "#131a2c",
        borderRight: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px"
      }}>
        {/* Title logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px", padding: "0 8px" }}>
          <div style={{
            height: "36px",
            width: "36px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "white", letterSpacing: "0.5px" }}>V-PLATFORM</h2>
            <span style={{ fontSize: "10px", color: "#6366f1", fontWeight: "bold" }}>ADMIN PANEL</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <button 
            onClick={() => setActiveTab("dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: activeTab === "dashboard" ? "white" : "#94a3b8",
              backgroundColor: activeTab === "dashboard" ? "#6366f1" : "transparent",
              transition: "all 0.2s ease"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" />
              <rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" />
              <rect x="3" y="16" width="7" height="5" />
            </svg>
            Dashboard
          </button>

          <button 
            onClick={() => setActiveTab("ngos")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: activeTab === "ngos" ? "white" : "#94a3b8",
              backgroundColor: activeTab === "ngos" ? "#6366f1" : "transparent",
              transition: "all 0.2s ease"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
              </svg>
              Verify NGOs
            </span>
            {pendingNgosCount > 0 && (
              <span style={{
                backgroundColor: "#ec4899",
                color: "white",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: "bold"
              }}>{pendingNgosCount}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab("events")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: activeTab === "events" ? "white" : "#94a3b8",
              backgroundColor: activeTab === "events" ? "#6366f1" : "transparent",
              transition: "all 0.2s ease"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Moderate Events
          </button>

          <button 
            onClick={() => setActiveTab("moderation")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: activeTab === "moderation" ? "white" : "#94a3b8",
              backgroundColor: activeTab === "moderation" ? "#6366f1" : "transparent",
              transition: "all 0.2s ease"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              Safety Reports
            </span>
            {pendingReportsCount > 0 && (
              <span style={{
                backgroundColor: "#ef4444",
                color: "white",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: "bold"
              }}>{pendingReportsCount}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab("payments")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: activeTab === "payments" ? "white" : "#94a3b8",
              backgroundColor: activeTab === "payments" ? "#6366f1" : "transparent",
              transition: "all 0.2s ease"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Payments
            </span>
            {pendingPaymentsCount > 0 && (
              <span style={{
                backgroundColor: "#d97706",
                color: "white",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: "bold"
              }}>{pendingPaymentsCount}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab("users")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: activeTab === "users" ? "white" : "#94a3b8",
              backgroundColor: activeTab === "users" ? "#6366f1" : "transparent",
              transition: "all 0.2s ease"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Manage Users
          </button>
        </nav>

        {/* User footer profile */}
        <div style={{
          borderTop: "1px solid #334155",
          paddingTop: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              height: "40px",
              width: "40px",
              borderRadius: "50%",
              backgroundColor: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #334155",
              fontWeight: "bold",
              color: "#6366f1"
            }}>AD</div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: "bold", color: "white", margin: 0 }}>
                {adminUser?.fullName?.split(" ")[0] || "Admin"}
              </p>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                {adminUser?.email || "admin@vplatform.org"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "40px", overflowY: "auto", backgroundColor: "#0b0f19" }}>
        {/* Header Title */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "36px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "white", margin: 0 }}>
              {activeTab === "dashboard" && "Console Overview"}
              {activeTab === "ngos" && "NGO Verifications"}
              {activeTab === "events" && "Campaign Moderation"}
              {activeTab === "moderation" && "Safety Operations"}
              {activeTab === "payments" && "Financial Dashboard"}
              {activeTab === "users" && "User Moderation Control"}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "4px", margin: "4px 0 0 0" }}>
              {activeTab === "dashboard" && "Monitor platform users, NGO compliance, and active drives."}
              {activeTab === "ngos" && "Verify registrations and legal documentation for host organizations."}
              {activeTab === "events" && "Oversee published volunteering drives and feature active campaigns."}
              {activeTab === "moderation" && "Review spam alerts, fake events, or fraud reports submitted by users."}
              {activeTab === "payments" && "Track premium host subscriptions and community donations in real-time."}
              {activeTab === "users" && "Monitor volunteer contributions, manage organizer accounts, and ban or reinstate users."}
            </p>
          </div>
          <span style={{ fontSize: "12px", color: "#94a3b8", border: "1px solid #334155", padding: "8px 16px", borderRadius: "20px", backgroundColor: "#131a2c" }}>
            Server: <strong style={{ color: "#10b981" }}>ONLINE</strong>
          </span>
        </header>

        {/* Dashboard Home View */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {/* Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.45)", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Total Volunteers</p>
                <h3 style={{ fontSize: "28px", fontWeight: "bold", color: "white", margin: "8px 0 0 0" }}>1,280</h3>
                <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600", display: "inline-block", marginTop: "4px" }}>↑ +12% this month</span>
              </div>
              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.45)", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Active Drive Hosts</p>
                <h3 style={{ fontSize: "28px", fontWeight: "bold", color: "white", margin: "8px 0 0 0" }}>84</h3>
                <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600", display: "inline-block", marginTop: "4px" }}>↑ +5 verified this week</span>
              </div>
              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.45)", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Ongoing Campaigns</p>
                <h3 style={{ fontSize: "28px", fontWeight: "bold", color: "white", margin: "8px 0 0 0" }}>{activeEventsCount}</h3>
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "inline-block", marginTop: "4px" }}>Synced in real-time</span>
              </div>
              <div style={{ 
                backgroundColor: "rgba(30, 41, 59, 0.45)", 
                border: "1px solid #334155", 
                borderRadius: "16px", 
                padding: "24px", 
                borderLeft: pendingNgosCount > 0 ? "3px solid #ec4899" : "1px solid #334155" 
              }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Pending Verifications</p>
                <h3 style={{ fontSize: "28px", fontWeight: "bold", color: "white", margin: "8px 0 0 0" }}>{pendingNgosCount}</h3>
                <span style={{ fontSize: "11px", color: pendingNgosCount > 0 ? "#ec4899" : "#94a3b8", fontWeight: "600", display: "inline-block", marginTop: "4px" }}>
                  {pendingNgosCount > 0 ? "⚠️ Requires review" : "✓ Compliance clear"}
                </span>
              </div>
            </div>

            {/* Main content grid split */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "28px" }}>
              {/* Event Moderation overview */}
              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.45)", border: "1px solid #334155", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "18px", color: "white", fontWeight: "bold", margin: "0 0 20px 0" }}>Published Volunteer Campaigns</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {events.slice(0, 3).map(evt => (
                    <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "16px" }}>
                      <div>
                        <p style={{ fontWeight: "bold", color: "white", margin: 0 }}>{evt.name}</p>
                        <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", margin: "4px 0 0 0" }}>
                          Host: <strong>{evt.organizer}</strong> | {evt.category} | {evt.location}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{
                          fontSize: "11px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          backgroundColor: evt.status === "FEATURED" ? "rgba(234, 179, 8, 0.15)" : evt.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(236, 72, 153, 0.15)",
                          color: evt.status === "FEATURED" ? "#eab308" : evt.status === "ACTIVE" ? "#10b981" : "#ec4899",
                        }}>{evt.status}</span>
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>{evt.volunteersApplied}/{evt.volunteersNeeded} slots</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveTab("events")} 
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "#6366f1",
                    fontWeight: "bold",
                    marginTop: "20px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: 0
                  }}
                >
                  Manage all drives
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

              {/* Quick Analytics Chart */}
              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.45)", border: "1px solid #334155", borderRadius: "16px", padding: "28px", display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: "18px", color: "white", fontWeight: "bold", margin: 0 }}>Volunteer Registrations</h3>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "4px 0 28px 0" }}>Platform growth metrics for the last 4 months.</p>
                
                {/* Simulated CSS Chart */}
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 10px 10px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <div style={{ height: "60px", width: "40px", borderRadius: "6px", backgroundColor: "#334155" }} />
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>March</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <div style={{ height: "100px", width: "40px", borderRadius: "6px", backgroundColor: "#334155" }} />
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>April</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <div style={{ height: "150px", width: "40px", borderRadius: "6px", backgroundColor: "#334155" }} />
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>May</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <div style={{ height: "200px", width: "40px", borderRadius: "6px", background: "linear-gradient(to top, #6366f1, #ec4899)" }} />
                    <span style={{ fontSize: "11px", color: "white", fontWeight: "bold" }}>June</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NGO Verification Tab */}
        {activeTab === "ngos" && (
          <div style={{ backgroundColor: "rgba(30, 41, 59, 0.45)", border: "1px solid #334155", borderRadius: "16px", padding: "28px" }}>
            <h3 style={{ fontSize: "18px", color: "white", fontWeight: "bold", margin: "0 0 20px 0" }}>Legal Document Verification Pipeline</h3>
            
            {ngos.filter(ngo => ngo.status === "PENDING").length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ color: "#10b981", fontWeight: "bold", margin: 0 }}>✓ Verification queue clear!</p>
                <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "8px", margin: "8px 0 0 0" }}>All host registrations match platform compliance policies.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", textAlign: "left" }}>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Organization</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Reg. Number</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Contact</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Proof Document</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ngos.filter(ngo => ngo.status === "PENDING").map(ngo => (
                    <tr key={ngo.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "18px 8px", fontWeight: "bold" }}>{ngo.name}</td>
                      <td style={{ padding: "18px 8px", fontFamily: "monospace", color: "#94a3b8" }}>{ngo.regNumber}</td>
                      <td style={{ padding: "18px 8px", fontSize: "13px", color: "#94a3b8" }}>
                        <div>{ngo.email}</div>
                        <div style={{ marginTop: "4px" }}>{ngo.phone}</div>
                      </td>
                      <td style={{ padding: "18px 8px" }}>
                        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#6366f1", fontSize: "13px", textDecoration: "underline", display: "flex", alignItems: "center", gap: "6px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                          </svg>
                          {ngo.documents}
                        </a>
                      </td>
                      <td style={{ padding: "18px 8px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                          <button 
                            onClick={() => handleApproveNGO(ngo.id)}
                            style={{
                              backgroundColor: "#10b981",
                              color: "white",
                              border: "none",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "bold"
                            }}
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleRejectNGO(ngo.id)}
                            style={{
                              backgroundColor: "transparent",
                              border: "1px solid #ec4899",
                              color: "#ec4899",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "bold"
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Campaign Moderation Tab */}
        {activeTab === "events" && (
          <div style={{ backgroundColor: "rgba(30, 41, 59, 0.45)", border: "1px solid #334155", borderRadius: "16px", padding: "28px" }}>
            {/* Table Search */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", color: "white", fontWeight: "bold", margin: 0 }}>Active Volunteer Drives</h3>
              <input 
                type="text" 
                placeholder="Filter events..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  backgroundColor: "#0b0f19",
                  border: "1px solid #334155",
                  color: "white",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  width: "240px",
                  outline: "none"
                }}
              />
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Event Drive</th>
                  <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Category</th>
                  <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Location</th>
                  <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Applications</th>
                  <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Status</th>
                  <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px", textAlign: "right" }}>Control Action</th>
                </tr>
              </thead>
              <tbody>
                {events.filter(evt => evt.name.toLowerCase().includes(searchQuery.toLowerCase())).map(evt => (
                  <tr key={evt.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "16px 8px" }}>
                      <div style={{ fontWeight: "bold" }}>{evt.name}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Host: {evt.organizer}</div>
                    </td>
                    <td style={{ padding: "16px 8px", fontSize: "13px" }}>{evt.category}</td>
                    <td style={{ padding: "16px 8px", fontSize: "13px", color: "#94a3b8" }}>{evt.location}</td>
                    <td style={{ padding: "16px 8px", fontSize: "13px" }}>
                      <strong style={{ color: "#6366f1" }}>{evt.volunteersApplied}</strong> / {evt.volunteersNeeded} slots
                    </td>
                    <td style={{ padding: "16px 8px" }}>
                      <span style={{
                        fontSize: "10px",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        backgroundColor: 
                          evt.status === "FEATURED" ? "rgba(234, 179, 8, 0.15)" :
                          evt.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(236, 72, 153, 0.15)",
                        color: 
                          evt.status === "FEATURED" ? "#eab308" :
                          evt.status === "ACTIVE" ? "#10b981" : "#ec4899",
                      }}>{evt.status}</span>
                    </td>
                    <td style={{ padding: "16px 8px", textAlign: "right" }}>
                      <button 
                        onClick={() => toggleEventStatus(evt.id)}
                        style={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          color: "white",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {evt.status === "ACTIVE" ? "⭐ Feature" : evt.status === "FEATURED" ? "🚫 Suspend" : "✓ Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Safety Reports Tab */}
        {activeTab === "moderation" && (
          <div style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            borderRadius: "16px",
            border: "1px solid #334155",
            padding: "24px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
          }}>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "white", marginBottom: "20px", margin: "0 0 20px 0" }}>Safety & Complaints Moderation</h3>
            
            {reports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ color: "#10b981", fontWeight: "bold", margin: 0 }}>✓ Reports queue clear!</p>
                <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "8px", margin: "8px 0 0 0" }}>No complaints have been filed by the community.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", textAlign: "left" }}>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Event Target</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Flag Category</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Reporter & Reason</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Status</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px", textAlign: "right" }}>Moderation Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(rep => (
                    <tr key={rep.id} style={{ borderBottom: "1px solid #1e293b", opacity: rep.resolved ? 0.6 : 1.0 }}>
                      <td style={{ padding: "16px 8px" }}>
                        <div style={{ fontWeight: "bold", color: "#f87171" }}>{rep.eventName}</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Date: {rep.date}</div>
                      </td>
                      <td style={{ padding: "16px 8px" }}>
                        <span style={{
                          fontSize: "10px",
                          padding: "3px 6px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          backgroundColor: "rgba(239, 68, 68, 0.15)",
                          color: "#ef4444",
                        }}>{rep.category}</span>
                      </td>
                      <td style={{ padding: "16px 8px", fontSize: "13px", maxWidth: "320px" }}>
                        <div style={{ fontWeight: "600", color: "#94a3b8" }}>By: {rep.reporter}</div>
                        <p style={{ margin: "4px 0 0 0", color: "#cbd5e1", lineHeight: "1.4" }}>"{rep.reason}"</p>
                      </td>
                      <td style={{ padding: "16px 8px" }}>
                        <span style={{
                          fontSize: "10px",
                          padding: "3px 6px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          backgroundColor: rep.resolved ? "rgba(16, 185, 129, 0.15)" : "rgba(234, 179, 8, 0.15)",
                          color: rep.resolved ? "#10b981" : "#eab308",
                        }}>{rep.resolved ? "RESOLVED" : "ACTIVE"}</span>
                      </td>
                      <td style={{ padding: "16px 8px", textAlign: "right" }}>
                        {!rep.resolved ? (
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button 
                              onClick={() => handleResolveReport(rep.id)}
                              style={{
                                backgroundColor: "rgba(16, 185, 129, 0.15)",
                                border: "1px solid #10b981",
                                color: "#10b981",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "600"
                              }}
                            >
                              Dismiss
                            </button>
                            <button 
                              onClick={() => handleRemoveReportedEvent(rep.eventId, rep.id)}
                              style={{
                                backgroundColor: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid #ef4444",
                                color: "#ef4444",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "600"
                              }}
                            >
                              Purge Event
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#64748b" }}>Action Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            borderRadius: "16px",
            border: "1px solid #334155",
            padding: "24px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "white", margin: 0 }}>Payments & Donations</h3>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Total Revenue</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#10b981" }}>₹{totalRevenue.toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Pending</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#eab308" }}>{pendingPaymentsCount}</div>
                </div>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>No payment transactions recorded.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", textAlign: "left" }}>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Donor / Org</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Type</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Event</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Amount</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Date</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Status</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Tx Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const typeLabel: Record<string, string> = { DONATION: 'Donation', PREMIUM_SUBSCRIBER: 'Subscription', FEATURED_EVENT_FEE: 'Event Promotion' };
                    const typeColor: Record<string, string> = { DONATION: '#6366f1', PREMIUM_SUBSCRIBER: '#d97706', FEATURED_EVENT_FEE: '#10b981' };
                    return (
                      <tr key={tx.id} style={{ borderBottom: "1px solid #1e293b" }}>
                        <td style={{ padding: "14px 8px", fontWeight: "bold" }}>{tx.donor}</td>
                        <td style={{ padding: "14px 8px" }}>
                          <span style={{ fontSize: "10px", padding: "3px 7px", borderRadius: "4px", fontWeight: "bold", backgroundColor: `${typeColor[tx.type]}22`, color: typeColor[tx.type] }}>
                            {typeLabel[tx.type] || tx.type}
                          </span>
                        </td>
                        <td style={{ padding: "14px 8px", color: "#94a3b8", fontSize: "13px" }}>{tx.eventName ?? "—"}</td>
                        <td style={{ padding: "14px 8px", fontWeight: "bold", color: "#10b981" }}>{tx.currency} {tx.amount.toLocaleString()}</td>
                        <td style={{ padding: "14px 8px", color: "#64748b", fontSize: "12px" }}>{tx.date}</td>
                        <td style={{ padding: "14px 8px" }}>
                          <span style={{
                            fontSize: "10px", padding: "3px 7px", borderRadius: "4px", fontWeight: "bold",
                            backgroundColor: tx.status === "SUCCESS" ? "rgba(16,185,129,0.15)" : tx.status === "PENDING" ? "rgba(234,179,8,0.15)" : "rgba(239,68,68,0.15)",
                            color: tx.status === "SUCCESS" ? "#10b981" : tx.status === "PENDING" ? "#eab308" : "#ef4444"
                          }}>{tx.status}</span>
                        </td>
                        <td style={{ padding: "14px 8px", color: "#475569", fontSize: "10px", fontFamily: "monospace" }}>{tx.txRef}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Manage Users Tab */}
        {activeTab === "users" && (
          <div style={{
            backgroundColor: "rgba(30, 41, 59, 0.45)",
            borderRadius: "16px",
            border: "1px solid #334155",
            padding: "24px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "white", margin: 0 }}>Volunteer & Organizer Control</h3>
              <span style={{ fontSize: "12px", color: "#cbd5e1" }}>Total Registered: <strong>{usersList.length}</strong></span>
            </div>

            {usersList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>No users found on the platform.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", textAlign: "left" }}>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Name / Email</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Phone</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Account Type</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Reputation</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Joined Date</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px" }}>Status</th>
                    <th style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "13px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(user => {
                    const isSelf = adminUser && adminUser.id === user.id;
                    return (
                      <tr key={user.id} style={{ borderBottom: "1px solid #1e293b", opacity: user.isBanned ? 0.6 : 1 }}>
                        <td style={{ padding: "14px 8px" }}>
                          <div style={{ fontWeight: "bold" }}>{user.fullName}</div>
                          <div style={{ fontSize: "12px", color: "#94a3b8" }}>{user.email}</div>
                        </td>
                        <td style={{ padding: "14px 8px", color: "#94a3b8", fontSize: "13px" }}>{user.phoneNumber ?? "—"}</td>
                        <td style={{ padding: "14px 8px" }}>
                          <span style={{
                            fontSize: "10px",
                            padding: "3px 7px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            backgroundColor: user.userType === "ADMIN" ? "rgba(236,72,153,0.15)" : user.userType === "ORGANIZER" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                            color: user.userType === "ADMIN" ? "#ec4899" : user.userType === "ORGANIZER" ? "#10b981" : "#6366f1"
                          }}>{user.userType}</span>
                        </td>
                        <td style={{ padding: "14px 8px", fontSize: "13px" }}>
                          {user.userType === "VOLUNTEER" && user.profile ? (
                            <div style={{ color: "#eab308", fontWeight: "bold" }}>
                              {user.profile.reputationLevel} ({user.profile.reputationScore} pts)
                            </div>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "14px 8px", color: "#64748b", fontSize: "12px" }}>{user.createdAt}</td>
                        <td style={{ padding: "14px 8px" }}>
                          <span style={{
                            fontSize: "10px", padding: "3px 7px", borderRadius: "4px", fontWeight: "bold",
                            backgroundColor: user.isBanned ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                            color: user.isBanned ? "#ef4444" : "#10b981"
                          }}>{user.isBanned ? "SUSPENDED" : "ACTIVE"}</span>
                        </td>
                        <td style={{ padding: "14px 8px", textAlign: "right" }}>
                          {!isSelf && user.userType !== "ADMIN" ? (
                            <button
                              onClick={() => handleToggleUserBan(user.id, user.isBanned)}
                              style={{
                                backgroundColor: user.isBanned ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                                border: `1px solid ${user.isBanned ? "#10b981" : "#ef4444"}`,
                                color: user.isBanned ? "#10b981" : "#ef4444",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "600",
                                transition: "all 0.2s"
                              }}
                            >
                              {user.isBanned ? "Reactivate" : "Suspend Account"}
                            </button>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#475569" }}>No Actions</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
