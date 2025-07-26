import * as XLSX from 'xlsx';

interface StudentRecord {
  email: string;
  section: string;
  batch: string;
  rollNumber?: string; // Optional roll number from Excel parsing
}

interface ParseResult {
  students: StudentRecord[];
  sectionsProcessed: string[];
  totalEmails: number;
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
      
      // Parse each row to extract email and potential roll number
      for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        let email: string | null = null;
        let rollNumber: string | null = null;
        
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
            // Check if the cell contains a roll number (alphanumeric pattern)
            else if (isValidRollNumber(cellValue)) {
              rollNumber = cellValue.toUpperCase(); // Normalize roll number to uppercase
            }
          }
        }
        
        // If we found an email in this row, create a student record
        if (email) {
          console.log(`Found email: ${email}${rollNumber ? ` with roll number: ${rollNumber}` : ''} in sheet: ${sheetName}`);
          
          students.push({
            email,
            section: `${batchName}::${sheetName}`, // Store as batch::section combination
            batch: batchName,
            rollNumber: rollNumber || undefined
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

function isValidRollNumber(value: string): boolean {
  // Roll number pattern: alphanumeric, 4-15 characters, may include hyphens/slashes
  const rollNumberRegex = /^[A-Za-z0-9\-\/]{4,15}$/;
  return rollNumberRegex.test(value) && !value.includes('@'); // Ensure it's not an email
}