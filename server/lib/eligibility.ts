export function isEligible(user: { batch?: string | null; section?: string | null; email?: string | null; program?: string | null; role?: string }, targets: { batches?: string[]; sections?: string[]; programs?: string[]; rollEmailAttendees?: string[] }): boolean {
  // Input validation
  if (!user || !targets) return false;

  // Check email-based inclusion first (highest priority)
  if (targets.rollEmailAttendees?.length && user.email && targets.rollEmailAttendees.includes(user.email)) {
    return true;
  }

  // Normalize arrays
  const batches = Array.isArray(targets?.batches) ? targets.batches : [];
  const sections = Array.isArray(targets?.sections) ? targets.sections : [];
  const programs = Array.isArray(targets?.programs) ? targets.programs : [];

  // POLICY DECISION: Explicit targeting required (no open-to-all events)
  // If no batches specified, event is not open to anyone
  if (batches.length === 0) return false;

  // Check batch eligibility (required)
  const batchOK = user.batch && batches.includes(user.batch);
  if (!batchOK) return false;

  // Check section eligibility (optional filter)
  // If sections specified, user must be in one of them
  // If sections empty, all sections in the targeted batches are eligible
  const sectionOK = sections.length === 0 || (user.section && sections.includes(user.section));
  if (!sectionOK) return false;

  // Check program eligibility (optional filter)
  // If programs specified, user must be in one of them
  // If programs empty, all programs are eligible
  const programOK = programs.length === 0 || (user.program && programs.includes(user.program));
  if (!programOK) return false;

  return true;
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