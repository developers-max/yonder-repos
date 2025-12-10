'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/auth-client';
import PlotDetails from '@/app/(protected)/chat/components/plot/plot-details';
import MockChatInterface from './components/mock-chat-interface';
import AuthDialog from './components/auth-dialog';

export default function PlotPage() {
  const params = useParams();
  const router = useRouter();
  const plotId = params.plot_id as string;
  const { data: session, isPending } = useSession();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // If user is already logged in, redirect directly to chat
  useEffect(() => {
    if (!isPending && session?.session) {
      router.push(`/chat?plotId=${plotId}`);
    }
  }, [isPending, session, router, plotId]);

  const handleStartChat = () => {
    if (session?.session) {
      // User is logged in, redirect to chat with plotId
      router.push(`/chat?plotId=${plotId}`);
    } else {
      // User is not logged in, show auth dialog
      setShowAuthDialog(true);
    }
  };

  // Show loading state while checking session or redirecting logged-in users
  if (isPending || session?.session) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">

        {/* Left side - Mock Chat Interface */}
        <div className="w-[45%]">
          <MockChatInterface 
            onStartChat={handleStartChat}
          />
        </div>
        {/* Right side - Plot Details */}
        <div className="w-[55%] border-l border-border">
          <PlotDetails 
            plotId={plotId} 
            onBack={() => {}} 
            standalone={true}
          />
        </div>
      
      </div>
      
      <AuthDialog 
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        plotId={plotId}
      />
    </div>
  );
} 