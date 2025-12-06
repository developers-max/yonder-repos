'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Button } from '@/app/_components/ui/button';
import { 
  MessageSquare, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Trash2,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { useSession, signOut, type User, authClient } from '@/lib/auth/auth-client';
import { createNewChat, getUrlWithParams } from '../../utils/chat-utils';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentChatId: string;
}

export default function ChatSidebar({ isOpen, onToggle, currentChatId }: ChatSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const { data: session, isPending: isSessionLoading } = useSession();

  // Get active organization directly from auth client
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const organizationId = activeOrganization?.id;

  // Get user's chats for the current organization
  const { data: chatData, refetch: refetchChats, isLoading: isChatsLoading } = trpc.chat.getUserChats.useQuery({ 
    organizationId: organizationId || "",
    page: 1,
    limit: 50 // Show more chats in sidebar without pagination
  }, {
    enabled: !!organizationId
  });
  
  const chats = chatData?.chats;
  
  // Mutations
  const createChatMutation = trpc.chat.createChat.useMutation();
  const deleteChatMutation = trpc.chat.deleteChat.useMutation();

  const handleNewChat = async () => {
    if (!organizationId) {
      console.error('No active organization selected');
      return;
    }

    await createNewChat({
      organizationId,
      createChatMutation,
      router,
      searchParams,
      onSuccess: () => {
        refetchChats();
        onToggle(); // Close sidebar after creating new chat
      },
      onError: () => {
        onToggle();
      }
    });
  };

  const handleChatClick = (chatId: string) => {
    router.push(getUrlWithParams(`/chat/${chatId}`, searchParams));
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
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const formatChatTitle = (title: string | null, createdAt: Date | string) => {
    if (title && title !== 'New Chat') {
      return title;
    }
    return `Chat ${new Date(createdAt).toLocaleDateString()}`;
  };

  const getUserDisplayName = () => {
    const user = session?.user as User;
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return session?.user?.name || session?.user?.email || 'User';
  };

  const getUserInitials = () => {
    const user = session?.user as User;
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (session?.user?.name) {
      const names = session.user.name.split(' ');
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return session?.user?.email?.[0]?.toUpperCase() || 'U';
  };

  // Skeleton components
  const ChatSkeleton = () => (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-3 rounded-lg">
          <div className="w-4 h-4 bg-sidebar-foreground/20 rounded animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-sidebar-foreground/20 rounded animate-pulse mb-1" />
            <div className="h-3 bg-sidebar-foreground/10 rounded animate-pulse w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );

  const CollapsedChatSkeleton = () => (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="w-8 h-8 rounded bg-sidebar-foreground/20 animate-pulse mx-auto" />
      ))}
    </div>
  );

  const UserSkeleton = () => (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-sidebar-foreground/20 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-sidebar-foreground/20 rounded animate-pulse mb-1" />
        <div className="h-3 bg-sidebar-foreground/10 rounded animate-pulse w-3/4" />
      </div>
      <div className="w-8 h-8 bg-sidebar-foreground/20 rounded animate-pulse" />
    </div>
  );

  const CollapsedUserSkeleton = () => (
    <div className="flex justify-center">
      <div className="w-8 h-8 rounded-full bg-sidebar-foreground/20 animate-pulse" />
    </div>
  );

  return (
    <>
      {/* Sidebar */}
      <div className={cn(
        "bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        isOpen ? "w-60" : "w-16"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            {isOpen && (
              <Button
                onClick={handleNewChat}
                className="flex-1 flex items-center gap-2"
                disabled={createChatMutation.isPending || !organizationId}
              >
                <Plus className="w-4 h-4" />
                New Chat
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="flex-shrink-0 w-8 h-8 p-0"
            >
              {isOpen ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Chat List */}
        <div className={cn(
          "flex-1 overflow-y-auto transition-all duration-300 p-2"
        )}>
          {isOpen ? (
            <>
              {!organizationId ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-sidebar-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-sidebar-foreground/60">Select a project to view chats</p>
                </div>
              ) : isChatsLoading ? (
                <ChatSkeleton />
              ) : chats?.length ? (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent transition-colors mb-1",
                      chat.id === currentChatId && "bg-accent"
                    )}
                    onClick={() => handleChatClick(chat.id)}
                  >
                    <MessageSquare className="w-4 h-4 text-sidebar-foreground/60 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {formatChatTitle(chat.title, chat.createdAt)}
                      </p>
                      <p className="text-xs text-sidebar-foreground/60">
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
                ))
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-sidebar-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-sidebar-foreground/60">No chats yet</p>
                </div>
              )}
            </>
          ) : (
            /* Collapsed view - show chat icons only */
            <>
              {!organizationId || isChatsLoading ? (
                <CollapsedChatSkeleton />
              ) : (
                <div className="space-y-2">
                  {chats?.slice(0, 8).map((chat) => (
                    <Button
                      key={chat.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-8 h-8 p-0 cursor-pointer hover:bg-accent transition-colors mx-auto flex items-center justify-center",
                        chat.id === currentChatId && "bg-accent"
                      )}
                      onClick={() => handleChatClick(chat.id)}
                      title={formatChatTitle(chat.title, chat.createdAt)}
                    >
                      <MessageSquare className="w-4 h-4 text-sidebar-foreground/60" />
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* User Info Section - Fixed at bottom */}
        <div className="border-t border-sidebar-border p-4">
          {isSessionLoading ? (
            isOpen ? <UserSkeleton /> : <CollapsedUserSkeleton />
          ) : isOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-primary">
                  {getUserInitials()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {getUserDisplayName()}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {session?.user?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="w-8 h-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            /* Collapsed view - show only user avatar */
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {getUserInitials()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 