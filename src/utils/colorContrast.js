/**
 * Color Contrast Ratio Checker
 * Based on WCAG 2.1 guidelines
 *
 * Contrast ratio requirements:
 * - AA standard: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
 * - AAA standard: 7:1 for normal text, 4.5:1 for large text
 */

/**
 * Parse a color string to RGB values
 * Supports: hex (#RGB, #RRGGBB), rgb(), rgba()
 */
export function parseColor(color) {
    if (!color) return null;

    // Handle hex colors
    if (color.startsWith('#')) {
        let hex = color.slice(1);

        // Convert 3-digit hex to 6-digit
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }

        if (hex.length === 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
        }
    }

    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10)
        };
    }

    // Handle named colors (common ones)
    const namedColors = {
        white: { r: 255, g: 255, b: 255 },
        black: { r: 0, g: 0, b: 0 },
        red: { r: 255, g: 0, b: 0 },
        green: { r: 0, g: 128, b: 0 },
        blue: { r: 0, g: 0, b: 255 },
        yellow: { r: 255, g: 255, b: 0 },
        gray: { r: 128, g: 128, b: 128 },
        grey: { r: 128, g: 128, b: 128 },
    };

    return namedColors[color.toLowerCase()] || null;
}

/**
 * Calculate relative luminance of a color
 * Formula from WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getLuminance(rgb) {
    if (!rgb) return 0;

    const { r, g, b } = rgb;

    // Convert to sRGB
    const [rs, gs, bs] = [r, g, b].map(c => {
        const srgb = c / 255;
        return srgb <= 0.03928
            ? srgb / 12.92
            : Math.pow((srgb + 0.055) / 1.055, 2.4);
    });

    // Calculate luminance
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function getContrastRatio(color1, color2) {
    const rgb1 = typeof color1 === 'string' ? parseColor(color1) : color1;
    const rgb2 = typeof color2 === 'string' ? parseColor(color2) : color2;

    if (!rgb1 || !rgb2) return 1;

    const lum1 = getLuminance(rgb1);
    const lum2 = getLuminance(rgb2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG standards
 */
export function meetsContrastStandard(ratio, standard = 'AA', isLargeText = false) {
    const thresholds = {
        AA: isLargeText ? 3 : 4.5,
        AAA: isLargeText ? 4.5 : 7
    };

    return ratio >= thresholds[standard];
}

/**
 * Get the best text color (black or white) for a given background
 */
export function getBestTextColor(backgroundColor) {
    const rgb = typeof backgroundColor === 'string' ? parseColor(backgroundColor) : backgroundColor;
    if (!rgb) return '#000000';

    const luminance = getLuminance(rgb);

    // If background is light (luminance > 0.179), use dark text
    // This threshold is derived from the contrast ratio formula
    return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

/**
 * Check contrast for gradient colors against text
 * Returns detailed results for both start and end colors
 */
export function checkGradientContrast(startColor, endColor, textColor = '#FFFFFF') {
    const startRatio = getContrastRatio(startColor, textColor);
    const endRatio = getContrastRatio(endColor, textColor);
    const minRatio = Math.min(startRatio, endRatio);

    return {
        startColor: {
            color: startColor,
            ratio: startRatio,
            meetsAA: meetsContrastStandard(startRatio, 'AA'),
            meetsAALarge: meetsContrastStandard(startRatio, 'AA', true),
            meetsAAA: meetsContrastStandard(startRatio, 'AAA'),
        },
        endColor: {
            color: endColor,
            ratio: endRatio,
            meetsAA: meetsContrastStandard(endRatio, 'AA'),
            meetsAALarge: meetsContrastStandard(endRatio, 'AA', true),
            meetsAAA: meetsContrastStandard(endRatio, 'AAA'),
        },
        overall: {
            minRatio,
            meetsAA: meetsContrastStandard(minRatio, 'AA'),
            meetsAALarge: meetsContrastStandard(minRatio, 'AA', true),
            meetsAAA: meetsContrastStandard(minRatio, 'AAA'),
        },
        recommendedTextColor: getBestTextColor(startColor) === getBestTextColor(endColor)
            ? getBestTextColor(startColor)
            : null, // null means colors differ, might need shadow or other treatment
    };
}

/**
 * Get accessible text color for a gradient
 * If start and end colors have different optimal text colors,
 * returns the one that works better overall, or suggests using text shadow
 */
export function getAccessibleTextColorForGradient(startColor, endColor) {
    const startBest = getBestTextColor(startColor);
    const endBest = getBestTextColor(endColor);

    // If both agree, use that color
    if (startBest === endBest) {
        return { textColor: startBest, needsShadow: false };
    }

    // Colors disagree - check which text color has better overall contrast
    const whiteOnStart = getContrastRatio(startColor, '#FFFFFF');
    const whiteOnEnd = getContrastRatio(endColor, '#FFFFFF');
    const blackOnStart = getContrastRatio(startColor, '#000000');
    const blackOnEnd = getContrastRatio(endColor, '#000000');

    const whiteMin = Math.min(whiteOnStart, whiteOnEnd);
    const blackMin = Math.min(blackOnStart, blackOnEnd);

    // Use the color with better minimum contrast, and suggest shadow
    return {
        textColor: whiteMin > blackMin ? '#FFFFFF' : '#000000',
        needsShadow: true,
        shadowColor: whiteMin > blackMin ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'
    };
}
