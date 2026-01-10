import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { validateEmail, validatePassword, validateRequired } from '../utils/formValidation';
import {
  Check, Bot, MessageSquare, Zap, Shield, Globe,
  Eye, EyeOff, Sparkles, TrendingUp, ArrowRight, Building2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://botbuilder-platform.onrender.com';

// Animated Counter Hook
function useAnimatedCounter(end, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(!startOnView);
  const ref = useRef(null);

  useEffect(() => {
    if (startOnView && ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasStarted) {
            setHasStarted(true);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, hasStarted]);

  return { count, ref };
}

// Platform Benefits Data (replaces fake testimonials)
const platformBenefits = [
  {
    icon: 'rocket',
    title: 'Launch in Minutes',
    description: 'Go live with your first chatbot in under 30 minutes'
  },
  {
    icon: 'chart',
    title: 'Reduce Support Load',
    description: 'Automate up to 70% of repetitive customer inquiries'
  },
  {
    icon: 'globe',
    title: 'Omnichannel Ready',
    description: 'Deploy on Web, WhatsApp, SMS, and more from one dashboard'
  }
];

// Company Logos (SVG paths for real companies)
const companyLogos = [
  { name: 'Microsoft', path: 'M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z' },
  { name: 'Stripe', path: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z' },
  { name: 'Shopify', path: 'M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.74a.377.377 0 00-.327-.317c-.135-.012-2.955-.22-2.955-.22s-1.967-1.905-2.18-2.118a.587.587 0 00-.425-.139L12.1 24l3.237-.021zm-3.503-17.94l-.757 2.36s-.906-.421-1.97-.421c-1.593 0-1.673.999-1.673 1.251 0 1.373 3.578 1.9 3.578 5.11 0 2.525-1.603 4.15-3.765 4.15-2.593 0-3.918-1.613-3.918-1.613l.694-2.292s1.363 1.17 2.512 1.17c.75 0 1.055-.591 1.055-1.023 0-1.786-2.935-1.866-2.935-4.81 0-2.473 1.778-4.867 5.367-4.867 1.381 0 2.062.396 2.062.396l-.25.59z' },
  { name: 'Slack', path: 'M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z' },
  { name: 'Notion', path: 'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zM5.251 7.39v14.004c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.457c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.606c.094.42 0 .84-.42.888l-.7.14v10.376c-.607.327-1.167.514-1.634.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.234 4.764 7.28v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933l3.223-.187zM2.197 1.142l13.728-.934c1.681-.14 2.101.046 2.802.56l3.874 2.707c.56.42.747.56.747 1.027v17.39c0 .98-.373 1.54-1.68 1.633l-15.457.933c-.98.046-1.448-.093-1.962-.7l-3.081-3.827C.467 19.118.233 18.625.233 17.926V2.682c0-.7.373-1.447 1.964-1.54z' }
];

// Password Strength Meter Component with Animation
function PasswordStrengthMeter({ password }) {
  const strength = useMemo(() => {
    if (!password) return { level: 0, label: '', color: '', textColor: '' };

    let score = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^a-zA-Z0-9]/.test(password),
      longLength: password.length >= 12
    };

    if (checks.length) score++;
    if (checks.uppercase && checks.lowercase) score++;
    if (checks.number) score++;
    if (checks.special) score++;
    if (checks.longLength) score++;

    if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-500', checks };
    if (score <= 3) return { level: 2, label: 'Fair', color: 'bg-orange-500', textColor: 'text-orange-500', checks };
    if (score <= 4) return { level: 3, label: 'Strong', color: 'bg-green-500', textColor: 'text-green-500', checks };
    return { level: 4, label: 'Excellent', color: 'bg-emerald-500', textColor: 'text-emerald-500', checks };
  }, [password]);

  if (!password) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= strength.level ? strength.color : 'bg-gray-200 dark:bg-slate-700'
            }`}
            style={{
              transform: i <= strength.level ? 'scaleX(1)' : 'scaleX(0.95)',
              opacity: i <= strength.level ? 1 : 0.5
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${strength.textColor}`}>
          {strength.label}
        </span>
        <span className="text-xs text-gray-400">
          {strength.level === 4 && 'Great job!'}
        </span>
      </div>
    </div>
  );
}

// Feature Item Component with Animation
function FeatureItem({ icon: Icon, text, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`flex items-center gap-3 transform transition-all duration-500 ${
        isVisible ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
      }`}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-white/90 text-sm font-medium">{text}</span>
    </div>
  );
}

