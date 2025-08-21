import googleFormMap from '../config/googleFormMap.json';

export interface LeaveFormData {
  email: string;
  reason: string;
  leaveFrom: string; // ISO date string
  leaveTo: string; // ISO date string
  leaveCity: string;
  correlationId: string;
}

export interface GoogleFormResponse {
  ok: boolean;
  statusCode?: number;
  attempts: number;
  lastTriedAt: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Submits leave application data to Google Forms
 * Handles form data mapping, HTTP submission, and error tracking
 */
export async function submitToGoogleForm(
  formData: LeaveFormData,
  attemptNumber: number = 1
): Promise<GoogleFormResponse> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`📝 [GOOGLE-FORM] Submitting leave application - Correlation ID: ${formData.correlationId}, Attempt: ${attemptNumber}`);
  
  try {
    // Map our form data to Google Form entries
    const formBody = new URLSearchParams();
    formBody.append(googleFormMap.mappings.email, formData.email);
    formBody.append(googleFormMap.mappings.reason, formData.reason);
    formBody.append(googleFormMap.mappings.leaveFrom, formData.leaveFrom);
    formBody.append(googleFormMap.mappings.leaveTo, formData.leaveTo);
    formBody.append(googleFormMap.mappings.leaveCity, formData.leaveCity);
    formBody.append(googleFormMap.mappings.correlationId, formData.correlationId);
    
    console.log(`🔗 [GOOGLE-FORM] Posting to: ${googleFormMap._form_url}`);
    console.log(`📋 [GOOGLE-FORM] Mapped fields:`, {
      email: `***${formData.email.slice(-4)}`,
      reason: formData.reason.substring(0, 50) + '...',
      leaveFrom: formData.leaveFrom,
      leaveTo: formData.leaveTo,
      leaveCity: formData.leaveCity,
      correlationId: formData.correlationId
    });
    
    // Submit to Google Forms
    const response = await fetch(googleFormMap._form_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'UniLoop-PWA/1.0',
      },
      body: formBody.toString(),
    });
    
    const latencyMs = Date.now() - startTime;
    const statusCode = response.status;
    
    // Google Forms typically returns 200 or 302 on success
    const isSuccess = statusCode === 200 || statusCode === 302;
    
    console.log(`${isSuccess ? '✅' : '❌'} [GOOGLE-FORM] Response - Status: ${statusCode}, Latency: ${latencyMs}ms, Success: ${isSuccess}`);
    
    if (isSuccess) {
      return {
        ok: true,
        statusCode,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs,
      };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`❌ [GOOGLE-FORM] Submission failed - Status: ${statusCode}, Error: ${errorText.substring(0, 200)}`);
      
      return {
        ok: false,
        statusCode,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs,
        error: `HTTP ${statusCode}: ${errorText.substring(0, 100)}`,
      };
    }
    
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error(`❌ [GOOGLE-FORM] Network error on attempt ${attemptNumber}:`, error.message);
    
    return {
      ok: false,
      attempts: attemptNumber,
      lastTriedAt: timestamp,
      latencyMs,
      error: `Network error: ${error.message}`,
    };
  }
}

/**
 * Retry logic for failed Google Form submissions
 * Uses exponential backoff: 1m, 5m, 30m, 3h, 24h (max 5 attempts)
 */
export function calculateRetryDelay(attemptNumber: number): number {
  const delays = [
    1 * 60 * 1000,      // 1 minute
    5 * 60 * 1000,      // 5 minutes  
    30 * 60 * 1000,     // 30 minutes
    3 * 60 * 60 * 1000, // 3 hours
    24 * 60 * 60 * 1000 // 24 hours
  ];
  
  return delays[Math.min(attemptNumber - 1, delays.length - 1)] || delays[delays.length - 1];
}

/**
 * Validates if a retry should be attempted
 */
export function shouldRetry(googleStatus: GoogleFormResponse): boolean {
  const maxAttempts = 5;
  
  if (googleStatus.ok) {
    return false; // Already successful
  }
  
  if (googleStatus.attempts >= maxAttempts) {
    return false; // Max attempts reached
  }
  
  // Don't retry client errors (4xx), only server errors (5xx) and network errors
  if (googleStatus.statusCode && googleStatus.statusCode >= 400 && googleStatus.statusCode < 500) {
    return false;
  }
  
  return true;
}

/**
 * Generates a unique correlation ID for tracking submissions
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `leave-${timestamp}-${random}`;
}