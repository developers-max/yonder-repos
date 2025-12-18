'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, X, CheckCircle, Clock, Bell } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';

interface UnverifiedPlotBannerProps {
  plotId: string;
  isVerified?: boolean;
  isClaimed?: boolean;
  onVerify?: () => void;
}

/**
 * Banner shown on plots that don't have verified coordinates.
 * Only visible to users with realtor role.
 */
export function UnverifiedPlotBanner({ plotId, isVerified = false, isClaimed = false, onVerify }: UnverifiedPlotBannerProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const handleClaimClick = () => {
    setShowModal(true);
  };

  const handleVerifyPlot = () => {
    // Navigate to realtor dashboard with plotId to search for this specific plot
    router.push(`/realtor?plotId=${plotId}`);
    onVerify?.();
  };

  // Verified plot banner
  if (isVerified) {
    return (
      <>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-green-700">Verified Plot</span>
              <span className="text-green-600 text-sm">Confirmed Location</span>
            </div>
          </div>
          {!isClaimed && (
            <Button
              onClick={handleClaimClick}
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-100 hover:text-green-800 flex-shrink-0"
            >
              Claim this plot
            </Button>
          )}
        </div>

        {/* Claim Modal */}
        {showModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowModal(false)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative p-6 pb-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                
                <h2 className="text-xl font-bold text-gray-900 pr-8">
                  Are you the seller of this plot?
                </h2>
                <p className="text-gray-600 mt-2">
                  Help buyers make faster decisions with verified data.
                </p>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <Button
                  onClick={handleVerifyPlot}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                >
                  Claim my plot
                </Button>
                <Button
                  onClick={() => setShowModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-amber-700">Unverified Plot</span>
            <span className="text-amber-600 text-sm">Location not confirmed by seller</span>
          </div>
        </div>
        <Button
          onClick={handleClaimClick}
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800 flex-shrink-0"
        >
          Claim this plot
        </Button>
      </div>

      {/* Claim Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-6 pb-4">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              
              <h2 className="text-xl font-bold text-gray-900 pr-8">
                Are you the seller of this plot?
              </h2>
              <p className="text-gray-600 mt-2">
                Help buyers make faster decisions with verified data.
              </p>
            </div>

            {/* Modal Content */}
            <div className="px-6 pb-6 space-y-4">
              <p className="text-gray-700 text-sm">
                By verifying your plot location, we can generate a comprehensive AI report including:
              </p>
              
              {/* Benefits List */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Exact zoning & building regulations (PDM)</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Cadastre & BUPI documentation</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Building potential visualization</span>
                </div>
              </div>

              {/* Privacy Points */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2.5 mt-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600">Your exact location stays private</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600">Less back-and-forth with buyers</span>
                </div>
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600">Get notified when buyers unlock your report</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                onClick={handleVerifyPlot}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
              >
                Verify my plot
              </Button>
              <Button
                onClick={() => setShowModal(false)}
                variant="outline"
                className="flex-1"
              >
                Learn more
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UnverifiedPlotBanner;
