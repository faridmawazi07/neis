'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export function ImageModal({ open, onClose, src, alt = 'Image' }: ImageModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-4xl w-full p-0 border-0 bg-black/90 overflow-hidden" showCloseButton={false}>
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
          <img
            src={src}
            alt={alt}
            className="w-full h-auto max-h-[80vh] object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
