import googleFormMap from '../config/googleFormMap.json';

export interface LeaveFormData {
  email: string;
  reason: string;
  leaveFrom: string; // ISO date string
  leaveTo: string; // ISO date string
  leaveCity: string;
  correlationId: string;
}

export interface GrievanceFormData {
  email: string;
  name: string;
  phoneNumber?: string;
  roomNumber?: string;
  category: string;
  description: string;
  correlationId: string;
}

export interface GoogleFormResponse {
  ok: boolean;
  statusCode?: number;
  finalUrl?: string;
  attempts: number;
  lastTriedAt: string;
  latencyMs?: number;
  error?: string;
  bodySnippet?: string;
  validationErrors?: string[];
}

/**
 * Submits leave application data to Google Forms
 * Handles form data mapping, HTTP submission, and error tracking
 */
/**
 * Formats date for Google Forms (dd-mm-yyyy format)
 */
function formatDateForGoogle(isoDateString: string): string {
  const date = new Date(isoDateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Converts date string to Google Form date parts
 */
function toGoogleDateParts(dateStrDdMmYyyy: string): { day: string; month: string; year: string } {
  const parts = dateStrDdMmYyyy.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format. Expected dd-mm-yyyy, got: ${dateStrDdMmYyyy}`);
  }
  return {
    day: parts[0],
    month: parts[1], 
    year: parts[2]
  };
}

/**
 * Validates email format using basic RFC5322 validation
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generates random User-Agent to avoid bot detection
 */
function generateUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Adds jitter delay to avoid rate spikes
 */
function addJitter(): Promise<void> {
  const delay = 300 + Math.random() * 500; // 300-800ms
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function submitToGoogleForm(
  formData: LeaveFormData,
  attemptNumber: number = 1
): Promise<GoogleFormResponse> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`📝 [GOOGLE-FORM] Submitting leave application - Correlation ID: ${formData.correlationId}, Attempt: ${attemptNumber}`);
  
  // Check if we're in test mode
  if ((googleFormMap as any)._test_mode) {
    console.log(`🧪 [GOOGLE-FORM] TEST MODE - Simulating successful submission`);
    await addJitter();
    
    return {
      ok: true,
      statusCode: 200,
      attempts: attemptNumber,
      lastTriedAt: timestamp,
      latencyMs: Date.now() - startTime,
    };
  }
  
  try {
    // Validate required fields with enhanced validation
    const validationErrors: string[] = [];
    
    const email = formData.email?.trim().toLowerCase();
    const reason = formData.reason?.trim();
    const leaveFrom = formData.leaveFrom;
    const leaveTo = formData.leaveTo;
    const leaveCity = formData.leaveCity?.trim();
    const correlationId = formData.correlationId;
    
    // Check required fields
    if (!email) validationErrors.push('Email is required');
    else if (!validateEmail(email)) validationErrors.push('Invalid email format');
    
    if (!reason) validationErrors.push('Reason is required');
    if (!leaveFrom) validationErrors.push('Leave from date is required');
    if (!leaveTo) validationErrors.push('Leave to date is required');
    if (!leaveCity) validationErrors.push('Leave city is required');
    if (!correlationId) validationErrors.push('Correlation ID is required');
    
    if (validationErrors.length > 0) {
      console.error(`❌ [GOOGLE-FORM] Validation failed:`, validationErrors);
      return {
        ok: false,
        statusCode: 400,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs: Date.now() - startTime,
        error: `Validation failed: skipped:validation`,
        validationErrors
      };
    }
    
    // Add anti-bot jitter delay
    await addJitter();
    
    // Map our form data to Google Form entries with proper date formatting
    const formBody = new URLSearchParams();
    
    // Add basic fields
    formBody.append(googleFormMap.mappings.email, email!);
    formBody.append(googleFormMap.mappings.reason, reason!);
    formBody.append(googleFormMap.mappings.leaveCity, leaveCity!);
    formBody.append(googleFormMap.mappings.correlationId, correlationId!);
    
    // Handle date fields (can be single or split)
    const leaveFromFormatted = formatDateForGoogle(leaveFrom!);
    const leaveToFormatted = formatDateForGoogle(leaveTo!);
    
    const leaveFromMapping = googleFormMap.mappings.leaveFrom as any;
    if (typeof leaveFromMapping === 'object' && leaveFromMapping.type === 'split_date') {
      // Split date format
      const fromParts = toGoogleDateParts(leaveFromFormatted);
      formBody.append(leaveFromMapping.year, fromParts.year);
      formBody.append(leaveFromMapping.month, fromParts.month);
      formBody.append(leaveFromMapping.day, fromParts.day);
    } else {
      // Single date field
      formBody.append(leaveFromMapping as string, leaveFromFormatted);
    }
    
    const leaveToMapping = googleFormMap.mappings.leaveTo as any;
    if (typeof leaveToMapping === 'object' && leaveToMapping.type === 'split_date') {
      // Split date format
      const toParts = toGoogleDateParts(leaveToFormatted);
      formBody.append(leaveToMapping.year, toParts.year);
      formBody.append(leaveToMapping.month, toParts.month);
      formBody.append(leaveToMapping.day, toParts.day);
    } else {
      // Single date field
      formBody.append(leaveToMapping as string, leaveToFormatted);
    }
    
    const entryKeys = Array.from(formBody.keys());
    
    console.log(`🔗 [GOOGLE-FORM] Posting to: ${googleFormMap._form_url}`);
    console.log(`📋 [GOOGLE-FORM] Mapped fields:`, {
      email: `***${email!.slice(-4)}`,
      reason: reason!.substring(0, 50) + '...',
      leaveFrom: leaveFromFormatted,
      leaveTo: leaveToFormatted,
      leaveCity,
      correlationId,
      entryKeys: entryKeys.sort()
    });
    
    // Submit to Google Forms with enhanced headers
    const userAgent = generateUserAgent();
    const response = await fetch(googleFormMap._form_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': userAgent,
        'Referer': 'https://docs.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Origin': 'https://docs.google.com'
      },
      body: formBody.toString(),
      redirect: 'follow',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const latencyMs = Date.now() - startTime;
    const statusCode = response.status;
    const finalUrl = response.url;
    
    let responseText = '';
    let bodySnippet = '';
    
    try {
      responseText = await response.text();
      bodySnippet = responseText.substring(0, 200);
    } catch (err) {
      bodySnippet = 'Failed to read response body';
    }
    
    // Enhanced success detection with 401 handling
    const urlContainsFormResponse = finalUrl.includes('formResponse') || finalUrl.includes('/formResponse?');
    const bodyHasSuccess = responseText.includes('Your response has been recorded') || 
                          (!responseText.includes('This is a required question') && !responseText.includes('Sign in'));
    
    // Handle 401 specifically - form may not be public
    const isAuthError = statusCode === 401;
    const isValidResponse = (statusCode === 200 || statusCode === 302) && urlContainsFormResponse && bodyHasSuccess;
    
    console.log(`${isValidResponse ? '✅' : '❌'} [GOOGLE-FORM] Response - Status: ${statusCode}, Final URL: ${finalUrl}, Latency: ${latencyMs}ms, Success: ${isValidResponse}`);
    
    if (isValidResponse) {
      return {
        ok: true,
        statusCode,
        finalUrl,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs
      };
    } else {
      // Enhanced error logging for debugging
      let errorReason;
      if (isAuthError) {
        errorReason = 'Form requires authentication or is not public';
      } else if (!urlContainsFormResponse) {
        errorReason = 'Invalid final URL';
      } else if (!bodyHasSuccess) {
        errorReason = 'Response contains validation errors';
      } else {
        errorReason = `HTTP ${statusCode}`;
      }
      
      console.error(`❌ [GOOGLE-FORM] Submission failed:`, {
        reason: errorReason,
        statusCode,
        finalUrl,
        bodySnippet: bodySnippet,
        correlationId,
        entryKeys: entryKeys.sort(),
        isAuthError,
        recommendation: isAuthError ? 'Check if Google Form is public and accepts anonymous responses' : 'Check field mappings and form configuration'
      });
      
      return {
        ok: false,
        statusCode,
        finalUrl,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs,
        error: `${errorReason}: ${bodySnippet.substring(0, 100)}`,
        bodySnippet,
        validationErrors: isAuthError ? ['Form not accessible - check if form accepts public responses'] : undefined
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

/**
 * Generates a prefilled URL for mapping validation
 */
export function generatePrefillProbeUrl(): string {
  const baseUrl = (googleFormMap as any)._prefill_probe_url;
  const testData = {
    email: 'test@mail.com',
    reason: 'Test Reason',
    leaveFromYear: '2025',
    leaveFromMonth: '08', 
    leaveFromDay: '25',
    leaveToYear: '2025',
    leaveToMonth: '08',
    leaveToDay: '28',
    leaveCity: 'Kolkata',
    correlationId: 'test-mapping'
  };
  
  const params = new URLSearchParams();
  
  // Add email and basic fields
  params.append(`${googleFormMap.mappings.email}`, testData.email);
  params.append(`${googleFormMap.mappings.reason}`, testData.reason);
  params.append(`${googleFormMap.mappings.leaveCity}`, testData.leaveCity);
  params.append(`${googleFormMap.mappings.correlationId}`, testData.correlationId);
  
  // Add date fields based on mapping type
  const leaveFromMapping = googleFormMap.mappings.leaveFrom as any;
  if (typeof leaveFromMapping === 'object') {
    params.append(leaveFromMapping.year, testData.leaveFromYear);
    params.append(leaveFromMapping.month, testData.leaveFromMonth);
    params.append(leaveFromMapping.day, testData.leaveFromDay);
  } else {
    params.append(leaveFromMapping as string, '25-08-2025');
  }
  
  const leaveToMapping = googleFormMap.mappings.leaveTo as any;
  if (typeof leaveToMapping === 'object') {
    params.append(leaveToMapping.year, testData.leaveToYear);
    params.append(leaveToMapping.month, testData.leaveToMonth);
    params.append(leaveToMapping.day, testData.leaveToDay);
  } else {
    params.append(leaveToMapping as string, '28-08-2025');
  }
  
  return `${baseUrl}&${params.toString()}`;
}

/**
 * Builds the exact URL-encoded body for preview
 */
export function buildGoogleFormPreview(formData: LeaveFormData): {
  endpoint: string;
  body: string;
  entryKeys: string[];
  maskedEmail: string;
} {
  const formBody = new URLSearchParams();
  
  // Normalize data
  const email = formData.email?.trim().toLowerCase();
  const reason = formData.reason?.trim();
  const leaveCity = formData.leaveCity?.trim();
  const correlationId = formData.correlationId;
  
  // Add basic fields
  formBody.append(googleFormMap.mappings.email, email!);
  formBody.append(googleFormMap.mappings.reason, reason!);
  formBody.append(googleFormMap.mappings.leaveCity, leaveCity!);
  formBody.append(googleFormMap.mappings.correlationId, correlationId!);
  
  // Handle date fields
  const leaveFromFormatted = formatDateForGoogle(formData.leaveFrom!);
  const leaveToFormatted = formatDateForGoogle(formData.leaveTo!);
  
  const leaveFromMapping = googleFormMap.mappings.leaveFrom as any;
  if (typeof leaveFromMapping === 'object' && leaveFromMapping.type === 'split_date') {
    const fromParts = toGoogleDateParts(leaveFromFormatted);
    formBody.append(leaveFromMapping.year, fromParts.year);
    formBody.append(leaveFromMapping.month, fromParts.month);
    formBody.append(leaveFromMapping.day, fromParts.day);
  } else {
    formBody.append(leaveFromMapping as string, leaveFromFormatted);
  }
  
  const leaveToMapping = googleFormMap.mappings.leaveTo as any;
  if (typeof leaveToMapping === 'object' && leaveToMapping.type === 'split_date') {
    const toParts = toGoogleDateParts(leaveToFormatted);
    formBody.append(leaveToMapping.year, toParts.year);
    formBody.append(leaveToMapping.month, toParts.month);
    formBody.append(leaveToMapping.day, toParts.day);
  } else {
    formBody.append(leaveToMapping as string, leaveToFormatted);
  }
  
  return {
    endpoint: googleFormMap._form_url,
    body: formBody.toString(),
    entryKeys: Array.from(formBody.keys()).sort(),
    maskedEmail: email!.length > 4 ? `${email!.substring(0, 2)}***${email!.slice(-2)}` : '***'
  };
}

/**
 * Submits grievance data to Google Forms
 * Handles form data mapping, HTTP submission, and error tracking
 */
export async function submitGrievanceToGoogleForm(
  formData: GrievanceFormData,
  attemptNumber: number = 1
): Promise<GoogleFormResponse> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`📝 [GOOGLE-FORM-GRIEVANCE] Submitting grievance - Correlation ID: ${formData.correlationId}, Attempt: ${attemptNumber}`);
  
  // Check if we're in test mode
  const grievanceConfig = (googleFormMap as any).grievance;
  if (!grievanceConfig) {
    console.error(`❌ [GOOGLE-FORM-GRIEVANCE] Grievance form configuration not found in googleFormMap.json`);
    return {
      ok: false,
      statusCode: 500,
      attempts: attemptNumber,
      lastTriedAt: timestamp,
      latencyMs: Date.now() - startTime,
      error: 'Grievance form configuration not found'
    };
  }

  if ((googleFormMap as any)._test_mode) {
    console.log(`🧪 [GOOGLE-FORM-GRIEVANCE] TEST MODE - Simulating successful submission`);
    await addJitter();
    
    return {
      ok: true,
      statusCode: 200,
      attempts: attemptNumber,
      lastTriedAt: timestamp,
      latencyMs: Date.now() - startTime,
    };
  }
  
  try {
    // Validate required fields
    const validationErrors: string[] = [];
    
    const email = formData.email?.trim().toLowerCase();
    const name = formData.name?.trim();
    const category = formData.category?.trim();
    const description = formData.description?.trim();
    const correlationId = formData.correlationId;
    const phoneNumber = formData.phoneNumber?.trim();
    const roomNumber = formData.roomNumber?.trim();
    
    // Check required fields
    if (!email) validationErrors.push('Email is required');
    else if (!validateEmail(email)) validationErrors.push('Invalid email format');
    
    if (!name) validationErrors.push('Name is required');
    if (!category) validationErrors.push('Category is required');
    if (!description) validationErrors.push('Description is required');
    if (!correlationId) validationErrors.push('Correlation ID is required');
    
    if (validationErrors.length > 0) {
      console.error(`❌ [GOOGLE-FORM-GRIEVANCE] Validation failed:`, validationErrors);
      return {
        ok: false,
        statusCode: 400,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs: Date.now() - startTime,
        error: `Validation failed: skipped:validation`,
        validationErrors
      };
    }
    
    // Add anti-bot jitter delay
    await addJitter();
    
    // Map our form data to Google Form entries
    const formBody = new URLSearchParams();
    const mappings = grievanceConfig.mappings;
    
    // Add form fields
    formBody.append(mappings.email, email!);
    formBody.append(mappings.name, name!);
    formBody.append(mappings.category, category!);
    formBody.append(mappings.description, description!);
    
    if (phoneNumber && mappings.phoneNumber) {
      formBody.append(mappings.phoneNumber, phoneNumber);
    }
    
    if (roomNumber && mappings.roomNumber) {
      formBody.append(mappings.roomNumber, roomNumber);
    }
    
    const entryKeys = Array.from(formBody.keys());
    
    console.log(`🔗 [GOOGLE-FORM-GRIEVANCE] Posting to: ${grievanceConfig._form_url}`);
    console.log(`📋 [GOOGLE-FORM-GRIEVANCE] Mapped fields:`, {
      email: `***${email!.slice(-4)}`,
      name: name!.substring(0, 20) + '...',
      category,
      description: description!.substring(0, 50) + '...',
      correlationId,
      entryKeys: entryKeys.sort()
    });
    
    // Submit to Google Forms with enhanced headers
    const userAgent = generateUserAgent();
    const response = await fetch(grievanceConfig._form_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': userAgent,
        'Referer': 'https://docs.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      body: formBody
    });

    const latencyMs = Date.now() - startTime;
    const responseText = await response.text();
    const bodySnippet = responseText.substring(0, 200);

    if (response.ok) {
      console.log(`✅ [GOOGLE-FORM-GRIEVANCE] Successfully submitted - Status: ${response.status}, Latency: ${latencyMs}ms`);
      return {
        ok: true,
        statusCode: response.status,
        finalUrl: response.url,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs,
        bodySnippet
      };
    } else {
      console.error(`❌ [GOOGLE-FORM-GRIEVANCE] Submission failed - Status: ${response.status}, Response snippet: ${bodySnippet}`);
      
      // Retry logic for server errors
      if (response.status >= 500 && attemptNumber < 3) {
        const retryDelay = Math.pow(2, attemptNumber) * 1000; // Exponential backoff
        console.log(`🔄 [GOOGLE-FORM-GRIEVANCE] Retrying in ${retryDelay}ms (attempt ${attemptNumber + 1}/3)`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return submitGrievanceToGoogleForm(formData, attemptNumber + 1);
      }
      
      return {
        ok: false,
        statusCode: response.status,
        finalUrl: response.url,
        attempts: attemptNumber,
        lastTriedAt: timestamp,
        latencyMs,
        error: `HTTP ${response.status}`,
        bodySnippet
      };
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error(`💥 [GOOGLE-FORM-GRIEVANCE] Network/parsing error:`, error.message);
    
    // Retry logic for network errors
    if (attemptNumber < 3 && (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.message.includes('fetch'))) {
      const retryDelay = Math.pow(2, attemptNumber) * 1000;
      console.log(`🔄 [GOOGLE-FORM-GRIEVANCE] Retrying network request in ${retryDelay}ms (attempt ${attemptNumber + 1}/3)`);
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return submitGrievanceToGoogleForm(formData, attemptNumber + 1);
    }
    
    return {
      ok: false,
      statusCode: 0,
      attempts: attemptNumber,
      lastTriedAt: timestamp,
      latencyMs,
      error: error.message || 'Unknown network error'
    };
  }
}