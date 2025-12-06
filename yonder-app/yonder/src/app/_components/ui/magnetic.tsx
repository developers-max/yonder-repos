"use client";

import { useRef } from "react";
import { motion, useSpring } from "motion/react";

const SPRING_CONFIG = { damping: 30, stiffness: 300, mass: 0.8 };

interface MagneticProps {
  children: React.ReactNode;
  intensity?: number;
  range?: number;
  actionArea?: "self" | "parent" | "global";
  springOptions?: typeof SPRING_CONFIG;
  className?: string;
}

export function Magnetic({
  children,
  intensity = 0.6,
  range = 100,
  actionArea = "self",
  springOptions = SPRING_CONFIG,
  className,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  const x = useSpring(0, springOptions);
  const y = useSpring(0, springOptions);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

    if (distance < range) {
      const scale = 1 - distance / range;
      x.set(distanceX * intensity * scale);
      y.set(distanceY * intensity * scale);
    } else {
      x.set(0);
      y.set(0);
    }
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const eventHandlers =
    actionArea === "self"
      ? {
          onMouseMove: handleMouseMove,
          onMouseLeave: handleMouseLeave,
        }
      : {};

  const parentEventHandlers =
    actionArea === "parent"
      ? {
          onMouseMove: handleMouseMove,
          onMouseLeave: handleMouseLeave,
        }
      : {};

  if (actionArea === "parent") {
    return (
      <div {...parentEventHandlers} className={className}>
        <motion.div ref={ref} style={{ x, y }}>
          {children}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      {...eventHandlers}
      className={className}
    >
      {children}
    </motion.div>
  );
}
