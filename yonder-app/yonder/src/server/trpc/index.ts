import { router } from './trpc';
import { plotsRouter } from './router/plot/plots';
import { chatRouter } from './router/chat';
import { projectsRouter } from './router/projects';
import { processStepsRouter } from './router/process-steps';
import { adminRouter } from './router/admin';
import { realtorRouter } from './router/realtor';

export const appRouter = router({
  plots: plotsRouter,
  chat: chatRouter,
  projects: projectsRouter,
  processSteps: processStepsRouter,
  admin: adminRouter,
  realtor: realtorRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
