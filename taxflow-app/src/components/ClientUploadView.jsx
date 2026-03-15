import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, CheckCircle, Clock } from 'lucide-react'
import { useDocumentWorkflow } from '../context/DocumentWorkflowContext'
import { StatusBadge, Badge, GlassPanel } from './ui'
import UploadDropzone from './UploadDropzone'
import RevisionAlert from './RevisionAlert'

const PRIORITY_COLORS = {
  Low: '#6b7280',
  Medium: '#eab308',
  High: '#f97316',
  Urgent: '#ef4444',
}

export default function ClientUploadView({ request, onBack }) {
  const { dispatch, vault } = useDocumentWorkflow()

  const handleUpload = (fileName) => {
    dispatch({
      type: 'UPLOAD_DOCUMENT',
      payload: { requestId: request.id, fileName },
    })
  }

  const isUploadable =
    request.status === 'Pending' || request.status === 'Revision_Requested'
  const isUnderReview = request.status === 'Under_Review'
  const isApproved = request.status === 'Approved'

  return (
    <div>
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          padding: '8px 0',
          marginBottom: 20,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')
        }
      >
        <ArrowLeft size={16} />
        Back to Documents
      </motion.button>

      {/* Document info panel */}
      <GlassPanel delay={50}>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: 22,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.03em',
          }}
        >
          {request.name}
        </h2>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: 14,
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.6,
          }}
        >
          {request.description}
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <Calendar size={14} />
            <span>Due {request.dueDate}</span>
          </div>

          <Badge color={PRIORITY_COLORS[request.priority] || '#6b7280'}>
            {request.priority}
          </Badge>

          <StatusBadge status={request.status} />
        </div>
      </GlassPanel>

      {/* Conditional content based on status */}
      <div style={{ marginTop: 20 }}>
        {/* Revision alert when status is Revision_Requested */}
        {request.status === 'Revision_Requested' && (
          <div style={{ marginBottom: 16 }}>
            <RevisionAlert comments={request.revisionComments} />
          </div>
        )}

        {/* Upload dropzone for Pending and Revision_Requested */}
        {isUploadable && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
          >
            <UploadDropzone 
              onUpload={handleUpload} 
              disabled={false} 
              folderId={vault?.id}
              requestId={request.id}
            />
          </motion.div>
        )}

        {/* Under Review message */}
        {isUnderReview && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '48px 32px',
              borderRadius: 22,
              border: '1px solid rgba(234,179,8,0.15)',
              background: 'rgba(234,179,8,0.04)',
              textAlign: 'center',
            }}
          >
            <Clock size={40} color="#eab308" strokeWidth={1.5} />
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: '#eab308',
              }}
            >
              Under Review
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'rgba(255,255,255,0.4)',
                maxWidth: 360,
                lineHeight: 1.6,
              }}
            >
              Your document is being reviewed by your tax preparer. You'll be
              notified if any changes are needed.
            </p>

            <UploadDropzone 
              onUpload={handleUpload} 
              disabled={true} 
              folderId={vault?.id}
              requestId={request.id}
            />
          </motion.div>
        )}

        {/* Approved state with green checkmark animation */}
        {isApproved && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              delay: 0.1,
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '48px 32px',
              borderRadius: 22,
              border: '1px solid rgba(34,197,94,0.2)',
              background: 'rgba(34,197,94,0.04)',
              textAlign: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 15,
                delay: 0.2,
              }}
            >
              <CheckCircle size={56} color="#22c55e" strokeWidth={1.5} />
            </motion.div>
            <p
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#22c55e',
                letterSpacing: '-0.02em',
              }}
            >
              Document Approved
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'rgba(255,255,255,0.4)',
                maxWidth: 360,
                lineHeight: 1.6,
              }}
            >
              This document has been reviewed and approved by your tax preparer.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
