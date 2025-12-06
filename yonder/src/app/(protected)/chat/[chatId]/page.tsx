import ChatLayout from '@/app/(protected)/chat/components/shared/chat-layout';

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatId } = await params;

  return <ChatLayout chatId={chatId} />;
} 