'use client';

import { useChat } from '@ai-sdk/react';
import type { Message } from 'ai';
import { Button } from '@/app/_components/ui/button';
import { Textarea } from '@/app/_components/ui/textarea';
import { Bot, BrushCleaning, Loader2, Building2, Settings, ChevronDown } from 'lucide-react';
import { ToolInvocationSkeleton } from '../tool-results/plot/plot-search-components';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import MarkdownRenderer from './markdown-renderer';
import PlotContextIndicator from '../plot/plot-context-indicator';
import { ToolRenderer } from '../tool-results/shared/tool-renderer';
import { SuggestionBadges } from './suggestion-badges';
import { useSession } from '@/lib/auth/auth-client';
import ProjectSelector from '../project/project-selector';
import StepIndicator from '../project/step-indicator';
import UserDropdown from './user-dropdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/_components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/_components/ui/dropdown-menu';
import { createNewChat, getUrlWithParams } from '../../utils/chat-utils';

// Dynamically import ChatHistoryPopover with SSR disabled to avoid hydration issues
const ChatHistoryPopover = dynamic(() => import('./chat-history-popover'), {
  ssr: false,
  loading: () => <div className="w-9 h-9" />, // Placeholder to maintain layout
});

// Suggestion prompts for empty state based on actual available tools
const SUGGESTIONS = {
  general: [
    "Search for plots near Lisbon under €100k",
    "Show me the complete acquisition process steps",
    "Find plots within 25km of Porto with beach access",
    "What's my current project progress?",
    "Search for plots between 1000-5000 m² in size",
    "Show me plots near cafes and supermarkets",
    "Find affordable plots near public transport",
    "What's the next step in my acquisition process?",
    "Search for plots sorted by price",
    "Show me plots near the main town center"
  ],
  plotSpecific: [
    "Show me detailed information about this plot",
    "What's the next step for this plot?",
    "Select this plot for my project",
    "Initiate outreach for plots like this one",
    "Show me the current project progress",
    "Search for similar plots in this area",
    "What are all the acquisition steps?",
    "Find plots near this location",
    "Show pricing analysis for this plot",
    "Update progress on this plot"
  ]
};

interface ChatInterfaceProps {
  chatId: string;
  initialMessages?: Message[];
  isLoading?: boolean;
  error?: string;
}

