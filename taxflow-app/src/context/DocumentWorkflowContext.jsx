import { useReducer, createContext, useContext, useState, useCallback } from 'react'
import { clientApi, vaultApi, onboardingApi, portalApi, reviewApi } from '../services/api.js'

// --- Document Status values (6-status model) ---
export const DocumentStatus = {
  Not_Requested: 'Not_Requested',
  Uploaded: 'Uploaded',
  Under_Review: 'Under_Review',
  Revision_Requested: 'Revision_Requested',
  Approved: 'Approved',
  Waived: 'Waived',
}

// --- Valid state machine transitions ---
export const VALID_TRANSITIONS = {
  [DocumentStatus.Not_Requested]: [DocumentStatus.Uploaded],
  [DocumentStatus.Uploaded]: [DocumentStatus.Under_Review],
  [DocumentStatus.Under_Review]: [DocumentStatus.Approved, DocumentStatus.Revision_Requested, DocumentStatus.Waived],
  [DocumentStatus.Revision_Requested]: [DocumentStatus.Uploaded],
  [DocumentStatus.Approved]: [DocumentStatus.Under_Review], // undo within 10-min window
  [DocumentStatus.Waived]: [], // terminal
}

// --- Status color mapping ---
export const STATUS_COLORS = {
  [DocumentStatus.Not_Requested]: '#6b7280',       // Gray
  [DocumentStatus.Uploaded]: '#3b82f6',             // Blue
  [DocumentStatus.Under_Review]: '#eab308',         // Yellow
  [DocumentStatus.Revision_Requested]: '#ef4444',   // Red
  [DocumentStatus.Approved]: '#22c55e',             // Green
  [DocumentStatus.Waived]: '#64748b',               // Slate
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
  { id: '1', name: 'W-2 Form', description: 'Wage and tax statement', dueDate: '2025-03-15', priority: 'High', status: 'Under_Review', revisionComments: null, uploadedFileName: 'w2-2024.pdf', clientId: 'client-1', version: 1 },
  { id: '2', name: '1099-DIV', description: 'Dividend income', dueDate: '2025-03-15', priority: 'Medium', status: 'Not_Requested', revisionComments: null, uploadedFileName: null, clientId: 'client-1', version: 1 },
  { id: '3', name: 'Mortgage Interest', description: '1098 form', dueDate: '2025-04-01', priority: 'Low', status: 'Revision_Requested', revisionComments: 'The uploaded document is for 2023, not 2024. Please upload the correct year.', uploadedFileName: null, clientId: 'client-1', version: 1 },
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
        status: DocumentStatus.Not_Requested,
        revisionComments: null,
        uploadedFileName: null,
        clientId,
        version: 1,
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
        status: DocumentStatus.Not_Requested,
        revisionComments: null,
        uploadedFileName: null,
        clientId,
        version: 1,
      }))
      return [...state, ...cloned]
    }

    case 'UPLOAD_DOCUMENT': {
      const { requestId, fileName } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        const targetStatus = DocumentStatus.Uploaded
        if (!isValidTransition(req.status, targetStatus)) return req
        return { ...req, status: targetStatus, uploadedFileName: fileName, version: (req.version || 1) + 1 }
      })
    }

    case 'APPROVE': {
      const { requestId } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        const targetStatus = DocumentStatus.Approved
        if (!isValidTransition(req.status, targetStatus)) return req
        return { ...req, status: targetStatus, version: (req.version || 1) + 1 }
      })
    }

    case 'REQUEST_REVISION': {
      const { requestId, comments } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        const targetStatus = DocumentStatus.Revision_Requested
        if (!isValidTransition(req.status, targetStatus)) return req
        return { ...req, status: targetStatus, revisionComments: comments, uploadedFileName: null, version: (req.version || 1) + 1 }
      })
    }

    case 'TRANSITION_STATUS': {
      const { requestId, toStatus } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        if (!isValidTransition(req.status, toStatus)) return req
        return { ...req, status: toStatus, version: (req.version || 1) + 1 }
      })
    }

    case 'UNDO_APPROVAL': {
      const { requestId } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        if (req.status !== DocumentStatus.Approved) return req
        if (!isValidTransition(req.status, DocumentStatus.Under_Review)) return req
        return { ...req, status: DocumentStatus.Under_Review, version: (req.version || 1) + 1 }
      })
    }

    case 'BULK_TRANSITION': {
      const { requestIds, toStatus } = action.payload
      if (toStatus !== DocumentStatus.Under_Review) return state
      return state.map((req) => {
        if (!requestIds.includes(req.id)) return req
        if (req.status !== DocumentStatus.Uploaded) return req
        return { ...req, status: DocumentStatus.Under_Review, version: (req.version || 1) + 1 }
      })
    }

    case 'WAIVE': {
      const { requestId } = action.payload
      return state.map((req) => {
        if (req.id !== requestId) return req
        if (!isValidTransition(req.status, DocumentStatus.Waived)) return req
        return { ...req, status: DocumentStatus.Waived, version: (req.version || 1) + 1 }
      })
    }

    case 'SET_REQUESTS': {
      return action.payload.requests
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Initialize or get client vault via onboarding API, then fetch progress
   */
  const initializeVault = useCallback(async (clientName, externalId, email, employeeEmail, financialYear) => {
    setVaultLoading(true)
    setVaultError(null)
    setError(null)
    
    try {
      // Try onboarding API first
      let onboardingResult = null
      try {
        onboardingResult = await onboardingApi.onboardClient(
          clientName, externalId, email,
          employeeEmail || 'preparer@taxflow.com',
          financialYear || new Date().getFullYear()
        )
        setVault(onboardingResult.folders || onboardingResult)
      } catch (apiErr) {
        console.warn('Onboarding API failed, falling back to clientApi:', apiErr.message)
        // Fallback to existing clientApi
        let vaultData = await clientApi.getVault(externalId).catch(() => null)
        if (!vaultData) {
          const result = await clientApi.createVault(clientName, externalId, email)
          vaultData = { vault: result.vault }
        }
        setVault(vaultData.vault)
      }

      // Fetch client progress to populate requests
      try {
        const progress = await portalApi.getClientProgress(externalId)
        if (progress && progress.documents && progress.documents.length > 0) {
          dispatch({ type: 'SET_REQUESTS', payload: { requests: progress.documents } })
        }
        // If no documents from API, keep mock data as fallback
      } catch (progressErr) {
        console.warn('Client progress API failed, keeping mock data:', progressErr.message)
      }

      return vault
    } catch (err) {
      console.error('Failed to initialize vault:', err)
      setVaultError(err.message)
      setError(err.message)
      throw err
    } finally {
      setVaultLoading(false)
    }
  }, [vault])

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
    } catch (err) {
      console.error('Failed to load vault files:', err)
      throw err
    }
  }

  /**
   * Wrapper dispatch that wires APPROVE and REQUEST_REVISION to review API
   */
  const wrappedDispatch = useCallback(async (action) => {
    if (action.type === 'APPROVE') {
      const { requestId } = action.payload
      const req = requests.find(r => r.id === requestId)
      if (req?.fileId) {
        // Fire-and-forget API call — don't block UI
        reviewApi.approve(req.fileId, action.payload.employeeId || 'current-employee').catch(err => {
          console.warn('reviewApi.approve failed (fire-and-forget):', err.message)
          setError(err.message)
        })
      }
      dispatch(action)
    } else if (action.type === 'REQUEST_REVISION') {
      const { requestId, comments } = action.payload
      const req = requests.find(r => r.id === requestId)
      if (req?.fileId) {
        // Fire-and-forget API call — don't block UI
        reviewApi.reject(req.fileId, action.payload.employeeId || 'current-employee', comments).catch(err => {
          console.warn('reviewApi.reject failed (fire-and-forget):', err.message)
          setError(err.message)
        })
      }
      dispatch(action)
    } else if (action.type === 'ADD_REQUEST') {
      // Try to send to backend, use server-generated ID if available
      try {
        // For now, dispatch locally — backend request creation endpoint TBD
        dispatch(action)
      } catch (err) {
        setError(err.message)
      }
    } else {
      dispatch(action)
    }
  }, [requests])

  return (
    <DocumentWorkflowContext.Provider value={{ 
      requests, 
      dispatch: wrappedDispatch,
      vault,
      vaultLoading,
      vaultError,
      loading,
      error,
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
