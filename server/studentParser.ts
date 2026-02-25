import * as XLSX from 'xlsx';

interface StudentRecord {
  email: string;
  section: string;
  batch: string;
  rollNumber?: string; // Optional roll number from Excel parsing
  phone?: string; // Optional phone from Excel parsing
}

interface ParseResult {
  students: StudentRecord[];
  sectionsProcessed: string[];
  totalEmails: number;
}

// New function to parse roll numbers for event attendees
export function parseRollNumbersForEvent(fileBuffer: Buffer): { attendees: any[]; message: string } {
  try {
    // Read the Excel workbook
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    const rollNumbers: string[] = [];
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      console.log(`Processing sheet for roll numbers: ${sheetName}`);
      
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Get the range of the worksheet
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      // First pass: Identify potential roll number columns by checking headers
      const rollNumberColumns = identifyRollNumberColumns(worksheet, range);
      
      // Parse each row to extract roll numbers
      for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        // Check all columns in the current row
        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v) {
            const cellValue = cell.v.toString().trim();
            
            // Enhanced roll number detection: check if column is identified as roll number column OR cell contains hyphen pattern
            if (rollNumberColumns.includes(colNum) || isValidRollNumber(cellValue)) {
              const normalizedRollNumber = cellValue.toUpperCase();
              if (!rollNumbers.includes(normalizedRollNumber)) {
                rollNumbers.push(normalizedRollNumber);
                console.log(`  -> Found roll number: ${normalizedRollNumber} in column ${XLSX.utils.encode_col(colNum)} for row ${rowNum + 1}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`Total roll numbers extracted: ${rollNumbers.length}`);
    console.log('Roll numbers found:', rollNumbers);
    
    return {
      attendees: rollNumbers.map(rollNumber => ({ rollNumber })),
      message: `Found ${rollNumbers.length} roll numbers`
    };
  } catch (error) {
    console.error('Error parsing roll numbers from Excel:', error);
    throw new Error('Failed to parse roll numbers from Excel file');
  }
}

export function parseStudentExcel(fileBuffer: Buffer, batchName: string): ParseResult {
  try {
    // Read the Excel workbook
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    const students: StudentRecord[] = [];
    const sectionsProcessed: string[] = [];
    let totalEmails = 0;

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      console.log(`Processing sheet: ${sheetName}`);
      sectionsProcessed.push(sheetName);
      
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Get the range of the worksheet
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      // First pass: Identify potential roll number and phone columns by checking headers
      const rollNumberColumns = identifyRollNumberColumns(worksheet, range);
      const phoneColumns = identifyPhoneColumns(worksheet, range);
      
      // Parse each row to extract email, optional roll number, and optional phone
      for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        let email: string | null = null;
        let rollNumber: string | null = null;
        let phone: string | null = null;
        
        // Check all columns in the current row
        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v) {
            const cellValue = cell.v.toString().trim();
            
            // Check if the cell contains an email (has @ symbol)
            if (cellValue.includes('@') && isValidEmail(cellValue)) {
              email = cellValue.toLowerCase(); // Normalize email to lowercase
            }
            // Enhanced roll number detection: check if column is identified as roll number column OR cell contains hyphen pattern
            if (rollNumberColumns.includes(colNum) || isValidRollNumber(cellValue)) {
              rollNumber = cellValue.toUpperCase(); // Normalize roll number to uppercase
              console.log(`  -> Detected roll number: ${rollNumber} in column ${XLSX.utils.encode_col(colNum)} for row ${rowNum + 1}`);
            }
            // Phone detection: check if column is identified as phone column OR value looks like a phone number
            if (phoneColumns.includes(colNum) || isValidPhoneValue(cellValue)) {
              const normalized = normalizePhoneValue(cellValue);
              if (normalized) {
                phone = normalized;
                if (phoneColumns.includes(colNum)) {
                  console.log(`  -> Detected phone: ${phone} in column ${XLSX.utils.encode_col(colNum)} for row ${rowNum + 1}`);
                }
              }
            }
          }
        }
        
        // If we found an email in this row, create a student record
        if (email) {
          console.log(`Found email: ${email}${rollNumber ? ` with roll number: ${rollNumber}` : ''}${phone ? ` with phone: ${phone}` : ''} in sheet: ${sheetName}`);
          
          students.push({
            email,
            section: `${batchName}::${sheetName}`, // Store as batch::section combination
            batch: batchName,
            rollNumber: rollNumber || undefined,
            phone: phone || undefined
          });
          
          totalEmails++;
        }
      }
    }

    console.log(`Parsed ${totalEmails} emails from ${sectionsProcessed.length} sheets`);
    
    // Remove duplicates based on email
    const uniqueStudents = students.filter((student, index, self) => 
      index === self.findIndex(s => s.email === student.email)
    );

    if (uniqueStudents.length !== students.length) {
      console.log(`Removed ${students.length - uniqueStudents.length} duplicate emails`);
    }

    return {
      students: uniqueStudents,
      sectionsProcessed,
      totalEmails: uniqueStudents.length
    };
  } catch (error) {
    console.error('Error parsing student Excel file:', error);
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function identifyRollNumberColumns(worksheet: XLSX.WorkSheet, range: XLSX.Range): number[] {
  const rollNumberCols: number[] = [];
  
  // Check first few rows for roll number column headers
  const maxHeaderRows = Math.min(3, range.e.r - range.s.r + 1);
  
  for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
    for (let rowNum = range.s.r; rowNum < range.s.r + maxHeaderRows; rowNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v) {
        const cellValue = cell.v.toString().toLowerCase().trim();
        
        // Check if header contains roll number keywords
        if (isRollNumberHeader(cellValue)) {
          rollNumberCols.push(colNum);
          console.log(`Identified roll number column at ${XLSX.utils.encode_col(colNum)} with header: "${cellValue}"`);
          break; // Found header, move to next column
        }
      }
    }
  }
  
  return rollNumberCols;
}

function isRollNumberHeader(headerValue: string): boolean {
  const rollNumberKeywords = [
    'roll number', 'rollnumber', 'roll no', 'rollno', 'roll no.', 'rollno.',
    'roll numbers', 'roll nos', 'roll nos.', 'student id', 'studentid',
    'registration number', 'registration no', 'reg no', 'reg no.',
    'enrollment number', 'enrollment no', 'enroll no', 'enroll no.'
  ];
  
  return rollNumberKeywords.some(keyword => headerValue.includes(keyword));
}

function isValidRollNumber(value: string): boolean {
  // Enhanced roll number detection:
  // 1. Must contain at least one hyphen (key requirement from user)
  // 2. Alphanumeric with hyphens/slashes, 3-20 characters (reduced minimum for shorter roll numbers)
  // 3. Cannot be an email
  if (!value.includes('-')) {
    console.log(`  -> Rejected "${value}": no hyphen found`);
    return false; // Must contain hyphen as per user requirement
  }
  
  const rollNumberRegex = /^[A-Za-z0-9\-\/]{3,20}$/;
  const isValid = rollNumberRegex.test(value) && !value.includes('@') && !isCommonNonRollNumber(value);
  
  if (!isValid) {
    console.log(`  -> Rejected "${value}": failed validation (regex: ${rollNumberRegex.test(value)}, no @: ${!value.includes('@')}, not common false positive: ${!isCommonNonRollNumber(value)})`);
  }
  
  return isValid;
}

function isCommonNonRollNumber(value: string): boolean {
  // Filter out common false positives that contain hyphens
  const falsePositives = ['n/a', 'na', 'nil', 'none', 'not-applicable', 'not-available'];
  return falsePositives.includes(value.toLowerCase());
}

function identifyPhoneColumns(worksheet: XLSX.WorkSheet, range: XLSX.Range): number[] {
  const phoneCols: number[] = [];
  const maxHeaderRows = Math.min(3, range.e.r - range.s.r + 1);

  for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
    for (let rowNum = range.s.r; rowNum < range.s.r + maxHeaderRows; rowNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        const cellValue = cell.v.toString().toLowerCase().trim();
        if (isPhoneHeader(cellValue)) {
          phoneCols.push(colNum);
          console.log(`Identified phone column at ${XLSX.utils.encode_col(colNum)} with header: "${cellValue}"`);
          break;
        }
      }
    }
  }
  return phoneCols;
}

function isPhoneHeader(headerValue: string): boolean {
  const phoneKeywords = [
    'phone', 'mobile', 'contact', 'tel', 'telephone', 'cell', 'whatsapp',
    'phone number', 'phonenumber', 'mobile no', 'mobile no.', 'contact no', 'contact no.'
  ];
  return phoneKeywords.some(keyword => headerValue.includes(keyword));
}

function isValidPhoneValue(value: string): boolean {
  if (!value || value.includes('@')) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function normalizePhoneValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  return digits;
}