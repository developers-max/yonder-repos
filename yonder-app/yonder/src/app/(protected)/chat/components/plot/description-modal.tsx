'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/_components/ui/dialog';
import { Languages, Loader2 } from 'lucide-react';
import { trpc } from '@/trpc/client';

interface DescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  description: string;
}

export function DescriptionModal({ isOpen, onClose, description }: DescriptionModalProps) {
  const [showTranslation, setShowTranslation] = useState(true);

  const { data: translationData, isLoading: isTranslating } = trpc.plots.translateDescription.useQuery(
    { text: description },
    { enabled: isOpen && !!description }
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Full Description
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original Description */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Original</h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            </div>
          </div>

          {/* Translation Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">English Translation</h3>
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showTranslation ? 'Hide' : 'Show'}
              </button>
            </div>

            {showTranslation && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                {isTranslating ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                    <span className="text-sm text-gray-600">Translating...</span>
                  </div>
                ) : translationData?.translation ? (
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {translationData.translation}
                  </p>
                ) : (
                  <p className="text-gray-500 text-sm italic">Translation unavailable</p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