// Animated Stat Component
function AnimatedStat({ value, suffix, label, delay = 0 }) {
  const { count, ref } = useAnimatedCounter(value, 2000, true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`text-center transform transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="text-3xl font-bold text-white">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-white/60 text-sm mt-1">{label}</div>
    </div>
  );
}

// Benefits Panel Component (replaces fake testimonials)
function BenefitsPanel() {
  return (
    <div className="space-y-4">
      {platformBenefits.map((benefit, index) => (
        <div
          key={index}
          className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-start gap-4 transform transition-all duration-300 hover:bg-white/15 hover:scale-[1.02]"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center flex-shrink-0">
            {benefit.icon === 'rocket' && (
              <Zap className="w-5 h-5 text-white" />
            )}
            {benefit.icon === 'chart' && (
              <TrendingUp className="w-5 h-5 text-white" />
            )}
            {benefit.icon === 'globe' && (
              <Globe className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-1">{benefit.title}</h4>
            <p className="text-white/60 text-xs leading-relaxed">{benefit.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Social Login Button Component
function SocialButton({ icon, children, onClick, variant = 'default', disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
        disabled
          ? 'bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60'
          : variant === 'google'
            ? 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md text-gray-700 dark:bg-slate-800 dark:border-slate-600 dark:text-gray-200 dark:hover:border-slate-500'
            : 'bg-[#2F2F2F] hover:bg-[#3F3F3F] text-white border border-transparent'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

// Floating Input Component
function FloatingInput({ id, type, value, onChange, label, error, icon: Icon, ...props }) {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        {Icon && (
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
            focused ? 'text-purple-500' : 'text-gray-400'
          }`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full ${Icon ? 'pl-12' : 'pl-4'} pr-4 pt-6 pb-2 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-white dark:bg-slate-800 text-gray-900 dark:text-white peer ${
            error
              ? 'border-red-500 focus:border-red-500'
              : focused
                ? 'border-purple-500 ring-4 ring-purple-500/10'
                : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
          }`}
          placeholder=" "
          {...props}
        />
        <label
          htmlFor={id}
          className={`absolute ${Icon ? 'left-12' : 'left-4'} transition-all duration-200 pointer-events-none ${
            focused || hasValue
              ? 'top-2 text-xs font-medium'
              : 'top-1/2 -translate-y-1/2 text-sm'
          } ${
            error
              ? 'text-red-500'
              : focused
                ? 'text-purple-500'
                : 'text-gray-400'
          }`}
        >
          {label}
        </label>
      </div>
      {error && (
        <p className="text-red-500 text-xs mt-1.5 ml-1 flex items-center gap-1" role="alert">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export default function Register() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    agreeToTerms: false
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const navigate = useNavigate();

  // Real-time validation
  const validateField = (field, value) => {
    switch (field) {
      case 'email':
        return validateEmail(value);
      case 'password':
        return validatePassword(value);
      case 'name':
        return validateRequired(value, 'Name');
      default:
        return null;
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleFieldBlur = (field) => {
    const error = validateField(field, formData[field]);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validate fields
    const errors = {};
    const nameError = validateRequired(formData.name, 'Name');
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    if (nameError) errors.name = nameError;
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the terms and privacy policy';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username: formData.name,
        email: formData.email,
        password: formData.password
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        if (response.data.user?.currentOrganizationId) {
          localStorage.setItem('currentOrganizationId', response.data.user.currentOrganizationId);
        }
        navigate('/dashboard');
      } else {
        setError(t('errors.registerNoToken'));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // OAuth login handlers
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const handleMicrosoftLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/microsoft`;
  };

  // Check if email looks like a personal email
  const isPersonalEmail = useMemo(() => {
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
    const domain = formData.email.split('@')[1];
    return personalDomains.includes(domain);
  }, [formData.email]);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900">
      {/* Left Panel - Marketing/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 xl:p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="absolute top-20 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 -right-20 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Bot className="w-7 h-7 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">BotBuilder</span>
          </div>

          {/* Hero Text */}
          <div className="mb-10">
            <h1 className="text-4xl xl:text-5xl font-bold text-white mb-5 leading-tight tracking-tight">
              Build AI Chatbots
              <br />
              <span className="bg-gradient-to-r from-white to-blue-200 text-transparent bg-clip-text">
                in Minutes, Not Months
              </span>
            </h1>
            <p className="text-white/70 text-lg max-w-md leading-relaxed">
              Create powerful conversational AI without writing code. Deploy everywhere instantly.
            </p>
          </div>

          {/* Animated Features */}
          <div className="space-y-4 mb-10">
            <FeatureItem icon={MessageSquare} text="Voice AI & Intelligent Chatbots" delay={100} />
            <FeatureItem icon={Globe} text="Multi-channel (Web, SMS, WhatsApp)" delay={200} />
            <FeatureItem icon={Zap} text="No-code visual bot builder" delay={300} />
            <FeatureItem icon={Shield} text="Enterprise-grade security" delay={400} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 py-6 px-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 mb-8">
            <AnimatedStat value={10000} suffix="+" label="Companies" delay={500} />
            <AnimatedStat value={50} suffix="M+" label="Messages" delay={700} />
            <AnimatedStat value={99} suffix="%" label="Uptime" delay={900} />
          </div>
        </div>

        {/* Benefits Panel (replaces fake testimonials) */}
        <div className="relative z-10 mb-6">
          <h3 className="text-white/80 text-sm font-medium mb-4 uppercase tracking-wider">Why teams choose BotBuilder</h3>
          <BenefitsPanel />
        </div>

        {/* Company Logos */}
        <div className="relative z-10">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-4 font-medium">
            Trusted by industry leaders
          </p>
          <div className="flex items-center gap-8">
            {companyLogos.map((logo, i) => (
              <div
                key={logo.name}
                className="opacity-40 hover:opacity-70 transition-opacity cursor-pointer"
                title={logo.name}
              >
                <svg className="h-6 w-auto" viewBox="0 0 24 24" fill="white">
                  <path d={logo.path} />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white dark:bg-slate-900">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">BotBuilder</span>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
              Start your free trial
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No credit card required. Get started in minutes.
            </p>
          </div>

          {/* Social Login */}
          <div className="space-y-3 mb-6">
            <SocialButton
              onClick={handleGoogleLogin}
              variant="google"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              }
            >
              Continue with Google
            </SocialButton>

            <SocialButton
              onClick={handleMicrosoftLogin}
              variant="microsoft"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M1 1h10v10H1z"/>
                  <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                  <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                  <path fill="#FFB900" d="M13 13h10v10H13z"/>
                </svg>
              }
            >
              Continue with Microsoft
            </SocialButton>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white dark:bg-slate-900 text-gray-400 text-xs uppercase tracking-wider font-medium">
                or register with email
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} role="form" aria-label="Registration form" className="space-y-4">
            {/* Work Email */}
            <FloatingInput
              id="register-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={() => handleFieldBlur('email')}
              label="Work email"
              error={fieldErrors.email}
              required
              aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
              aria-invalid={fieldErrors.email ? 'true' : 'false'}
            />
            {isPersonalEmail && !fieldErrors.email && formData.email && (
              <p className="text-amber-600 dark:text-amber-400 text-xs -mt-2 ml-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Use work email for team collaboration features
              </p>
            )}

            {/* Full Name */}
            <FloatingInput
              id="register-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              label="Full name"
              error={fieldErrors.name}
              required
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              aria-invalid={fieldErrors.name ? 'true' : 'false'}
            />

            {/* Company Name (Optional) */}
            <FloatingInput
              id="register-company"
              type="text"
              value={formData.companyName}
              onChange={(e) => handleFieldChange('companyName', e.target.value)}
              label="Company name (optional)"
              icon={Building2}
            />

            {/* Password */}
            <div className="relative">
              <FloatingInput
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                onBlur={() => handleFieldBlur('password')}
                label="Create password"
                error={fieldErrors.password}
                required
                aria-describedby={fieldErrors.password ? 'reg-password-error' : undefined}
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              <PasswordStrengthMeter password={formData.password} />
            </div>

            {/* Terms & Privacy Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={`w-5 h-5 border-2 rounded-md transition-all duration-200 flex items-center justify-center ${
                    formData.agreeToTerms
                      ? 'bg-purple-600 border-purple-600'
                      : 'border-gray-300 dark:border-slate-600 group-hover:border-purple-400'
                  } ${fieldErrors.agreeToTerms ? 'border-red-500' : ''}`}>
                    {formData.agreeToTerms && (
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" className="text-purple-600 dark:text-purple-400 hover:underline font-medium">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-purple-600 dark:text-purple-400 hover:underline font-medium">Privacy Policy</Link>
                </span>
              </label>
              {fieldErrors.agreeToTerms && (
                <p className="text-red-500 text-xs mt-2 ml-8" role="alert">{fieldErrors.agreeToTerms}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Creating your account...</span>
                </>
              ) : (
                <>
                  <span>Start Free Trial</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-600 dark:text-purple-400 hover:underline font-semibold">
              Sign in
            </Link>
          </p>

          {/* Security Badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Shield className="w-4 h-4 text-green-500" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Check className="w-4 h-4 text-green-500" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Shield className="w-4 h-4 text-green-500" />
              <span>SOC 2 Type II</span>
            </div>
          </div>

          {/* Mobile Stats */}
          <div className="lg:hidden mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">10K+</div>
                <div className="text-xs text-gray-500">Companies</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">50M+</div>
                <div className="text-xs text-gray-500">Messages</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">99%</div>
                <div className="text-xs text-gray-500">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
