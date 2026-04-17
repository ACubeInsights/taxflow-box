import { useReducer, createContext, useContext, useState, useCallback } from 'react'
import { vaultApi, onboardingApi, portalApi, reviewApi, clientApi } from '../services/api.js'
import { useAuth } from './AuthContext.jsx'
import { DocumentStatus, VALID_TRANSITIONS } from '../constants/statusTransitions.js'
import {
  INITIAL_MOCK_REQUESTS,
  PRIOR_YEAR_REQUESTS,
} from '../fixtures/mockData.js'

// Re-export for backward compatibility
export { DocumentStatus, VALID_TRANSITIONS, INITIAL_MOCK_REQUESTS, PRIOR_YEAR_REQUESTS }

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
  const { user } = useAuth() || {}
  const [requests, dispatch] = useReducer(
    documentReducer,
    import.meta.env.DEV ? INITIAL_MOCK_REQUESTS : []
  )
  const [vault, setVault] = useState(null)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultError, setVaultError] = useState(null)
  const [error, setError] = useState(null)

  /**
   * Look up an existing client vault by external ID.
   * This is the primary path for clients who have already been onboarded.
   */
  const lookupVault = useCallback(async (externalId) => {
    setVaultLoading(true)
    setVaultError(null)
    setError(null)

    try {
      const result = await clientApi.getVault(externalId)
      if (result?.vault) {
        setVault(result.vault)
        return result.vault
      }
      return null
    } catch (err) {
      // 404 means vault doesn't exist yet — not an error
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        return null
      }
      console.warn('Vault lookup failed:', err.message)
      return null
    } finally {
      setVaultLoading(false)
    }
  }, [])

  /**
   * Initialize or get client vault. Tries lookup first, falls back to onboarding.
   * Uses the backend as the single source of truth — no fallback paths.
   */
  const initializeVault = useCallback(async (clientName, externalId, email, employeeEmail, financialYear) => {
    setVaultLoading(true)
    setVaultError(null)
    setError(null)
    
    try {
      // Step 1: Try to look up existing vault first
      const existingVault = await lookupVault(externalId)
      if (existingVault) {
        // Fetch client progress to populate requests from backend
        try {
          const progress = await portalApi.getClientProgress(externalId)
          if (progress?.documents?.length > 0) {
            dispatch({ type: 'SET_REQUESTS', payload: { requests: progress.documents } })
          }
        } catch (progressErr) {
          console.warn('Client progress fetch failed:', progressErr.message)
        }
        return existingVault
      }

      // Step 2: Vault doesn't exist — try onboarding (requires employee auth)
      const onboardingResult = await onboardingApi.onboardClient(
        clientName, externalId, email,
        employeeEmail || 'preparer@taxflow.com',
        financialYear || new Date().getFullYear()
      )
      const vaultData = onboardingResult.folders || onboardingResult
      setVault(vaultData)

      // Fetch client progress to populate requests from backend
      const progress = await portalApi.getClientProgress(externalId)
      if (progress?.documents?.length > 0) {
        dispatch({ type: 'SET_REQUESTS', payload: { requests: progress.documents } })
      }

      return vaultData
    } catch (err) {
      setVaultError(err.message)
      setError(err.message)
      throw err
    } finally {
      setVaultLoading(false)
    }
  }, [])

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
   * Async dispatch that syncs APPROVE and REQUEST_REVISION with the review API
   * before updating local state. Errors propagate to the caller.
   */
  const wrappedDispatch = useCallback(async (action) => {
    setError(null)
    try {
      if (action.type === 'APPROVE') {
        const { requestId } = action.payload
        const req = requests.find(r => r.id === requestId)
        if (req?.fileId) {
          await reviewApi.approve(req.fileId, action.payload.employeeId || user?.id)
        }
        dispatch(action)
      } else if (action.type === 'REQUEST_REVISION') {
        const { requestId, comments } = action.payload
        const req = requests.find(r => r.id === requestId)
        if (req?.fileId) {
          await reviewApi.reject(req.fileId, action.payload.employeeId || user?.id, comments)
        }
        dispatch(action)
      } else {
        dispatch(action)
      }
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [requests, user?.id])

  return (
    <DocumentWorkflowContext.Provider value={{ 
      requests, 
      dispatch: wrappedDispatch,
      vault,
      vaultLoading,
      vaultError,
      error,
      initializeVault,
      lookupVault,
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
