import { useReducer, createContext, useContext, useState } from 'react'
import { clientApi, vaultApi } from '../services/api.js'

// --- Document Status values ---
export const DocumentStatus = {
  Pending: 'Pending',
  Under_Review: 'Under_Review',
  Revision_Requested: 'Revision_Requested',
  Approved: 'Approved',
}

// --- Valid state machine transitions ---
export const VALID_TRANSITIONS = {
  [DocumentStatus.Pending]: [DocumentStatus.Under_Review],
  [DocumentStatus.Under_Review]: [DocumentStatus.Approved, DocumentStatus.Revision_Requested],
  [DocumentStatus.Revision_Requested]: [DocumentStatus.Under_Review],
  [DocumentStatus.Approved]: [], // terminal state
}

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
  { id: '1', name: 'W-2 Form', description: 'Wage and tax statement', dueDate: '2025-03-15', priority: 'High', status: 'Under_Review', revisionComments: null, uploadedFileName: 'w2-2024.pdf', clientId: 'client-1' },
  { id: '2', name: '1099-DIV', description: 'Dividend income', dueDate: '2025-03-15', priority: 'Medium', status: 'Pending', revisionComments: null, uploadedFileName: null, clientId: 'client-1' },
  { id: '3', name: 'Mortgage Interest', description: '1098 form', dueDate: '2025-04-01', priority: 'Low', status: 'Revision_Requested', revisionComments: 'The uploaded document is for 2023, not 2024. Please upload the correct year.', uploadedFileName: null, clientId: 'client-1' },
]

// --- Helper: check if a transition is valid ---
function isValidTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// --- ID counter for new requests ---
let nextId = 100

// --- Reducer ---
export function documentReducer(state, action) {
  switch (action.type) {
    case 'ADD_REQUEST': {
      const { name, description, dueDate, priority, clientId } = action.payload
      const newRequest = {
        id: String(nextId++),
        name,
        description,
        dueDate,
        priority,
        status: DocumentStatus.Pending,
        revisionComments: null,
        uploadedFileName: null,
        clientId,
      }
      return [...state, newRequest]
    }

    case 'CLONE_PRIOR_YEAR': {
      const { clientId } = action.payload
      const cloned = PRIOR_YEAR_REQUESTS.map((template) => ({
        id: String(nextId++),
        name: template.name,
        description: template.description,
        dueDate: template.dueDate,
        priority: template.priority,
        status: DocumentStatus.Pending,
        revisionComments: null,
        uploadedFileName: null,
        clientId,
      }))
      return [...state, ...cloned]
    }

    case 'UPLOAD_DOCUMENT': {
      const { requestId, fileName } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        const targetStatus = DocumentStatus.Under_Review
        if (!isValidTransition(req.status, targetStatus)) return req
        return { ...req, status: targetStatus, uploadedFileName: fileName }
      })
    }

    case 'APPROVE': {
      const { requestId } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        const targetStatus = DocumentStatus.Approved
        if (!isValidTransition(req.status, targetStatus)) return req
        return { ...req, status: targetStatus }
      })
    }

    case 'REQUEST_REVISION': {
      const { requestId, comments } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        const targetStatus = DocumentStatus.Revision_Requested
        if (!isValidTransition(req.status, targetStatus)) return req
        return { ...req, status: targetStatus, revisionComments: comments, uploadedFileName: null }
      })
    }

    default:
      return state
  }
}

// --- Context ---
const DocumentWorkflowContext = createContext(null)

export function DocumentWorkflowProvider({ children }) {
  const [requests, dispatch] = useReducer(documentReducer, INITIAL_MOCK_REQUESTS)
  const [vault, setVault] = useState(null)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultError, setVaultError] = useState(null)

  /**
   * Initialize or get client vault
   * Call this when a client logs in
   */
  const initializeVault = async (clientName, externalId, email) => {
    setVaultLoading(true)
    setVaultError(null)
    
    try {
      // Try to get existing vault
      let vaultData = await clientApi.getVault(externalId).catch(() => null)
      
      // If no vault exists, create one
      if (!vaultData) {
        const result = await clientApi.createVault(clientName, externalId, email)
        vaultData = { vault: result.vault }
      }
      
      setVault(vaultData.vault)
      return vaultData.vault
    } catch (error) {
      console.error('Failed to initialize vault:', error)
      setVaultError(error.message)
      throw error
    } finally {
      setVaultLoading(false)
    }
  }

  /**
   * Load files from Box vault
   */
  const loadVaultFiles = async () => {
    if (!vault) {
      throw new Error('Vault not initialized')
    }
    
    try {
      const result = await vaultApi.listFiles(vault.id)
      return result.files
    } catch (error) {
      console.error('Failed to load vault files:', error)
      throw error
    }
  }

  return (
    <DocumentWorkflowContext.Provider value={{ 
      requests, 
      dispatch,
      vault,
      vaultLoading,
      vaultError,
      initializeVault,
      loadVaultFiles,
    }}>
      {children}
    </DocumentWorkflowContext.Provider>
  )
}

export function useDocumentWorkflow() {
  const context = useContext(DocumentWorkflowContext)
  if (context === null) {
    throw new Error('useDocumentWorkflow must be used within a DocumentWorkflowProvider')
  }
  return context
}
