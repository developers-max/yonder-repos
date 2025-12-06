import { Button } from '@/app/_components/ui/button';
import type { ActionSuggestion } from '@/lib/ai/tools/types';

interface SuggestionBadgesProps {
  suggestions: ActionSuggestion[];
  onSuggestionClick: (action: string) => void;
  variant?: 'tool-result' | 'empty-state';
}

export function SuggestionBadges({ 
  suggestions, 
  onSuggestionClick, 
  variant = 'tool-result' 
}: SuggestionBadgesProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const containerClasses = variant === 'empty-state' 
    ? "flex flex-wrap gap-3 justify-center" 
    : "mt-4 pt-4 border-t border-border";

  const buttonClasses = variant === 'empty-state'
    ? "text-sm bg-background/50 hover:bg-background border-border/50 hover:border-border"
    : "";

  return (
    <div className={containerClasses}>
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((suggestion) => (
          <Button
            variant="outline"
            key={suggestion.id}
            onClick={() => onSuggestionClick(suggestion.action)}
            className={buttonClasses}
            size="sm"
          >
            {suggestion.action}
          </Button>
        ))}
      </div>
    </div>
  );
} 