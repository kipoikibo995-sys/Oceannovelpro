import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  BookOpen,
} from "lucide-react";
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAF8F5] font-sans selection:bg-[#8C503C] selection:text-white overflow-x-hidden">

      {/* ================= LEFT COLUMN: WRITER'S DESK SHOWCASE (desktop) ================= */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[52%] bg-[#17100B] text-[#F4EFE6] px-14 py-12 xl:px-20 flex-col justify-between relative overflow-hidden min-h-screen shrink-0">

        {/* Atmospheric ambient glows */}
        <div className="absolute -top-24 right-0 w-[520px] h-[520px] bg-[#8C503C]/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 -left-20 w-[420px] h-[420px] bg-[#C89D66]/10 rounded-full blur-[110px] pointer-events-none" />

        {/* Brand */}
        <div className="relative z-10">
          <BrandMark tone="dark" />
        </div>

        {/* Headline + product composition */}
        <div className="relative z-10 space-y-8 my-8">
          <div className="space-y-5 max-w-lg">
            <h1 className="font-serif text-4xl xl:text-[44px] font-bold text-[#FCFAF5] leading-[1.12] tracking-tight">
              Every great novel<br />
              <span className="italic font-medium text-[#E0B98A]">begins with a world.</span>
            </h1>
            <p className="font-serif text-[15px] text-[#C8B8A6] leading-relaxed max-w-md">
              Characters, lore, plot threads and manuscript — organised in one private studio that remembers everything so you can keep writing.
            </p>
            {/* Feature list stands in for the desk vignette on narrower desktops */}
            <ul className="space-y-2.5 pt-2 xl:hidden">
              {[
                "Character dossiers & relationship maps",
                "Story Bible for lore, factions and world rules",
                "Continuity checks across your whole manuscript",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-[#DCCFBF]">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#C89D66]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <DeskComposition />
        </div>

        {/* Footer: ocean line + quote */}
        <div className="relative z-10 space-y-4">
          <svg viewBox="0 0 600 24" className="w-full h-5 text-[#3A2619]" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0 12 Q 25 2 50 12 T 100 12 T 150 12 T 200 12 T 250 12 T 300 12 T 350 12 T 400 12 T 450 12 T 500 12 T 550 12 T 600 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <div className="flex items-center justify-between text-xs text-[#A69584] font-serif">
            <span className="italic">&ldquo;A novel is a world born from words.&rdquo;</span>
            <span className="flex items-center gap-1.5 text-[11px] text-[#C89D66]">
              <Lock className="w-3 h-3" /> Private & cloud-synced
            </span>
          </div>
        </div>
      </div>

      {/* ================= RIGHT COLUMN: AUTHENTICATION PANE ================= */}
      <div className="flex-1 bg-[#FAF8F5] px-5 py-10 sm:p-10 lg:p-14 flex flex-col justify-center items-center relative overflow-y-auto">
        <div className="w-full max-w-[400px] space-y-6">

          {/* Compact brand for mobile/tablet */}
          <div className="lg:hidden pb-2">
            <BrandMark tone="light" />
          </div>

          {/* Header & Mode Switcher with Smooth Sliding Indicator */}
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-[28px] sm:text-3xl font-bold text-[#2A1B14] tracking-tight leading-tight">
                {mode === "signin" ? "Welcome back" : "Start your studio"}
              </h2>
              <p className="text-sm font-serif text-stone-500 mt-1.5">
                {mode === "signin"
                  ? "Pick up right where your story left off."
                  : "Create your author profile — it takes under a minute."}
              </p>
            </div>

            {/* Fluid Mode Switcher */}
            <div className="p-1 bg-[#EFE9DE] rounded-xl flex items-center relative">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 cursor-pointer text-center relative z-10",
                  mode === "signin" ? "text-[#2A1B14]" : "text-stone-500 hover:text-stone-800"
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 cursor-pointer text-center relative z-10",
                  mode === "signup" ? "text-[#2A1B14]" : "text-stone-500 hover:text-stone-800"
                )}
              >
                Create account
              </button>

              {/* Smooth Animated Indicator */}
              <motion.div
                className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm"
                layoutId="authTabIndicator"
                initial={false}
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                style={{
                  width: "calc(50% - 4px)",
                  left: mode === "signin" ? "4px" : "calc(50%)",
                }}
              />
            </div>
          </div>

          {/* Feedback Alerts with Smooth Motion */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="p-3.5 bg-rose-50/90 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 shadow-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{errorMsg}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="leading-relaxed">{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* One-Click Google Authentication */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full h-11 px-4 bg-white hover:bg-stone-50 text-stone-700 border border-[#DCD5C9] hover:border-[#BFAF9C] rounded-xl font-medium text-sm flex items-center justify-center gap-3 shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-60"
          >
            {isGoogleLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#8C503C]" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isGoogleLoading ? "Connecting to Author Cloud..." : "Continue with Google"}</span>
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E6DECF]" />
            <span className="text-xs text-stone-400 whitespace-nowrap">or with email</span>
            <div className="h-px flex-1 bg-[#E6DECF]" />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Pen Name (Signup only) with smooth height animation */}
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="block text-[13px] font-medium text-stone-700">
                    Pen name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required={mode === "signup"}
                      placeholder="e.g. Brandon Sanderson"
                      value={penName}
                      onChange={(e) => setPenName(e.target.value)}
                      className="w-full h-11 pl-10 pr-3.5 bg-white border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-2 focus:ring-[#8C503C]/15 rounded-xl text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 font-sans"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-stone-700">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="author@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 bg-white border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-2 focus:ring-[#8C503C]/15 rounded-xl text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 font-sans"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[13px] font-medium text-stone-700">
                  Password
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-xs font-serif text-[#8C503C] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 bg-white border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-2 focus:ring-[#8C503C]/15 rounded-xl text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password (Signup only) */}
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="block text-[13px] font-medium text-stone-700">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required={mode === "signup"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-11 pl-10 pr-10 bg-white border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-2 focus:ring-[#8C503C]/15 rounded-xl text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && confirmPassword && (
                    <p
                      className={cn(
                        "text-[11px] font-sans pl-1 transition-colors",
                        password === confirmPassword ? "text-emerald-600 font-medium" : "text-rose-500 font-medium"
                      )}
                    >
                      {password === confirmPassword ? "✓ Passwords match" : "✕ Passwords do not match"}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Math Captcha Verification (Signup only) */}
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="block text-[13px] font-medium text-stone-700">
                    Quick check — solve the sum
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center gap-2 px-3.5 h-11 bg-[#F4EFE6] border border-[#E6DECF] rounded-xl font-mono text-sm font-bold text-[#2A1B14] select-none shrink-0">
                      <span>{captchaQuestion.num1}</span>
                      <span className="text-[#8C503C]">+</span>
                      <span>{captchaQuestion.num2}</span>
                      <span className="text-stone-400">=</span>
                      <span className="text-[#8C503C]">?</span>
                    </div>

                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      title="Generate new calculation"
                      className="w-11 h-11 rounded-xl border border-[#DCD5C9] bg-white hover:bg-stone-50 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <div className="relative flex-1">
                      <input
                        type="number"
                        required={mode === "signup"}
                        placeholder="Result"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value)}
                        className="w-full h-11 px-3.5 bg-white border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-2 focus:ring-[#8C503C]/15 rounded-xl text-sm text-stone-800 outline-none transition-all placeholder:text-stone-400 font-mono"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Remember checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none pt-1 w-fit">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#DCD5C9] w-4 h-4 accent-[#8C503C] cursor-pointer"
              />
              <span className="text-sm text-stone-600">Keep me signed in</span>
            </label>

            {/* Submit CTA */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full h-12 bg-[#8C503C] hover:bg-[#7A4332] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_-8px_rgba(140,80,60,0.7)] transition-colors cursor-pointer disabled:opacity-60 mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Opening your studio…</span>
                </>
              ) : (
                <>
                  <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Mode hint */}
          <p className="text-center text-sm text-stone-500">
            {mode === "signin" ? "New to Ocean Novel? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-[#8C503C] hover:underline cursor-pointer"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
            <BookOpen className="w-3.5 h-3.5 text-[#8C503C]/70" />
            Your manuscripts stay private to your account.
          </p>

        </div>
      </div>

      {/* PASSWORD RESET MODAL */}
      <AnimatePresence>
        {isForgotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm bg-[#FAF8F5] border border-[#E5E0D5] rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#EBE3D5] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#8C503C]/10 flex items-center justify-center text-[#8C503C]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#2A1B14]">
                      Reset Password
                    </h3>
                    <p className="text-[10px] font-mono text-stone-500">
                      Author Vault Recovery
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsForgotModalOpen(false)}
                  className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer w-6 h-6 rounded-full hover:bg-stone-200 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs font-serif text-stone-600 leading-relaxed">
                Enter your registered email address and we will dispatch a secure link to reset your author credentials.
              </p>

              <form onSubmit={handleSendPasswordReset} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="author@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full h-10 px-3.5 bg-white border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C] rounded-xl text-xs text-stone-800 outline-none shadow-2xs"
                />

                {resetStatus && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] font-serif text-[#8C503C] bg-[#8C503C]/10 p-2 rounded-lg"
                  >
                    {resetStatus}
                  </motion.p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-3.5 py-1.5 border border-[#DCD5C9] text-stone-600 text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-stone-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="px-4 py-1.5 bg-[#8C503C] hover:bg-[#753D2C] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg cursor-pointer disabled:opacity-60 shadow-xs"
                  >
                    {isResetting ? "Dispatching..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrandMark({ tone }: { tone: "dark" | "light" }) {
  const onDark = tone === "dark";
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          onDark ? "bg-[#C89D66]/15 text-[#E0B98A]" : "bg-[#8C503C]/10 text-[#8C503C]"
        )}
      >
        <BookOpen className="w-5 h-5" />
      </div>
      <div>
        <span className={cn("font-serif text-xl font-bold tracking-tight block leading-none", onDark ? "text-[#FAF7F2]" : "text-[#2A1B14]")}>
          Ocean Novel
        </span>
        <span className={cn("text-[10px] uppercase font-semibold tracking-[0.2em] mt-1 block", onDark ? "text-[#C89D66]" : "text-[#8C503C]")}>
          Novel Architecture Studio
        </span>
      </div>
    </div>
  );
}

// Illustrative product vignette: a character dossier, a chapter in progress and a relationship web
function DeskComposition() {
  const float = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: [0, -6, 0] },
    transition: {
      opacity: { duration: 0.6, delay },
      y: { duration: 7, delay, repeat: Infinity, ease: "easeInOut" as const },
    },
  });

  return (
    <div className="relative h-[250px] w-full max-w-[560px] hidden xl:block" aria-hidden="true">
      {/* Character dossier */}
      <motion.div
        {...float(0.1)}
        className="absolute top-0 left-0 w-[240px] rounded-2xl bg-[#FAF6EE] text-[#2A1B14] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] -rotate-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8C503C] to-[#C89D66] flex items-center justify-center text-white font-serif font-bold">
            EV
          </div>
          <div>
            <p className="font-serif font-bold text-[15px] leading-tight">Elara Voss</p>
            <p className="text-[11px] text-stone-500">Protagonist · Tidecaller</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex justify-between"><span className="text-stone-500">Desire</span><span className="font-medium">Raise the drowned city</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Flaw</span><span className="font-medium">Trusts no one</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Stubborn", "Loyal", "Haunted"].map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-[#8C503C]/10 text-[#8C503C] text-[10px] font-semibold">{t}</span>
          ))}
        </div>
      </motion.div>

      {/* Chapter progress */}
      <motion.div
        {...float(0.35)}
        className="absolute top-4 right-0 w-[230px] rounded-2xl bg-[#241810] border border-[#3A2619] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] rotate-2"
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#C89D66] font-semibold">Chapter 12</p>
        <p className="font-serif text-[15px] font-semibold text-[#FAF7F2] mt-1">The Drowned Library</p>
        <p className="font-serif italic text-[11px] text-[#A69584] mt-2 leading-relaxed">
          &ldquo;The shelves still breathed salt, and every page remembered the sea…&rdquo;
        </p>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-[#A69584] mb-1">
            <span>3,412 / 5,000 words</span><span>68%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#3A2619] overflow-hidden">
            <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#8C503C] to-[#E0B98A]" />
          </div>
        </div>
      </motion.div>

      {/* Relationship web */}
      <motion.div
        {...float(0.6)}
        className="absolute -bottom-2 left-[42%] w-[190px] rounded-2xl bg-[#FAF6EE] p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] -rotate-1"
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#8C503C] font-semibold mb-1">Relationships</p>
        <svg viewBox="0 0 180 90" className="w-full h-[84px]">
          <g stroke="#C9B79F" strokeWidth="1.2">
            <line x1="90" y1="45" x2="30" y2="20" />
            <line x1="90" y1="45" x2="150" y2="22" />
            <line x1="90" y1="45" x2="40" y2="75" strokeDasharray="3 3" />
            <line x1="90" y1="45" x2="145" y2="72" />
          </g>
          <circle cx="90" cy="45" r="11" fill="#8C503C" />
          <circle cx="30" cy="20" r="7" fill="#C89D66" />
          <circle cx="150" cy="22" r="7" fill="#C89D66" />
          <circle cx="40" cy="75" r="7" fill="#A8A29E" />
          <circle cx="145" cy="72" r="7" fill="#C89D66" />
        </svg>
      </motion.div>
    </div>
  );
}
