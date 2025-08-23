/**
 * NEW BATCH-SCOPED ELIGIBILITY HELPER - Single source of truth
 * Implements the exact specification from the requirements with sectionsByBatch
 */
export function isEligible(user: { batch?: string | null; section?: string | null; email?: string | null; program?: string | null; role?: string }, targets: { batches?: string[]; sectionsByBatch?: Record<string, string[]>; sections?: string[]; programs?: string[] }): boolean {
  const batches = Array.isArray(targets?.batches) ? targets.batches : [];
  if (batches.length === 0) return false; // explicit targeting required
  if (!batches.includes(user.batch || '')) return false;
  
  // Check batch-scoped sections
  const sectionsByBatch = targets?.sectionsByBatch || {};
  const userBatch = user.batch || '';
  const scoped = sectionsByBatch[userBatch];
  
  // If no entry or empty array for batch => all sections eligible in that batch
  if (scoped === undefined || scoped.length === 0) {
    // But also check legacy sections for backward compatibility
    const legacySections = targets?.sections ?? [];
    if (legacySections.length > 0) {
      return legacySections.includes(user.section || '');
    }
    return true; // All sections eligible in that batch
  }
  
  // Must be in the specific sections for this batch
  const sectionOK = scoped.includes(user.section || '');
  
  // Check program eligibility  
  const programs = targets?.programs ?? [];
  const programOK = programs.length === 0 || programs.includes(user.program || '');
  
  return sectionOK && programOK;
}

export interface EligibilityTargets {
  batches: string[];
  sectionsByBatch: Record<string, string[]>;
  sections?: string[]; // Legacy support
  programs: string[];
  rollEmailAttendees?: string[];
}

export interface EligibleUser {
  batch?: string | null;
  section?: string | null;
  email?: string | null;
  program?: string | null;
  role?: string;
}

// Helper function to normalize and validate targeting arrays
export function normalizeTargets(targets: any): EligibilityTargets {
  const norm = (arr: any): string[] => Array.from(new Set((arr || []).map((x: any) => String(x).trim()))).filter(Boolean).sort() as string[];
  
  return {
    batches: norm(targets?.batches),
    sectionsByBatch: targets?.sectionsByBatch || {},
    sections: norm(targets?.sections), // Legacy support
    programs: norm(targets?.programs),
    rollEmailAttendees: norm(targets?.rollEmailAttendees),
  };
}

// NEW: Normalize legacy payload to new batch-scoped structure
export function normalizeToBatchScoped(payload: any): { batches: string[]; sectionsByBatch: Record<string, string[]>; programs: string[] } {
  const norm = (arr: any): string[] => Array.from(new Set((arr || []).map((x: any) => String(x).trim()))).filter(Boolean).sort() as string[];
  
  let batches: string[] = [];
  let sectionsByBatch: Record<string, string[]> = {};
  
  // Handle new format: targets.batches and targets.sectionsByBatch
  if (payload?.targets?.sectionsByBatch && typeof payload.targets.sectionsByBatch === 'object') {
    batches = norm(payload.targets.batches);
    sectionsByBatch = payload.targets.sectionsByBatch;
  }
  // Handle new format: direct batches and sectionsByBatch
  else if (payload?.sectionsByBatch && typeof payload.sectionsByBatch === 'object') {
    batches = norm(payload.batches);
    sectionsByBatch = payload.sectionsByBatch;
  }
  // Handle legacy: targetBatchSections format like ["MBA 2024-26::A","MBA 2025-27::C"]
  else if (payload?.targetBatchSections?.length) {
    const batchSet = new Set<string>();
    sectionsByBatch = {};
    
    for (const batchSection of payload.targetBatchSections) {
      if (batchSection.includes('::')) {
        const [batch, section] = batchSection.split('::');
        batchSet.add(batch.trim());
        if (!sectionsByBatch[batch.trim()]) {
          sectionsByBatch[batch.trim()] = [];
        }
        if (!sectionsByBatch[batch.trim()].includes(section.trim())) {
          sectionsByBatch[batch.trim()].push(section.trim());
        }
      }
    }
    batches = Array.from(batchSet).sort();
  }
  // Handle mixed legacy: batches + sections (global)
  else if (payload?.batches?.length && payload?.sections?.length) {
    batches = norm(payload.batches);
    // Convert global sections to per-batch sections
    const globalSections = norm(payload.sections);
    for (const batch of batches) {
      sectionsByBatch[batch] = globalSections;
    }
  }
  // Handle targets.batches + targets.sections (global)
  else if (payload?.targets?.batches?.length && payload?.targets?.sections?.length) {
    batches = norm(payload.targets.batches);
    const globalSections = norm(payload.targets.sections);
    for (const batch of batches) {
      sectionsByBatch[batch] = globalSections;
    }
  }
  // Handle just batches (all sections)
  else if (payload?.batches?.length || payload?.targets?.batches?.length) {
    batches = norm(payload.batches || payload.targets?.batches);
    // Empty sectionsByBatch means all sections for each batch
    for (const batch of batches) {
      sectionsByBatch[batch] = [];
    }
  }
  
  // Sort sections within each batch
  for (const batch in sectionsByBatch) {
    sectionsByBatch[batch] = sectionsByBatch[batch].sort();
  }
  
  return {
    batches: batches.sort(),
    sectionsByBatch,
    programs: norm(payload?.programs || payload?.targets?.programs || [])
  };
}

// Legacy adapter for converting old targetBatchSections format
export function adaptLegacyTargets(event: {
  targetBatches?: string[];
  targetSections?: string[];
  targetBatchSections?: string[];
  rollNumberAttendees?: string[];
}): EligibilityTargets {
  const norm = (arr: any): string[] => Array.from(new Set((arr || []).map((x: any) => String(x).trim()))).filter(Boolean).sort() as string[];
  
  let batches = norm(event.targetBatches);
  let sections = norm(event.targetSections);
  
  // Convert targetBatchSections to separate batches + sections
  if (event.targetBatchSections?.length) {
    const additionalBatches: string[] = [];
    const additionalSections: string[] = [];
    
    for (const batchSection of event.targetBatchSections) {
      if (batchSection.includes('::')) {
        const [batch, section] = batchSection.split('::');
        if (batch && section) {
          additionalBatches.push(batch.trim());
          additionalSections.push(section.trim());
        }
      }
    }
    
    // Merge with existing arrays and normalize
    batches = norm(batches.concat(additionalBatches));
    sections = norm(sections.concat(additionalSections));
  }
  
  return {
    batches,
    sections,
    programs: [], // Not used in current system
    rollEmailAttendees: norm(event.rollNumberAttendees || []), // Renamed but contains emails
  };
}