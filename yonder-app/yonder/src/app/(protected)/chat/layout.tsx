'use client';

import { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import PlotsPanel from './components/plot/plots-panel';
import ProjectSelector from './components/project/project-selector';
import StepIndicator from './components/project/step-indicator';
import UserDropdown from './components/shared/user-dropdown';
import { MessageCircle, X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';

// Dynamically import ChatHistoryPopover with SSR disabled
const ChatHistoryPopover = dynamic(() => import('./components/shared/chat-history-popover'), {
  ssr: false,
  loading: () => <div className="w-9 h-9" />,
});

interface ChatLayoutProps {
  children: React.ReactNode;
}

export default function ChatLayout({ children }: ChatLayoutProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background">
      {/* Mobile Header - Logo centered, controls below */}
      <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-sm">
        {/* Logo row - centered */}
        <div className="flex justify-center pt-4 pb-2">
          <Image 
            src="/logo.svg" 
            alt="Yonder" 
            width={100} 
            height={30}
            className="h-7 w-auto"
          />
        </div>
        {/* Controls row */}
        <div className="flex items-center justify-center px-2 pb-3 gap-1">
          <div className="flex-1 max-w-[140px]">
            <ProjectSelector />
          </div>
          <StepIndicator />
          <ChatHistoryPopover currentChatId="" disabled={false} />
          <UserDropdown disabled={false} />
        </div>
      </div>

      {/* Main Chat Area - Hidden on mobile, visible on md+ */}
      <div className="hidden md:flex md:flex-1 md:flex-col md:min-w-0">
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>

      {/* Right Panel - Plots Browser - Full width on mobile, takes remaining height */}
      <PlotsPanel className="flex-1 md:flex-none w-full md:w-[55%]" />

      {/* Floating Chat Button - Mobile only */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-[60] w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Floating Chat Window - Mobile only */}
      {isChatOpen && (
        <div 
          className={`md:hidden fixed z-[60] bg-background border border-border shadow-2xl transition-all duration-300 ease-out ${
            isChatExpanded 
              ? 'inset-2 rounded-2xl' 
              : 'bottom-2 left-2 right-2 h-[50vh] rounded-2xl'
          }`}
        >
          {/* Floating Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="font-medium text-sm">Chat Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsChatExpanded(!isChatExpanded)}
              >
                {isChatExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setIsChatOpen(false);
                  setIsChatExpanded(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Chat Content */}
          <div className={`overflow-hidden ${isChatExpanded ? 'h-[calc(100%-52px)]' : 'h-[calc(50vh-52px)]'}`}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
} 