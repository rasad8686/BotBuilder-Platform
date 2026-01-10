/**
 * Survey Animation Components
 * Smooth transitions and feedback animations
 */

import React, { useState, useEffect, useRef } from 'react';

// Fade In Animation Wrapper
export const FadeIn = ({
  children,
  delay = 0,
  duration = 300,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-all ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'ease-out'
      }}
    >
      {children}
    </div>
  );
};

// Slide In Animation Wrapper
export const SlideIn = ({
  children,
  direction = 'left',
  delay = 0,
  duration = 300,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)';
    switch (direction) {
      case 'left': return 'translateX(-20px)';
      case 'right': return 'translateX(20px)';
      case 'up': return 'translateY(-20px)';
      case 'down': return 'translateY(20px)';
      default: return 'translateX(-20px)';
    }
  };

  return (
    <div
      className={`transition-all ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'ease-out'
      }}
    >
      {children}
    </div>
  );
};

// Scale In Animation Wrapper
export const ScaleIn = ({
  children,
  delay = 0,
  duration = 300,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-all ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.95)',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'ease-out'
      }}
    >
      {children}
    </div>
  );
};

// Stagger Children Animation
export const StaggerChildren = ({
  children,
  staggerDelay = 50,
  initialDelay = 0,
  className = ''
}) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <FadeIn delay={initialDelay + index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
};

// Question Transition Component
export const QuestionTransition = ({
  children,
  questionIndex,
  direction = 'next',
  className = ''
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const prevIndex = useRef(questionIndex);

  useEffect(() => {
    if (prevIndex.current !== questionIndex) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      prevIndex.current = questionIndex;
      return () => clearTimeout(timer);
    }
    setIsAnimating(false);
  }, [questionIndex]);

  const getTransform = () => {
    if (!isAnimating) return 'translateX(0)';
    return direction === 'next' ? 'translateX(30px)' : 'translateX(-30px)';
  };

  return (
    <div
      className={`transition-all duration-300 ease-out ${className}`}
      style={{
        opacity: isAnimating ? 0 : 1,
        transform: getTransform()
      }}
    >
      {children}
    </div>
  );
};

// Success Animation (Checkmark)
export const SuccessAnimation = ({ size = 80, className = '' }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <svg
      className="checkmark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 52"
      style={{ width: size, height: size }}
    >
      <circle
        className="checkmark-circle"
        cx="26"
        cy="26"
        r="25"
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
      />
      <path
        className="checkmark-check"
        fill="none"
        stroke="#10B981"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.1 27.2l7.1 7.2 16.7-16.8"
      />
    </svg>
    <style>{`
      .checkmark-circle {
        stroke-dasharray: 166;
        stroke-dashoffset: 166;
        animation: checkmark-circle 0.6s ease-in-out forwards;
      }
      .checkmark-check {
        stroke-dasharray: 48;
        stroke-dashoffset: 48;
        animation: checkmark-check 0.3s ease-in-out 0.4s forwards;
      }
      @keyframes checkmark-circle {
        to { stroke-dashoffset: 0; }
      }
      @keyframes checkmark-check {
        to { stroke-dashoffset: 0; }
      }
    `}</style>
  </div>
);

// Error Animation (X mark)
export const ErrorAnimation = ({ size = 80, className = '' }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <svg
      className="error-mark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 52"
      style={{ width: size, height: size }}
    >
      <circle
        className="error-circle"
        cx="26"
        cy="26"
        r="25"
        fill="none"
        stroke="#EF4444"
        strokeWidth="2"
      />
      <path
        className="error-x"
        fill="none"
        stroke="#EF4444"
        strokeWidth="3"
        strokeLinecap="round"
        d="M16 16l20 20M36 16l-20 20"
      />
    </svg>
    <style>{`
      .error-circle {
        stroke-dasharray: 166;
        stroke-dashoffset: 166;
        animation: error-circle 0.6s ease-in-out forwards;
      }
      .error-x {
        stroke-dasharray: 48;
        stroke-dashoffset: 48;
        animation: error-x 0.3s ease-in-out 0.4s forwards;
      }
      @keyframes error-circle {
        to { stroke-dashoffset: 0; }
      }
      @keyframes error-x {
        to { stroke-dashoffset: 0; }
      }
    `}</style>
  </div>
);

// Pulse Animation for highlights
export const PulseAnimation = ({ children, className = '' }) => (
  <div className={`animate-pulse-subtle ${className}`}>
    {children}
    <style>{`
      @keyframes pulse-subtle {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .animate-pulse-subtle {
        animation: pulse-subtle 2s ease-in-out infinite;
      }
    `}</style>
  </div>
);

// Progress Bar Animation
export const AnimatedProgressBar = ({
  progress,
  className = '',
  color = 'bg-indigo-600'
}) => (
  <div className={`h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}>
    <div
      className={`h-full ${color} rounded-full transition-all duration-500 ease-out`}
      style={{ width: `${progress}%` }}
    />
  </div>
);

// Counter Animation
export const AnimatedCounter = ({
  value,
  duration = 1000,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef(null);
  const startValue = useRef(0);

  useEffect(() => {
    startValue.current = displayValue;
    startTime.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = Math.round(startValue.current + (value - startValue.current) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
};

// Shake Animation for errors
export const ShakeAnimation = ({
  children,
  trigger,
  className = ''
}) => {
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <div className={`${isShaking ? 'animate-shake' : ''} ${className}`}>
      {children}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

// Confetti Animation for celebration
export const ConfettiAnimation = ({ active, className = '' }) => {
  if (!active) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none z-50 ${className}`}>
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            backgroundColor: ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899'][Math.floor(Math.random() * 5)]
          }}
        />
      ))}
      <style>{`
        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          opacity: 0;
          animation: confetti-fall 3s ease-out forwards;
        }
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            top: -10px;
            transform: translateX(0) rotateZ(0deg);
          }
          100% {
            opacity: 0;
            top: 100vh;
            transform: translateX(${Math.random() > 0.5 ? '' : '-'}${Math.random() * 200}px) rotateZ(${Math.random() * 720}deg);
          }
        }
      `}</style>
    </div>
  );
};

// Tooltip Animation
export const AnimatedTooltip = ({
  children,
  content,
  position = 'top',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <div
        className={`absolute ${positionClasses[position]} px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap transition-all duration-200 pointer-events-none z-50`}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.95)'
        }}
      >
        {content}
      </div>
    </div>
  );
};

export default {
  FadeIn,
  SlideIn,
  ScaleIn,
  StaggerChildren,
  QuestionTransition,
  SuccessAnimation,
  ErrorAnimation,
  PulseAnimation,
  AnimatedProgressBar,
  AnimatedCounter,
  ShakeAnimation,
  ConfettiAnimation,
  AnimatedTooltip
};
