"use client"

import { cn } from "@/lib/utils/utils"

export interface Step {
  number: number
  label: string
  status: "completed" | "current" | "upcoming"
}

interface ProgressStepperProps {
  title?: string
  steps: Step[]
  className?: string
  size?: "sm" | "md" | "lg"
  onStepClick?: (index: number) => void
}

export function ProgressStepper({ title, steps, className, size = "sm", onStepClick }: ProgressStepperProps) {
  // Resolve sizes
  const circleSize = size === "lg" ? "size-16 text-2xl" : size === "md" ? "size-12 text-xl" : "size-8 text-base";
  const ringClass = size === "lg" ? "ring-4" : size === "md" ? "ring-4" : "ring-2";
  const gapY = size === "lg" ? "gap-4" : size === "md" ? "gap-3" : "gap-2";
  const labelMaxW = size === "lg" ? "max-w-[180px]" : size === "md" ? "max-w-[160px]" : "max-w-[140px]";
  // Bar top offset to align with circle center
  const barTop = size === "lg" ? "top-8" : size === "md" ? "top-6" : "top-4";

  // Determine current index (first current, else last completed, else 0)
  const currentIndex = (() => {
    const idx = steps.findIndex((s) => s.status === "current");
    if (idx >= 0) return idx;
    const lastCompleted = [...steps].reverse().findIndex((s) => s.status === "completed");
    if (lastCompleted >= 0) return steps.length - 1 - lastCompleted;
    return 0;
  })();

  const progressWidth = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div className={cn("w-full", className)}>
      {!!title && <h2 className="text-base font-semibold mb-2">{title}</h2>}

      <div className="relative">
        {/* Progress line */}
        <div className={cn("absolute left-0 right-0 h-1 bg-muted rounded", barTop)}>
          <div
            className="h-full bg-foreground rounded transition-all duration-500"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className={cn("flex flex-col items-center", gapY)}>
              {/* Step circle */}
              <button
                type="button"
                onClick={onStepClick ? () => onStepClick(index) : undefined}
                className={cn(
                  "rounded-full flex items-center justify-center transition-all duration-300 z-10 border",
                  circleSize,
                  step.status === "completed" && "bg-foreground text-background border-foreground/80",
                  step.status === "current" && cn("bg-foreground text-background", ringClass, "ring-foreground/20 border-foreground"),
                  step.status === "upcoming" && "bg-muted text-muted-foreground border-border",
                  onStepClick && "cursor-pointer hover:opacity-90"
                )}
                aria-current={step.status === "current" ? "step" : undefined}
                aria-label={`Step ${step.number}: ${step.label}`}
              >
                {step.number}
              </button>

              {/* Step label */}
              <div className={cn("text-center", labelMaxW)}>
                <p
                  className={cn(
                    "text-[11px] sm:text-sm leading-tight truncate",
                    step.status === "completed" && "text-foreground",
                    step.status === "current" && "text-foreground font-semibold",
                    step.status === "upcoming" && "text-muted-foreground",
                  )}
                  title={step.label}
                >
                  {step.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}