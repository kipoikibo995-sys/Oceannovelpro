import React, { useState, useRef } from "react";
import { Upload, Image as ImageIcon, Trash2, Link2 } from "lucide-react";
import { fileToOptimizedDataUrl } from "@/lib/imageUtils";
import ImagePickerModal from "./ImagePickerModal";

interface ImageDropzoneCardProps {
  imageUrl?: string;
  onImageChange: (newUrl: string) => void;
  aspectRatio?: "portrait" | "landscape";
  type: "character" | "location";
  label?: string;
}

export default function ImageDropzoneCard({
  imageUrl = "",
  onImageChange,
  aspectRatio = "portrait",
  type,
  label,
}: ImageDropzoneCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setIsOptimizing(true);
      try {
        const maxDim = aspectRatio === "portrait" ? 640 : 960;
        const dataUrl = await fileToOptimizedDataUrl(file, maxDim, maxDim, 0.8);
        onImageChange(dataUrl);
      } catch (err) {
        console.error(err);
      } finally {
        setIsOptimizing(false);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setIsOptimizing(true);
      try {
        const maxDim = aspectRatio === "portrait" ? 640 : 960;
        const dataUrl = await fileToOptimizedDataUrl(file, maxDim, maxDim, 0.8);
        onImageChange(dataUrl);
      } catch (err) {
        console.error(err);
      } finally {
        setIsOptimizing(false);
      }
    }
  };

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">
            {label}
          </label>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onImageChange("")}
              className="text-[10px] font-bold text-stone-400 hover:text-rose-600 transition-colors uppercase tracking-wider flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        className="hidden"
      />

      {/* Dropzone & Preview Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => setIsModalOpen(true)}
        className={`relative group cursor-pointer overflow-hidden border-2 transition-all rounded-sm shadow-sm flex flex-col items-center justify-center ${
          aspectRatio === "portrait" ? "aspect-[3/4] max-w-[280px]" : "aspect-[16/9] w-full"
        } ${
          isDragging
            ? "border-[#a66850] bg-[#a66850]/15 scale-[1.01]"
            : "border-[#d49a89]/60 hover:border-[#b8785e] bg-white"
        }`}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Visual asset"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 text-white">
              <div className="flex items-center gap-2 justify-center bg-black/50 backdrop-blur-sm rounded-sm py-1.5 px-3 mb-1">
                <Upload className="w-3.5 h-3.5 text-[#e5e0d5]" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Click or drop to replace</span>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-center flex flex-col items-center justify-center gap-2.5 text-stone-400 group-hover:text-[#a66850]">
            <div className="w-12 h-12 rounded-full bg-[#f4efe6] border border-[#e5e0d5] flex items-center justify-center text-[#8a5b46] group-hover:scale-110 transition-transform">
              <ImageIcon className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#4a3225] font-serif uppercase tracking-wider">
                {isOptimizing ? "Processing..." : "Add Visual Artwork"}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Drop file here or click to choose
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2.5 py-1.5 bg-white border border-[#e5e0d5] hover:border-[#a66850] text-[#4a3225] text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-xs transition-colors flex items-center gap-1.5"
          title="Upload image from your local computer"
        >
          <Upload className="w-3 h-3 text-[#a66850]" />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-2.5 py-1.5 bg-white border border-[#e5e0d5] hover:border-[#a66850] text-[#4a3225] text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-xs transition-colors flex items-center gap-1.5"
          title="Paste image web link or choose sample"
        >
          <Link2 className="w-3 h-3 text-[#a66850]" />
          Image URL
        </button>
      </div>

      {/* Modal for full picker */}
      <ImagePickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectImage={onImageChange}
        currentImage={imageUrl}
        type={type}
        title={type === "character" ? "Character Portrait" : "Location Artwork"}
      />
    </div>
  );
}
