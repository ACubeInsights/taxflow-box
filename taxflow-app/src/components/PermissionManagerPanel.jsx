import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, Folder, FolderOpen, FileText, ChevronRight, ChevronDown,
  Loader2, AlertCircle, Search, Check,
} from 'lucide-react'
import { GlassPanel } from './ui'
import { useAuth } from '../context/AuthContext'
import { projectApi, vaultApi, permissionApi } from '../services/api'

const ACCESS_LEVELS = ['no_access', 'viewer', 'commenter', 'writer', 'delete']
const ACCESS_COLORS = {
  no_access: '#6b7280',
  viewer: 'var(--color-primary)',
  commenter: 'var(--color-tertiary)',
  writer: 'var(--color-secondary)',
  delete: '#f87171',
}

function AccessBadge({ level, onClick }) {
  const color = ACCESS_COLORS[level] || '#6b7280'
  return (
    <button
      onClick={onClick}
      className="h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all duration-200 hover:scale-105"
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        color,
      }}
    >
      {level.replace('_', ' ')}
    </button>
  )
}

function AccessSelector({ current, onSelect, onCancel }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {ACCESS_LEVELS.map(level => (
        <button
          key={level}
          onClick={() => onSelect(level)}
          className={`h-6 px-2 rounded-md text-[9px] font-bold uppercase tracking-wide cursor-pointer transition-all duration-150 ${
            level === current ? 'ring-2 ring-white/30 scale-105' : 'opacity-70 hover:opacity-100'
          }`}
          style={{
            background: `color-mix(in srgb, ${ACCESS_COLORS[level]} 20%, transparent)`,
            border: `1px solid color-mix(in srgb, ${ACCESS_COLORS[level]} 35%, transparent)`,
            color: ACCESS_COLORS[level],
          }}
        >
          {level === current && <Check size={8} className="inline mr-0.5" />}
          {level.replace('_', ' ')}
        </button>
      ))}
      <button onClick={onCancel} className="text-[9px] text-[var(--color-on-surface-variant)] ml-1 cursor-pointer bg-transparent border-none hover:text-white">
        ✕
      </button>
    </div>
  )
}

function ResourceRow({ item, clientId, permissions, onPermissionChange }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const currentLevel = permissions[item.id] || 'no_access'

  const handleSelect = async (newLevel) => {
    if (newLevel === currentLevel) { setEditing(false); return }
    setSaving(true)
    try {
      await onPermissionChange(item.id, item.type === 'folder' ? 'folder' : 'file', newLevel, item.name)
      setEditing(false)
    } catch (err) {
      console.error('Permission change failed:', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-surface-highest)]/40 transition-all group">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[var(--color-on-surface-variant)]" style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }}>
        {item.type === 'folder' ? <Folder size={14} /> : <FileText size={14} />}
      </div>
      <span className="flex-1 text-[12px] font-medium text-[var(--color-on-surface)] truncate">{item.name}</span>
      {saving ? (
        <Loader2 size={12} className="animate-spin text-[var(--color-primary)]" />
      ) : editing ? (
        <AccessSelector current={currentLevel} onSelect={handleSelect} onCancel={() => setEditing(false)} />
      ) : (
        <AccessBadge level={currentLevel} onClick={() => setEditing(true)} />
      )}
    </div>
  )
}

function FolderTree({ folderId, clientId, permissions, onPermissionChange, depth = 0 }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchItems = useCallback(async () => {
    if (!folderId) return
    setLoading(true)
    try {
      // Employee calls get all files (no permission filtering for employees)
      const data = await vaultApi.listFiles(folderId)
      setItems(data.files || [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [folderId])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && items.length === 0 && !loading) fetchItems()
  }

  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <div onClick={handleToggle} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--color-surface-highest)]/30">
        {open ? <ChevronDown size={12} className="text-[var(--color-on-surface-variant)]" /> : <ChevronRight size={12} className="text-[var(--color-on-surface-variant)]" />}
        {open ? <FolderOpen size={14} className="text-[var(--color-primary)]" /> : <Folder size={14} className="text-[var(--color-on-surface-variant)]" />}
        <span className="text-[12px] font-semibold text-[var(--color-on-surface)]">{folderId}</span>
      </div>
      {open && (
        <div className="mt-1">
          {loading && <div className="px-4 py-2"><Loader2 size={12} className="animate-spin text-[var(--color-primary)]" /></div>}
          {!loading && items.map(item => (
            <ResourceRow key={item.id} item={item} clientId={clientId} permissions={permissions} onPermissionChange={onPermissionChange} />
          ))}
          {!loading && items.length === 0 && <p className="px-4 text-[11px] text-[var(--color-on-surface-variant)] italic">Empty</p>}
        </div>
      )}
    </div>
  )
}

