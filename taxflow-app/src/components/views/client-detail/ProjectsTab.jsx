import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react'
import { FolioPanel as GlassPanel, Badge, ProgressBar } from '../../ui'
import { projectApi } from '../../../services/api'
import EmptyState from '../../EmptyState'
import { SkeletonRow } from '../../Skeleton'
import { ENGAGEMENT_STATUS_COLORS } from '../../../constants/roles'


/* ── Projects Tab ── */
export function ProjectsTab({ clientId, navigate }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await projectApi.getClientProjects(clientId)
      setProjects(data.projects || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  if (loading) {
    return <GlassPanel><SkeletonRow count={3} /></GlassPanel>
  }

  if (error) {
    return (
      <GlassPanel>
        <div className="py-6 text-center">
          <AlertTriangle size={24} className="text-[var(--color-error)] mx-auto mb-2" />
          <p className="text-[var(--color-error)] text-xs font-semibold m-0 mb-2">Failed to load projects</p>
          <button onClick={fetchProjects} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer bg-[var(--color-error-muted)] border border-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </GlassPanel>
    )
  }

  if (projects.length === 0) {
    return <GlassPanel><EmptyState icon={FolderOpen} title="No projects yet" subtitle="Projects will appear here once created for this client." /></GlassPanel>
  }

  return (
    <GlassPanel>
      <div className="flex flex-col gap-3">
        {projects.map(project => {
          const pColor = ENGAGEMENT_STATUS_COLORS[project.status] || 'var(--color-on-surface-variant)'
          return (
            <div
              key={project.id}
              onClick={() => navigate(`/clients/${clientId}/projects/${project.id}`)}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-highest)] hover:border-[var(--color-outline)] group"
            >
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">{project.name}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1 max-w-[200px]">
                    <ProgressBar value={project.progressPercentage ?? 0} color={pColor} />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-on-surface-variant)]">
                    {project.progressPercentage ?? 0}%
                  </span>
                  <span className="text-[11px] text-[var(--color-on-surface-variant)]">
                    {project.documentCount ?? 0} docs
                  </span>
                </div>
              </div>
              <Badge color={pColor}>{(project.status || '').replace('_', ' ')}</Badge>
              <ChevronRight size={16} className="text-[var(--color-on-surface-variant)] opacity-40 group-hover:opacity-80 transition-opacity" />
            </div>
          )
        })}
      </div>
    </GlassPanel>
  )
}

