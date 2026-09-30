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
import {
  IconAlert,
  IconArrow,
  IconBookWave,
  IconCheck,
  IconClose,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconSpinner,
} from "@/components/brand/ocean-ui";

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

  const labelCls = "block pl-5 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0E1D26]/60";
  const inputCls =
    "w-full h-[52px] px-5 bg-white border border-[#E4DAC8] rounded-full text-[15px] text-[#0E1D26] placeholder:text-[#0E1D26]/35 outline-none transition focus:border-[#E8561F] focus:ring-4 focus:ring-[#E8561F]/12";
  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen w-full flex bg-[#F6F1E7] font-['Outfit'] text-[#0E1D26] selection:bg-[#E8561F] selection:text-white">
      {/* ================= LEFT: NAVY HERO ================= */}
      <aside className="hidden lg:flex relative w-[58%] overflow-hidden bg-[#0E1D26] text-[#F6F1E7]">
        {/* Geometric décor */}
        <div className="absolute -left-24 -bottom-28 w-[340px] h-[420px] rounded-t-full bg-[#F0B54B] rotate-[18deg]" aria-hidden="true" />
        <div className="absolute right-0 top-0 h-full w-[120px] bg-[#132631]" aria-hidden="true" />
        <div className="absolute right-[60px] top-[14%] w-[120px] h-[120px] rounded-full border-[18px] border-[#E8561F]/90" aria-hidden="true" />

        <div className="relative z-10 m-auto w-full max-w-[760px] px-12 xl:px-16 py-10 flex flex-col gap-10">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <IconBookWave className="w-7 h-7 text-[#F0B54B]" />
            <span className="text-[18px] font-bold tracking-tight">Ocean Novel</span>
          </div>

          {/* Book + headline */}
          <div className="flex items-center gap-10 xl:gap-14">
            <BookMockup />

            <div className="min-w-0">
              <span className="inline-block px-3 py-1 border border-[#F6F1E7]/70 text-[10px] font-bold uppercase tracking-[0.22em]">
                Novel Writing Studio
              </span>
              <h1 className="mt-4 text-[46px] xl:text-[58px] font-extrabold leading-[0.98] tracking-[-0.02em]">
                Write Your
                <br />
                <span className="text-[#E8561F]">Story World.</span>
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed text-[#F6F1E7]/75 max-w-[360px]">
                Characters, lore, plot and manuscript in one private studio — with a clear path from first idea to finished book.
              </p>
            </div>
          </div>

          {/* Playbook-style feature cards */}
          <div className="grid grid-cols-3 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.tag}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.15 + i * 0.1, ease: "easeOut" }}
                whileHover={{ y: -3 }}
                className="group flex items-stretch h-[92px] rounded-xl bg-[#F6F1E7] text-[#0E1D26] overflow-hidden"
              >
                <FeatureThumb variant={i} />
                <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-between">
                  <span className="self-start px-1.5 py-0.5 border border-[#0E1D26]/30 rounded text-[8.5px] font-bold uppercase tracking-[0.14em]">
                    {f.tag}
                  </span>
                  <p className="text-[13px] font-semibold leading-snug">{f.title}</p>
                </div>
                <div className="pr-2.5 hidden 2xl:flex items-center">
                  <span className="w-7 h-7 rounded-full border border-[#0E1D26]/15 flex items-center justify-center transition group-hover:bg-[#E8561F] group-hover:border-[#E8561F] group-hover:text-white">
                    <IconArrow className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </aside>

      {/* ================= RIGHT: FORM ================= */}
      <main className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile brand */}
          <div className="lg:hidden mb-10 relative overflow-hidden rounded-3xl bg-[#0E1D26] text-[#F6F1E7] px-6 py-7">
            <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[#E8561F]" aria-hidden="true" />
            <div className="absolute -left-8 -bottom-16 w-28 h-36 rounded-t-full bg-[#F0B54B] rotate-[18deg]" aria-hidden="true" />
            <div className="relative flex items-center gap-2">
              <IconBookWave className="w-6 h-6 text-[#F0B54B]" />
              <span className="text-[16px] font-bold tracking-tight">Ocean Novel</span>
            </div>
            <p className="relative mt-5 pl-16 text-[30px] font-extrabold leading-[1] tracking-[-0.02em]">
              Write Your <span className="text-[#E8561F]">Story World.</span>
            </p>
          </div>

          <span className="inline-block px-3 py-1 border border-[#0E1D26]/70 text-[10px] font-bold uppercase tracking-[0.22em]">
            {isSignup ? "New Author" : "Member Access"}
          </span>
          <h2 className="mt-4 text-[40px] font-extrabold leading-[1] tracking-[-0.02em]">
            {isSignup ? (
              <>
                Start your <span className="text-[#E8561F]">studio.</span>
              </>
            ) : (
              <>
                Welcome <span className="text-[#E8561F]">back.</span>
              </>
            )}
          </h2>
          <p className="mt-3 text-[15px] text-[#0E1D26]/65">
            {isSignup ? "Set up your author profile in under a minute." : "Sign in to open your manuscripts and story bible."}
          </p>

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
                  "mt-6 px-4 py-3 rounded-2xl flex items-start gap-2.5 text-[13px] leading-snug",
                  errorMsg ? "bg-[#E8561F]/10 text-[#A33A10]" : "bg-emerald-50 text-emerald-800"
                )}
              >
                {errorMsg ? <IconAlert className="w-4 h-4 mt-px shrink-0" /> : <IconCheck className="w-4 h-4 mt-px shrink-0" />}
                <span>{errorMsg || successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isSignup && (
              <div>
                <label htmlFor="pen" className={labelCls}>Pen name</label>
                <input id="pen" type="text" required value={penName} onChange={(e) => setPenName(e.target.value)} placeholder="How readers will know you" className={inputCls} />
              </div>
            )}

            <div>
              <label htmlFor="email" className={labelCls}>Email address</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
            </div>

            <div>
              <div className="flex items-baseline justify-between pr-5">
                <label htmlFor="pw" className={labelCls}>Password</label>
                {!isSignup && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[12px] font-medium text-[#E8561F] hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="pw"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "At least 6 characters" : "••••••••"}
                  className={cn(inputCls, "pr-14")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[#0E1D26]/40 hover:text-[#E8561F] transition cursor-pointer"
                >
                  {showPassword ? <IconEyeOff className="w-[18px] h-[18px]" /> : <IconEye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {isSignup && (
              <>
                <div>
                  <label htmlFor="pw2" className={labelCls}>Confirm password</label>
                  <input
                    id="pw2"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-[#E8561F]/60")}
                  />
                </div>

                <div>
                  <label htmlFor="sum" className={labelCls}>Quick check</label>
                  <div className="flex items-center gap-2">
                    <span className="h-[52px] px-5 flex items-center rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[15px] font-semibold select-none shrink-0 tabular-nums">
                      {captchaQuestion.num1} + {captchaQuestion.num2} =
                    </span>
                    <input id="sum" type="number" required value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} placeholder="?" className={inputCls} />
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      aria-label="New sum"
                      className="h-[52px] w-[52px] shrink-0 rounded-full border border-[#E4DAC8] flex items-center justify-center text-[#0E1D26]/50 hover:text-[#E8561F] hover:border-[#E8561F] transition cursor-pointer"
                    >
                      <IconRefresh className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="group w-full h-[54px] !mt-6 pl-7 pr-2 bg-[#E8561F] hover:bg-[#D44B17] text-white rounded-full text-[15px] font-bold flex items-center justify-between shadow-[0_14px_30px_-14px_rgba(232,86,31,0.9)] transition-colors cursor-pointer disabled:opacity-60"
            >
              <span>{isLoading ? "Opening studio…" : isSignup ? "Create My Studio" : "Enter The Studio"}</span>
              <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                {isLoading ? <IconSpinner className="w-4 h-4" /> : <IconArrow className="w-5 h-5" />}
              </span>
            </button>
          </form>

          <div className="my-6 flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#0E1D26]/40">
            <div className="h-px flex-1 bg-[#E4DAC8]" />
            or
            <div className="h-px flex-1 bg-[#E4DAC8]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full h-[52px] bg-white border border-[#E4DAC8] hover:border-[#0E1D26]/40 rounded-full text-[15px] font-semibold flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-60"
          >
            {isGoogleLoading ? <IconSpinner className="w-4 h-4 text-[#E8561F]" /> : <GoogleLogo className="w-[18px] h-[18px]" />}
            {isGoogleLoading ? "Connecting…" : "Continue with Google"}
          </button>

          <button
            type="button"
            onClick={() => switchMode(isSignup ? "signin" : "signup")}
            className="group mt-9 flex items-center gap-3 text-[15px] font-medium text-[#E8561F] cursor-pointer"
          >
            {isSignup ? "I already have an account" : "Create a free account"}
            <span className="w-9 h-9 rounded-full bg-[#E8561F] text-white flex items-center justify-center transition-transform group-hover:translate-x-1">
              <IconArrow className="w-4 h-4" />
            </span>
          </button>
        </motion.div>
      </main>

      {/* Password reset */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E1D26]/60 backdrop-blur-sm"
            onClick={() => setIsForgotModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#F6F1E7] rounded-3xl p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 w-9 h-9 rounded-full flex items-center justify-center text-[#0E1D26]/50 hover:text-[#0E1D26] hover:bg-[#E4DAC8]/60 transition cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>

              <h3 className="text-[28px] font-extrabold tracking-[-0.02em]">
                Reset <span className="text-[#E8561F]">password.</span>
              </h3>
              <p className="mt-1.5 text-[14px] text-[#0E1D26]/65">We'll email you a link to set a new one.</p>

              <form onSubmit={handleSendPasswordReset} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="reset" className={labelCls}>Email address</label>
                  <input id="reset" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className={inputCls} />
                </div>
                {resetStatus && <p className="text-[13px] text-[#A33A10] bg-[#E8561F]/10 px-4 py-2.5 rounded-2xl">{resetStatus}</p>}
                <button
                  type="submit"
                  disabled={isResetting}
                  className="w-full h-[52px] bg-[#E8561F] hover:bg-[#D44B17] text-white rounded-full text-[15px] font-bold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isResetting ? <IconSpinner className="w-4 h-4" /> : "Send Reset Link"}
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
/* Hero pieces                                                         */
/* ------------------------------------------------------------------ */

const FEATURES = [
  { tag: "Characters", title: "Dossiers & relationships" },
  { tag: "Story Bible", title: "Lore & world rules" },
  { tag: "Export", title: "KDP-ready EPUB 3" },
];

// Hardcover book with a Bauhaus cover, tilted in 3D over an orange sun
function BookMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, rotate: -8, y: 16 }}
      animate={{ opacity: 1, rotate: -5, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative shrink-0 w-[190px] h-[250px] xl:w-[210px] xl:h-[276px]"
      aria-hidden="true"
    >
      <div className="absolute -right-16 top-2 w-[190px] h-[190px] rounded-full bg-[#E8561F]" />
      {/* page block */}
      <div className="absolute inset-y-[6px] -right-[10px] w-[14px] rounded-r-sm bg-[repeating-linear-gradient(90deg,#EFE7D6_0_1px,#D9CDB6_1px_2px)] shadow-[4px_6px_12px_rgba(0,0,0,0.35)]" />
      {/* cover */}
      <div className="absolute inset-0 rounded-r-md rounded-l-sm bg-[#F6F1E7] overflow-hidden shadow-[18px_24px_40px_-12px_rgba(0,0,0,0.6)]">
        <svg viewBox="0 0 210 276" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <circle cx="130" cy="58" r="34" fill="#F0B54B" />
          <rect x="164" y="0" width="22" height="276" fill="#0E1D26" />
          <rect x="176" y="0" width="10" height="120" fill="#F6F1E7" />
          <path d="M40 276 A 80 80 0 0 1 164 200 L 164 276 Z" fill="#E8561F" />
          <path d="M92 276 L 164 222 L 164 276 Z" fill="#E9DCC5" />
        </svg>
        {/* spine shading */}
        <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/15 to-transparent" />
        <div className="absolute left-6 top-[42%] -translate-y-1/2">
          <p className="text-[27px] xl:text-[30px] font-extrabold leading-[0.95] tracking-[-0.02em] text-[#0E1D26]">
            Ocean
            <br />
            Novel
          </p>
          <p className="mt-2 text-[7px] font-bold uppercase tracking-[0.3em] text-[#0E1D26]/60">Story Studio</p>
        </div>
      </div>
    </motion.div>
  );
}

// Small architectural thumbnails echoing the arches, suns and stairs of the hero
function FeatureThumb({ variant }: { variant: number }) {
  return (
    <svg viewBox="0 0 80 92" className="w-[56px] 2xl:w-[72px] h-full shrink-0" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {variant === 0 && (
        <>
          <rect width="80" height="92" fill="#E8561F" />
          <rect x="44" width="36" height="92" fill="#C8461A" />
          <path d="M16 92 V48 A 18 18 0 0 1 52 48 V92 Z" fill="#E9DCC5" />
          <path d="M24 92 V52 A 10 10 0 0 1 44 52 V92 Z" fill="#9C3512" />
        </>
      )}
      {variant === 1 && (
        <>
          <rect width="80" height="92" fill="#E9DCC5" />
          <circle cx="22" cy="58" r="30" fill="#E8561F" />
          <path d="M40 92 V40 A 22 22 0 0 1 80 40 V92 Z" fill="#D8C7A9" />
          <path d="M50 92 V46 A 12 12 0 0 1 74 46 V92 Z" fill="#0E1D26" />
        </>
      )}
      {variant === 2 && (
        <>
          <rect width="80" height="92" fill="#D8C7A9" />
          <circle cx="60" cy="20" r="14" fill="#F0B54B" />
          {[0, 1, 2, 3, 4].map((s) => (
            <rect key={s} x={s * 12} y={92 - (s + 1) * 9} width={80 - s * 12} height="9" fill={s % 2 ? "#E9DCC5" : "#CDB999"} />
          ))}
        </>
      )}
    </svg>
  );
}

// Google's brand mark must stay in its official colours
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}
