import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { storage } from "@/lib/storage";
import { adminService } from "@/lib/adminService";
import { cn } from "@/lib/utils";

export default function Login() {
  const navigate = useNavigate();

  // Mode: "signin" | "signup"
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [penName, setPenName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Security Math Captcha (For Register)
  const [captchaQuestion, setCaptchaQuestion] = useState(() => {
    const n1 = Math.floor(Math.random() * 8) + 3;
    const n2 = Math.floor(Math.random() * 7) + 2;
    return { num1: n1, num2: n2, answer: n1 + n2 };
  });
  const [captchaInput, setCaptchaInput] = useState("");

  const refreshCaptcha = () => {
    const n1 = Math.floor(Math.random() * 8) + 3;
    const n2 = Math.floor(Math.random() * 7) + 2;
    setCaptchaQuestion({ num1: n1, num2: n2, answer: n1 + n2 });
    setCaptchaInput("");
  };

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (next === "signup") refreshCaptcha();
  };

  // Honour "Keep me signed in": persist across browser restarts, or only for this tab session
  const applyPersistence = () =>
    setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  // Monitor auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        storage.switchUser(user.uid, user.email, user.displayName);
        try {
          await storage.syncFromCloud(user.uid);
        } catch (e) {
          console.warn("Auto-sync on login mount:", e);
        }
        navigate("/dashboard", { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Post-login data sync and redirection
  const handlePostAuthSync = async (user: any, customPenName?: string) => {
    const authorName = customPenName || user.displayName || user.email?.split("@")[0] || "Author";
    storage.switchUser(user.uid, user.email, authorName);

    try {
      await adminService.trackUserActivity({
        uid: user.uid,
        email: user.email,
        displayName: authorName,
      });
      await storage.syncFromCloud(user.uid);
      await storage.syncAllLocalDataToCloud(user.uid);
    } catch (e) {
      console.warn("Post-auth synchronization note:", e);
    }

    navigate("/dashboard");
  };

  // Submit handler (Email/Password)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !email.includes("@")) {
      setErrorMsg("Please provide a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (mode === "signup") {
      if (!confirmPassword) {
        setErrorMsg("Please confirm your password.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match. Please verify your password confirmation.");
        return;
      }
      const parsedCaptcha = parseInt(captchaInput.trim(), 10);
      if (isNaN(parsedCaptcha) || parsedCaptcha !== captchaQuestion.answer) {
        setErrorMsg("Incorrect math verification. Please solve the calculation to continue.");
        refreshCaptcha();
        return;
      }
    }

    setIsLoading(true);

    try {
      await applyPersistence();
      if (mode === "signup") {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const nameToUse = penName.trim() || email.split("@")[0] || "Author";

        if (userCred.user) {
          try {
            await updateProfile(userCred.user, { displayName: nameToUse });
          } catch (err) {
            console.warn("Profile update note:", err);
          }
          // Verified email is required to claim WarriorPlus purchases (see firestore.rules)
          try {
            await sendEmailVerification(userCred.user);
          } catch (err) {
            console.warn("Verification email note:", err);
          }
          setSuccessMsg("Account created — we've sent a verification link to your inbox. Opening your studio…");
          await handlePostAuthSync(userCred.user, nameToUse);
        }
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (userCred.user) {
          setSuccessMsg("Welcome back, Storyteller. Loading your archives...");
          await handlePostAuthSync(userCred.user);
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = "Authentication failed. Please verify your credentials.";
      const code = err?.code;

      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        message = "Invalid email or password. Please check your spelling.";
      } else if (code === "auth/email-already-in-use") {
        message = "This email is already registered. Please sign in instead.";
      } else if (code === "auth/weak-password") {
        message = "Password must be at least 6 characters long.";
      } else if (code === "auth/too-many-requests") {
        message = "Too many attempts. Access temporarily paused for your security.";
      } else if (err?.message) {
        message = err.message;
      }

      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsGoogleLoading(true);

    try {
      // Not awaited: the popup must open synchronously within the click gesture or browsers block it
      applyPersistence().catch((e) => console.warn("Persistence note:", e));
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setSuccessMsg("Google verified. Synchronizing author archives...");
        await handlePostAuthSync(result.user);
      }
    } catch (err: any) {
      const isUserCancellation =
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/cancelled-popup-request" ||
        err?.code === "auth/popup-blocked";

      if (isUserCancellation) {
        console.info("[Auth] Google Sign-In popup was closed or cancelled by the user.");
      } else {
        console.error("Google Sign-In error:", err);
        setErrorMsg(err?.message || "Google authentication was interrupted. Please try again.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Password reset handler
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes("@")) {
      setResetStatus("Please enter a valid email address.");
      return;
    }
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetStatus("A password reset link has been dispatched to your inbox.");
      setTimeout(() => {
        setIsForgotModalOpen(false);
        setResetStatus(null);
      }, 2500);
    } catch (err: any) {
      setResetStatus(err?.message || "Unable to send reset email. Please verify the address.");
    } finally {
      setIsResetting(false);
    }
  };

  const inputCls =
    "w-full h-11 px-3.5 bg-white border border-[#E3DACB] rounded-xl text-sm text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-[#8C503C] focus:ring-4 focus:ring-[#8C503C]/10";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-10 bg-[#140E0A] overflow-hidden font-sans selection:bg-[#8C503C] selection:text-white">
      <Backdrop />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-[380px]"
      >
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <LogoMark className="w-12 h-12" />
          <h1 className="mt-3 font-serif text-2xl font-bold text-[#FAF6EE] tracking-tight">Ocean Novel</h1>
          <p className="mt-1 font-serif italic text-[13px] text-[#B8A68F]">Where stories find their shape.</p>
        </div>

        <div className="rounded-3xl bg-[#FAF8F5] p-6 sm:p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] space-y-5">
          {/* Mode switch */}
          <div className="grid grid-cols-2 p-1 bg-[#EFE9DE] rounded-xl relative">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  "relative z-10 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer",
                  mode === m ? "text-[#2A1B14]" : "text-stone-500 hover:text-stone-800"
                )}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
            <motion.div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm"
              initial={false}
              animate={{ left: mode === "signin" ? 4 : "50%" }}
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          </div>

          {/* Feedback */}
          <AnimatePresence mode="wait">
            {(errorMsg || successMsg) && (
              <motion.div
                key={errorMsg ? "err" : "ok"}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "px-3 py-2.5 rounded-xl flex items-start gap-2 text-[13px] leading-snug",
                  errorMsg ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"
                )}
              >
                {errorMsg ? <IconAlert className="w-4 h-4 mt-px shrink-0" /> : <IconCheck className="w-4 h-4 mt-px shrink-0" />}
                <span>{errorMsg || successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full h-11 bg-white border border-[#E3DACB] hover:border-[#C9B79F] hover:bg-[#FFFDF9] rounded-xl text-sm font-medium text-stone-700 flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-60"
          >
            {isGoogleLoading ? <IconSpinner className="w-4 h-4 text-[#8C503C]" /> : <GoogleLogo className="w-4 h-4" />}
            {isGoogleLoading ? "Connecting…" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 text-xs text-stone-400">
            <div className="h-px flex-1 bg-[#E6DECF]" />
            or
            <div className="h-px flex-1 bg-[#E6DECF]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                aria-label="Pen name"
                required
                placeholder="Pen name"
                value={penName}
                onChange={(e) => setPenName(e.target.value)}
                className={inputCls}
              />
            )}

            <input
              type="email"
              aria-label="Email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                aria-label="Password"
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(inputCls, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-[#8C503C] transition cursor-pointer"
              >
                {showPassword ? <IconEyeOff className="w-[18px] h-[18px]" /> : <IconEye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            {mode === "signup" && (
              <>
                <input
                  type={showPassword ? "text" : "password"}
                  aria-label="Confirm password"
                  required
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    inputCls,
                    confirmPassword && password !== confirmPassword && "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  )}
                />

                <div className="flex items-center gap-2">
                  <span className="h-11 px-3.5 flex items-center rounded-xl bg-[#EFE9DE] font-mono text-sm font-semibold text-[#2A1B14] select-none shrink-0">
                    {captchaQuestion.num1} + {captchaQuestion.num2} =
                  </span>
                  <input
                    type="number"
                    aria-label="Answer to the sum"
                    required
                    placeholder="?"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className={cn(inputCls, "font-mono")}
                  />
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    aria-label="New sum"
                    className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-stone-400 hover:text-[#8C503C] hover:bg-[#EFE9DE] transition cursor-pointer"
                  >
                    <IconRefresh className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[13px] text-stone-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#8C503C] cursor-pointer"
                />
                Keep me signed in
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setIsForgotModalOpen(true);
                  }}
                  className="text-[13px] text-[#8C503C] hover:underline cursor-pointer"
                >
                  Forgot?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="group w-full h-11 mt-1 bg-[#8C503C] hover:bg-[#7A4332] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_8px_24px_-10px_rgba(140,80,60,0.9)] transition-colors cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <IconSpinner className="w-4 h-4" />
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <IconArrow className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[13px] text-[#A69584]">
          {mode === "signin" ? "New to Ocean Novel?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-[#E0B98A] hover:underline cursor-pointer"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </motion.div>

      {/* Password reset */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsForgotModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[360px] bg-[#FAF8F5] rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#EFE9DE] transition cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>

              <div>
                <h3 className="font-serif text-lg font-bold text-[#2A1B14]">Reset password</h3>
                <p className="mt-1 text-[13px] text-stone-500">We'll email you a link to set a new one.</p>
              </div>

              <form onSubmit={handleSendPasswordReset} className="space-y-3">
                <input
                  type="email"
                  aria-label="Email"
                  required
                  placeholder="Email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={inputCls}
                />
                {resetStatus && (
                  <p className="text-[13px] text-[#8C503C] bg-[#8C503C]/8 px-3 py-2 rounded-xl">{resetStatus}</p>
                )}
                <button
                  type="submit"
                  disabled={isResetting}
                  className="w-full h-11 bg-[#8C503C] hover:bg-[#7A4332] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isResetting ? <IconSpinner className="w-4 h-4" /> : "Send reset link"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Backdrop & brand                                                    */
/* ------------------------------------------------------------------ */

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[520px] rounded-full bg-[#8C503C]/25 blur-[140px]" />
      <div className="absolute -bottom-40 -right-20 w-[520px] h-[420px] rounded-full bg-[#C89D66]/10 blur-[120px]" />
      <svg className="absolute bottom-0 left-0 w-full h-48 text-[#C89D66]" viewBox="0 0 1440 200" preserveAspectRatio="none" fill="none">
        {[0, 1, 2, 3].map((i) => (
          <motion.path
            key={i}
            d={`M0 ${80 + i * 30} C 240 ${50 + i * 30}, 480 ${110 + i * 30}, 720 ${80 + i * 30} S 1200 ${50 + i * 30}, 1440 ${80 + i * 30}`}
            stroke="currentColor"
            strokeOpacity={0.14 - i * 0.03}
            strokeWidth="1.2"
            animate={{ x: [0, i % 2 ? 24 : -24, 0] }}
            transition={{ duration: 14 + i * 3, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
    </div>
  );
}

// Brand mark: an open book resting on a wave
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="on-logo" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C89D66" />
          <stop offset="1" stopColor="#8C503C" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#on-logo)" />
      <g fill="none" stroke="#FFF8EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 15.5c3.6-1.6 7.4-1.2 11 1.5v13c-3.6-2.7-7.4-3.1-11-1.5z" />
        <path d="M35 15.5c-3.6-1.6-7.4-1.2-11 1.5v13c3.6-2.7 7.4-3.1 11-1.5z" />
        <path d="M11 35.5c2.2-1.6 4.4-1.6 6.5 0s4.4 1.6 6.5 0 4.4-1.6 6.5 0 4.4 1.6 6.5 0" strokeOpacity="0.85" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Icon set — 24px grid, 1.75 stroke, round caps                       */
/* ------------------------------------------------------------------ */

type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconEye(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Icon>
  );
}

function IconEyeOff(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.3 7.4A15.6 15.6 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1" />
      <path d="M10 10.1a2.75 2.75 0 0 0 3.9 3.9" />
      <path d="m3.5 3.5 17 17" />
    </Icon>
  );
}

function IconArrow(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Icon>
  );
}

function IconRefresh(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </Icon>
  );
}

function IconAlert(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.25M12 16.25v.25" />
    </Icon>
  );
}

function IconCheck(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.25 12.25 2.5 2.5 5-5.25" />
    </Icon>
  );
}

function IconClose(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

function IconSpinner({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("animate-spin", className)} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Google's brand mark must stay in its official colours
function GoogleLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}
