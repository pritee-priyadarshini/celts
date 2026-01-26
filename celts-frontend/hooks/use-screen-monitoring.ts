import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseScreenMonitoringOptions {
  onViolation?: (violationType: string, details: string) => void;
  onCriticalViolation?: (violationType: string, details: string) => void;
  onAutoSubmit?: () => void;
  enabled?: boolean;
  autoSubmitOnViolation?: boolean;
  warningsBeforeAutoSubmit?: number;
}

interface ViolationWarning {
  type: string;
  count: number;
  maxWarnings: number;
  lastWarningTime: number;
}

export function useScreenMonitoring(options: UseScreenMonitoringOptions = {}) {
  const {
    onViolation,
    onCriticalViolation,
    onAutoSubmit,
    enabled = true,
    autoSubmitOnViolation = true,
    warningsBeforeAutoSubmit = 10,
  } = options;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [currentViolationType, setCurrentViolationType] = useState<string>('');
  
  const warningsRef = useRef<Map<string, ViolationWarning>>(new Map());
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoSubmittedRef = useRef(false);

  const showViolationWarning = useCallback((violationType: string, message: string) => {
    if (hasAutoSubmittedRef.current) return;

    const now = Date.now();
    const warnings = warningsRef.current;
    const currentWarning = warnings.get(violationType) || {
      type: violationType,
      count: 0,
      maxWarnings: warningsBeforeAutoSubmit,
      lastWarningTime: 0,
    };

    // Prevent spam warnings (minimum 3 seconds between same violation type)
    if (now - currentWarning.lastWarningTime < 3000) {
      return;
    }

    currentWarning.count++;
    currentWarning.lastWarningTime = now;
    warnings.set(violationType, currentWarning);

    const remainingWarnings = Math.max(0, currentWarning.maxWarnings - currentWarning.count);

    if (currentWarning.count >= currentWarning.maxWarnings) {
      // Maximum warnings reached - notify but don't auto-submit
      setCurrentViolationType(violationType);
      setShowWarningDialog(true);
      
      toast.error('🚨 MAXIMUM WARNINGS REACHED', {
        description: `${message}. You have reached the maximum warnings. All violations are being logged for faculty review.`,
        duration: 10000,
      });

      // Log as critical violation but don't trigger auto-submit
      warningTimeoutRef.current = setTimeout(() => {
        setShowWarningDialog(false);
        onCriticalViolation?.(violationType, `Maximum warnings exceeded: ${message}`);
      }, 10000);
    } else {
      // Regular warning
      toast.warning('⚠️ Security Warning', {
        description: `${message}. ${remainingWarnings} more warnings before maximum limit. Violations are being logged.`,
        duration: 6000,
      });
      
      onViolation?.(violationType, message);
    }
  }, [warningsBeforeAutoSubmit, onViolation, onCriticalViolation, onAutoSubmit]);

  const dismissWarning = useCallback(() => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    setShowWarningDialog(false);
    setCurrentViolationType('');
  }, []);

  const proceedWithAutoSubmit = useCallback(() => {
    const violationType = currentViolationType;
    dismissWarning();
    
    // Trigger immediate auto-submit
    if (!hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      setTimeout(() => {
        onCriticalViolation?.(violationType, `User acknowledged auto-submit: ${violationType}`);
        onAutoSubmit?.();
      }, 100);
    }
  }, [currentViolationType, dismissWarning, onCriticalViolation, onAutoSubmit]);

  const returnToExam = useCallback(() => {
    dismissWarning();
    
    // Try to re-enter fullscreen if it was a fullscreen exit
    if (currentViolationType === 'fullscreen_exit') {
      try {
        document.documentElement.requestFullscreen?.();
      } catch (error) {
        console.log('Could not re-enter fullscreen:', error);
      }
    }
    
    // Focus the window
    window.focus();
  }, [dismissWarning, currentViolationType]);

  // Fullscreen monitoring
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && isFullscreen) {
        showViolationWarning(
          'fullscreen_exit',
          'You exited fullscreen mode'
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, [enabled, isFullscreen, showViolationWarning]);

  // Tab switch monitoring via visibility change
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        showViolationWarning(
          'tab_switch',
          'You switched to a different tab'
        );
      } else {
        setIsWindowFocused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, showViolationWarning]);

  useEffect(() => {
    if (!enabled) return;

    let lastScreenWidth = screen.width;
    let lastScreenHeight = screen.height;

    const checkScreenChanges = () => {
      const currentWidth = screen.width;
      const currentHeight = screen.height;

      if (currentWidth !== lastScreenWidth || currentHeight !== lastScreenHeight) {
        showViolationWarning(
          'screen_change',
          'Screen resolution or display configuration changed'
        );
        lastScreenWidth = currentWidth;
        lastScreenHeight = currentHeight;
      }

      // Multiple monitor detection removed - no longer flagged as violation
    };

    checkScreenChanges();

    const interval = setInterval(checkScreenChanges, 5000);

    return () => clearInterval(interval);
  }, [enabled, showViolationWarning]);

  useEffect(() => {
    if (!enabled) return;

    let lastWindowWidth = window.innerWidth;
    let lastWindowHeight = window.innerHeight;

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      const widthChange = Math.abs(currentWidth - lastWindowWidth);
      const heightChange = Math.abs(currentHeight - lastWindowHeight);

      if (widthChange > 20 || heightChange > 20) {
        showViolationWarning(
          'window_resize',
          'Exam window was resized'
        );
        lastWindowWidth = currentWidth;
        lastWindowHeight = currentHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [enabled, showViolationWarning]);

  // Browser devtools detection
  useEffect(() => {
    if (!enabled) return;

    let devtoolsOpen = false;
    const threshold = 160;

    const detectDevtools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          showViolationWarning(
            'dev_tools_open',
            'Developer tools detected as open'
          );
        }
      } else {
        devtoolsOpen = false;
      }
    };

    const interval = setInterval(detectDevtools, 1000);

    return () => clearInterval(interval);
  }, [enabled, showViolationWarning]);

  // Zoom level detection
  useEffect(() => {
    if (!enabled) return;

    let lastZoomLevel = Math.round(window.devicePixelRatio * 100);

    const detectZoomChange = () => {
      const currentZoomLevel = Math.round(window.devicePixelRatio * 100);
      
      if (currentZoomLevel !== lastZoomLevel) {
        showViolationWarning(
          'zoom_change',
          `Browser zoom level changed from ${lastZoomLevel}% to ${currentZoomLevel}%`
        );
        lastZoomLevel = currentZoomLevel;
      }
    };

    const interval = setInterval(detectZoomChange, 2000);

    return () => clearInterval(interval);
  }, [enabled, showViolationWarning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  return {
    isFullscreen,
    isWindowFocused,
    showWarningDialog,
    currentViolationType,
    dismissWarning,
    proceedWithAutoSubmit,
    returnToExam,
    warningCounts: Object.fromEntries(warningsRef.current),
    hasAutoSubmitted: hasAutoSubmittedRef.current,
  };
}