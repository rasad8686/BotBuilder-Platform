import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Card, EmptyState } from '../../components/ui';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface HelpCategory {
  key: string;
  label: string;
  icon: string;
  color: string;
}

const categories: HelpCategory[] = [
  { key: 'getting-started', label: 'Getting Started', icon: 'rocket', color: '#3B82F6' },
  { key: 'bots', label: 'Bots & AI', icon: 'chatbubbles', color: '#10B981' },
  { key: 'integrations', label: 'Integrations', icon: 'link', color: '#8B5CF6' },
  { key: 'billing', label: 'Billing', icon: 'card', color: '#F59E0B' },
  { key: 'account', label: 'Account', icon: 'person', color: '#EC4899' },
  { key: 'troubleshooting', label: 'Troubleshooting', icon: 'construct', color: '#EF4444' },
];

const faqData: FAQItem[] = [
  {
    id: '1',
    question: 'How do I create my first bot?',
    answer: 'Go to the Bots tab and tap the "+" button. Choose a template or start from scratch, give your bot a name, and configure its settings. You can customize the AI model, system prompt, and welcome message.',
    category: 'getting-started',
  },
  {
    id: '2',
    question: 'What AI models are available?',
    answer: 'We support GPT-4, GPT-3.5 Turbo, and Claude 3. GPT-4 is best for complex tasks, GPT-3.5 Turbo is fast and cost-effective, and Claude 3 excels at analysis and writing.',
    category: 'bots',
  },
  {
    id: '3',
    question: 'How do I connect my bot to Slack?',
    answer: 'Go to your bot\'s settings, tap "Channels", and select Slack. Follow the OAuth flow to authorize the connection. Once connected, your bot will respond to messages in the selected Slack channels.',
    category: 'integrations',
  },
  {
    id: '4',
    question: 'How is billing calculated?',
    answer: 'Billing is based on the number of messages processed by your bots and the AI model used. GPT-4 messages cost more than GPT-3.5 Turbo. View your current usage in Settings > Billing.',
    category: 'billing',
  },
  {
    id: '5',
    question: 'How do I change my email address?',
    answer: 'Go to Settings > Account > Edit Profile. Enter your new email address and verify it via the confirmation link sent to your inbox. Your old email will remain active until verification is complete.',
    category: 'account',
  },
  {
    id: '6',
    question: 'My bot is not responding. What should I do?',
    answer: 'First, check if your bot is enabled. Then verify your API keys are valid in Settings. If the issue persists, check the bot\'s logs for error messages or contact support.',
    category: 'troubleshooting',
  },
  {
    id: '7',
    question: 'Can I use my own OpenAI API key?',
    answer: 'Yes! Go to Settings > API Keys and enter your OpenAI API key. This allows you to use your own quota and potentially reduce costs.',
    category: 'integrations',
  },
  {
    id: '8',
    question: 'How do I train my bot with custom data?',
    answer: 'Navigate to your bot\'s Knowledge Base section. You can upload documents, add website URLs, or paste text directly. The bot will use this information to provide more accurate responses.',
    category: 'bots',
  },
  {
    id: '9',
    question: 'What happens if I exceed my message limit?',
    answer: 'You\'ll receive a notification when approaching your limit. Once exceeded, bots will be paused until you upgrade your plan or the next billing cycle begins.',
    category: 'billing',
  },
  {
    id: '10',
    question: 'How do I delete my account?',
    answer: 'Go to Settings > Account > Delete Account. This action is permanent and will remove all your bots, data, and conversations. Make sure to export any important data first.',
    category: 'account',
  },
];

const quickActions = [
  {
    icon: 'mail',
    label: 'Email Support',
    description: 'Get help via email',
    action: 'mailto:support@botbuilder.com',
  },
  {
    icon: 'chatbubble-ellipses',
    label: 'Live Chat',
    description: 'Chat with our team',
    action: 'chat',
  },
  {
    icon: 'book',
    label: 'Documentation',
    description: 'Browse our docs',
    action: 'https://docs.botbuilder.com',
  },
  {
    icon: 'videocam',
    label: 'Video Tutorials',
    description: 'Watch how-to videos',
    action: 'https://youtube.com/@botbuilder',
  },
];

