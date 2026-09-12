"use client";

import * as React from "react";
import { ThumbsUp, MessageSquare, Share2, Globe, Sparkles, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface PostPreviewProps {
  content: string;
  mediaUrls: string[];
  accountName?: string;
  targetName?: string;
  platform?: string;
}

export function PostPreview({
  content,
  mediaUrls,
  accountName = "Your Account",
  targetName,
  platform = "facebook",
}: PostPreviewProps) {
  const isInstagram = (platform || "").toLowerCase() === "instagram";

  if (isInstagram) {
    const igHandle = targetName?.includes("@")
      ? targetName.replace("@", "")
      : accountName?.includes("@")
      ? accountName.replace("@", "")
      : "hog_alashour";

    return (
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            Live Instagram Preview
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30 font-mono">
            Instagram Feed View
          </span>
        </div>

        <SpotlightCard className="p-4 border border-white/10 bg-[#000000] text-white rounded-xl shadow-2xl font-sans">
          {/* Instagram Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 flex items-center justify-center shadow-md">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-xs font-bold text-white uppercase">
                  {igHandle.slice(0, 2)}
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-xs text-white leading-tight">
                    {igHandle}
                  </span>
                  <span className="text-gray-400 text-xs">•</span>
                  <span className="text-gray-400 text-xs">Follow</span>
                </div>
                <span className="text-[10px] text-gray-400">Original audio</span>
              </div>
            </div>
            <button type="button" className="text-gray-400 hover:text-white transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Media Showcase (Square/Aspect-Fill) */}
          <div className="rounded-lg overflow-hidden border border-white/5 bg-[#121212] mb-3 relative">
            {mediaUrls.length > 0 ? (
              mediaUrls.length === 1 ? (
                <img src={mediaUrls[0]} alt="Instagram Post" className="w-full aspect-square object-cover" />
              ) : (
                <div className="relative aspect-square">
                  <img src={mediaUrls[0]} alt="Instagram Carousel" className="w-full h-full object-cover" />
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-mono">
                    1/{mediaUrls.length}
                  </div>
                </div>
              )
            ) : (
              <div className="w-full aspect-square flex flex-col items-center justify-center text-gray-600 p-6 text-center">
                <div className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center mb-2 text-gray-500">
                  📸
                </div>
                <span className="text-xs text-gray-500">Pick products or add images to see carousel preview</span>
              </div>
            )}
          </div>

          {/* Instagram Action Bar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3.5">
              <button type="button" className="hover:text-red-500 transition-colors">
                <Heart className="w-5 h-5" />
              </button>
              <button type="button" className="hover:text-gray-300 transition-colors">
                <MessageCircle className="w-5 h-5 -rotate-90" />
              </button>
              <button type="button" className="hover:text-gray-300 transition-colors">
                <Send className="w-5 h-5" />
              </button>
            </div>
            <button type="button" className="hover:text-gray-300 transition-colors">
              <Bookmark className="w-5 h-5" />
            </button>
          </div>

          {/* Likes */}
          <div className="text-xs font-semibold text-white mb-1.5">
            284 likes
          </div>

          {/* Caption */}
          <div className="text-xs text-gray-100 whitespace-pre-wrap leading-relaxed" dir="auto">
            <span className="font-bold mr-1.5 text-white">{igHandle}</span>
            {content.trim() ? (
              content
            ) : (
              <span className="text-gray-500 italic">Write your post caption here...</span>
            )}
          </div>

          <div className="mt-2 text-[10px] text-gray-500 uppercase tracking-wider font-mono">
            Just now
          </div>
        </SpotlightCard>
      </div>
    );
  }

  // Fallback: Facebook Preview
  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-quaz-cyan)]" />
          Live Facebook Preview
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
          Desktop Feed View
        </span>
      </div>

      <SpotlightCard className="p-4 border border-white/10 bg-[#18191a] text-[#e4e6eb] rounded-xl shadow-2xl font-sans">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            {accountName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-sm text-white leading-snug">
                {targetName || accountName}
              </h4>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>Just now</span>
              <span>•</span>
              <Globe className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="mb-3 text-sm text-gray-100 whitespace-pre-wrap leading-relaxed min-h-[50px]" dir="auto">
          {content.trim() ? (
            content
          ) : (
            <span className="text-gray-500 italic">Start typing your post or pick a product from your catalog to preview it live here...</span>
          )}
        </div>

        {/* Media / Image Showcase */}
        {mediaUrls.length > 0 && (
          <div className="rounded-lg overflow-hidden border border-white/5 bg-black/40 mb-3">
            {mediaUrls.length === 1 ? (
              <img src={mediaUrls[0]} alt="Post Attachment" className="w-full max-h-80 object-cover" />
            ) : (
              <div className="grid grid-cols-2 gap-1 max-h-80 overflow-hidden">
                {mediaUrls.slice(0, 4).map((url, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={url} alt={`Post media ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 3 && mediaUrls.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg">
                        +{mediaUrls.length - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Engagement Stats Bar */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 pb-2 border-b border-white/10">
          <div className="flex items-center space-x-1.5">
            <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[9px] text-white">
              👍
            </span>
            <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] text-white">
              ❤️
            </span>
            <span>128</span>
          </div>
          <div className="flex space-x-3">
            <span>24 comments</span>
            <span>6 shares</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-1 pt-1 text-xs text-gray-300 font-medium">
          <button type="button" className="flex items-center justify-center space-x-1.5 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <ThumbsUp className="w-4 h-4 text-gray-400" />
            <span>Like</span>
          </button>
          <button type="button" className="flex items-center justify-center space-x-1.5 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span>Comment</span>
          </button>
          <button type="button" className="flex items-center justify-center space-x-1.5 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <Share2 className="w-4 h-4 text-gray-400" />
            <span>Share</span>
          </button>
        </div>
      </SpotlightCard>
    </div>
  );
}
