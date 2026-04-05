/**
 * Mock/demo data for the document workflow.
 * These arrays are used only in development mode to provide sample data
 * for the DocumentWorkflowContext when no backend API is available.
 */

// --- Prior year (2024) templates for clone feature ---
export const PRIOR_YEAR_REQUESTS = [
  { name: 'W-2 Form', description: 'Wage and tax statement from employer', dueDate: '2025-03-15', priority: 'High' },
  { name: '1099-DIV', description: 'Dividend income statement', dueDate: '2025-03-15', priority: 'Medium' },
  { name: '1099-INT', description: 'Interest income statement', dueDate: '2025-03-15', priority: 'Medium' },
  { name: 'Mortgage Interest (1098)', description: 'Mortgage interest deduction form', dueDate: '2025-04-01', priority: 'Low' },
  { name: 'Charitable Donations', description: 'Receipts for charitable contributions', dueDate: '2025-04-01', priority: 'Low' },
]

// --- Initial mock requests for demo ---
export const INITIAL_MOCK_REQUESTS = [
  { id: '1', name: 'W-2 Form', description: 'Wage and tax statement', dueDate: '2025-03-15', priority: 'High', status: 'Under_Review', revisionComments: null, uploadedFileName: 'w2-2024.pdf', clientId: 'client-1', version: 1 },
  { id: '2', name: '1099-DIV', description: 'Dividend income', dueDate: '2025-03-15', priority: 'Medium', status: 'Not_Requested', revisionComments: null, uploadedFileName: null, clientId: 'client-1', version: 1 },
  { id: '3', name: 'Mortgage Interest', description: '1098 form', dueDate: '2025-04-01', priority: 'Low', status: 'Revision_Requested', revisionComments: 'The uploaded document is for 2023, not 2024. Please upload the correct year.', uploadedFileName: null, clientId: 'client-1', version: 1 },
]
