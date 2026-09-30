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
import { CHARACTER_PRESETS } from "@/data/characterPresets";

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

  const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600 mb-2";
  const inputCls =
    "w-full h-[52px] px-4 bg-white border border-[#E6DFD3] rounded-xl text-[15px] text-stone-900 placeholder:text-stone-400 outline-none transition shadow-[0_1px_2px_rgba(42,27,20,0.04)] focus:border-[#2A1B14]/40 focus:ring-4 focus:ring-[#2A1B14]/5";
  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen w-full flex bg-[#FAF8F4] font-sans text-[#2A1B14] selection:bg-[#8C503C] selection:text-white">
      {/* ================= LEFT: EDITORIAL PANEL ================= */}
      <aside className="hidden lg:flex relative w-[56%] overflow-hidden border-r border-[#ECE6DB] bg-[#FBF9F5]">
        <Aura />

        <div className="relative z-10 m-auto w-full max-w-[660px] px-10 xl:px-14 py-8 flex flex-col gap-7">
          {/* Brand row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GlyphTile small />
              <span className="font-['Cormorant_Garamond'] text-[22px] font-semibold text-[#1E140E]">Ocean Novel</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/60 border border-white/80 backdrop-blur text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Novel Architecture Studio
            </span>
          </div>

          <div>
            <h1 className="font-['Cormorant_Garamond'] text-[48px] xl:text-[56px] leading-[1.02] font-medium tracking-tight text-[#1E140E]">
              Build worlds <span className="italic text-[#8C503C]">worth reading.</span>
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-stone-600 max-w-[480px]">
              Characters, lore, plot and manuscript — one private studio for your novel.
            </p>
          </div>

          <StudioBento />
        </div>
      </aside>

      {/* ================= RIGHT: FORM ================= */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[440px]"
        >
          {/* Mobile brand */}
          <div className="lg:hidden mb-10 flex items-center gap-3">
            <GlyphTile small />
            <span className="font-['Cormorant_Garamond'] text-2xl font-semibold">Ocean Novel</span>
          </div>

          <h2 className="font-['Cormorant_Garamond'] text-[34px] leading-tight font-medium text-[#1E140E]">
            {isSignup ? "Create your studio" : "Welcome back"}
          </h2>
          <p className="mt-2 text-[15px] text-stone-500">
            {isSignup ? "Set up your author profile in under a minute." : "Sign in to access your manuscripts and story bible."}
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
                  "mt-6 px-3.5 py-3 rounded-xl flex items-start gap-2.5 text-[13px] leading-snug",
                  errorMsg ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"
                )}
              >
                {errorMsg ? <IconAlert className="w-4 h-4 mt-px shrink-0" /> : <IconCheck className="w-4 h-4 mt-px shrink-0" />}
                <span>{errorMsg || successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
              <div className="flex items-baseline justify-between">
                <label htmlFor="pw" className={labelCls}>Password</label>
                {!isSignup && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[12px] text-stone-500 hover:text-[#2A1B14] transition cursor-pointer"
                  >
                    Forgot password?
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
                  className={cn(inputCls, "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-[#2A1B14] transition cursor-pointer"
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
                    className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-rose-300 focus:ring-rose-100")}
                  />
                </div>

                <div>
                  <label htmlFor="sum" className={labelCls}>Quick check</label>
                  <div className="flex items-center gap-2">
                    <span className="h-[52px] px-4 flex items-center rounded-xl bg-[#F1ECE3] font-mono text-[15px] font-semibold select-none shrink-0">
                      {captchaQuestion.num1} + {captchaQuestion.num2} =
                    </span>
                    <input id="sum" type="number" required value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} placeholder="?" className={cn(inputCls, "font-mono")} />
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      aria-label="New sum"
                      className="h-[52px] w-[52px] shrink-0 rounded-xl flex items-center justify-center text-stone-400 hover:text-[#2A1B14] hover:bg-[#F1ECE3] transition cursor-pointer"
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
              className="w-full h-[52px] !mt-7 bg-[#2A1B14] hover:bg-[#1E140E] text-[#FAF6EE] rounded-xl text-[13px] font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2 shadow-[0_10px_24px_-12px_rgba(30,20,14,0.8)] transition-colors cursor-pointer disabled:opacity-60"
            >
              {isLoading ? <IconSpinner className="w-4 h-4" /> : isSignup ? "Create my studio" : "Sign in to studio"}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
            <div className="h-px flex-1 bg-[#E6DFD3]" />
            or
            <div className="h-px flex-1 bg-[#E6DFD3]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full h-[52px] bg-white border border-[#E6DFD3] hover:border-[#CFC4B3] rounded-xl text-[15px] font-semibold text-[#1E140E] flex items-center justify-center gap-3 shadow-[0_1px_2px_rgba(42,27,20,0.04)] transition cursor-pointer disabled:opacity-60"
          >
            {isGoogleLoading ? <IconSpinner className="w-4 h-4 text-stone-500" /> : <GoogleLogo className="w-[18px] h-[18px]" />}
            {isGoogleLoading ? "Connecting…" : "Continue with Google"}
          </button>

          <p className="mt-8 text-center text-[14px] text-stone-500">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isSignup ? "signin" : "signup")}
              className="font-semibold text-[#1E140E] hover:underline cursor-pointer"
            >
              {isSignup ? "Sign in." : "Create one here."}
            </button>
          </p>
        </motion.div>
      </main>

      {/* Password reset */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E140E]/40 backdrop-blur-sm"
            onClick={() => setIsForgotModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[400px] bg-[#FAF8F4] rounded-2xl p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-[#F1ECE3] transition cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>

              <h3 className="font-['Cormorant_Garamond'] text-[26px] font-medium text-[#1E140E]">Reset password</h3>
              <p className="mt-1 text-[14px] text-stone-500">We'll email you a link to set a new one.</p>

              <form onSubmit={handleSendPasswordReset} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="reset" className={labelCls}>Email address</label>
                  <input id="reset" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className={inputCls} />
                </div>
                {resetStatus && <p className="text-[13px] text-[#6B3D2E] bg-[#F1ECE3] px-3 py-2 rounded-xl">{resetStatus}</p>}
                <button
                  type="submit"
                  disabled={isResetting}
                  className="w-full h-[52px] bg-[#2A1B14] hover:bg-[#1E140E] text-[#FAF6EE] rounded-xl text-[13px] font-semibold uppercase tracking-[0.16em] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
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
/* Editorial panel pieces                                              */
/* ------------------------------------------------------------------ */

// Soft, slowly drifting colour washes — sand, amber and terracotta
function Aura() {
  const blob = "absolute rounded-full blur-[110px]";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <motion.div
        className={cn(blob, "-top-24 -left-24 w-[460px] h-[460px] bg-[#BFB5A6]/55")}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={cn(blob, "top-1/3 -right-32 w-[420px] h-[420px] bg-[#F3D9A4]/60")}
        animate={{ x: [0, -24, 0], y: [0, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={cn(blob, "-bottom-32 left-1/3 w-[520px] h-[420px] bg-[#EFC3B1]/55")}
        animate={{ x: [0, 20, 0], y: [0, -24, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function GlyphTile({ small }: { small?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl bg-white/50 backdrop-blur-md border border-white/70 shadow-[0_8px_24px_-10px_rgba(42,27,20,0.35)] text-[#2A1B14]",
        small ? "w-11 h-11" : "w-16 h-16"
      )}
    >
      <IconBookWave className={small ? "w-6 h-6" : "w-8 h-8"} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Studio bento — miniature previews of the real app sections,         */
/* built from the same character presets the Characters page uses.    */
/* ------------------------------------------------------------------ */

const HERO = CHARACTER_PRESETS[0]; // Elaseth Moonwhisper — protagonist
const MENTOR = CHARACTER_PRESETS[3]; // Orion Astralveil
const ANTAGONIST = CHARACTER_PRESETS[2]; // Empress Vespera Aurelia
const RIVAL = CHARACTER_PRESETS[6]; // Kaelen Nightshade

const firstName = (name: string) => name.replace(/^(Empress|Sir)\s+/, "").split(" ")[0];

function BentoBlock({
  className,
  delay,
  children,
}: {
  className?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className={cn(
        "relative rounded-2xl bg-white/65 backdrop-blur-md border border-white/80 shadow-[0_12px_32px_-18px_rgba(42,27,20,0.45)] overflow-hidden",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

function BlockLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">{children}</p>;
}

function Mention({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-[#8C503C] border-b border-[#8C503C]/25 px-0.5">{children}</span>;
}

function Portrait({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn("rounded-full object-cover ring-2 ring-white shadow-sm", className)}
    />
  );
}

function StudioBento() {
  return (
    <div className="grid grid-cols-6 auto-rows-[80px] gap-3" aria-hidden="true">
      {/* Character dossier */}
      <BentoBlock delay={0.1} className="col-span-2 row-span-3 !bg-[#1E140E]">
        <img src={HERO.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E140E] via-[#1E140E]/40 to-transparent" />
        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-white/85 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8C503C]">
          {HERO.role.toLowerCase()}
        </div>
        <div className="absolute bottom-0 inset-x-0 p-4 text-[#FAF6EE]">
          <p className="font-['Cormorant_Garamond'] text-[24px] leading-none font-semibold">{HERO.name}</p>
          <p className="mt-1 text-[11px] text-[#E0CDB6]">{HERO.title}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {HERO.traits.slice(0, 3).map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur text-[10px]">
                {t}
              </span>
            ))}
          </div>
        </div>
      </BentoBlock>

      {/* Writing studio */}
      <BentoBlock delay={0.2} className="col-span-4 row-span-2 p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <BlockLabel>Writing Studio · Chapter 7</BlockLabel>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Synced
          </span>
        </div>
        <p className="mt-2 font-['Cormorant_Garamond'] text-[20px] font-semibold text-[#1E140E] leading-tight">
          The Glyphs of the First Dawn
        </p>
        <p className="mt-1.5 font-serif text-[12.5px] leading-relaxed text-stone-600 line-clamp-2">
          <Mention>@{firstName(HERO.name)}</Mention> traced the fading glyph while <Mention>@{firstName(MENTOR.name)}</Mention> watched
          from the Loom — somewhere beyond the seal, <Mention>@{firstName(ANTAGONIST.name)}</Mention> was already listening.
        </p>
        <div className="mt-auto flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-[#EFE9DE] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#8C503C] to-[#D9A876]"
              initial={{ width: 0 }}
              animate={{ width: "71%" }}
              transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className="text-[10px] text-stone-500 tabular-nums">2,840 / 4,000 words</span>
        </div>
      </BentoBlock>

      {/* Relationship web */}
      <BentoBlock delay={0.3} className="col-span-2 row-span-1 px-3.5 py-3">
        <BlockLabel>Relationships</BlockLabel>
        <div className="mt-2 flex items-center">
          <div className="flex -space-x-2 shrink-0">
            {[MENTOR, ANTAGONIST, RIVAL].map((c) => (
              <Portrait key={c.id} src={c.imageUrl} alt={c.name} className="w-8 h-8" />
            ))}
          </div>
          <span className="ml-2 h-8 px-2 rounded-full bg-[#EFE9DE] flex items-center text-[10px] font-semibold text-[#8C503C]">
            +{CHARACTER_PRESETS.length - 4}
          </span>
        </div>
      </BentoBlock>

      {/* Plot arc */}
      <BentoBlock delay={0.4} className="col-span-2 row-span-1 px-3.5 py-3">
        <BlockLabel>Plot · Act II</BlockLabel>
        <div className="mt-3 relative flex items-center justify-between">
          <div className="absolute inset-x-0 h-px bg-[#E2D8C8]" />
          <motion.div
            className="absolute left-0 h-px bg-[#8C503C]"
            initial={{ width: 0 }}
            animate={{ width: "55%" }}
            transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
          />
          {["I", "II", "III"].map((act, i) => (
            <span
              key={act}
              className={cn(
                "relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold",
                i === 0 && "bg-[#8C503C] text-white",
                i === 1 && "bg-white text-[#8C503C] ring-2 ring-[#8C503C]",
                i === 2 && "bg-white text-stone-400 ring-1 ring-[#E2D8C8]"
              )}
            >
              {act}
            </span>
          ))}
        </div>
      </BentoBlock>

      {/* Export */}
      <BentoBlock delay={0.5} className="col-span-6 row-span-1 !bg-[#2A1B14] px-4 py-3 flex items-center gap-4 text-[#FAF6EE]">
        <div className="flex items-end gap-[3px] shrink-0" aria-hidden="true">
          {[40, 52, 46, 56].map((h, i) => (
            <span
              key={i}
              style={{ height: h }}
              className={cn("w-3 rounded-sm", ["bg-[#8C503C]", "bg-[#D9A876]", "bg-[#6B3D2E]", "bg-[#EFC3B1]"][i])}
            />
          ))}
        </div>
        <div className="min-w-0">
          <p className="font-['Cormorant_Garamond'] text-[20px] leading-tight font-semibold">Export to EPUB 3</p>
          <p className="text-[11px] text-[#CDBBA5]">KDP-ready manuscript in one click · {CHARACTER_PRESETS.length} character presets included</p>
        </div>
      </BentoBlock>
    </div>
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

// Brand glyph: an open book resting on a wave
function IconBookWave(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3.5 5.75c2.9-1.3 5.8-1 8.5 1.1v10c-2.7-2.1-5.6-2.4-8.5-1.1z" />
      <path d="M20.5 5.75c-2.9-1.3-5.8-1-8.5 1.1v10c2.7-2.1 5.6-2.4 8.5-1.1z" />
      <path d="M2.5 20.25c1.6-1.1 3.2-1.1 4.9 0s3.2 1.1 4.6 0 3.2-1.1 4.6 0 3.3 1.1 4.9 0" />
    </Icon>
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
