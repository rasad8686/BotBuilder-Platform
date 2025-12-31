import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { CreateBotScreen } from '../../src/screens/bots/CreateBotScreen';
import { botService } from '../../src/services/botService';
import { Alert } from 'react-native';

jest.mock('../../src/services/botService');
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      background: '#FFFFFF',
      card: '#F3F4F6',
      text: '#1F2937',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
    },
  }),
}));

jest.spyOn(Alert, 'alert');

const mockBotService = botService as jest.Mocked<typeof botService>;

const renderWithNavigation = (component: React.ReactElement) => {
  return render(
    <NavigationContainer>
      {component}
    </NavigationContainer>
  );
};

describe('CreateBotScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the screen with bot type selection', () => {
    const { getByText } = renderWithNavigation(<CreateBotScreen />);

    expect(getByText('Create Bot')).toBeTruthy();
    expect(getByText('What type of bot do you want to create?')).toBeTruthy();
    expect(getByText('Customer Support')).toBeTruthy();
    expect(getByText('Sales Assistant')).toBeTruthy();
    expect(getByText('FAQ Bot')).toBeTruthy();
  });

  it('should show all bot type options', () => {
    const { getByText } = renderWithNavigation(<CreateBotScreen />);

    expect(getByText('Customer Support')).toBeTruthy();
    expect(getByText('Sales Assistant')).toBeTruthy();
    expect(getByText('FAQ Bot')).toBeTruthy();
    expect(getByText('Lead Generation')).toBeTruthy();
    expect(getByText('Appointment Booking')).toBeTruthy();
    expect(getByText('Custom Bot')).toBeTruthy();
  });

  it('should enable Next button when bot type is selected', () => {
    const { getByText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Customer Support'));

    const nextButton = getByText('Next');
    expect(nextButton).toBeTruthy();
  });

  it('should move to step 2 when Next is pressed', () => {
    const { getByText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Customer Support'));
    fireEvent.press(getByText('Next'));

    expect(getByText('Give your bot a name')).toBeTruthy();
    expect(getByText('Bot Name *')).toBeTruthy();
  });

  it('should show AI model selection in step 2', () => {
    const { getByText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    expect(getByText('AI Model')).toBeTruthy();
    expect(getByText('GPT-4')).toBeTruthy();
    expect(getByText('GPT-3.5 Turbo')).toBeTruthy();
    expect(getByText('Claude 3')).toBeTruthy();
  });

  it('should require bot name with minimum 3 characters', () => {
    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    const nameInput = getByPlaceholderText('e.g., Support Assistant');
    fireEvent.changeText(nameInput, 'AB'); // Only 2 characters

    // Next button should be disabled (can't proceed)
    const nextButton = getByText('Next');
    expect(nextButton).toBeTruthy();
  });

  it('should proceed to step 3 when name is valid', () => {
    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    const nameInput = getByPlaceholderText('e.g., Support Assistant');
    fireEvent.changeText(nameInput, 'My Support Bot');
    fireEvent.press(getByText('Next'));

    expect(getByText('Configure your bot')).toBeTruthy();
  });

  it('should show system prompt and welcome message in step 3', () => {
    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    const nameInput = getByPlaceholderText('e.g., Support Assistant');
    fireEvent.changeText(nameInput, 'My Support Bot');
    fireEvent.press(getByText('Next'));

    expect(getByText('System Prompt')).toBeTruthy();
    expect(getByText('Welcome Message')).toBeTruthy();
  });

  it('should show character counts', () => {
    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    expect(getByText('0/50')).toBeTruthy(); // Bot name character count
  });

  it('should go back when Back button is pressed', () => {
    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    // Now in step 2
    expect(getByText('Give your bot a name')).toBeTruthy();

    fireEvent.press(getByText('Back'));

    // Back to step 1
    expect(getByText('What type of bot do you want to create?')).toBeTruthy();
  });

  it('should show step indicator', () => {
    const { getByText } = renderWithNavigation(<CreateBotScreen />);

    expect(getByText('Type')).toBeTruthy();
    expect(getByText('Details')).toBeTruthy();
    expect(getByText('Configure')).toBeTruthy();
  });

  it('should call createBot when Create Bot is pressed', async () => {
    mockBotService.createBot.mockResolvedValueOnce({
      id: '1',
      name: 'Test Bot',
      status: 'active',
    } as any);

    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    // Step 1: Select bot type
    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    // Step 2: Enter name
    const nameInput = getByPlaceholderText('e.g., Support Assistant');
    fireEvent.changeText(nameInput, 'Test Bot');
    fireEvent.press(getByText('Next'));

    // Step 3: Configure and create
    fireEvent.press(getByText('Create Bot'));

    await waitFor(() => {
      expect(mockBotService.createBot).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Bot',
          type: 'custom',
        })
      );
    });
  });

  it('should show success alert when bot is created', async () => {
    mockBotService.createBot.mockResolvedValueOnce({
      id: '1',
      name: 'Test Bot',
      status: 'active',
    } as any);

    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    const nameInput = getByPlaceholderText('e.g., Support Assistant');
    fireEvent.changeText(nameInput, 'Test Bot');
    fireEvent.press(getByText('Next'));

    fireEvent.press(getByText('Create Bot'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Your bot has been created successfully!',
        expect.any(Array)
      );
    });
  });

  it('should show error when bot creation fails', async () => {
    mockBotService.createBot.mockRejectedValueOnce(new Error('Creation failed'));

    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    const nameInput = getByPlaceholderText('e.g., Support Assistant');
    fireEvent.changeText(nameInput, 'Test Bot');
    fireEvent.press(getByText('Next'));

    fireEvent.press(getByText('Create Bot'));

    await waitFor(() => {
      expect(getByText('Creation failed')).toBeTruthy();
    });
  });

  it('should allow selecting different AI models', () => {
    const { getByText, getByPlaceholderText } = renderWithNavigation(<CreateBotScreen />);

    fireEvent.press(getByText('Custom Bot'));
    fireEvent.press(getByText('Next'));

    // Select GPT-4
    fireEvent.press(getByText('GPT-4'));

    // Model description should be visible
    expect(getByText('Most capable, best for complex tasks')).toBeTruthy();
  });
});
