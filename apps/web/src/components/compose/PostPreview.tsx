"use client";

import * as React from "react";
import { ThumbsUp, MessageSquare, Share2, Globe, Sparkles } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface PostPreviewProps {
  content: string;
  mediaUrls: string[];
  accountName?: string;
  targetName?: string;
}

export function PostPreview({ content, mediaUrls, accountName = "Your Facebook Page", targetName }: PostPreviewProps) {
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
