import React, { useState, useRef } from "react";
import { 
  X, Upload, Link2, Trash2, Check, Image as ImageIcon, 
  AlertCircle, RefreshCw, Search, User, MapPin, Lock, ArrowRight
} from "lucide-react";
import { 
  fileToOptimizedDataUrl, 
  FANTASY_PRESET_PORTRAITS, 
  FANTASY_PRESET_LOCATIONS,
  PresetImage
} from "@/lib/imageUtils";
import { storage } from "@/lib/storage";
import { PLAN_LIMITS } from "@/lib/license";
import { useNavigate } from "react-router-dom";

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  currentImage?: string;
  title?: string;
  type?: "character" | "location";
  defaultTab?: "upload" | "url" | "presets";
}

export default function ImagePickerModal({
  isOpen,
  onClose,
  onSelectImage,
  currentImage = "",
  title = "Select Image",
  type = "character",
  defaultTab = "upload",
}: ImagePickerModalProps) {
  const navigate = useNavigate();
  const profile = storage.getUserProfile();
  const hasImageLibrary = PLAN_LIMITS[profile?.plan || 'free'].hasImageLibrary;

  const [activeTab, setActiveTab] = useState<"upload" | "url" | "presets">(defaultTab);
  const [urlInput, setUrlInput] = useState(currentImage.startsWith("data:") ? "" : currentImage);
  const [previewImage, setPreviewImage] = useState<string>(currentImage);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Category Filters for presets
  const [presetSearch, setPresetSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state on open
  React.useEffect(() => {
    if (isOpen) {
      setPreviewImage(currentImage);
      setUrlInput(currentImage.startsWith("data:") ? "" : currentImage);
      setErrorMsg(null);
      if (defaultTab) {
        setActiveTab(defaultTab);
      }
    }
  }, [isOpen, currentImage, defaultTab]);

  if (!isOpen) return null;

  const presets = type === "character" ? FANTASY_PRESET_PORTRAITS : FANTASY_PRESET_LOCATIONS;

  // Extract unique categories
  const categories = Array.from(
    new Set(
      presets
        .map((p) => ('category' in p ? (p as PresetImage).category : undefined))
        .filter((c): c is string => Boolean(c))
    )
  );

  const filteredPresets = presets.filter((preset) => {
    const p = preset as PresetImage;
    if (selectedCategory !== "all" && p.category !== selectedCategory) {
      return false;
    }
    if (!presetSearch.trim()) return true;
    const q = presetSearch.toLowerCase();
    const matchesLabel = p.label.toLowerCase().includes(q);
    const matchesTags = p.tags && Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q));
    const matchesDesc = p.description && p.description.toLowerCase().includes(q);
    return matchesLabel || matchesTags || matchesDesc;
  });

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please choose an image file (PNG, JPG, WebP, GIF, or SVG).");
      return;
    }
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      // Compress & optimize for storage
      const maxDim = type === "character" ? 640 : 960;
      const dataUrl = await fileToOptimizedDataUrl(file, maxDim, maxDim, 0.8);
      setPreviewImage(dataUrl);
      setActiveTab("upload");
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to read image file. Please try another one.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      setErrorMsg("Please enter a valid image URL.");
      return;
    }
    setErrorMsg(null);
    setPreviewImage(urlInput.trim());
  };

  const handleSave = () => {
    onSelectImage(previewImage);
    onClose();
  };

  const handleRemove = () => {
    setPreviewImage("");
    setUrlInput("");
    onSelectImage("");
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#fcfaf5] rounded-sm shadow-[8px_24px_64px_rgba(0,0,0,0.6)] w-full max-w-2xl border border-[#e5e0d5] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e0d5] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[#f4efe6] border border-[#e5e0d5] flex items-center justify-center text-[#8a5b46]">
              <ImageIcon className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-[#4a3225]">
                {title}
              </h2>
              <p className="text-[10px] font-bold text-[#a66850] tracking-widest uppercase mt-0.5">
                Upload from device or paste web image URL
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#e5e0d5] bg-[#f7f3eb] px-6">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
              activeTab === "upload"
                ? "border-[#a66850] text-[#4a3225] bg-white/60"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
          <button
            onClick={() => setActiveTab("url")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
              activeTab === "url"
                ? "border-[#a66850] text-[#4a3225] bg-white/60"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Image URL
          </button>
          <button
            onClick={() => setActiveTab("presets")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${
              activeTab === "presets"
                ? "border-[#a66850] text-[#4a3225] bg-white/60"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#b8785e]" />
            <span>{type === "character" ? `Portrait Library (${presets.length})` : `Location Library (${presets.length})`}</span>
            {!hasImageLibrary && (
              <span className="flex items-center gap-0.5 bg-[#8C503C] text-white text-[8px] font-sans font-bold px-1.5 py-0.5 rounded-xs tracking-wider uppercase ml-1">
                <Lock className="w-2.5 h-2.5" /> PRO
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: UPLOAD FILE */}
          {activeTab === "upload" && (
            <div className="space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileInputChange} 
                accept="image/*" 
                className="hidden" 
              />
              
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging 
                    ? "border-[#a66850] bg-[#a66850]/10 scale-[1.01]" 
                    : "border-[#d49a89]/60 hover:border-[#a66850] bg-white hover:bg-[#faf7f2]"
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-[#f4efe6] border border-[#e5e0d5] flex items-center justify-center text-[#8a5b46] shadow-sm">
                  {isProcessing ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 stroke-[1.5]" />
                  )}
                </div>
                <div>
                  <p className="font-serif text-base font-bold text-[#4a3225]">
                    {isProcessing ? "Optimizing image..." : "Drag & drop your image here, or click to browse"}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Supports PNG, JPG, JPEG, WEBP, GIF, SVG (Auto-compressed for fast rendering)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="mt-2 px-4 py-2 bg-[#b8785e] hover:bg-[#a66850] text-white text-[11px] font-bold uppercase tracking-wider rounded-sm shadow-sm transition-colors"
                >
                  Choose File from Computer
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IMAGE URL */}
          {activeTab === "url" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
                  Direct Web Image Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/... or https://i.imgur.com/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyUrl(); } }}
                    className="flex-1 bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm text-[#4a3225] focus:outline-none focus:border-[#a66850]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-4 py-2 bg-[#b8785e] hover:bg-[#a66850] text-white text-[11px] font-bold uppercase tracking-wider rounded-sm transition-colors"
                  >
                    Preview
                  </button>
                </div>
                <p className="text-[10px] text-stone-500 italic">
                  Paste any public image URL from Pinterest, ArtStation, Unsplash, Cloudinary, etc.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: FANTASY LIBRARY */}
          {activeTab === "presets" && (
            !hasImageLibrary ? (
              <div className="p-8 text-center bg-[#F4F1EA] rounded-md border border-[#E5E0D5] flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#8C503C]/10 border border-[#8C503C]/20 flex items-center justify-center text-[#8C503C] shadow-xs">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 text-[#8C503C]">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                      Ocean Novel Pro Exclusive
                    </span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#4A3225]">
                    {type === "character" ? `Fantasy Portrait Library (${FANTASY_PRESET_PORTRAITS.length} portraits)` : `Location Landmark Library (${FANTASY_PRESET_LOCATIONS.length} presets)`}
                  </h3>
                  <p className="text-xs text-stone-600 font-serif leading-relaxed">
                    The curated library of high-definition character portraits and fantasy landscape art is available in <strong>Ocean Novel Pro</strong>. In this Author Edition (FE), you can freely upload your own photos or paste web image links using the other tabs!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("upload")}
                    className="px-4 py-2 bg-white border border-[#DCD5C9] hover:bg-stone-50 text-[#4A3225] text-xs font-semibold rounded-sm transition-colors cursor-pointer"
                  >
                    Upload My Own Image Instead
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/settings");
                    }}
                    className="px-5 py-2 bg-[#8C503C] hover:bg-[#723E2E] text-white text-xs font-bold uppercase tracking-wider rounded-sm shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Upgrade to Pro</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
            <div className="space-y-4">
              {/* Filter Controls: Search & Category Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e5e0d5]/80">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder={`Search ${presets.length} presets (name, class, role)...`}
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#e5e0d5] rounded-sm text-xs font-serif text-[#4a3225] placeholder:text-stone-400 focus:outline-none focus:border-[#a66850]"
                  />
                  {presetSearch && (
                    <button
                      onClick={() => setPresetSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {categories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                    <button
                      onClick={() => setSelectedCategory("all")}
                      className={`px-2.5 py-1 rounded-sm transition-colors ${
                        selectedCategory === "all"
                          ? "bg-[#8c503c] text-white shadow-2xs"
                          : "bg-white border border-[#e5e0d5] text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      All ({presets.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-1 rounded-sm transition-colors ${
                          selectedCategory === cat
                            ? "bg-[#8c503c] text-white shadow-2xs"
                            : "bg-white border border-[#e5e0d5] text-stone-600 hover:text-stone-900"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Grid of Presets */}
              {filteredPresets.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredPresets.map((preset, idx) => {
                    const p = preset as PresetImage;
                    const isSelected = previewImage === p.url;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPreviewImage(p.url);
                          setUrlInput(p.url);
                          setErrorMsg(null);
                        }}
                        className={`group relative rounded-sm overflow-hidden border text-left transition-all p-1 bg-white flex flex-col ${
                          isSelected
                            ? "border-[#8c503c] ring-2 ring-[#8c503c]/40 shadow-md"
                            : "border-[#e5e0d5] hover:border-[#b8785e] hover:shadow-sm"
                        }`}
                      >
                        <div className={`w-full overflow-hidden bg-stone-100 relative ${type === "character" ? "aspect-[3/4]" : "aspect-[16/10]"}`}>
                          <img 
                            src={p.url} 
                            alt={p.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            loading="lazy"
                          />
                          {p.category && (
                            <span className="absolute top-1 left-1 bg-black/60 backdrop-blur-xs text-white text-[8px] font-sans font-semibold px-1.5 py-0.5 rounded-xs tracking-wider uppercase">
                              {p.category}
                            </span>
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#8c503c]/20 flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-[#8c503c] text-white flex items-center justify-center shadow-md">
                                <Check className="w-4 h-4" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-1.5 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-[#4a3225] group-hover:text-[#8c503c] transition-colors truncate">
                              {p.label}
                            </span>
                          </div>
                          {p.description && (
                            <span className="text-[8px] text-stone-500 font-serif line-clamp-1">
                              {p.description}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-sm border border-[#e5e0d5]">
                  <ImageIcon className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="font-serif font-bold text-stone-700 text-xs">
                    No matching portraits found
                  </p>
                  <p className="text-[10px] text-stone-500 font-serif mt-0.5">
                    Try another keyword or select "All" above.
                  </p>
                </div>
              )}
            </div>
            )
          )}

          {/* PREVIEW CONTAINER */}
          {previewImage && (
            <div className="p-4 bg-white border border-[#e5e0d5] rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  Current Selection Preview
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImage("")}
                  className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Image
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className={`overflow-hidden rounded-sm border border-[#d49a89]/40 bg-stone-100 shadow-sm shrink-0 ${
                  type === "character" ? "w-24 h-32" : "w-36 h-24"
                }`}>
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => {
                      setErrorMsg("Could not load image from this source. Please verify URL or file.");
                    }}
                  />
                </div>
                <div className="text-xs text-stone-600 space-y-1">
                  <p className="font-semibold text-[#4a3225]">Image ready to be applied</p>
                  <p className="text-[11px] text-stone-500 line-clamp-2 break-all">
                    {previewImage.startsWith("data:") ? "Custom uploaded image file (Stored in project)" : previewImage}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#e5e0d5] flex items-center justify-between bg-white">
          <div>
            {currentImage && (
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs text-stone-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Image
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-[#8a5b46] text-[11px] font-bold tracking-widest uppercase hover:bg-stone-100 rounded-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-[#b8785e] hover:bg-[#a66850] text-white text-[11px] font-bold tracking-widest uppercase rounded-sm shadow-md transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Apply Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
