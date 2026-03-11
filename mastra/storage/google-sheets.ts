/**
 * Google Sheets Logger
 * Logs all generated content to a Google Sheet for tracking
 */

import { google } from 'googleapis';

// Types for the log entry
export interface GenerationLogEntry {
  timestamp: string;
  personName: string;
  username: string;
  linkedinUrl: string;
  currentRole: string | null;
  currentCompany: string | null;
  postCount: number;
  profileOnlyMode: boolean;
  // Generated content
  originalPost: string;
  altPost: string;
  optimizedPost1: string;
  optimizedPost2: string;
  // Personality Analysis (NEW)
  signalMode: string; // "Writing-Led (70/30)" or "Profile-Only (100%)"
  personalityBlurb: string; // dominantPersonalityBlurb
  writingStyleSummary: string; // styleSummary from writingStyleGraph
  talResonationAngle: string; // resonationAngle from talCompatibilityLayer
  // Analysis summary (legacy)
  personalityTraits: string;
  topics: string;
  // Timing
  totalTimeSeconds: number;
  // Voting (to be filled later)
  vote: string;
  notes: string;
}

/**
 * Initialize Google Sheets client
 */
function getGoogleSheetsClient() {
  const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credentials) {
    console.warn('[google-sheets] GOOGLE_SHEETS_CREDENTIALS not set - logging disabled');
    return null;
  }

  try {
    const parsedCredentials = JSON.parse(credentials);
    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('[google-sheets] Failed to initialize client:', error);
    return null;
  }
}

/**
 * Log a generation to Google Sheets
 */
export async function logGenerationToSheet(entry: GenerationLogEntry): Promise<boolean> {
  const sheets = getGoogleSheetsClient();
  if (!sheets) {
    console.log('[google-sheets] Skipping log - client not initialized');
    return false;
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.warn('[google-sheets] GOOGLE_SHEETS_SPREADSHEET_ID not set');
    return false;
  }

  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';

  // Prepare row data
  const rowData = [
    entry.timestamp,
    entry.personName,
    entry.username,
    entry.linkedinUrl,
    entry.currentRole || '',
    entry.currentCompany || '',
    entry.postCount,
    entry.profileOnlyMode ? 'Yes' : 'No',
    entry.originalPost,
    entry.altPost,
    entry.optimizedPost1,
    entry.optimizedPost2,
    // Personality Analysis (NEW)
    entry.signalMode || '',
    entry.personalityBlurb || '',
    entry.writingStyleSummary || '',
    entry.talResonationAngle || '',
    // Legacy
    entry.personalityTraits,
    entry.topics,
    entry.totalTimeSeconds,
    entry.vote,
    entry.notes,
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:U`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    console.log(`[google-sheets] Logged generation for ${entry.username}`);
    return true;
  } catch (error) {
    console.error('[google-sheets] Failed to log:', error);
    return false;
  }
}

/**
 * Create headers in the sheet (run once to set up)
 */
export async function initializeSheetHeaders(): Promise<boolean> {
  const sheets = getGoogleSheetsClient();
  if (!sheets) return false;

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return false;

  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';

  const headers = [
    'Timestamp',
    'Person Name',
    'Username',
    'LinkedIn URL',
    'Current Role',
    'Current Company',
    'Post Count',
    'Profile Only Mode',
    'Original Post',
    'Alt Post',
    'Optimized Post 1',
    'Optimized Post 2',
    // Personality Analysis (NEW)
    'Signal Mode',
    'Personality Blurb',
    'Writing Style Summary',
    'Tal Resonation Angle',
    // Legacy
    'Personality Traits',
    'Topics',
    'Total Time (s)',
    'Vote',
    'Notes',
  ];

  try {
    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:U1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:U1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });
      console.log('[google-sheets] Headers initialized');
    }

    return true;
  } catch (error) {
    console.error('[google-sheets] Failed to initialize headers:', error);
    return false;
  }
}

export default { logGenerationToSheet, initializeSheetHeaders };
