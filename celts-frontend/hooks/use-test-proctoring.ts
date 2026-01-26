import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useInputRestrictions } from './use-input-restrictions';
import { useScreenMonitoring } from './use-screen-monitoring';
import api from '@/lib/api';

interface UseTestProctoringOptions {
  testId?: string;
  enabled?: boolean;
  autoSubmitOnViolation?: boolean;
  onAutoSubmit?: () => void;
  onViolation?: (violationType: string, details: string) => void;
  onCriticalViolation?: (violationType: string, details: string) => void;
  maxViolationsBeforeSubmit?: number;
  sessionToken?: string;
  attemptId?: string;
  enableDeviceRestrictions?: boolean;
  enableNetworkMonitoring?: boolean;
  isSubmissionInProgress?: boolean;
  warningsBeforeAutoSubmit?: number;
}

interface ViolationLog {
  type: string;
  details: string;
  timestamp: Date;
}

interface ServerViolationResponse {
  success: boolean;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'warning' | 'terminate' | 'flag';
  securityScore: number;
  shouldTerminate: boolean;
  remainingViolations: number;
  message: string;
}

const BATCH_INTERVAL = 5000;
const BATCH_SIZE = 10;

export function useTestProctoring(options: UseTestProctoringOptions = {}) {
  const {
    testId,
    enabled = true,
    autoSubmitOnViolation = true,
    onAutoSubmit,
    onViolation,
    onCriticalViolation,
    maxViolationsBeforeSubmit = 10,
    sessionToken,
    attemptId,
    enableDeviceRestrictions = true,
    enableNetworkMonitoring = true,
    isSubmissionInProgress = false,
    warningsBeforeAutoSubmit = 10,
  } = options;

  const [criticalViolationType, setCriticalViolationType] = useState<string | null>(null);
  const [securityScore, setSecurityScore] = useState(100);
  const [isSessionValid, setIsSessionValid] = useState(true);
  const [networkConnected, setNetworkConnected] = useState(navigator.onLine);

  const violationsRef = useRef<ViolationLog[]>([]);
  const hasAutoSubmittedRef = useRef(false);
  
  const logQueueRef = useRef<Array<{ eventType: string; eventData: any }>>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushLogQueue = useCallback(async (retryCount = 0) => {
    if (!testId || logQueueRef.current.length === 0) return;

    const logsToSend = [...logQueueRef.current];
    logQueueRef.current = [];

    try {
      await Promise.all(
        logsToSend.map((log) =>
          api.apiPost('/proctor/log', {
            testSet: testId,
            eventType: 'warning',
            eventData: {
              violationType: log.eventType,
              details: log.eventData,
              timestamp: new Date().toISOString(),
            },
          })
        )
      );
    } catch (error: any) {
      console.error('Failed to flush log queue:', error);
      
      if (retryCount < 3) {
        console.log(`Retrying log flush, attempt ${retryCount + 1}`);
        logQueueRef.current = [...logsToSend, ...logQueueRef.current];
        
        setTimeout(() => {
          flushLogQueue(retryCount + 1);
        }, Math.pow(2, retryCount) * 1000);
      } else {
        console.error('Max retries reached for log flush');
        try {
          const failedLogs = localStorage.getItem('celts_failed_logs');
          const logs = failedLogs ? JSON.parse(failedLogs) : [];
          logs.push(...logsToSend);
          localStorage.setItem('celts_failed_logs', JSON.stringify(logs));
        } catch (storageError: any) {
          console.error('Failed to store logs in localStorage:', storageError);
        }
      }
    }
  }, [testId]);

  const logViolation = useCallback(async (eventType: string, eventData: any) => {
    if (!testId) return;

    logQueueRef.current.push({ eventType, eventData });

    if (attemptId && sessionToken) {
      try {
        const response = await api.apiPost('/security/violation', {
          testAttemptId: attemptId,
          violationType: eventType,
          details: typeof eventData === 'string' ? eventData : JSON.stringify(eventData),
          clientTimestamp: new Date().toISOString()
        });

        const data: ServerViolationResponse = response?.data || response;
        
        if (data?.success) {
          if (typeof data.securityScore === 'number') {
            setSecurityScore(data.securityScore);
          }

          if (data.shouldTerminate && !hasAutoSubmittedRef.current) {
            toast.error('🚨 Exam Terminated', {
              description: data.message || 'Critical security violations detected.',
              duration: 6000,
            });
            hasAutoSubmittedRef.current = true;
            onAutoSubmit?.();
            return;
          }

          // Show appropriate message based on server response
          if (data.severity === 'high' || data.severity === 'medium') {
            const remaining = data.remainingViolations || 0;
            if (remaining > 0) {
              toast.warning('⚠️ Security Warning', {
                description: `${data.message}. ${remaining} more violations before termination.`,
                duration: 4000,
              });
            }
          }
        }
      } catch (error: any) {
        console.error('Security violation logging error:', error);
      }
    }

    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }

    if (logQueueRef.current.length >= BATCH_SIZE) {
      flushLogQueue();
    } else {
      batchTimerRef.current = setTimeout(() => {
        flushLogQueue();
      }, BATCH_INTERVAL);
    }
  }, [testId, flushLogQueue, attemptId, sessionToken, onAutoSubmit]);

  const handleViolation = useCallback((type: string, details: string) => {
    // Prevent duplicate violations during auto-submit process
    if (hasAutoSubmittedRef.current) {
      return;
    }
    
    // Skip violations during submission process
    if (isSubmissionInProgress) {
      console.log(`Skipping violation ${type} during submission:`, details);
      return;
    }

    const violation: ViolationLog = {
      type,
      details,
      timestamp: new Date(),
    };
    
    logViolation(type, details);
    
    violationsRef.current.push(violation);
    onViolation?.(type, details);

    // Handle warning-based violations (don't trigger auto-submit)
    if (type.includes('_warning') && !type.includes('_critical')) {
      return;
    }

    const criticalViolationTypes = ['tab_switch', 'fullscreen_exit'];
    
    if (criticalViolationTypes.includes(type)) {
      setCriticalViolationType(type);
      // Show critical violation warning but don't auto-submit
      toast.error('🚨 Critical Violation Detected', {
        description: `${details}. This violation has been logged and will be reviewed.`,
        duration: 8000,
      });
    }

    // Warning for multiple violations
    if (violationsRef.current.length >= maxViolationsBeforeSubmit) {
      toast.error('⚠️ Multiple Violations Detected', {
        description: `${violationsRef.current.length} violations logged. Your exam activity is being monitored.`,
        duration: 8000,
      });
    }
  }, [logViolation, autoSubmitOnViolation, maxViolationsBeforeSubmit, onAutoSubmit, onViolation, isSubmissionInProgress]);

  const handleCriticalViolation = useCallback((type: string, details: string) => {
    console.log('Critical proctoring violation:', type, details);
    
    if (isSubmissionInProgress) {
      return;
    }

    const violation: ViolationLog = {
      type,
      details,
      timestamp: new Date(),
    };
    
    logViolation(type, details);
    violationsRef.current.push(violation);
    onCriticalViolation?.(type, details);
    
    setCriticalViolationType(type);
    
    // Show critical warning but don't auto-submit
    toast.error('🚨 Critical Security Violation', {
      description: `${details}. This has been logged and will be reviewed by faculty.`,
      duration: 10000,
    });
  }, [logViolation, onCriticalViolation, isSubmissionInProgress]);

  const handleAutoSubmit = useCallback(async () => {
    if (!hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      
      await flushLogQueue();
      
      toast.error('🚨 Test Auto-Submitted', {
        description: 'You switched tabs or lost focus. Your test has been automatically submitted.',
        duration: 6000,
      });
      logViolation('auto_submit', 'Test auto-submitted due to violations');
      
      await flushLogQueue();
      
      onAutoSubmit?.();
    }
  }, [logViolation, onAutoSubmit, flushLogQueue]);

  const inputRestrictions = useInputRestrictions({
    onViolation: handleViolation,
    onCriticalViolation: handleCriticalViolation,
    enabled,
    warningsBeforeAutoSubmit,
  });

  const screenMonitoring = useScreenMonitoring({
    onViolation: handleViolation,
    onCriticalViolation: handleCriticalViolation,
    onAutoSubmit: handleAutoSubmit,
    enabled,
    autoSubmitOnViolation,
    warningsBeforeAutoSubmit,
  });

  useEffect(() => {
    if (!enabled || !enableNetworkMonitoring) return;

    const handleOnline = () => {
      setNetworkConnected(true);
    };

    const handleOffline = () => {
      setNetworkConnected(false);
      logViolation('network_disconnect', 'Network connection lost during exam');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, enableNetworkMonitoring, logViolation]);

  // Session validation heartbeat with enhanced exam context
  useEffect(() => {
    if (!enabled || !sessionToken) return;

    const validateSession = async () => {
      try {
        const response = await api.apiPost('/security/session/validate', {
          sessionToken,
          examContext: {
            testId: testId,
            attemptId: attemptId,
            timestamp: new Date().toISOString()
          }
        });
        
        const data = response.data || response;
        const isValid = data.valid || false;
        setIsSessionValid(isValid);
        
        if (!isValid) {
          const message = data.message || 'Session expired';
          toast.error('Session Invalid', {
            description: `${message}. Please restart the exam.`,
            duration: 5000,
          });
          
          // Prevent further violations from being logged
          hasAutoSubmittedRef.current = true;
          onAutoSubmit?.();
        }
      } catch (error: any) {
        console.error('Session validation error:', error);
        
        // Only set session as invalid for specific error cases
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          setIsSessionValid(false);
          
          if (error?.response?.status === 403) {
            toast.error('Exam Access Denied', {
              description: 'Your exam session is no longer valid.',
              duration: 5000,
            });
            hasAutoSubmittedRef.current = true;
            onAutoSubmit?.();
          }
        }
        // For other errors (network issues, etc.), don't immediately invalidate session
      }
    };

    // Add delay before first validation to allow exam session to be established
    const initialTimeout = setTimeout(() => {
      validateSession();
    }, 5000); // Wait 5 seconds before first validation

    // Set up periodic validation with longer intervals during exams
    const interval = setInterval(validateSession, 30000); // Every 30 seconds

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [enabled, sessionToken, testId, attemptId, onAutoSubmit]);

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      flushLogQueue();
      
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave? Your test progress may be lost.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      flushLogQueue();
      
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, [enabled, flushLogQueue]);

  return {
    violations: violationsRef.current,
    violationCount: violationsRef.current.length,
    hasAutoSubmitted: hasAutoSubmittedRef.current,
    screenMonitoring,
    inputRestrictions,
    criticalViolationType,
    dismissCriticalViolation: () => setCriticalViolationType(null),
    flushLogs: flushLogQueue,
    // New security features
    securityScore,
    isSessionValid,
    networkConnected,
    logViolation,
  };
}
