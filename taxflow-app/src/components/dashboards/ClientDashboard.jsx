import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, CheckCircle, Clock, MessageSquare, Shield, ChevronRight, Calendar } from 'lucide-react'
import { SectionHeader, GlassPanel, PanelTitle, ProgressBar, Badge, StatusBadge } from '../ui'
import { useDocumentWorkflow } from '../../context/DocumentWorkflowContext'
import ClientUploadView from '../ClientUploadView'
import UploadDropzone from '../UploadDropzone'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

const PREPARER_REQUESTS = [
  { title: 'Please upload your W-2 from Employer', priority: 'urgent', due: 'Mar 12', done: false },
  { title: 'Confirm home office square footage for Sch. C', priority: 'normal', due: 'Mar 18', done: false },
  { title: 'Upload 1099-INT from Chase Bank', priority: 'normal', due: 'Mar 18', done: true },
  { title: 'Review and sign Form 8879 (e-file authorization)', priority: 'urgent', due: 'Apr 1', done: false },
]

const TAX_STEPS = [
  { label: 'Documents Submitted', done: true },
  { label: 'Preparer Review', done: true },
  { label: 'Quality Check', done: false },
  { label: 'Client Signature', done: false },
  { label: 'Filed with IRS', done: false },
]

export default function ClientDashboard() {
  const [dragging, setDragging] = useState(false)
  const [uploaded, setUploaded] = useState([])
  const [selectedRequest, setSelectedRequest] = useState(null)
  const { requests, vault, vaultLoading, initializeVault } = useDocumentWorkflow()

  // Initialize vault on mount (simulating logged-in client)
  useEffect(() => {
    const initVault = async () => {
      try {
        // In a real app, these would come from the auth context
        await initializeVault('John Doe', 'client-1', 'john.doe@example.com')
      } catch (error) {
        console.error('Failed to initialize vault:', error)
      }
    }
    
    if (!vault && !vaultLoading) {
      initVault()
    }
  }, [vault, vaultLoading, initializeVault])

  const clientRequests = requests.filter(r => r.clientId === 'client-1')
  const activeRequest = selectedRequest
    ? clientRequests.find(r => r.id === selectedRequest)
    : null

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    setUploaded(prev => [...prev, ...files.map(f => f.name)])
  }

  if (activeRequest) {
    return (
      <ClientUploadView
        request={activeRequest}
        onBack={() => setSelectedRequest(null)}
      />
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={itemVariants}
        style={{
          marginBottom: 28,
          padding: '24px 28px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(99,102,241,0.06))',
          border: '1px solid rgba(6,182,212,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Welcome back, Jordan.
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Your 2024 tax return is in progress. Your preparer is reviewing your documents.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Filing Status</div>
          <Badge color="#fbbf24">In Review</Badge>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 mb-6">
        {/* Progress tracker */}
        <GlassPanel delay={100}>
          <PanelTitle>Tax Year 2024 — Your Progress</PanelTitle>
          <div style={{ padding: '8px 0' }}>
            {TAX_STEPS.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: i < TAX_STEPS.length - 1 ? 0 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: step.done ? '#34d399' : 'rgba(255,255,255,0.07)',
                      border: `2px solid ${step.done ? '#34d399' : 'rgba(255,255,255,0.12)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: step.done ? '0 0 12px rgba(52,211,153,0.4)' : 'none',
                      transition: 'all 0.3s',
                    }}
                  >
                    {step.done
                      ? <CheckCircle size={14} color="#000" strokeWidth={2.5} />
                      : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'block' }} />
                    }
                  </div>
                  {i < TAX_STEPS.length - 1 && (
                    <div
                      style={{
                        width: 2, height: 28, margin: '3px 0',
                        background: step.done ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.07)',
                        transition: 'background 0.3s',
                      }}
                    />
                  )}
                </div>
                <div style={{ paddingTop: 5, paddingBottom: i < TAX_STEPS.length - 1 ? 0 : 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: step.done ? 600 : 400, color: step.done ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Overall completion</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>40%</span>
            </div>
            <ProgressBar value={40} color="#34d399" />
          </div>
        </GlassPanel>

        {/* Preparer requests */}
        <GlassPanel delay={150}>
          <PanelTitle>Requests from Your Preparer</PanelTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PREPARER_REQUESTS.map((r) => (
              <div
                key={r.title}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: r.done ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${r.done ? 'rgba(52,211,153,0.12)' : r.priority === 'urgent' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)'}`,
                  opacity: r.done ? 0.5 : 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!r.done) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!r.done) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ paddingTop: 1 }}>
                    {r.done
                      ? <CheckCircle size={14} color="#34d399" />
                      : <Clock size={14} color={r.priority === 'urgent' ? '#f87171' : '#fbbf24'} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: r.done ? 'rgba(255,255,255,0.4)' : '#fff', lineHeight: 1.4, textDecoration: r.done ? 'line-through' : 'none' }}>
                      {r.title}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
                      {!r.done && <Badge color={r.priority === 'urgent' ? '#f87171' : '#fbbf24'}>{r.priority}</Badge>}
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Due {r.due}</span>
                    </div>
                  </div>
                  {!r.done && <ChevronRight size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0, marginTop: 2 }} />}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Upload dropzone */}
      <motion.div variants={itemVariants}>
        <UploadDropzone 
          onUpload={(fileName, fileData) => {
            setUploaded(prev => [...prev, fileName])
          }}
          disabled={!vault}
          folderId={vault?.id}
        />
      </motion.div>

      {/* Document Requests */}
      {clientRequests.length > 0 && (
        <motion.div variants={itemVariants} style={{ marginTop: 24 }}>
          <GlassPanel delay={200}>
            <PanelTitle>Document Requests</PanelTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    e.currentTarget.style.transform = 'translateX(2px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <FileText size={16} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.4 }}>
                      {req.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                        <Calendar size={10} />
                        Due {req.dueDate}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                  <ChevronRight size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </motion.div>
  )
}
