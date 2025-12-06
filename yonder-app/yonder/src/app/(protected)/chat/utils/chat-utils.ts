import { useRouter } from 'next/navigation';
import { ReadonlyURLSearchParams } from 'next/navigation';

// Helper function to preserve URL parameters
export const getUrlWithParams = (basePath: string, searchParams: ReadonlyURLSearchParams) => {
  const plotId = searchParams.get('plotId');
  if (plotId) {
    return `${basePath}?plotId=${plotId}`;
  }
  return basePath;
};

interface CreateNewChatOptions {
  organizationId: string;
  createChatMutation: {
    mutateAsync: (params: { organizationId: string; title: string }) => Promise<{ id: string }>;
  };
  router: ReturnType<typeof useRouter>;
  searchParams: ReadonlyURLSearchParams;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onFinally?: () => void;
}

export const createNewChat = async ({
  organizationId,
  createChatMutation,
  router,
  searchParams,
  onSuccess,
  onError,
  onFinally
}: CreateNewChatOptions) => {
  if (!organizationId) {
    console.error('No active organization found');
    onError?.(new Error('No active organization found'));
    return;
  }

  try {
    const newChat = await createChatMutation.mutateAsync({
      organizationId,
      title: 'New Chat'
    });
    
    router.push(getUrlWithParams(`/chat/${newChat.id}`, searchParams));
    onSuccess?.();
  } catch (error) {
    console.error('Failed to create new chat:', error);
    // Fallback to old behavior
    router.push(getUrlWithParams('/chat', searchParams));
    onError?.(error);
  } finally {
    onFinally?.();
  }
}; 