import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Radio,
  ShieldAlert,
  Search,
  ArrowLeft,
  RefreshCw,
  History,
  Zap,
  Shield,
  ShieldOff,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Info,
  Copy,
  Check,
  X,
  Lock,
  Server,
  Code,
  Key,
  Globe,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  adminService,
  RegisteredUser,
  IpnPendingPurchase,
  PurchaseRecord,
  isUserAdmin,
  ADMIN_EMAIL,
} from "@/lib/adminService";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const userIsAdmin = isUserAdmin(currentUser?.email);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"crm" | "ipn">("crm");
  const [ipnSubTab, setIpnSubTab] = useState<"simulator" | "production">("simulator");

  // Data states from Firestore
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<IpnPendingPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // CRM Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "banned">("all");

  // Notification feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Modals state
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<RegisteredUser | null>(null);
  const [selectedUserForTier, setSelectedUserForTier] = useState<RegisteredUser | null>(null);
  const [newTierSelection, setNewTierSelection] = useState<'Free' | 'FrontEnd' | 'OTO1' | 'OTO2'>("FrontEnd");
  const [userToDelete, setUserToDelete] = useState<RegisteredUser | null>(null);

  // IPN Test Tool Form State
  const [ipnEmail, setIpnEmail] = useState("");
  const [ipnProduct, setIpnProduct] = useState("FrontEnd: Ocean Novel Studio ($17)");
  const [ipnTier, setIpnTier] = useState<'Free' | 'FrontEnd' | 'OTO1' | 'OTO2'>("FrontEnd");
  const [ipnTxnId, setIpnTxnId] = useState("");
  const [isSubmittingIpn, setIsSubmittingIpn] = useState(false);

  // Copied helpers
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const handleCopyWebhookUrl = () => {
    const url = `${window.location.origin}/api/ipn/warriorplus`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const sampleWebhookCode = `// Production WarriorPlus IPN Webhook Receiver (Node.js / Express or Cloud Function)
import express from 'express';
import { handleWarriorPlusWebhook } from '@/lib/warriorplusIpnHandler';

const app = express();
// WarriorPlus sends application/x-www-form-urlencoded payloads
app.use(express.urlencoded({ extended: true }));

app.post('/api/ipn/warriorplus', async (req, res) => {
  try {
    const expectedSecretKey = process.env.WARRIORPLUS_SECURITY_KEY || 'YOUR_WPLUS_SECRET_KEY';
    
    // Automatically parses WP_ACTION, WP_BUYER_EMAIL, WP_ITEM_NAME, WP_TXNID
    // and unlocks the corresponding Tier (FrontEnd, OTO1, OTO2) directly in Firestore!
    const result = await handleWarriorPlusWebhook(req.body, expectedSecretKey);
    
    console.log('[WarriorPlus IPN Success]', result.message);
    // Respond HTTP 200 OK so WarriorPlus knows delivery succeeded
    return res.status(200).send('OK');
  } catch (error) {
    console.error('[WarriorPlus IPN Error]', error.message);
    return res.status(400).send('IPN Verification Failed: ' + error.message);
  }
});`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(sampleWebhookCode);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  // Load real Firestore data
  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [fetchedUsers, fetchedPending] = await Promise.all([
        adminService.getAllUsers(),
        adminService.getPendingPurchases(),
      ]);
      setUsers(fetchedUsers);
      setPendingPurchases(fetchedPending);
    } catch (err: any) {
      console.error("Error loading admin data:", err);
      setFeedback({ type: "error", message: "Failed to load live data from Firestore." });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const totalAccounts = users.length;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    const onlineAccounts = users.filter((u) => !u.isBanned && now - (u.lastActive || 0) <= fiveMinutes).length;
    const bannedAccounts = users.filter((u) => u.isBanned).length;

    return { totalAccounts, onlineAccounts, bannedAccounts };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const queryLower = searchQuery.toLowerCase().trim();

    return users.filter((u) => {
      const isOnline = !u.isBanned && now - (u.lastActive || 0) <= fiveMinutes;

      // Status filter
      if (statusFilter === "online" && !isOnline) return false;
      if (statusFilter === "offline" && (isOnline || u.isBanned)) return false;
      if (statusFilter === "banned" && !u.isBanned) return false;

      // Search query filter (Email, UID, Name, or Tier)
      if (queryLower) {
        const matchEmail = (u.email || "").toLowerCase().includes(queryLower);
        const matchUid = (u.uid || "").toLowerCase().includes(queryLower);
        const matchTier = (u.tier || "").toLowerCase().includes(queryLower);
        const matchName = (u.displayName || "").toLowerCase().includes(queryLower);
        return matchEmail || matchUid || matchTier || matchName;
      }

      return true;
    });
  }, [users, statusFilter, searchQuery]);

  // Action handlers
  const handleToggleBan = async (user: RegisteredUser) => {
    if (isUserAdmin(user.email)) {
      setFeedback({ type: "error", message: "The Master Admin account cannot be suspended." });
      return;
    }

    const newStatus = !user.isBanned;
    try {
      await adminService.setUserBanned(user.uid, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, isBanned: newStatus } : u))
      );
      setFeedback({
        type: "success",
        message: `Account "${user.email}" has been ${newStatus ? "SUSPENDED" : "REINSTATED"}.`,
      });
    } catch {
      setFeedback({ type: "error", message: "Failed to update account ban status." });
    }
  };

  const handleSaveTier = async () => {
    if (!selectedUserForTier) return;
    try {
      await adminService.updateTier(selectedUserForTier.uid, newTierSelection);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === selectedUserForTier.uid ? { ...u, tier: newTierSelection } : u
        )
      );
      setFeedback({
        type: "success",
        message: `License tier for "${selectedUserForTier.email}" updated to ${newTierSelection}.`,
      });
      setSelectedUserForTier(null);
    } catch {
      setFeedback({ type: "error", message: "Failed to update license tier." });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (isUserAdmin(userToDelete.email)) {
      setFeedback({ type: "error", message: "The Master Admin account cannot be deleted." });
      setUserToDelete(null);
      return;
    }

    try {
      await adminService.deleteUserRecord(userToDelete.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid));
      setFeedback({
        type: "success",
        message: `User record "${userToDelete.email}" removed from Firestore.`,
      });
      setUserToDelete(null);
    } catch {
      setFeedback({ type: "error", message: "Failed to delete user record from Firestore." });
    }
  };

  const handleDeletePendingPurchase = async (id: string, email: string) => {
    try {
      await adminService.deletePendingPurchase(id);
      setPendingPurchases((prev) => prev.filter((p) => p.id !== id));
      setFeedback({
        type: "info",
        message: `Pending purchase for "${email}" removed (Refunded).`,
      });
    } catch {
      setFeedback({ type: "error", message: "Failed to delete pending purchase." });
    }
  };

  // Submit Simulated IPN Webhook
  const handleSimulateIpn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipnEmail || !ipnEmail.includes("@")) {
      setFeedback({ type: "error", message: "Please enter a valid buyer email address." });
      return;
    }

    setIsSubmittingIpn(true);
    try {
      const res = await adminService.simulateIpnWebhook({
        buyerEmail: ipnEmail,
        productItem: ipnProduct,
        tier: ipnTier,
        txnId: ipnTxnId.trim() || undefined,
      });

      setFeedback({
        type: "success",
        message: res.message,
      });

      // Clear input & refresh live data
      setIpnEmail("");
      setIpnTxnId("");
      await loadData(true);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to process simulated IPN webhook.",
      });
    } finally {
      setIsSubmittingIpn(false);
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return "Never";
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Non-admin Access Denied View
  if (!userIsAdmin) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#E3DDD1] rounded-2xl p-8 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Administrator Access Required
          </h2>
          <p className="text-xs text-stone-600 font-serif leading-relaxed">
            This portal is strictly reserved for the Master Administrator (<strong>{ADMIN_EMAIL}</strong>).
            Your current logged-in account does not hold administrative clearance.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2.5 bg-[#8C503C] hover:bg-[#733D2D] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Return to Novel Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A1B14] font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E3DDD1] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 -ml-2 rounded-lg text-stone-500 hover:text-[#8C503C] hover:bg-stone-100 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Studio</span>
            </button>
            <div className="h-5 w-[1px] bg-stone-300 mx-1 hidden sm:block" />
            <div>
              <h1 className="text-base sm:text-lg font-serif font-bold text-[#2A1B14] flex items-center gap-2 leading-tight">
                <span>Ocean Novel Admin CRM</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[#8C503C]/10 text-[#8C503C] font-semibold border border-[#8C503C]/20">
                  Control Center
                </span>
              </h1>
              <p className="text-[11px] text-stone-500 font-serif">
                Master Admin: <strong className="text-stone-800">{ADMIN_EMAIL}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 rounded-lg border border-[#DCD5C9] bg-stone-50 hover:bg-white text-stone-700 text-xs font-medium flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Firestore records"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-[#8C503C]")} />
              <span className="hidden sm:inline">Sync Live Data</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Alerts & Feedback Banner */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs shadow-xs",
                feedback.type === "success" && "bg-emerald-50 border-emerald-200 text-emerald-900",
                feedback.type === "error" && "bg-rose-50 border-rose-200 text-rose-900",
                feedback.type === "info" && "bg-amber-50 border-amber-200 text-amber-900"
              )}
            >
              <div className="flex items-start gap-2.5">
                {feedback.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                {feedback.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                {feedback.type === "info" && <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                <span className="font-medium leading-relaxed">{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3 TOP STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Accounts */}
          <div className="bg-white p-5 rounded-xl border border-[#E3DDD1] shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                1. Total Accounts
              </p>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-[#2A1B14]">
                {stats.totalAccounts}
              </div>
              <p className="text-[11px] text-stone-500">Registered users recorded in Firestore</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#8C503C]/10 text-[#8C503C] flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Online */}
          <div className="bg-white p-5 rounded-xl border border-[#E3DDD1] shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                2. Online Now
              </p>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-emerald-600 flex items-center gap-2">
                <span>{stats.onlineAccounts}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-stone-500">Active within the last 5 minutes</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Banned */}
          <div className="bg-white p-5 rounded-xl border border-[#E3DDD1] shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                3. Suspended Accounts
              </p>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-rose-600">
                {stats.bannedAccounts}
              </div>
              <p className="text-[11px] text-stone-500">Restricted from accessing the platform</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#E3DDD1] flex items-center gap-6 text-sm font-bold">
          <button
            onClick={() => setActiveTab("crm")}
            className={cn(
              "pb-3 relative flex items-center gap-2 cursor-pointer transition-colors",
              activeTab === "crm"
                ? "text-[#8C503C] border-b-2 border-[#8C503C]"
                : "text-stone-500 hover:text-stone-800"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Users CRM</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ipn")}
            className={cn(
              "pb-3 relative flex items-center gap-2 cursor-pointer transition-colors",
              activeTab === "ipn"
                ? "text-[#8C503C] border-b-2 border-[#8C503C]"
                : "text-stone-500 hover:text-stone-800"
            )}
          >
            <Zap className="w-4 h-4" />
            <span>WarriorPlus IPN (Fulfillment Engine)</span>
            {pendingPurchases.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                {pendingPurchases.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: USERS CRM */}
        {activeTab === "crm" && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-[#E3DDD1] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Email, Firebase UID, Name, or Tier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-[#FAF8F5] border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C] rounded-lg text-xs sm:text-sm text-stone-800 outline-none placeholder:text-stone-400 font-sans"
                />
              </div>

              {/* Roster Filter Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-[#ECE5D8] rounded-lg border border-[#DDD5C7] text-xs font-bold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap",
                    statusFilter === "all"
                      ? "bg-white text-[#2A1B14] shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  All Users ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("online")}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                    statusFilter === "online"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Online ({stats.onlineAccounts})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("offline")}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap",
                    statusFilter === "offline"
                      ? "bg-white text-stone-800 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  Offline ({users.length - stats.onlineAccounts - stats.bannedAccounts})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("banned")}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                    statusFilter === "banned"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Banned ({stats.bannedAccounts})</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-[#E3DDD1] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8F5EE] border-b border-[#E3DDD1] text-stone-600 uppercase font-mono tracking-wider text-[10px]">
                      <th className="py-3 px-4">Author Account</th>
                      <th className="py-3 px-4">License Tier</th>
                      <th className="py-3 px-4">Access Status</th>
                      <th className="py-3 px-4">Last Activity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE1]">
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-stone-500 font-serif">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#8C503C] mb-2" />
                          <span>Connecting to Firestore database...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-stone-500 font-serif">
                          No users found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const now = Date.now();
                        const isOnline = !user.isBanned && now - (user.lastActive || 0) <= 5 * 60 * 1000;
                        const initialLetter = (user.displayName || user.email || "U")[0].toUpperCase();
                        const isSuperAdmin = isUserAdmin(user.email);

                        return (
                          <tr
                            key={user.uid}
                            className={cn(
                              "hover:bg-[#FAF8F5] transition-colors",
                              user.isBanned && "bg-rose-50/40",
                              isSuperAdmin && "bg-amber-50/20"
                            )}
                          >
                            {/* User column */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm select-none shrink-0 shadow-2xs",
                                    isSuperAdmin
                                      ? "bg-[#2c1b13] text-[#C89D66] border border-[#5a3a29]"
                                      : user.isBanned
                                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                                      : isOnline
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-[#EFEAE1] text-stone-700 border border-[#DCD5C9]"
                                  )}
                                >
                                  {initialLetter}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-stone-900 truncate flex items-center gap-2">
                                    <span>{user.displayName || user.email.split("@")[0]}</span>
                                    {isSuperAdmin && (
                                      <span className="text-[9px] bg-stone-900 text-[#C89D66] font-mono px-1.5 py-0.2 rounded font-bold tracking-wider">
                                        MASTER ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-stone-500 truncate text-[11px]">{user.email}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-[10px] text-stone-400 truncate max-w-[140px] sm:max-w-[200px]">
                                      {user.uid}
                                    </span>
                                    <button
                                      onClick={() => handleCopyUid(user.uid)}
                                      title="Copy Firebase UID"
                                      className="text-stone-400 hover:text-stone-700 cursor-pointer"
                                    >
                                      {copiedUid === user.uid ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Tier */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-[11px] font-bold font-mono border uppercase tracking-wider inline-block",
                                  (user.tier === "OTO2" || (user.tier as string) === "Premium") && "bg-purple-50 text-purple-700 border-purple-200",
                                  (user.tier === "OTO1" || (user.tier as string) === "Pro") && "bg-blue-50 text-blue-700 border-blue-200",
                                  (user.tier === "FrontEnd" || (user.tier as string) === "Regular") && "bg-amber-50 text-amber-800 border-amber-200",
                                  user.tier === "Free" && "bg-stone-100 text-stone-600 border-stone-200"
                                )}
                              >
                                {user.tier === "OTO2" || (user.tier as string) === "Premium"
                                  ? "Premium"
                                  : user.tier === "OTO1" || (user.tier as string) === "Pro"
                                  ? "Pro"
                                  : user.tier === "FrontEnd" || (user.tier as string) === "Regular"
                                  ? "Regular"
                                  : user.tier || "Regular"}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {user.isBanned ? (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px] bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded-full">
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>Banned</span>
                                </span>
                              ) : isOnline ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Online</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-stone-500 font-medium text-[11px] bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">
                                  <span>Offline</span>
                                </span>
                              )}
                            </td>

                            {/* Last active */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-stone-500 font-serif">
                              {formatTimeAgo(user.lastActive)}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Purchase History */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserForHistory(user)}
                                  title="Purchase & IPN Transaction History"
                                  className="p-1.5 rounded-md border border-[#DCD5C9] bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 shadow-2xs cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>

                                {/* Upgrade Tier */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserForTier(user);
                                    setNewTierSelection(user.tier || "FrontEnd");
                                  }}
                                  title="Change License Tier"
                                  className="p-1.5 rounded-md border border-[#DCD5C9] bg-white hover:bg-stone-50 text-[#8C503C] shadow-2xs cursor-pointer"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                </button>

                                {/* Ban / Unban */}
                                {!isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBan(user)}
                                    title={user.isBanned ? "Unban Account" : "Ban Account"}
                                    className={cn(
                                      "p-1.5 rounded-md border shadow-2xs cursor-pointer transition-colors",
                                      user.isBanned
                                        ? "bg-rose-600 text-white border-rose-700 hover:bg-rose-700"
                                        : "bg-white border-[#DCD5C9] text-stone-600 hover:text-rose-600"
                                    )}
                                  >
                                    {user.isBanned ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                  </button>
                                )}

                                {/* Delete User */}
                                {!isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setUserToDelete(user)}
                                    title="Delete User Record from Firestore"
                                    className="p-1.5 rounded-md border border-[#DCD5C9] bg-white hover:bg-rose-50 text-stone-400 hover:text-rose-600 shadow-2xs cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WARRIORPLUS IPN */}
        {activeTab === "ipn" && (
          <div className="space-y-6">
            {/* Sub-navigation Switcher */}
            <div className="flex items-center gap-2 p-1.5 bg-[#EAE4D7] rounded-xl w-fit border border-[#DCD5C9]">
              <button
                type="button"
                onClick={() => setIpnSubTab("simulator")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                  ipnSubTab === "simulator"
                    ? "bg-white text-[#8C503C] shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Live Sandbox Simulator</span>
              </button>

              <button
                type="button"
                onClick={() => setIpnSubTab("production")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                  ipnSubTab === "production"
                    ? "bg-white text-[#8C503C] shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                )}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Production Webhook Specs & Setup</span>
              </button>
            </div>

            {/* SUB-VIEW 1: SIMULATOR & PENDING LEDGER */}
            {ipnSubTab === "simulator" && (
              <div className="space-y-6">
                {/* IPN Simulation Test Tool */}
                <div className="bg-white p-5 rounded-xl border border-[#E3DDD1] shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#8C503C]/10 text-[#8C503C] flex items-center justify-center font-bold">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-[#2A1B14] uppercase tracking-wide">
                          WarriorPlus IPN Webhook Simulator (Sandbox)
                        </h2>
                        <p className="text-[11px] text-stone-500 font-serif">
                          Simulates real Instant Payment Notification webhooks from WarriorPlus to test automated license tier fulfillment directly in Firestore
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSimulateIpn} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Buyer Email */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Buyer Invoice Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="customer@example.com"
                        value={ipnEmail}
                        onChange={(e) => setIpnEmail(e.target.value)}
                        className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C] rounded-lg text-xs sm:text-sm text-stone-800 outline-none"
                      />
                    </div>

                    {/* Product Item */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Product Item *
                      </label>
                      <select
                        value={ipnProduct}
                        onChange={(e) => {
                          const val = e.target.value;
                          setIpnProduct(val);
                          if (val.includes("Premium") || val.includes("OTO2")) {
                            setIpnTier("OTO2");
                          } else if (val.includes("Pro") || val.includes("OTO1")) {
                            setIpnTier("OTO1");
                          } else {
                            setIpnTier("FrontEnd");
                          }
                        }}
                        className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C] rounded-lg text-xs text-stone-800 outline-none font-medium cursor-pointer"
                      >
                        <option value="Regular: Ocean Novel Studio ($17)">Regular: Ocean Novel Studio ($17)</option>
                        <option value="Pro: Unlimited Studio Edition ($47)">Pro: Unlimited Studio Edition ($47)</option>
                        <option value="Premium: AI Ghostwriter & Lore Generator ($97)">Premium: AI Ghostwriter & Lore ($97)</option>
                      </select>
                    </div>

                    {/* Tier Selection */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        License Tier
                      </label>
                      <select
                        value={ipnTier}
                        onChange={(e) => setIpnTier(e.target.value as any)}
                        className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C] rounded-lg text-xs text-stone-800 outline-none font-mono cursor-pointer"
                      >
                        <option value="FrontEnd">Regular</option>
                        <option value="OTO1">Pro (Unlimited)</option>
                        <option value="OTO2">Premium (AI Ghostwriter)</option>
                        <option value="Free">Free</option>
                      </select>
                    </div>

                    {/* Transaction ID */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Transaction ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. WP-TXN-88410"
                        value={ipnTxnId}
                        onChange={(e) => setIpnTxnId(e.target.value)}
                        className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#DCD5C9] focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C] rounded-lg text-xs text-stone-800 outline-none font-mono"
                      />
                    </div>

                    {/* Submit Action */}
                    <div className="sm:col-span-2 flex items-end">
                      <button
                        type="submit"
                        disabled={isSubmittingIpn}
                        className="w-full h-10 bg-[#8C503C] hover:bg-[#733D2D] text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingIpn ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Dispatch Test IPN Webhook</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Pending Purchases Ledger Table */}
                <div className="bg-white rounded-xl border border-[#E3DDD1] shadow-xs overflow-hidden space-y-3 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#2A1B14] uppercase tracking-wide flex items-center gap-2">
                        <span>Pending Purchases (Unmatched Sales Ledger)</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                          {pendingPurchases.length} Pending
                        </span>
                      </h3>
                      <p className="text-[11px] text-stone-500 font-serif mt-0.5">
                        Orders paid through WarriorPlus where the buyer hasn't signed up yet. As soon as the customer registers using their purchase email, their license tier will automatically activate.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F8F5EE] border-b border-[#E3DDD1] text-stone-600 uppercase font-mono tracking-wider text-[10px]">
                          <th className="py-3 px-4">Buyer Email</th>
                          <th className="py-3 px-4">Product Item</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Tier</th>
                          <th className="py-3 px-4">Date Received</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFEAE1]">
                        {pendingPurchases.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-stone-400 font-serif">
                              No pending purchases. All WarriorPlus orders have been fulfilled!
                            </td>
                          </tr>
                        ) : (
                          pendingPurchases.map((item) => (
                            <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                              <td className="py-3 px-4 font-bold text-stone-900 font-mono">
                                {item.buyerEmail}
                              </td>
                              <td className="py-3 px-4 text-stone-700">{item.productItem}</td>
                              <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                                {item.amount || "$17.00"}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded bg-stone-100 font-mono text-[10px] uppercase font-bold text-stone-700 border border-stone-200">
                                  {item.tier}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-stone-500 font-serif">
                                {new Date(item.dateReceived).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleDeletePendingPurchase(item.id, item.buyerEmail)}
                                  title="Delete / Refund record"
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  Refund / Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: PRODUCTION SETUP & SPECIFICATION */}
            {ipnSubTab === "production" && (
              <div className="space-y-6">
                {/* Endpoint Information Card */}
                <div className="bg-white p-6 rounded-2xl border border-[#E3DDD1] shadow-xs space-y-4">
                  <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8C503C]/10 text-[#8C503C] flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base text-stone-900">
                        WarriorPlus Live Webhook URL & Configuration
                      </h3>
                      <p className="text-xs text-stone-500 font-serif">
                        Enter this Webhook URL into your WarriorPlus Vendor Dashboard under <strong className="text-stone-800">Products &gt; Advanced Integration &gt; IPN URL</strong>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      Your Live IPN Webhook URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/api/ipn/warriorplus`}
                        className="flex-1 h-11 px-3.5 bg-[#FAF8F5] border border-[#DCD5C9] rounded-xl font-mono text-xs text-stone-800 outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyWebhookUrl}
                        className="h-11 px-4 bg-[#8C503C] hover:bg-[#733D2D] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
                      >
                        {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedUrl ? "Copied" : "Copy URL"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DDD1]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">HTTP Method</div>
                      <div className="font-mono font-bold text-xs text-stone-900 mt-0.5">POST (Form Urlencoded)</div>
                    </div>
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DDD1]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Security Verification</div>
                      <div className="font-mono font-bold text-xs text-stone-900 mt-0.5">WP_SECURITYKEY</div>
                    </div>
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DDD1]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Auto Reconcile</div>
                      <div className="font-mono font-bold text-xs text-emerald-700 mt-0.5">Active (Instant)</div>
                    </div>
                  </div>
                </div>

                {/* Product Mapping Reference Table */}
                <div className="bg-white p-6 rounded-2xl border border-[#E3DDD1] shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
                    <ShieldCheck className="w-5 h-5 text-[#8C503C]" />
                    <h3 className="font-serif font-bold text-sm text-stone-900 uppercase tracking-wide">
                      WarriorPlus Product Mapping Matrix
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F8F5EE] border-b border-[#E3DDD1] text-stone-600 font-mono uppercase text-[10px]">
                          <th className="py-2.5 px-3">Offer Tier</th>
                          <th className="py-2.5 px-3">Product Name in W+</th>
                          <th className="py-2.5 px-3">Suggested Price</th>
                          <th className="py-2.5 px-3">Unlocked Features</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFEAE1]">
                        <tr>
                          <td className="py-3 px-3 font-mono font-bold text-amber-800">Regular</td>
                          <td className="py-3 px-3 font-serif">Ocean Novel Studio - Standard</td>
                          <td className="py-3 px-3 font-mono font-bold text-stone-900">$17.00</td>
                          <td className="py-3 px-3 text-stone-600">Standard Story Bible, Manuscript binder, Word/TXT export</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-3 font-mono font-bold text-blue-700">Pro</td>
                          <td className="py-3 px-3 font-serif">Ocean Novel Studio - Unlimited Edition</td>
                          <td className="py-3 px-3 font-mono font-bold text-stone-900">$47.00</td>
                          <td className="py-3 px-3 text-stone-600">Unlimited books, full EPUB KDP export, 50+ fantasy art assets</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-3 font-mono font-bold text-purple-700">Premium</td>
                          <td className="py-3 px-3 font-serif">Ocean Novel Studio - AI Lore & Ghostwriter</td>
                          <td className="py-3 px-3 font-mono font-bold text-stone-900">$97.00</td>
                          <td className="py-3 px-3 text-stone-600">Full AI Lore generation, plot suggestions, deep continuity engine</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Production Code Snippet */}
                <div className="bg-[#1F1916] text-[#E0D8D0] p-6 rounded-2xl shadow-lg border border-stone-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-[#C89D66]" />
                      <span className="font-mono text-xs font-bold text-[#E0D8D0]">
                        src/lib/warriorplusIpnHandler.ts (Production Webhook Receiver)
                      </span>
                    </div>
                    <button
                      onClick={handleCopySnippet}
                      className="px-3 py-1 bg-[#3A2B23] hover:bg-[#4E392F] text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSnippet ? "Copied" : "Copy Code"}</span>
                    </button>
                  </div>

                  <p className="text-xs text-stone-400 font-serif leading-relaxed">
                    The handler module has already been compiled in <code className="text-[#C89D66] font-mono">src/lib/warriorplusIpnHandler.ts</code>. It parses raw form data, verifies the security key, and persists users or pending queues in Firestore immediately.
                  </p>

                  <pre className="p-4 bg-black/40 rounded-xl font-mono text-[11px] text-stone-300 overflow-x-auto leading-relaxed border border-stone-800/60">
                    {sampleWebhookCode}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: PURCHASE HISTORY */}
      <AnimatePresence>
        {selectedUserForHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-[#E3DDD1] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#8C503C]" />
                  <h3 className="font-serif font-bold text-base text-[#2A1B14]">
                    Purchase History & Transactions
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedUserForHistory(null)}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-stone-600">
                Author Email: <strong className="text-stone-900">{selectedUserForHistory.email}</strong>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-xl">
                {!selectedUserForHistory.purchaseHistory || selectedUserForHistory.purchaseHistory.length === 0 ? (
                  <div className="p-6 text-center text-stone-400 font-serif text-xs">
                    No purchase or IPN fulfillment history logged for this account.
                  </div>
                ) : (
                  selectedUserForHistory.purchaseHistory.map((rec) => (
                    <div key={rec.id} className="p-3 hover:bg-stone-50 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-stone-900">{rec.productItem}</div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          Txn: {rec.txnId} • {new Date(rec.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-700">{rec.amount || "$17.00"}</div>
                        <div className="text-[10px] font-mono text-stone-500 uppercase">{rec.tier}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedUserForHistory(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: UPGRADE TIER */}
      <AnimatePresence>
        {selectedUserForTier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E3DDD1] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#8C503C]" />
                  <h3 className="font-serif font-bold text-base text-[#2A1B14]">
                    Change License Tier
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedUserForTier(null)}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-stone-600">
                Select access tier for: <strong className="text-stone-900">{selectedUserForTier.email}</strong>
              </p>

              <div className="space-y-2">
                {[
                  { id: "FrontEnd", label: "Regular Edition ($17)", desc: "Standard manuscript & story bible features" },
                  { id: "OTO1", label: "Pro Edition ($47)", desc: "Unlimited projects & advanced exports" },
                  { id: "OTO2", label: "Premium Edition ($97)", desc: "Full AI lore generation & plotting tools" },
                  { id: "Free", label: "Free Demo Tier", desc: "Restricted evaluation access" },
                ].map((tierOpt) => (
                  <label
                    key={tierOpt.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                      newTierSelection === tierOpt.id
                        ? "bg-[#FAF8F5] border-[#8C503C] ring-1 ring-[#8C503C]"
                        : "bg-white border-[#E3DDD1] hover:bg-stone-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="tier_option"
                      value={tierOpt.id}
                      checked={newTierSelection === tierOpt.id}
                      onChange={() => setNewTierSelection(tierOpt.id as any)}
                      className="mt-0.5 accent-[#8C503C]"
                    />
                    <div>
                      <div className="text-xs font-bold text-stone-900">{tierOpt.label}</div>
                      <div className="text-[11px] text-stone-500 font-serif">{tierOpt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedUserForTier(null)}
                  className="px-4 py-2 border border-[#DCD5C9] text-stone-600 text-xs font-bold uppercase rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTier}
                  className="px-4 py-2 bg-[#8C503C] hover:bg-[#733D2D] text-white text-xs font-bold uppercase rounded-lg shadow-xs cursor-pointer"
                >
                  Apply Tier
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: DELETE CONFIRMATION */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-rose-200 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-900">
                    Delete User Record?
                  </h3>
                  <p className="text-xs text-stone-500 font-serif">
                    Permanent deletion from Firestore CRM
                  </p>
                </div>
              </div>

              <p className="text-xs text-stone-600 font-serif leading-relaxed">
                Are you sure you want to permanently delete the CRM record for{" "}
                <strong className="text-stone-900">{userToDelete.email}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 border border-[#DCD5C9] text-stone-600 text-xs font-bold uppercase rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase rounded-lg shadow-xs cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
