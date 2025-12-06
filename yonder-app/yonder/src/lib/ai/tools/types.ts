// Simplified tool response interface

export interface ToolResult<TData = unknown> {
  data?: TData;
  error?: ToolError;
  suggestions: ActionSuggestion[];
}

export interface ToolError {
  code: string;
  details?: unknown;
}

export interface ActionSuggestion {
  id: string;
  action: string;
}

// Common error codes
export enum ToolErrorCode {
  AUTHENTICATION_REQUIRED = "AUTH_REQUIRED",
  RESOURCE_NOT_FOUND = "NOT_FOUND", 
  INVALID_PARAMETERS = "INVALID_PARAMS",
  EXTERNAL_API_ERROR = "EXTERNAL_ERROR",
  INSUFFICIENT_PERMISSIONS = "PERMISSIONS",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT",
  UNKNOWN_ERROR = "UNKNOWN"
} 