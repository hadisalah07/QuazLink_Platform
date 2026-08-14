import { Variants } from "framer-motion"

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export const glassHover: Variants = {
  initial: { scale: 1, backgroundColor: "rgba(255, 255, 255, 0.05)" },
  hover: { scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.08)" }
}
