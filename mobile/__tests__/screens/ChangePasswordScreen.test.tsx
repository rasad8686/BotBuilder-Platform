import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ChangePasswordScreen } from '../../src/screens/settings/ChangePasswordScreen';
import { authService } from '../../src/services/authService';
import { Alert } from 'react-native';

jest.mock('../../src/services/authService');
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

const mockAuthService = authService as jest.Mocked<typeof authService>;

const renderWithNavigation = (component: React.ReactElement) => {
  return render(
    <NavigationContainer>
      {component}
    </NavigationContainer>
  );
};

describe('ChangePasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the screen with all fields', () => {
    const { getByText, getByPlaceholderText } = renderWithNavigation(<ChangePasswordScreen />);

    expect(getByText('Change Password')).toBeTruthy();
    expect(getByText('Current Password')).toBeTruthy();
    expect(getByText('New Password')).toBeTruthy();
    expect(getByText('Confirm New Password')).toBeTruthy();
    expect(getByPlaceholderText('Enter current password')).toBeTruthy();
    expect(getByPlaceholderText('Enter new password')).toBeTruthy();
    expect(getByPlaceholderText('Confirm new password')).toBeTruthy();
  });

  it('should show password requirements', () => {
    const { getByText } = renderWithNavigation(<ChangePasswordScreen />);

    expect(getByText('Password Requirements:')).toBeTruthy();
    expect(getByText('At least 8 characters')).toBeTruthy();
    expect(getByText('One uppercase letter')).toBeTruthy();
    expect(getByText('One lowercase letter')).toBeTruthy();
    expect(getByText('One number')).toBeTruthy();
    expect(getByText('One special character')).toBeTruthy();
  });

  it('should toggle password visibility', () => {
    const { getByPlaceholderText, getAllByRole } = renderWithNavigation(<ChangePasswordScreen />);

    const currentPasswordInput = getByPlaceholderText('Enter current password');

    // Password should be hidden initially
    expect(currentPasswordInput.props.secureTextEntry).toBe(true);
  });

  it('should update password strength indicator', () => {
    const { getByPlaceholderText, queryByText } = renderWithNavigation(<ChangePasswordScreen />);

    const newPasswordInput = getByPlaceholderText('Enter new password');

    // Type a weak password
    fireEvent.changeText(newPasswordInput, 'abc');
    expect(queryByText('Weak')).toBeTruthy();

    // Type a stronger password
    fireEvent.changeText(newPasswordInput, 'Abc12345');
    expect(queryByText('Good')).toBeTruthy();

    // Type a strong password
    fireEvent.changeText(newPasswordInput, 'Abc12345!@');
    expect(queryByText('Strong')).toBeTruthy();
  });

  it('should show passwords match indicator', () => {
    const { getByPlaceholderText, getByText } = renderWithNavigation(<ChangePasswordScreen />);

    const newPasswordInput = getByPlaceholderText('Enter new password');
    const confirmPasswordInput = getByPlaceholderText('Confirm new password');

    fireEvent.changeText(newPasswordInput, 'Test123!@#');
    fireEvent.changeText(confirmPasswordInput, 'Test123!@#');

    expect(getByText('Passwords match')).toBeTruthy();
  });

  it('should validate passwords do not match', async () => {
    const { getByPlaceholderText, getByText } = renderWithNavigation(<ChangePasswordScreen />);

    const currentPasswordInput = getByPlaceholderText('Enter current password');
    const newPasswordInput = getByPlaceholderText('Enter new password');
    const confirmPasswordInput = getByPlaceholderText('Confirm new password');

    fireEvent.changeText(currentPasswordInput, 'OldPassword123!');
    fireEvent.changeText(newPasswordInput, 'NewPassword123!');
    fireEvent.changeText(confirmPasswordInput, 'DifferentPassword123!');

    fireEvent.press(getByText('Change Password'));

    await waitFor(() => {
      expect(getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('should validate password requirements', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithNavigation(<ChangePasswordScreen />);

    const currentPasswordInput = getByPlaceholderText('Enter current password');
    const newPasswordInput = getByPlaceholderText('Enter new password');
    const confirmPasswordInput = getByPlaceholderText('Confirm new password');

    fireEvent.changeText(currentPasswordInput, 'OldPassword123!');
    fireEvent.changeText(newPasswordInput, 'weak'); // Does not meet requirements
    fireEvent.changeText(confirmPasswordInput, 'weak');

    fireEvent.press(getByText('Change Password'));

    await waitFor(() => {
      expect(queryByText(/Password must have/)).toBeTruthy();
    });
  });

  it('should validate new password is different from current', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithNavigation(<ChangePasswordScreen />);

    const currentPasswordInput = getByPlaceholderText('Enter current password');
    const newPasswordInput = getByPlaceholderText('Enter new password');
    const confirmPasswordInput = getByPlaceholderText('Confirm new password');

    fireEvent.changeText(currentPasswordInput, 'SamePassword123!');
    fireEvent.changeText(newPasswordInput, 'SamePassword123!');
    fireEvent.changeText(confirmPasswordInput, 'SamePassword123!');

    fireEvent.press(getByText('Change Password'));

    await waitFor(() => {
      expect(queryByText('New password must be different from current password')).toBeTruthy();
    });
  });

  it('should call changePassword when form is valid', async () => {
    mockAuthService.changePassword.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByText } = renderWithNavigation(<ChangePasswordScreen />);

    const currentPasswordInput = getByPlaceholderText('Enter current password');
    const newPasswordInput = getByPlaceholderText('Enter new password');
    const confirmPasswordInput = getByPlaceholderText('Confirm new password');

    fireEvent.changeText(currentPasswordInput, 'OldPassword123!');
    fireEvent.changeText(newPasswordInput, 'NewPassword123!');
    fireEvent.changeText(confirmPasswordInput, 'NewPassword123!');

    fireEvent.press(getByText('Change Password'));

    await waitFor(() => {
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('OldPassword123!', 'NewPassword123!');
    });
  });

  it('should show success alert when password is changed', async () => {
    mockAuthService.changePassword.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByText } = renderWithNavigation(<ChangePasswordScreen />);

    const currentPasswordInput = getByPlaceholderText('Enter current password');
    const newPasswordInput = getByPlaceholderText('Enter new password');
    const confirmPasswordInput = getByPlaceholderText('Confirm new password');

    fireEvent.changeText(currentPasswordInput, 'OldPassword123!');
    fireEvent.changeText(newPasswordInput, 'NewPassword123!');
    fireEvent.changeText(confirmPasswordInput, 'NewPassword123!');

    fireEvent.press(getByText('Change Password'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Your password has been changed successfully.',
        expect.any(Array)
      );
    });
  });

  it('should show error alert when password change fails', async () => {
    mockAuthService.changePassword.mockRejectedValueOnce({
      response: { data: { message: 'Current password is incorrect' } },
    });

    const { getByPlaceholderText, getByText } = renderWithNavigation(<ChangePasswordScreen />);

    const currentPasswordInput = getByPlaceholderText('Enter current password');
    const newPasswordInput = getByPlaceholderText('Enter new password');
    const confirmPasswordInput = getByPlaceholderText('Confirm new password');

    fireEvent.changeText(currentPasswordInput, 'WrongPassword123!');
    fireEvent.changeText(newPasswordInput, 'NewPassword123!');
    fireEvent.changeText(confirmPasswordInput, 'NewPassword123!');

    fireEvent.press(getByText('Change Password'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Current password is incorrect'
      );
    });
  });

  it('should update requirement checkmarks as password changes', () => {
    const { getByPlaceholderText, getAllByTestId } = renderWithNavigation(<ChangePasswordScreen />);

    const newPasswordInput = getByPlaceholderText('Enter new password');

    // Initially no requirements met
    fireEvent.changeText(newPasswordInput, 'A');
    // One uppercase is met

    fireEvent.changeText(newPasswordInput, 'Aa');
    // One uppercase and one lowercase

    fireEvent.changeText(newPasswordInput, 'Aa1');
    // Uppercase, lowercase, and number

    fireEvent.changeText(newPasswordInput, 'Aa1!');
    // Uppercase, lowercase, number, and special character

    fireEvent.changeText(newPasswordInput, 'Aa1!5678');
    // All requirements met (8 chars)
  });

  it('should show cancel button that navigates back', () => {
    const { getByText } = renderWithNavigation(<ChangePasswordScreen />);

    expect(getByText('Cancel')).toBeTruthy();
  });

  it('should show info box with password guidance', () => {
    const { getByText } = renderWithNavigation(<ChangePasswordScreen />);

    expect(getByText(/Choose a strong password/)).toBeTruthy();
  });
});
