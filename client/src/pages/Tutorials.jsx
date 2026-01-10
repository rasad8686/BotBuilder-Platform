import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { VideoCard, VideoPlayer, TutorialSidebar, ProgressTracker } from '../components/tutorials';
import { BookOpen, Rocket, Smartphone, Bot, Zap, Search } from 'lucide-react';

// Tutorial Data
const tutorials = [
  {
    id: 1,
    title: "İlk Chatbot Yaratma",
    category: "getting-started",
    duration: "5:30",
    difficulty: "Beginner",
    youtubeId: "placeholder",
    description: "BotBuilder-də ilk chatbotunuzu 5 dəqiqəyə yaradın. Bu tutorialda platformanın əsas funksiyalarını öyrənəcək, sadə söhbət axınları qura biləcəksiniz.",
    thumbnail: "/tutorials/placeholder.svg"
  },
  {
    id: 2,
    title: "Telegram Bot İnteqrasiyası",
    category: "channels",
    duration: "8:15",
    difficulty: "Beginner",
    youtubeId: "placeholder",
    description: "Telegram BotFather ilə bot yaradıb BotBuilder-ə qoşun. API token almaq və botunuzu aktivləşdirmək addımlarını əhatə edir."
  },
  {
    id: 3,
    title: "WhatsApp Business API Setup",
    category: "channels",
    duration: "12:00",
    difficulty: "Intermediate",
    youtubeId: "placeholder",
    description: "Meta Business ilə WhatsApp inteqrasiyası. Business hesab yaratmaq, API əldə etmək və mesaj şablonları hazırlamaq prosesini öyrənin."
  },
  {
    id: 4,
    title: "Multi-Agent AI Sistemləri",
    category: "ai-features",
    duration: "15:30",
    difficulty: "Advanced",
    youtubeId: "placeholder",
    description: "Bir neçə AI agenti birlikdə işlətmək. Kompleks tapşırıqları həll etmək üçün agentləri necə əlaqələndirəcəyinizi öyrənin."
  },
  {
    id: 5,
    title: "Voice AI - Səsli Bot",
    category: "ai-features",
    duration: "10:45",
    difficulty: "Intermediate",
    youtubeId: "placeholder",
    description: "Gladia STT ilə səsli chatbot yaratma. Səs tanıma, sintez və real-time danışıq imkanlarını kəşf edin."
  },
  {
    id: 6,
    title: "Knowledge Base & RAG",
    category: "ai-features",
    duration: "14:00",
    difficulty: "Advanced",
    youtubeId: "placeholder",
    description: "Sənədlərdən məlumat çəkən AI. RAG (Retrieval Augmented Generation) ilə öz bilik bazanızı yaradın."
  },
  {
    id: 7,
    title: "Stripe Ödəniş İnteqrasiyası",
    category: "advanced",
    duration: "8:00",
    difficulty: "Intermediate",
    youtubeId: "placeholder",
    description: "Subscription billing qurulumu. Stripe ilə ödəniş qəbul etmək və abunəlik idarə etmək."
  },
  {
    id: 8,
    title: "Webhook & API İstifadəsi",
    category: "advanced",
    duration: "11:20",
    difficulty: "Advanced",
    youtubeId: "placeholder",
    description: "External sistemlərlə inteqrasiya. REST API-lər, webhook-lar və data transformasiyası haqqında ətraflı məlumat."
  }
];

const categories = [
  { id: 'all', label: 'Hamısı', Icon: BookOpen },
  { id: 'getting-started', label: 'Başlanğıc', Icon: Rocket },
  { id: 'channels', label: 'Kanallar', Icon: Smartphone },
  { id: 'ai-features', label: 'AI Features', Icon: Bot },
  { id: 'advanced', label: 'Advanced', Icon: Zap }
];

const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const sortOptions = [
  { id: 'default', label: 'Default' },
  { id: 'newest', label: 'Ən Yeni' },
  { id: 'popular', label: 'Populyar' },
  { id: 'duration-asc', label: 'Qısa → Uzun' },
  { id: 'duration-desc', label: 'Uzun → Qısa' }
];

// Helper to parse duration string to seconds
const parseDuration = (duration) => {
  const parts = duration.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

// LocalStorage helpers
const STORAGE_KEYS = {
  COMPLETED: 'botbuilder_completed_tutorials',
  LAST_WATCHED: 'botbuilder_last_watched_tutorial'
};

const getCompletedTutorials = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.COMPLETED);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setCompletedTutorials = (ids) => {
  localStorage.setItem(STORAGE_KEYS.COMPLETED, JSON.stringify(ids));
};

const getLastWatched = () => {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEYS.LAST_WATCHED)) || null;
  } catch {
    return null;
  }
};

const setLastWatched = (id) => {
  localStorage.setItem(STORAGE_KEYS.LAST_WATCHED, String(id));
};

