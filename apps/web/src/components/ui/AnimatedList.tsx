"use client";

import React, { ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedListProps {
  children: ReactNode[];
  className?: string;
  delay?: number;
}

export function AnimatedList({ children, className = "", delay = 0 }: AnimatedListProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: delay,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, x: -20 },
    show: { 
        opacity: 1, 
        x: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 24 }
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
