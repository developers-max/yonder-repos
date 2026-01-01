import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../../server/trpc';
import { createTRPCContext } from '../../../../server/trpc/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };

// Increase timeout for long-running operations like PDM processing
// Vercel limits: Pro plan max 300s (5 min), Enterprise max 900s (15 min)
// Must match or exceed PDM_PROCESS_TIMEOUT_MS in yonder-agent-client (900s)
export const maxDuration = 900; // 15 minutes (requires Vercel Enterprise plan) 