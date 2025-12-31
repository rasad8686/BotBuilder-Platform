import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../../components/ui';
import { botService } from '../../services/botService';

const botTypes = [
  {
    key: 'customer-support',
    label: 'Customer Support',
    description: 'Handle customer inquiries and support tickets',
    icon: 'headset',
    color: '#3B82F6',
  },
  {
    key: 'sales',
    label: 'Sales Assistant',
    description: 'Help with product recommendations and sales',
    icon: 'cart',
    color: '#10B981',
  },
  {
    key: 'faq',
    label: 'FAQ Bot',
    description: 'Answer frequently asked questions',
    icon: 'help-circle',
    color: '#F59E0B',
  },
  {
    key: 'lead-gen',
    label: 'Lead Generation',
    description: 'Capture and qualify leads',
    icon: 'people',
    color: '#8B5CF6',
  },
  {
    key: 'appointment',
    label: 'Appointment Booking',
    description: 'Schedule appointments and meetings',
    icon: 'calendar',
    color: '#EC4899',
  },
  {
    key: 'custom',
    label: 'Custom Bot',
    description: 'Build a custom bot from scratch',
    icon: 'construct',
    color: '#6B7280',
  },
];

const aiModels = [
  { key: 'gpt-4', label: 'GPT-4', description: 'Most capable, best for complex tasks' },
  { key: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
  { key: 'claude-3', label: 'Claude 3', description: 'Great for analysis and writing' },
];

export const CreateBotScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();

  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const canProceed = useCallback(() => {
    switch (step) {
      case 1:
        return selectedType !== null;
      case 2:
        return name.trim().length >= 3;
      case 3:
        return true; // Optional configuration
      default:
        return false;
    }
  }, [step, selectedType, name]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleCreate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      setError(null);

      await botService.createBot({
        name: name.trim(),
        description: description.trim(),
        type: selectedType!,
        model: selectedModel,
        systemPrompt: systemPrompt.trim() || undefined,
        welcomeMessage: welcomeMessage.trim() || undefined,
      });

      Alert.alert(
        'Success',
        'Your bot has been created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || 'Failed to create bot');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor: s <= step ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            {s < step ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : (
              <Text style={[styles.stepNumber, { color: s <= step ? '#fff' : theme.colors.textSecondary }]}>
                {s}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              { color: s <= step ? theme.colors.text : theme.colors.textSecondary },
            ]}
          >
            {s === 1 ? 'Type' : s === 2 ? 'Details' : 'Configure'}
          </Text>
          {s < 3 && (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: s < step ? theme.colors.primary : theme.colors.border },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        What type of bot do you want to create?
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        Choose a template to get started quickly
      </Text>

      <View style={styles.typeGrid}>
        {botTypes.map((type) => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.typeCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: selectedType === type.key ? type.color : theme.colors.border,
                borderWidth: selectedType === type.key ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedType(type.key)}
          >
            <View style={[styles.typeIcon, { backgroundColor: type.color + '15' }]}>
              <Ionicons name={type.icon as any} size={24} color={type.color} />
            </View>
            <Text style={[styles.typeLabel, { color: theme.colors.text }]}>{type.label}</Text>
            <Text style={[styles.typeDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {type.description}
            </Text>
            {selectedType === type.key && (
              <View style={[styles.typeSelected, { backgroundColor: type.color }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Give your bot a name
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        This will help you identify your bot
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Bot Name *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.card,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="e.g., Support Assistant"
          placeholderTextColor={theme.colors.textSecondary}
          maxLength={50}
        />
        <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
          {name.length}/50
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: theme.colors.card,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what your bot does..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
        <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
          {description.length}/200
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>AI Model</Text>
        {aiModels.map((model) => (
          <TouchableOpacity
            key={model.key}
            style={[
              styles.modelOption,
              {
                backgroundColor: theme.colors.card,
                borderColor: selectedModel === model.key ? theme.colors.primary : theme.colors.border,
                borderWidth: selectedModel === model.key ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedModel(model.key)}
          >
            <View style={styles.modelInfo}>
              <Text style={[styles.modelLabel, { color: theme.colors.text }]}>{model.label}</Text>
              <Text style={[styles.modelDescription, { color: theme.colors.textSecondary }]}>
                {model.description}
              </Text>
            </View>
            <View
              style={[
                styles.radioOuter,
                { borderColor: selectedModel === model.key ? theme.colors.primary : theme.colors.border },
              ]}
            >
              {selectedModel === model.key && (
                <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Configure your bot
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        Customize how your bot behaves (optional)
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>System Prompt</Text>
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          Instructions that define your bot's personality and behavior
        </Text>
        <TextInput
          style={[
            styles.textArea,
            styles.tallTextArea,
            {
              backgroundColor: theme.colors.card,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="You are a helpful assistant that..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={5}
          maxLength={1000}
        />
        <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
          {systemPrompt.length}/1000
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Welcome Message</Text>
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          The first message users see when starting a conversation
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: theme.colors.card,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          value={welcomeMessage}
          onChangeText={setWelcomeMessage}
          placeholder="Hello! How can I help you today?"
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
        <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
          {welcomeMessage.length}/500
        </Text>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '15' }]}>
          <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create Bot</Text>
        <View style={styles.backButton} />
      </View>

      {renderStepIndicator()}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: theme.colors.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.backBtnText, { color: theme.colors.text }]}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.nextBtn,
            {
              backgroundColor: canProceed() ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={handleNext}
          disabled={!canProceed() || isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === 3 ? 'Create Bot' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepLabel: {
    fontSize: 12,
    marginLeft: 6,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  typeCard: {
    width: '47%',
    marginHorizontal: '1.5%',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    position: 'relative',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  typeSelected: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  tallTextArea: {
    minHeight: 120,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  modelInfo: {
    flex: 1,
  },
  modelLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  modelDescription: {
    fontSize: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  backBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 2,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateBotScreen;
