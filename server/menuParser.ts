import XLSX from 'xlsx';

export interface ParsedMenu {
  [date: string]: {
    breakfast?: string;
    lunch?: string;
    eveningSnacks?: string;
    dinner?: string;
  };
}

export interface MenuParseResult {
  success: boolean;
  menu?: ParsedMenu;
  error?: string;
  errorDetails?: string;
}

export function parseExcelMenu(buffer: Buffer): MenuParseResult {
  try {
    // Read the Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    
    if (!firstSheetName) {
      return { success: false, error: 'No sheets found in Excel file' };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON format for easier manipulation
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      return { success: false, error: 'Empty worksheet found' };
    }

    // Step 1: Forward-fill column A downward to handle merged cells
    const processedData = forwardFillColumnA(jsonData);
    
    // Step 2: Extract dates from row 1 (starting from column C)
    const dateColumns = extractDateColumns(processedData[0] as string[]);
    
    if (dateColumns.length === 0) {
      return { success: false, error: 'No valid dates found in first row starting from column C' };
    }

    // Step 3: Parse menu items for each date
    const parsedMenu: ParsedMenu = {};
    
    for (const { columnIndex, date } of dateColumns) {
      parsedMenu[date] = {
        breakfast: '',
        lunch: '',
        eveningSnacks: '',
        dinner: ''
      };
      
      // Walk through each row to find meal items
      for (let rowIndex = 1; rowIndex < processedData.length; rowIndex++) {
        const row = processedData[rowIndex] as string[];
        const mealLabel = (row[0] || '').toString().toLowerCase().trim();
        const menuItem = (row[columnIndex] || '').toString().trim();
        
        if (menuItem && mealLabel) {
          if (mealLabel.includes('breakfast')) {
            parsedMenu[date].breakfast = addMenuItem(parsedMenu[date].breakfast || '', menuItem);
          } else if (mealLabel.includes('lunch')) {
            parsedMenu[date].lunch = addMenuItem(parsedMenu[date].lunch || '', menuItem);
          } else if (mealLabel.includes('evening snacks') || mealLabel.includes('snacks')) {
            parsedMenu[date].eveningSnacks = addMenuItem(parsedMenu[date].eveningSnacks || '', menuItem);
          } else if (mealLabel.includes('dinner')) {
            parsedMenu[date].dinner = addMenuItem(parsedMenu[date].dinner || '', menuItem);
          }
        }
      }
    }

    return { success: true, menu: parsedMenu };
    
  } catch (error) {
    return { 
      success: false, 
      error: 'Failed to parse Excel file', 
      errorDetails: error instanceof Error ? error.message : String(error)
    };
  }
}

function forwardFillColumnA(data: any[][]): string[][] {
  const result: string[][] = [];
  let lastMealLabel = '';
  
  for (const row of data) {
    const processedRow: string[] = [];
    
    for (let i = 0; i < row.length; i++) {
      const cellValue = row[i]?.toString()?.trim() || '';
      
      if (i === 0) { // Column A
        if (cellValue) {
          lastMealLabel = cellValue;
          processedRow[i] = cellValue;
        } else {
          processedRow[i] = lastMealLabel;
        }
      } else if (i === 1) {
        // Ignore column B entirely as per requirements
        processedRow[i] = '';
      } else {
        processedRow[i] = cellValue;
      }
    }
    
    result.push(processedRow);
  }
  
  return result;
}

function extractDateColumns(headerRow: string[]): Array<{ columnIndex: number; date: string }> {
  const dateColumns: Array<{ columnIndex: number; date: string }> = [];
  
  // Start from column C (index 2)
  for (let i = 2; i < headerRow.length; i++) {
    const cellValue = (headerRow[i] || '').toString().trim();
    
    if (cellValue) {
      const normalizedDate = normalizeDateString(cellValue);
      if (normalizedDate) {
        dateColumns.push({ columnIndex: i, date: normalizedDate });
      }
    }
  }
  
  return dateColumns;
}

function normalizeDateString(dateStr: string): string | null {
  try {
    // Try various date parsing approaches
    let date: Date | null = null;
    
    // First try Excel date number
    if (!isNaN(Number(dateStr))) {
      const excelDate = XLSX.SSF.parse_date_code(Number(dateStr));
      if (excelDate) {
        date = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
      }
    }
    
    // If that fails, try direct parsing
    if (!date) {
      date = new Date(dateStr);
    }
    
    // Check if date is valid
    if (date && !isNaN(date.getTime())) {
      // Format as YYYY-MM-DD
      return date.toISOString().split('T')[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

function addMenuItem(existing: string, newItem: string): string {
  if (!existing) return newItem;
  if (!newItem) return existing;
  
  // Split existing items, add new item, and rejoin
  const items = existing.split(',').map(item => item.trim()).filter(item => item);
  const trimmedNewItem = newItem.trim();
  
  if (!items.includes(trimmedNewItem)) {
    items.push(trimmedNewItem);
  }
  
  return items.join(', ');
}

// Helper function to get menu for specific date ranges
export function getMenuForDateRange(menu: ParsedMenu, startDate: Date, days: number) {
  const result: ParsedMenu = {};
  
  for (let i = 0; i < days; i++) {
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + i);
    const dateString = targetDate.toISOString().split('T')[0];
    
    if (menu[dateString]) {
      result[dateString] = menu[dateString];
    } else {
      result[dateString] = {
        breakfast: '',
        lunch: '',
        eveningSnacks: '',
        dinner: ''
      };
    }
  }
  
  return result;
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getDateOffset(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}