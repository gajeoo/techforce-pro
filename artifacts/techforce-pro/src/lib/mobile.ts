/**
 * Mobile Optimization Module
 * Enhanced mobile experience and responsive utilities
 */

export interface MobileSettings {
  compactMode: boolean;
  largeButtons: boolean;
  highContrast: boolean;
  reducedAnimations: boolean;
}

/**
 * Detect device type
 */
export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  const width = window.innerWidth;
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Check if device is touch-capable
 */
export function isTouchDevice(): boolean {
  return !!(
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.maxTouchPoints > 0)
  );
}

/**
 * Check if device is in portrait mode
 */
export function isPortraitMode(): boolean {
  return window.innerHeight > window.innerWidth;
}

/**
 * Get safe area insets for notched devices
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseFloat(style.getPropertyValue("--sat") || "0"),
    right: parseFloat(style.getPropertyValue("--sar") || "0"),
    bottom: parseFloat(style.getPropertyValue("--sab") || "0"),
    left: parseFloat(style.getPropertyValue("--sal") || "0"),
  };
}

/**
 * Optimize image for mobile display
 */
export function getOptimizedImageSize(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = 300
): { width: number; height: number } {
  const aspectRatio = originalHeight / originalWidth;
  
  return {
    width: maxWidth,
    height: Math.round(maxWidth * aspectRatio),
  };
}

/**
 * Format large numbers for mobile display
 */
export function formatNumberForMobile(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Get readable touch-friendly padding values
 */
export function getTouchPadding(context: "button" | "input" | "list" = "button"): {
  horizontal: string;
  vertical: string;
} {
  const device = getDeviceType();
  
  if (device === "mobile") {
    switch (context) {
      case "button":
        return { horizontal: "16px", vertical: "14px" }; // Min 44px height
      case "input":
        return { horizontal: "12px", vertical: "12px" }; // Min 44px height
      case "list":
        return { horizontal: "16px", vertical: "12px" }; // Min 48px touch target
      default:
        return { horizontal: "12px", vertical: "12px" };
    }
  }

  return { horizontal: "12px", vertical: "8px" };
}

/**
 * Calculate optimal column count for responsive grid
 */
export function getResponsiveColumns(): number {
  const device = getDeviceType();
  
  switch (device) {
    case "mobile":
      return 1;
    case "tablet":
      return 2;
    case "desktop":
      return 3;
  }
}

/**
 * Get font size recommendations for mobile
 */
export function getResponsiveFontSize(baseSize: number): number {
  const device = getDeviceType();
  
  if (device === "mobile") {
    return baseSize - 2;
  }
  return baseSize;
}

/**
 * Check if device supports hover
 */
export function supportsHover(): boolean {
  if (typeof window === "undefined") return true;
  
  return window.matchMedia("(hover: hover)").matches;
}

/**
 * Get mobile-optimized spacing scale
 */
export function getMobileSpacing(level: 0 | 1 | 2 | 3 | 4 | 5 | 6): string {
  const device = getDeviceType();
  const baseScale = [0, 4, 8, 12, 16, 24, 32];
  
  if (device === "mobile") {
    // Slightly reduced spacing on mobile
    return `${Math.max(4, baseScale[level] - 2)}px`;
  }
  
  return `${baseScale[level]}px`;
}

/**
 * Optimize table display for mobile
 */
export function shouldStackTableColumns(): boolean {
  return getDeviceType() === "mobile";
}

/**
 * Get modal max height for mobile
 */
export function getModalMaxHeight(): string {
  const device = getDeviceType();
  
  if (device === "mobile") {
    return "85vh"; // Leave room for keyboard
  }
  
  return "90vh";
}

/**
 * Check if mobile menu should be drawer or popup
 */
export function shouldUseDrawerMenu(): boolean {
  return getDeviceType() === "mobile";
}

/**
 * Format time for mobile display
 */
export function formatTimeForMobile(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const given = new Date(date);
  given.setHours(0, 0, 0, 0);
  
  const diffTime = given.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Enable virtual scrolling for large lists
 */
export function shouldUseVirtualScroll(itemCount: number): boolean {
  return itemCount > 50;
}

/**
 * Get optimal list item height
 */
export function getListItemHeight(): number {
  const device = getDeviceType();
  return device === "mobile" ? 56 : 48; // Touch-friendly on mobile
}

/**
 * Check if device network is slow
 */
export async function isSlowNetwork(): Promise<boolean> {
  if ("connection" in navigator) {
    const conn = (navigator as any).connection;
    return conn.effectiveType === "2g" || conn.effectiveType === "3g";
  }
  return false;
}

/**
 * Reduce image quality for slow networks
 */
export function getImageQuality(): number {
  if (typeof window === "undefined") return 0.8;
  
  if ("connection" in navigator) {
    const conn = (navigator as any).connection;
    if (conn.effectiveType === "2g" || conn.effectiveType === "3g") {
      return 0.5;
    }
  }
  
  return 0.8;
}

/**
 * Apply mobile-specific accessibility enhancements
 */
export const mobileA11y = {
  minTouchTarget: 44, // Apple recommendation
  minClickArea: 48, // Android recommendation
  doubleTapDelay: 300, // ms
  longPressDelay: 500, // ms
};