export default function ChatInterface({ 
  chatId, 
  initialMessages = [], 
  isLoading = false, 
  error 
}: ChatInterfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [includePlotContext, setIncludePlotContext] = useState(true);
  const [droppedPinCoords, setDroppedPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const { data: session } = useSession();
  const createChatMutation = trpc.chat.createChat.useMutation();
  const { data: chatQueriesData, refetch: refetchChatQueries } = trpc.admin.getRemainingChatQueries.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  const remainingQueries = chatQueriesData?.remainingChatQueries ?? 0;
  
  // Get plotId from URL search params
  const plotId = searchParams.get('plotId');
  
  // Generate suggestions for empty state (deterministic to avoid hydration mismatch)
  const emptySuggestions = useMemo(() => {
    const suggestions = plotId ? SUGGESTIONS.plotSpecific : SUGGESTIONS.general;
    return suggestions.slice(0, 4).map((action, index) => ({
      id: `empty-suggestion-${index}`,
      action
    }));
  }, [plotId]);
  
  const { messages, input, handleInputChange, handleSubmit, status, setInput } = useChat({
    id: chatId,
    api: '/api/chat',
    initialMessages,
    sendExtraMessageFields: true,
    body: {
      chatId: chatId,
      // Include plotId in body when plot context is enabled
      ...(plotId && includePlotContext ? { plotId } : {}),
      // Include dropped pin coordinates when available
      ...(droppedPinCoords ? { droppedPinCoords } : {}),
    },
    onFinish: () => {
      // Refetch remaining chat queries after each message completes
      refetchChatQueries();
    },
  });
  
  // Check for pending message and auto-send it
  useEffect(() => {
    if (chatId && messages.length === 0) {
      const pendingMessage = sessionStorage.getItem('pendingMessage');
      if (pendingMessage) {
        sessionStorage.removeItem('pendingMessage');
        setInput(pendingMessage);
        // Auto-submit the message
        setTimeout(() => {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }, 100);
      }
    }
  }, [chatId, messages.length, setInput]);

  // Listen for external message requests (e.g., from layer info search)
  useEffect(() => {
    const handleSendMessage = (event: CustomEvent<{ message: string }>) => {
      if (event.detail?.message) {
        setInput(event.detail.message);
        // Auto-submit after setting input
        setTimeout(() => {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }, 100);
      }
    };
    
    window.addEventListener('chatSendMessage', handleSendMessage as EventListener);
    return () => window.removeEventListener('chatSendMessage', handleSendMessage as EventListener);
  }, [setInput]);

  // Reset plot context inclusion when plotId changes
  useEffect(() => {
    if (plotId) {
      setIncludePlotContext(true);
    }
  }, [plotId]);

  // Listen for map pin drop/remove events
  useEffect(() => {
    const handlePinDrop = (event: CustomEvent<{ latitude: number; longitude: number }>) => {
      if (event.detail) {
        setDroppedPinCoords(event.detail);
      }
    };
    
    const handlePinRemove = () => {
      setDroppedPinCoords(null);
    };
    
    window.addEventListener('mapPinDropped', handlePinDrop as EventListener);
    window.addEventListener('mapPinRemoved', handlePinRemove as EventListener);
    return () => {
      window.removeEventListener('mapPinDropped', handlePinDrop as EventListener);
      window.removeEventListener('mapPinRemoved', handlePinRemove as EventListener);
    };
  }, []);

  const isSubmitting = status === 'submitted' || status === 'streaming' || isCreatingChat;
  const isStreamingComplete = status === 'ready' || status === 'error';

  // Function to render individual message parts chronologically
  const renderMessagePart = (
    part: NonNullable<Message['parts']>[0], 
    messageId: string, 
    partIndex: number
  ) => {
    if (part.type === 'text') {
      return (
        <div key={`${messageId}-text-${partIndex}`}>
          <MarkdownRenderer>{part.text}</MarkdownRenderer>
        </div>
      );
    }
    
    if (part.type === 'tool-invocation') {
      const { toolInvocation } = part;
      const toolName = toolInvocation.toolName || 'unknown';
      
      if (toolInvocation.state !== 'result' || !toolInvocation.result) {
        return (
          <ToolInvocationSkeleton 
            key={`${messageId}-tool-loading-${partIndex}`} 
            toolName={toolName} 
          />
        );
      } else {
        return (
          <div key={`${messageId}-tool-result-${partIndex}`} className="flex flex-col pt-2 pb-4">
          <ToolRenderer
            key={`${messageId}-tool-result-${partIndex}`}
            toolName={toolName}
            result={toolInvocation.result}
            chatId={chatId}
          />
          </div>
        );
      }
    }
    
    return null;
  };

  // Function to collect suggestions from tool results
  const collectSuggestions = (message: Message): Array<{ id: string; action: string }> => {
    const suggestions: Array<{ id: string; action: string }> = [];
    
    if (message.parts && Array.isArray(message.parts)) {
      message.parts
        .filter((part): part is Extract<NonNullable<Message['parts']>[0], { type: 'tool-invocation' }> => 
          part.type === 'tool-invocation'
        )
        .forEach((part) => {
          if (part.toolInvocation.state === 'result') {
            const result = part.toolInvocation.result as { suggestions?: Array<{ id: string; action: string }> };
            if (result?.suggestions && Array.isArray(result.suggestions)) {
              suggestions.push(...result.suggestions);
            }
          }
        });
    }
    
    return suggestions;
  };

  // Handle clean up (new chat)
  const handleCleanUp = async () => {
    const activeOrganizationId = session?.session?.activeOrganizationId;
    if (!activeOrganizationId) {
      return;
    }

    setIsCreatingChat(true);
    await createNewChat({
      organizationId: activeOrganizationId,
      createChatMutation,
      router,
      searchParams,
      onFinally: () => setIsCreatingChat(false)
    });
  };

  // Custom submit handler to create chat if needed
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatId && input.trim()) {
      // Create new chat and redirect to it with the message
      setIsCreatingChat(true);
      try {
        // Get the active organization from session
        const activeOrganizationId = session?.session?.activeOrganizationId;
        if (!activeOrganizationId) {
          throw new Error('No active organization found');
        }
        
        const newChat = await createChatMutation.mutateAsync({
          organizationId: activeOrganizationId,
          title: 'New Chat'
        });
        // Store the message to send after redirect
        sessionStorage.setItem('pendingMessage', input);
        
        // Preserve current search parameters when redirecting
        router.push(getUrlWithParams(`/chat/${newChat.id}`, searchParams));
      } catch (error) {
        console.error('Failed to create new chat:', error);
        setIsCreatingChat(false);
      }
    } else if (chatId) {
      handleSubmit(e);
    }
  };

  // Show error state
  if (error) {
    return (
      <div className="relative h-screen bg-background">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-shrink">
              <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
                Chat
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">Ask me anything about your plots or general questions</p>
            </div>
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <div className="hidden md:block">
                <ProjectSelector />
              </div>
              <div className="hidden sm:block">
                <StepIndicator />
              </div>
              <ChatHistoryPopover 
                currentChatId={chatId || ''}
                disabled={isCreatingChat}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCleanUp}
                    variant="outline"
                    size="sm"
                    disabled={isCreatingChat || messages.length === 0}
                    className="flex items-center gap-2 h-9 w-9"
                  >
                    {isCreatingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BrushCleaning className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create a new chat</p>
                  <p className="text-xs opacity-75">Start fresh conversation</p>
                </TooltipContent>
              </Tooltip>
              {/* Admin/Realtor Panel Dropdown - only show for realtor or admin roles */}
              {(session?.user?.role === 'realtor' || session?.user?.role === 'admin') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 h-9 px-2 md:px-3"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm hidden md:inline">Panels</span>
                      <ChevronDown className="w-3 h-3 hidden sm:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => window.open('/realtor', '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Realtor Panel</span>
                    </DropdownMenuItem>
                    {session?.user?.role === 'admin' && (
                      <DropdownMenuItem
                        onClick={() => window.open('/admin', '_blank', 'noopener,noreferrer')}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Admin Panel</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <UserDropdown disabled={isCreatingChat} />
            </div>
          </div>
        </div>

        {/* Error State */}
        <div className="h-full flex items-center justify-center pt-16">
          <div className="text-center px-4">
            <p className="text-destructive mb-2">Failed to load chat</p>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full md:h-screen bg-secondary">
      {/* Header - Hidden on mobile (floating chat has its own header) */}
      <div className="hidden md:block absolute top-0 left-0 right-0 z-50 bg-secondary/80 backdrop-blur-lg px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 mr-4">
            <h1 className="text-xl font-semibold text-foreground truncate">
              Chat
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Project selector */}
            <div className="w-48 flex-shrink-0">
              <ProjectSelector />
            </div>
            {/* Step indicator */}
            <div className="flex-shrink-0">
              <StepIndicator />
            </div>
            <ChatHistoryPopover 
              currentChatId={chatId || ''}
              disabled={isCreatingChat}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCleanUp}
                  variant="outline"
                  size="sm"
                  disabled={isCreatingChat || messages.length === 0}
                  className="flex items-center gap-2 h-9 w-9"
                >
                  {isCreatingChat ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BrushCleaning className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new chat</p>
                <p className="text-xs opacity-75">Start fresh conversation</p>
              </TooltipContent>
            </Tooltip>
            {/* Role-specific buttons */}
            {(session?.user?.role === 'realtor' || session?.user?.role === 'admin') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 h-9 px-3"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm hidden sm:inline">Panels</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => window.open('/realtor', '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Realtor Panel</span>
                  </DropdownMenuItem>
                  {session?.user?.role === 'admin' && (
                    <DropdownMenuItem
                      onClick={() => window.open('/admin', '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Admin Panel</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <UserDropdown disabled={isCreatingChat} />
          </div>
        </div>
      </div>

      {/* Messages Container - No top padding on mobile (no header), reduced bottom padding */}
      <div className="h-full overflow-y-auto px-3 md:px-6 pt-2 md:pt-24 pb-20 md:pb-32 flex flex-col-reverse">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading chat...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">Start a conversation</h3>
              <p className="text-muted-foreground mb-6">Ask me anything about your plots or general questions</p>
              
              <SuggestionBadges
                suggestions={emptySuggestions}
                variant="empty-state"
                onSuggestionClick={(action) => {
                  setInput(action);
                  // Auto-submit the suggestion
                  setTimeout(() => {
                    const form = document.querySelector('form');
                    if (form) {
                      form.requestSubmit();
                    }
                  }, 100);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message: Message, index: number) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'user' ? (
                    /* User message in chat bubble - plain text, no markdown */
                    <div className="bg-primary text-primary-foreground px-4 py-3 rounded-3xl rounded-br-xs">
                      <div className="whitespace-pre-wrap break-words">
                        {typeof message.content === 'string' ? message.content : ''}
                      </div>
                    </div>
                  ) : (
                    /* Assistant message with chronological parts rendering */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <Bot className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Assistant</span>
                      </div>
                      <div className="space-y-2">
                        {/* Render message parts chronologically */}
                        {message.parts && Array.isArray(message.parts) && 
                          message.parts.map((part, partIndex) => 
                            renderMessagePart(part, message.id, partIndex)
                          )
                        }
                        
                        {/* Show suggestions only for last message and when streaming is complete */}
                        {index === messages.length - 1 && isStreamingComplete && (() => {
                          const suggestions = collectSuggestions(message);
                          
                          if (suggestions.length === 0) return null;
                          
                          return (
                            <SuggestionBadges
                              suggestions={suggestions}
                              onSuggestionClick={(action) => {
                                setInput(action);
                                // Auto-submit the suggestion
                                setTimeout(() => {
                                  const form = document.querySelector('form');
                                  if (form) {
                                    form.requestSubmit();
                                  }
                                }, 100);
                              }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-secondary/70 backdrop-blur-lg p-2 md:p-4 pb-1 md:pb-3">
        <form onSubmit={handleFormSubmit} className="flex gap-2 md:gap-3 items-end">
              {/* Plot Context Indicator */}
              {plotId && includePlotContext && (
              <PlotContextIndicator 
                plotId={plotId} 
                onDismiss={() => setIncludePlotContext(false)} 
              />
            )}
            {/* Dropped Pin Indicator */}
            {droppedPinCoords && (
              <button
                type="button"
                onClick={() => {
                  setDroppedPinCoords(null);
                  window.dispatchEvent(new CustomEvent('mapPinRemoved'));
                }}
                className="bg-purple-100 text-purple-700 rounded px-2 py-1 text-xs font-medium hover:bg-purple-200 transition-colors"
                title="Click to remove pin"
              >
                📍 Pin
              </button>
            )}
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about your plots or anything else..."
              className="resize-none rounded-xl pr-12 py-2.5 min-h-[44px] bg-background"
              rows={1}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit(e);
                }
              }}
            />
          </div>
          
          <Button
            type="submit"
            disabled={!input.trim() || isSubmitting || isLoading || remainingQueries <= 0}
            className="font-medium h-[44px] w-[44px] md:w-auto md:px-4 md:pr-6 flex items-center justify-center md:gap-2 flex-shrink-0"
            title={remainingQueries <= 0 ? 'Chat query limit reached' : undefined}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            <span className="hidden md:inline">Send</span>
          </Button>
        </form>
        <div className="hidden md:flex mt-2 px-2 items-center justify-between text-xs text-muted-foreground">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {remainingQueries <= 0 ? (
            <span className="text-destructive font-medium">
              Chat limit reached - Contact admin
            </span>
          ) : (
            <span className="font-mono">
              {remainingQueries} {remainingQueries === 1 ? 'query' : 'queries'} remaining
            </span>
          )}
        </div>
        {/* Compact queries indicator on mobile */}
        <div className="md:hidden mt-1 px-1 text-center">
          {remainingQueries <= 0 ? (
            <span className="text-xs text-destructive font-medium">Limit reached</span>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">{remainingQueries} left</span>
          )}
        </div>
      </div>
    </div>
  );
} 