'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Button } from '@/app/_components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/_components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/_components/ui/tooltip';
import { 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  History,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { authClient } from '@/lib/auth/auth-client';
import { getUrlWithParams } from '../../utils/chat-utils';

interface ChatHistoryPopoverProps {
  currentChatId: string;
  disabled?: boolean;
}

export default function ChatHistoryPopover({ currentChatId, disabled = false }: ChatHistoryPopoverProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  // Get active organization
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const organizationId = activeOrganization?.id;

  // Get paginated chats
  const { data: chatData, refetch: refetchChats, isLoading: isChatsLoading } = trpc.chat.getUserChats.useQuery({ 
    organizationId: organizationId || "",
    page: currentPage,
    limit: 10
  }, {
    enabled: !!organizationId && isOpen
  });

  // Mutations
  const deleteChatMutation = trpc.chat.deleteChat.useMutation();

  const handleChatClick = (chatId: string) => {
    router.push(getUrlWithParams(`/chat/${chatId}`, searchParams));
    setIsOpen(false);
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    setDeletingChatId(chatId);
    try {
      await deleteChatMutation.mutateAsync({ chatId });
      refetchChats();
      
      // If we're deleting the current chat, redirect to new chat (preserve params)
      if (chatId === currentChatId) {
        router.push(getUrlWithParams('/chat', searchParams));
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    } finally {
      setDeletingChatId(null);
    }
  };

  const formatChatTitle = (title: string | null, createdAt: Date | string) => {
    if (title && title !== 'New Chat') {
      return title;
    }
    return `Chat ${new Date(createdAt).toLocaleDateString()}`;
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const chats = chatData?.chats;
  const pagination = chatData?.pagination;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || !organizationId}
              className="flex items-center gap-2 h-9 w-9"
            >
              <History className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>View chat history</p>
          <p className="text-xs opacity-75">Browse and navigate to previous conversations</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex flex-col h-96">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-foreground">Chat History</h3>
            <p className="text-sm text-muted-foreground">
              {pagination ? `${pagination.totalCount} total chats` : 'Browse your conversations'}
            </p>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto p-2">
            {!organizationId ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select a project to view chats</p>
              </div>
            ) : isChatsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg">
                    <div className="w-4 h-4 bg-muted rounded animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-muted rounded animate-pulse mb-1" />
                      <div className="h-3 bg-muted/50 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chats?.length ? (
              <div className="space-y-1">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent transition-colors",
                      chat.id === currentChatId && "bg-accent"
                    )}
                    onClick={() => handleChatClick(chat.id)}
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {formatChatTitle(chat.title, chat.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      disabled={deletingChatId === chat.id}
                    >
                      {deletingChatId === chat.id ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No chats yet</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
} 