'use client';

import { Button } from '@/app/_components/ui/button';
import { Textarea } from '@/app/_components/ui/textarea';
import { Bot, MessageCircle, Sparkles } from 'lucide-react';

interface MockChatInterfaceProps {
  onStartChat: () => void;
}

export default function MockChatInterface({ onStartChat }: MockChatInterfaceProps) {
  return (
    <div className="relative h-screen bg-secondary">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-secondary/80 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-4">
            <h1 className="text-xl font-semibold text-foreground truncate">
              Plot Chat
            </h1>
            <p className="text-sm text-muted-foreground">AI-powered plot insights and guidance</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="h-full overflow-y-auto px-6 pt-24 pb-32 relative">
        {/* Sample Messages (muted) */}
        <div className="space-y-4 opacity-30">
          {/* Sample Assistant Message */}
          <div className="flex justify-start">
            <div className="max-w-[80%]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Assistant</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  I can help you understand this plot&apos;s details, nearby amenities, pricing insights, and guide you through the acquisition process.
                </div>
              </div>
            </div>
          </div>

          {/* Sample User Message */}
          <div className="flex justify-end">
            <div className="max-w-[80%]">
              <div className="bg-primary/30 text-foreground px-4 py-3 rounded-3xl rounded-br-xs">
                <div className="whitespace-pre-wrap break-words text-sm">
                  Tell me about this plot&apos;s investment potential
                </div>
              </div>
            </div>
          </div>

          {/* Sample Assistant Response */}
          <div className="flex justify-start">
            <div className="max-w-[80%]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Assistant</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Based on the plot details, I can analyze the investment potential considering location, pricing trends, nearby developments...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Call-to-Action - positioned within the messages area */}
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto p-6 bg-background/95 backdrop-blur-sm rounded-xl border shadow-lg">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              Start a chat with this plot to learn more
            </h3>
            <p className="text-muted-foreground mb-4 text-sm text-balance">
              Get AI-powered insights about this property, investment potential, and acquisition guidance.
            </p>
            <Button 
              onClick={onStartChat}
              className="font-medium h-10 px-6 flex items-center gap-2 mx-auto"
            >
              <MessageCircle className="w-4 h-4" />
              Start Chatting
            </Button>
          </div>
        </div>
      </div>

      {/* Mock Input Form (disabled) */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-secondary/70 backdrop-blur-lg p-4 pb-3">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              placeholder="Ask about this plot..."
              className="resize-none rounded-xl pr-12 py-2.5 min-h-[44px] bg-background opacity-50"
              rows={1}
              disabled
            />
          </div>
          
          <Button
            disabled
            className="font-medium h-[44px] !px-4 !pr-6 flex items-center gap-2 opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send
          </Button>
        </div>
        <div className="mt-2 px-2 text-xs text-muted-foreground">
          Sign in to start chatting about this plot
        </div>
      </div>
    </div>
  );
} 