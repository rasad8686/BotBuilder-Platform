import { forwardRef } from 'react';
import { motion } from 'framer-motion';

/**
 * AnimatedCard - Card component with entrance and hover animations
 */
const AnimatedCard = forwardRef(({
  children,
  className = '',
  delay = 0,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      whileHover={{
        y: -4,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
      className={`
        bg-white dark:bg-slate-800
        rounded-xl shadow-md
        border border-gray-100 dark:border-slate-700
        transition-colors duration-300
        p-6
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
});

AnimatedCard.displayName = 'AnimatedCard';

export default AnimatedCard;
