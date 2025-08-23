/**
 * CANONICAL ELIGIBILITY HELPER - Single source of truth
 * Implements the exact specification from the requirements
 */
export function isEligible(user: { batch?: string | null; section?: string | null; email?: string | null; program?: string | null; role?: string }, targets: { batches?: string[]; sections?: string[]; programs?: string[] }): boolean {
  const batches = targets?.batches ?? [];
  const sections = targets?.sections ?? [];
  const programs = targets?.programs ?? [];
  
  // If no batches specified, event is not open to anyone
  if (batches.length === 0) return false;
  
  // Check batch eligibility - user batch must be in target batches
  const batchOK = batches.includes(user.batch || '');
  
  // Check section eligibility
  // sections empty ⇒ all sections in selected batches are eligible
  // sections specified ⇒ user section must be in target sections
  const sectionOK = sections.length === 0 || sections.includes(user.section || '');
  
  // Check program eligibility  
  // programs empty ⇒ all programs are eligible
  // programs specified ⇒ user program must be in target programs
  const programOK = programs.length === 0 || programs.includes(user.program || '');
  
  return batchOK && sectionOK && programOK;
}

export interface EligibilityTargets {
  batches: string[];
  sections: string[];
  programs: string[];
  rollEmailAttendees: string[];
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
    sections: norm(targets?.sections),
    programs: norm(targets?.programs),
    rollEmailAttendees: norm(targets?.rollEmailAttendees),
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