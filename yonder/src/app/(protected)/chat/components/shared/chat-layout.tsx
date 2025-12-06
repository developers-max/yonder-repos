'use client';

import { trpc } from '@/trpc/client';
import ChatInterface from './chat-interface';
import type { Message } from 'ai';

interface ChatLayoutProps {
  chatId: string;
}

export default function ChatLayout({ chatId }: ChatLayoutProps) {
  // Load the specific chat
  const { data: chatData, isLoading, error } = trpc.chat.getChat.useQuery({
    chatId,
  });

  return (
    <ChatInterface 
      chatId={chatId}
      initialMessages={(chatData?.messages || []) as Message[]}
      isLoading={isLoading}
      error={error?.message}
    />
  );
} 