export default function Tutorials() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [completedTutorials, setCompletedTutorialsState] = useState(getCompletedTutorials);
  const [lastWatched, setLastWatchedState] = useState(getLastWatched);
  const [showSidebar, setShowSidebar] = useState(false);

  // If we have an ID, we're in video player mode
  const isVideoMode = !!id;
  const currentTutorial = tutorials.find(t => t.id === parseInt(id));

  // Set last watched when viewing a tutorial
  useEffect(() => {
    if (currentTutorial) {
      setLastWatched(currentTutorial.id);
      setLastWatchedState(currentTutorial.id);
    }
  }, [currentTutorial]);

  // Filter and sort tutorials
  const filteredTutorials = useMemo(() => {
    let result = [...tutorials];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== 'All') {
      result = result.filter(t => t.difficulty === selectedDifficulty);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result = result.reverse();
        break;
      case 'duration-asc':
        result = result.sort((a, b) => parseDuration(a.duration) - parseDuration(b.duration));
        break;
      case 'duration-desc':
        result = result.sort((a, b) => parseDuration(b.duration) - parseDuration(a.duration));
        break;
      default:
        break;
    }

    return result;
  }, [searchQuery, selectedCategory, selectedDifficulty, sortBy]);

  // Mark tutorial as complete
  const handleMarkComplete = (tutorialId) => {
    const newCompleted = completedTutorials.includes(tutorialId)
      ? completedTutorials
      : [...completedTutorials, tutorialId];
    setCompletedTutorials(newCompleted);
    setCompletedTutorialsState(newCompleted);
  };

  // Get related tutorials (same category, different id)
  const getRelatedTutorials = (tutorial) => {
    return tutorials
      .filter(t => t.category === tutorial.category && t.id !== tutorial.id)
      .slice(0, 3);
  };

  // Get "Continue Learning" tutorial
  const continueLearningTutorial = lastWatched
    ? tutorials.find(t => t.id === lastWatched)
    : null;

  // Video Player View
  if (isVideoMode && currentTutorial) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setShowSidebar(true)}
          className="lg:hidden fixed bottom-4 right-4 z-50 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        <div className="max-w-screen-2xl mx-auto flex">
          {/* Main Content */}
          <div className="flex-1 p-4 lg:p-6">
            {/* Back Button */}
            <Link
              to="/academy"
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 mb-4 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              Bütün Tutoriallar
            </Link>

            <VideoPlayer
              tutorial={currentTutorial}
              isCompleted={completedTutorials.includes(currentTutorial.id)}
              onMarkComplete={() => handleMarkComplete(currentTutorial.id)}
              relatedTutorials={getRelatedTutorials(currentTutorial)}
            />
          </div>

          {/* Sidebar - Desktop */}
          <div className="hidden lg:block w-80 p-4 lg:p-6">
            <div className="sticky top-6">
              <TutorialSidebar
                tutorials={tutorials}
                currentTutorialId={currentTutorial.id}
                completedTutorials={completedTutorials}
              />
            </div>
          </div>

          {/* Sidebar - Mobile Overlay */}
          {showSidebar && (
            <>
              <div
                className="lg:hidden fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowSidebar(false)}
              />
              <div className="lg:hidden fixed right-0 top-0 h-full w-80 z-50">
                <TutorialSidebar
                  tutorials={tutorials}
                  currentTutorialId={currentTutorial.id}
                  completedTutorials={completedTutorials}
                  onClose={() => setShowSidebar(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Grid View (Tutorial List)
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-3">
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              BotBuilder Academy
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Step-by-step video tutoriallarla BotBuilder-in bütün funksiyalarını öyrənin
          </p>
        </div>

        {/* Progress Overview */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mb-8 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <ProgressTracker
              completed={completedTutorials.length}
              total={tutorials.length}
              size="lg"
              showCertificate={true}
            />

            {/* Continue Learning */}
            {continueLearningTutorial && !completedTutorials.includes(continueLearningTutorial.id) && (
              <div className="flex-1 max-w-md">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Davam edin
                </p>
                <Link
                  to={`/academy/${continueLearningTutorial.id}`}
                  className="flex items-center gap-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors group"
                >
                  <div className="w-16 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate transition-colors">
                      {continueLearningTutorial.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {continueLearningTutorial.duration}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-md">
          {/* Search Bar */}
          <div className="relative mb-4">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Tutorial axtar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-slate-700 border-0 rounded-xl text-gray-800 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`
                  px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200
                  ${selectedCategory === cat.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }
                `}
              >
                {cat.Icon && <cat.Icon size={14} className="inline mr-1" />}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Difficulty & Sort */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Səviyyə:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-gray-100 dark:bg-slate-700 border-0 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500"
              >
                {difficulties.map((d) => (
                  <option key={d} value={d}>{d === 'All' ? 'Hamısı' : d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Sırala:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-100 dark:bg-slate-700 border-0 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {filteredTutorials.length} tutorial tapıldı
            </div>
          </div>
        </div>

        {/* Video Grid */}
        {filteredTutorials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTutorials.map((tutorial) => (
              <VideoCard
                key={tutorial.id}
                tutorial={tutorial}
                isCompleted={completedTutorials.includes(tutorial.id)}
                onClick={() => {
                  setLastWatched(tutorial.id);
                  setLastWatchedState(tutorial.id);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4"><Search size={64} className="mx-auto text-gray-400" /></div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Tutorial tapılmadı
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Axtarış kriteriyalarını dəyişdirin
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedDifficulty('All');
              }}
              className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Filterləri Sıfırla
            </button>
          </div>
        )}

        {/* All Complete Certificate Placeholder */}
        {completedTutorials.length === tutorials.length && (
          <div className="mt-12 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-2xl p-8 text-center text-white shadow-xl">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold mb-2">Təbrik edirik!</h2>
            <p className="text-lg opacity-90 mb-4">
              Bütün tutorialları tamamladınız!
            </p>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="font-semibold">BotBuilder Master Certificate</span>
            </div>
            <p className="mt-4 text-sm opacity-75">
              Sertifikat tezliklə email ilə göndəriləcək
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
