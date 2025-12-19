# BotBuilder Mobile Assets

## Required Image Assets

### 1. icon.png
- **Size**: 1024x1024 pixels
- **Format**: PNG (no transparency)
- **Description**: Main app icon displayed on home screen
- **Design**: "B" letter with gradient indigo (#6366f1 to #818cf8) background, rounded corners

### 2. splash.png
- **Size**: 1284x2778 pixels (iPhone 14 Pro Max)
- **Format**: PNG
- **Description**: Splash screen shown during app launch
- **Design**:
  - Background: Solid indigo (#6366f1)
  - Center: BotBuilder logo (white "B" in rounded square)
  - Below logo: "BotBuilder" text in white

### 3. adaptive-icon.png
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparency
- **Description**: Android adaptive icon foreground
- **Design**: White "B" logo centered, transparent background
- **Note**: Android will apply the backgroundColor from app.json (#6366f1)

### 4. notification-icon.png
- **Size**: 96x96 pixels
- **Format**: PNG with transparency
- **Description**: Android notification small icon
- **Design**: Simple white silhouette of "B" logo
- **Note**: Must be single color (white) with transparency

### 5. favicon.png (optional, for web)
- **Size**: 48x48 pixels
- **Format**: PNG
- **Description**: Browser favicon for Expo web builds

## Color Palette

```
Primary Indigo: #6366f1
Primary Light: #818cf8
Primary Dark: #4f46e5
Background: #f8fafc
Text Dark: #1e293b
Text Light: #64748b
```

## Design Guidelines

1. **Logo Design**:
   - Letter "B" in a rounded rectangle
   - Clean, modern sans-serif font
   - Sufficient padding around the letter

2. **Splash Screen**:
   - Logo should be centered vertically
   - Leave space for system status bar
   - Smooth transition to app content

3. **Icon Consistency**:
   - Use same "B" logo across all icon variants
   - Maintain visual consistency with web version

## Placeholder Generation

To generate placeholder assets, you can use tools like:
- Figma (https://figma.com)
- Canva (https://canva.com)
- GIMP (https://gimp.org)
- Adobe Illustrator

Or use Expo's icon generator:
```bash
npx expo-optimize
```

## Asset Checklist

- [ ] icon.png (1024x1024)
- [ ] splash.png (1284x2778)
- [ ] adaptive-icon.png (1024x1024)
- [ ] notification-icon.png (96x96)
- [ ] favicon.png (48x48) - optional
