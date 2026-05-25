'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { X, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export function ImageModal({ open, onClose, src, alt = 'Image' }: ImageModalProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  // Reset states when src changes or modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      // Reset error/loading after close animation
      setTimeout(() => {
        setImgError(false);
        setImgLoading(true);
      }, 200);
    }
  };

  // If src changes while open, reset states
  const handleSrcChange = () => {
    setImgError(false);
    setImgLoading(true);
  };

  // Don't render if no valid src
  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 border-0 bg-black/90 overflow-hidden" showCloseButton={false}>
        {/* Visually hidden title/description for accessibility (required by Radix Dialog) */}
        <DialogTitle className="sr-only">Preview: {alt}</DialogTitle>
        <DialogDescription className="sr-only">Preview gambar {alt}</DialogDescription>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20 rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          {imgError ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/70">
              <ImageOff className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Gagal memuat gambar</p>
            </div>
          ) : (
            <>
              {imgLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70" />
                </div>
              )}
              <img
                src={src}
                alt={alt}
                className={`w-full h-auto max-h-[80vh] object-contain transition-opacity duration-300 ${imgLoading ? 'opacity-0 absolute' : 'opacity-100'}`}
                onLoad={() => setImgLoading(false)}
                onError={() => { setImgError(true); setImgLoading(false); }}
                key={src}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
