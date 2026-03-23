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
  hidden: { opacity: 0, y: 15 },
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
      className="max-w-[1200px] mx-auto"
    >
      <motion.div
        variants={itemVariants}
        className="mb-8 p-7 rounded-[24px] flex items-center gap-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 10%, transparent), color-mix(in srgb, var(--color-primary-container) 8%, transparent))',
          border: '1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)',
        }}
      >
        <div className="absolute top-0 right-0 w-[400px] h-[400px] -translate-y-1/2 translate-x-1/3 rounded-full opacity-10 pointer-events-none" style={{ background: 'var(--color-primary)', filter: 'blur(80px)' }} />
        
        <div className="relative z-10">
          <h1 className="m-0 text-[28px] font-bold text-[var(--color-on-surface)] tracking-[-0.03em] leading-tight font-display mb-1.5">
            Welcome back, Jordan.
          </h1>
          <p className="m-0 text-[14px] text-[var(--color-on-surface-variant)] tracking-wide">
            Your 2024 tax return is in progress. Your preparer is reviewing your documents.
          </p>
        </div>
        <div className="ml-auto text-right shrink-0 relative z-10">
          <div className="text-[11px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-1.5 opacity-70">Filing Status</div>
          <Badge color="var(--color-tertiary)">In Review</Badge>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5 mb-8">
        {/* Progress tracker */}
        <GlassPanel delay={100}>
          <PanelTitle>Tax Year 2024 — Your Progress</PanelTitle>
          <div className="py-2">
            {TAX_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-start gap-4" style={{ marginBottom: i < TAX_STEPS.length - 1 ? 0 : 0 }}>
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 relative z-10"
                    style={{
                      background: step.done ? 'var(--color-secondary)' : 'var(--color-surface-high)',
                      border: `2px solid ${step.done ? 'var(--color-secondary)' : 'var(--color-outline-variant)'}`,
                      boxShadow: step.done ? '0 0 16px color-mix(in srgb, var(--color-secondary) 40%, transparent)' : 'none',
                    }}
                  >
                    {step.done
                      ? <CheckCircle size={16} color="var(--color-surface-lowest)" strokeWidth={3} />
                      : <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-outline)] block" />
                    }
                  </div>
                  {i < TAX_STEPS.length - 1 && (
                    <div
                      className="w-0.5 h-7 my-1 transition-colors duration-300"
                      style={{
                        background: step.done ? 'color-mix(in srgb, var(--color-secondary) 50%, transparent)' : 'var(--color-outline-variant)',
                      }}
                    />
                  )}
                </div>
                <div className="pt-1.5">
                  <p className="m-0 text-[14px]" style={{ fontWeight: step.done ? 700 : 500, color: step.done ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}>
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--color-outline-variant)]">
            <div className="flex justify-between mb-3">
              <span className="text-[12px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest">Overall completion</span>
              <span className="text-[13px] font-extrabold text-[var(--color-secondary)]">40%</span>
            </div>
            <ProgressBar value={40} color="var(--color-secondary)" />
          </div>
        </GlassPanel>

        {/* Preparer requests */}
        <GlassPanel delay={150}>
          <PanelTitle>Requests from Your Preparer</PanelTitle>
          <div className="flex flex-col gap-3">
            {PREPARER_REQUESTS.map((r) => (
              <div
                key={r.title}
                className="p-3.5 rounded-[16px] cursor-pointer transition-all duration-300 group"
                style={{
                  background: r.done ? 'color-mix(in srgb, var(--color-secondary) 8%, transparent)' : 'var(--color-surface-high)',
                  border: `1px solid ${r.done ? 'color-mix(in srgb, var(--color-secondary) 25%, transparent)' : r.priority === 'urgent' ? 'color-mix(in srgb, #ffb4ab 25%, transparent)' : 'var(--color-outline-variant)'}`,
                  opacity: r.done ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (!r.done) {
                    e.currentTarget.style.background = 'var(--color-surface-highest)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'
                  }
                }}
                onMouseLeave={e => {
                  if (!r.done) {
                    e.currentTarget.style.background = 'var(--color-surface-high)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5 shrink-0">
                    {r.done
                      ? <CheckCircle size={16} className="text-[var(--color-secondary)]" />
                      : <Clock size={16} color={r.priority === 'urgent' ? '#ffb4ab' : 'var(--color-tertiary)'} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[13px] font-semibold leading-snug" style={{ color: r.done ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)', textDecoration: r.done ? 'line-through' : 'none' }}>
                      {r.title}
                    </p>
                    <div className="flex gap-2.5 mt-2 items-center">
                      {!r.done && <Badge color={r.priority === 'urgent' ? '#ffb4ab' : 'var(--color-tertiary)'}>{r.priority}</Badge>}
                      <span className="text-[11px] font-medium text-[var(--color-on-surface-variant)] flex items-center gap-1.5">
                        <Calendar size={10} />
                        Due {r.due}
                      </span>
                    </div>
                  </div>
                  {!r.done && <ChevronRight size={14} className="text-[var(--color-on-surface-variant)] shrink-0 mt-1 origin-left transition-transform duration-300 group-hover:translate-x-1" />}
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
        <motion.div variants={itemVariants} className="mt-8">
          <GlassPanel delay={200}>
            <PanelTitle>Document Requests</PanelTitle>
            <div className="flex flex-col gap-3">
              {clientRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req.id)}
                  className="p-4 rounded-[16px] bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)] cursor-pointer flex items-center gap-4 transition-all duration-300 group hover:bg-[var(--color-surface-highest)] hover:-translate-y-[2px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.3)] hover:ring-[var(--color-outline)]"
                >
                  <div className="w-10 h-10 rounded-[12px] bg-[var(--color-surface-container)] flex items-center justify-center border border-[var(--color-outline-variant)] group-hover:bg-[var(--color-primary)]/10 group-hover:border-[var(--color-primary)]/30 transition-colors">
                    <FileText size={18} className="text-[var(--color-on-surface-variant)] group-hover:text-[var(--color-primary)] transition-colors" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] leading-snug">
                      {req.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container)] px-2 py-0.5 rounded-md">
                        <Calendar size={10} />
                        Due {req.dueDate}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                  <ChevronRight size={16} className="text-[var(--color-on-surface-variant)] shrink-0 group-hover:text-[var(--color-primary)] transition-colors origin-left group-hover:translate-x-1" />
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </motion.div>
  )
}