export default function PermissionManagerPanel({ onClose }) {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [permissions, setPermissions] = useState({}) // resourceId → accessLevel
  const [vaultFolders, setVaultFolders] = useState([]) // [{id, name}]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch all clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await projectApi.getAllClients()
        setClients(data.clients || data || [])
      } catch { setClients([]) }
    }
    fetchClients()
  }, [])

  // Fetch permissions when client selected
  useEffect(() => {
    if (!selectedClient) { setPermissions({}); setVaultFolders([]); return }
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const permData = await permissionApi.getClientPermissions(selectedClient.id)
        const permMap = {}
        for (const p of (permData.permissions || [])) {
          permMap[p.resourceId] = p.accessLevel
        }
        setPermissions(permMap)

        // Get vault folders for this client (non-fatal if vault doesn't exist yet)
        if (selectedClient.boxFolderId) {
          try {
            const data = await vaultApi.listFiles(selectedClient.boxFolderId)
            setVaultFolders((data.files || []).filter(f => f.type === 'folder'))
          } catch (vaultErr) {
            // Vault folder not found or inaccessible — not a blocking error
            console.warn('Could not load vault folders:', vaultErr.message)
            setVaultFolders([])
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedClient])

  const handlePermissionChange = async (resourceId, resourceType, accessLevel, resourceName) => {
    await permissionApi.setPermission(selectedClient.id, resourceId, resourceType, accessLevel, resourceName)
    setPermissions(prev => ({ ...prev, [resourceId]: accessLevel }))
  }

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  )

  return (
    <GlassPanel className="max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          {selectedClient && (
            <button onClick={() => setSelectedClient(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-highest)] transition-colors mr-1">
              <ChevronRight size={14} className="rotate-180" />
            </button>
          )}
          <Shield size={16} className="text-[var(--color-on-surface)]" />
          <span className="text-[15px] font-semibold text-[var(--color-on-surface)]">Permission Manager</span>
        </div>
        {onClose && <button onClick={onClose} className="text-[12px] text-[var(--color-on-surface-variant)] cursor-pointer bg-transparent border-none hover:text-white">Close</button>}
      </div>

      {/* Client list */}
      {!selectedClient && (
        <div className="mb-4">
          <p className="m-0 mb-2 text-[11px] font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wide">Select a Client</p>
          {clients.length > 8 && (
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Filter clients..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-[12px] bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          )}
          <div className="max-h-[320px] overflow-y-auto flex flex-col gap-1">
            {filteredClients.length > 0 ? (
              filteredClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClient(c); setClientSearch('') }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer bg-transparent border-none hover:bg-[var(--color-surface-highest)] transition-all w-full group"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--color-primary)] group-hover:bg-[var(--color-primary)]/20 transition-colors">
                    {(c.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[12px] font-semibold text-[var(--color-on-surface)] truncate">{c.name}</p>
                    <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)] truncate">{c.email}</p>
                  </div>
                  <ChevronRight size={14} className="text-[var(--color-on-surface-variant)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            ) : (
              <p className="text-[12px] text-[var(--color-on-surface-variant)] text-center py-4 italic">
                {clients.length === 0 ? 'No clients available' : 'No matching clients'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selected client info */}
      {selectedClient && (
        <div className="mb-4 flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-[10px] font-bold text-[var(--color-primary)]">
            {(selectedClient.name || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="m-0 text-[12px] font-bold text-[var(--color-on-surface)]">{selectedClient.name}</p>
            <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)]">{selectedClient.email}</p>
          </div>
          <button onClick={() => setSelectedClient(null)} className="text-[10px] text-[var(--color-on-surface-variant)] cursor-pointer bg-transparent border-none hover:text-white">Change</button>
        </div>
      )}

      {/* Vault tree */}
      {selectedClient && (
        <div>
          {loading && <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--color-primary)]" /></div>}
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f87171]/5 border border-[#f87171]/15"><AlertCircle size={12} className="text-[#f87171]" /><span className="text-[11px] text-[#f87171]">{error}</span></div>}
          {!loading && !error && (
            <div className="flex flex-col gap-0.5">
              {vaultFolders.length > 0 ? (
                vaultFolders.map(folder => (
                  <div key={folder.id}>
                    <ResourceRow item={{ ...folder, type: 'folder' }} clientId={selectedClient.id} permissions={permissions} onPermissionChange={handlePermissionChange} />
                    <FolderTree folderId={folder.id} clientId={selectedClient.id} permissions={permissions} onPermissionChange={handlePermissionChange} depth={1} />
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-[var(--color-on-surface-variant)] text-center py-6 italic">
                  No vault folders found. Onboard this client to create their vault.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  )
}
