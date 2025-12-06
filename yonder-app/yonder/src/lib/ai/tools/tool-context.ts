// Shared global context for all tools that need authentication
let globalToolContext: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  chatId: string;
  organizationId?: string;
  plotId?: string;
} | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setToolContext(context: { session: any; user: any; chatId: string; organizationId?: string; plotId?: string }) {
  globalToolContext = context;
}

export function getToolContext() {
  return globalToolContext;
}

export function clearToolContext() {
  globalToolContext = null;
} 