export const HelpCenterScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredFAQs = faqData.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'chat') {
      // Open live chat (implement based on your chat solution)
      Alert.alert('Live Chat', 'Live chat feature coming soon!');
    } else if (action.startsWith('mailto:') || action.startsWith('http')) {
      Linking.openURL(action);
    }
  };

  const renderCategoryChip = ({ item }: { item: HelpCategory }) => (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        {
          backgroundColor:
            selectedCategory === item.key ? item.color : theme.colors.card,
        },
      ]}
      onPress={() => setSelectedCategory(selectedCategory === item.key ? null : item.key)}
    >
      <Ionicons
        name={item.icon as any}
        size={16}
        color={selectedCategory === item.key ? '#fff' : item.color}
      />
      <Text
        style={[
          styles.categoryChipText,
          { color: selectedCategory === item.key ? '#fff' : theme.colors.text },
        ]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderFAQItem = ({ item }: { item: FAQItem }) => {
    const isExpanded = expandedFAQ === item.id;
    const category = categories.find((c) => c.key === item.category);

    return (
      <TouchableOpacity
        style={[styles.faqItem, { backgroundColor: theme.colors.card }]}
        onPress={() => setExpandedFAQ(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.faqHeader}>
          <View style={styles.faqQuestion}>
            <View style={[styles.categoryDot, { backgroundColor: category?.color || theme.colors.primary }]} />
            <Text style={[styles.faqQuestionText, { color: theme.colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
              {item.question}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors.textSecondary}
          />
        </View>
        {isExpanded && (
          <View style={styles.faqAnswer}>
            <Text style={[styles.faqAnswerText, { color: theme.colors.textSecondary }]}>
              {item.answer}
            </Text>
            <View style={styles.faqActions}>
              <TouchableOpacity style={[styles.helpfulButton, { borderColor: theme.colors.border }]}>
                <Ionicons name="thumbs-up-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.helpfulText, { color: theme.colors.textSecondary }]}>Helpful</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.helpfulButton, { borderColor: theme.colors.border }]}>
                <Ionicons name="thumbs-down-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.helpfulText, { color: theme.colors.textSecondary }]}>Not helpful</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Help Center</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.card }]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search for help..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.quickActionCard, { backgroundColor: theme.colors.card }]}
              onPress={() => handleQuickAction(action.action)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name={action.icon as any} size={22} color={theme.colors.primary} />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]}>{action.label}</Text>
              <Text style={[styles.quickActionDescription, { color: theme.colors.textSecondary }]}>
                {action.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Categories */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Browse by Topic</Text>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item.key}
          renderItem={renderCategoryChip}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />

        {/* FAQs */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {selectedCategory
            ? `${categories.find((c) => c.key === selectedCategory)?.label} FAQs`
            : 'Frequently Asked Questions'}
        </Text>

        {filteredFAQs.length === 0 ? (
          <EmptyState
            icon="help-circle-outline"
            title="No Results Found"
            description="Try adjusting your search or browse by category"
          />
        ) : (
          filteredFAQs.map((item) => (
            <View key={item.id}>{renderFAQItem({ item })}</View>
          ))
        )}

        {/* Contact Support */}
        <View style={[styles.contactCard, { backgroundColor: theme.colors.primary + '10' }]}>
          <Ionicons name="headset" size={32} color={theme.colors.primary} />
          <Text style={[styles.contactTitle, { color: theme.colors.text }]}>
            Still need help?
          </Text>
          <Text style={[styles.contactDescription, { color: theme.colors.textSecondary }]}>
            Our support team is here to assist you 24/7
          </Text>
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => Linking.openURL('mailto:support@botbuilder.com')}
          >
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  quickActionCard: {
    width: '47%',
    marginHorizontal: '1.5%',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  categoriesList: {
    marginBottom: 24,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  faqItem: {
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 10,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 34,
  },
  faqAnswerText: {
    fontSize: 14,
    lineHeight: 22,
  },
  faqActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  helpfulText: {
    fontSize: 12,
  },
  contactCard: {
    marginTop: 24,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  contactDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  contactButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Add missing Alert import
import { Alert } from 'react-native';

export default HelpCenterScreen;
