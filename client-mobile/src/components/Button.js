/**
 * Button Component
 * Reusable button with variants
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const Button = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, danger
  size = 'medium', // small, medium, large
  disabled = false,
  loading = false,
  icon = null,
  style = {},
  textStyle = {},
}) => {
  const getButtonStyle = () => {
    const styles = [baseStyles.button, baseStyles[size]];

    switch (variant) {
      case 'secondary':
        styles.push(baseStyles.secondary);
        break;
      case 'outline':
        styles.push(baseStyles.outline);
        break;
      case 'danger':
        styles.push(baseStyles.danger);
        break;
      default:
        styles.push(baseStyles.primary);
    }

    if (disabled || loading) {
      styles.push(baseStyles.disabled);
    }

    return styles;
  };

  const getTextStyle = () => {
    const styles = [baseStyles.text, baseStyles[`${size}Text`]];

    switch (variant) {
      case 'outline':
        styles.push(baseStyles.outlineText);
        break;
      case 'secondary':
        styles.push(baseStyles.secondaryText);
        break;
      default:
        styles.push(baseStyles.primaryText);
    }

    return styles;
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? '#3b82f6' : '#ffffff'}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const baseStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  // Sizes
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  // Variants
  primary: {
    backgroundColor: '#3b82f6',
  },
  secondary: {
    backgroundColor: '#f1f5f9',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  danger: {
    backgroundColor: '#ef4444',
  },
  disabled: {
    opacity: 0.5,
  },
  // Text styles
  text: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryText: {
    color: '#1e293b',
  },
  outlineText: {
    color: '#3b82f6',
  },
});

export default Button;
