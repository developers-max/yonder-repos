"use client";

import * as React from "react";
import { cn } from "@/lib/utils/utils";

type MarqueeProps = React.PropsWithChildren<{
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  vertical?: boolean;
  repeat?: number;
}>;

// Lightweight marquee inspired by Magic UI's API
// https://magicui.design/docs/components/marquee
export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = false,
  vertical = false,
  repeat = 4,
}: MarqueeProps) {
  const items = React.useMemo(() => {
    const childArray = React.Children.toArray(children);
    const minRepeats = Math.max(2, repeat);
    const clones: React.ReactNode[] = [];
    for (let r = 0; r < minRepeats; r += 1) {
      for (let i = 0; i < childArray.length; i += 1) {
        const child = childArray[i];
        clones.push(
          <div
            key={`${r}-${i}`}
            className={cn(
              "shrink-0",
              vertical ? "flex flex-col" : "flex items-center"
            )}
          >
            {child}
          </div>
        );
      }
    }
    return clones;
  }, [children, repeat, vertical]);

  return (
    <div className={cn("relative overflow-hidden")}>
      <div
        className={cn(
          "flex gap-8 will-change-transform",
          vertical ? "flex-col" : "flex-row",
          className
        )}
      >
        <div
          className={cn(
            "flex gap-8 [animation-duration:50s] [animation-timing-function:linear] [animation-iteration-count:infinite]",
            vertical
              ? "flex-col animate-marquee-y"
              : "flex-row animate-marquee-x",
            reverse && "direction-reverse",
            pauseOnHover && "hover:[animation-play-state:paused]"
          )}
        >
          {items}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee-x {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @keyframes marquee-y {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        .animate-marquee-x {
          animation-name: marquee-x;
        }
        .animate-marquee-y {
          animation-name: marquee-y;
        }
        .direction-reverse {
          animation-direction: reverse;
        }
      `}</style>
    </div>
  );
}

export default Marquee;
