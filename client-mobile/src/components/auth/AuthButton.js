/**
 * AuthButton Component
 * Styled button for authentication screens
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';

const AuthButton = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, text
  size = 'large', // small, medium, large
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style = {},
  textStyle = {},
}) => {
  const getButtonStyle = () => {
    const baseStyles = [styles.button, styles[`${size}Button`]];

    switch (variant) {
      case 'secondary':
        baseStyles.push(styles.secondaryButton);
        break;
      case 'outline':
        baseStyles.push(styles.outlineButton);
        break;
      case 'text':
        baseStyles.push(styles.textButton);
        break;
      default:
        baseStyles.push(styles.primaryButton);
    }

    if (disabled || loading) {
      baseStyles.push(styles.disabledButton);
    }

    return baseStyles;
  };

  const getTextStyle = () => {
    const baseStyles = [styles.buttonText, styles[`${size}Text`]];

    switch (variant) {
      case 'secondary':
        baseStyles.push(styles.secondaryText);
        break;
      case 'outline':
        baseStyles.push(styles.outlineText);
        break;
      case 'text':
        baseStyles.push(styles.textButtonText);
        break;
      default:
        baseStyles.push(styles.primaryText);
    }

    return baseStyles;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variant === 'primary' ? '#ffffff' : '#6366f1'}
          size="small"
        />
      );
    }

    return (
      <View style={styles.contentWrapper}>
        {icon && iconPosition === 'left' && (
          <View style={styles.iconLeft}>{icon}</View>
        )}
        <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
        {icon && iconPosition === 'right' && (
          <View style={styles.iconRight}>{icon}</View>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  // Sizes
  smallButton: {
    height: 40,
    paddingHorizontal: 16,
  },
  mediumButton: {
    height: 48,
    paddingHorizontal: 24,
  },
  largeButton: {
    height: 56,
    paddingHorizontal: 32,
  },
  // Variants
  primaryButton: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: '#e0e7ff',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  textButton: {
    backgroundColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Text styles
  buttonText: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 15,
  },
  largeText: {
    fontSize: 17,
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryText: {
    color: '#6366f1',
  },
  outlineText: {
    color: '#6366f1',
  },
  textButtonText: {
    color: '#6366f1',
  },
  // Content
  contentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
});

export default AuthButton;
