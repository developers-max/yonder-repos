import ChatInterface from './components/shared/chat-interface';

export default function ChatPage() {
  return (
    <ChatInterface 
      chatId=""
      initialMessages={[]}
      isLoading={false}
      error={undefined}
    />
  );
} 