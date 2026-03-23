import { motion } from 'framer-motion'
import { Shield, Users, Activity, Server, Bot, CheckCircle, AlertTriangle, Cpu, Globe, Database, ArrowUpRight } from 'lucide-react'
import { StatCard, SectionHeader, GlassPanel, PanelTitle, StatusDot, ProgressBar, Badge } from '../ui'

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

const API_SERVICES = [
  { name: 'Box AI Document Intelligence', status: 'operational', latency: '42ms', uptime: '99.98%', color: 'var(--color-secondary)' },
  { name: 'Metadata Extraction Engine', status: 'operational', latency: '78ms', uptime: '99.95%', color: 'var(--color-secondary)' },
  { name: 'OCR Processing Pipeline', status: 'degraded', latency: '210ms', uptime: '98.2%', color: 'var(--color-tertiary)' },
  { name: 'Authentication Service', status: 'operational', latency: '18ms', uptime: '100%', color: 'var(--color-secondary)' },
  { name: 'Storage API (Box)', status: 'operational', latency: '54ms', uptime: '99.99%', color: 'var(--color-secondary)' },
]

const RECENT_USERS = [
  { name: 'Sarah Chen', role: 'Tax Preparer', email: 'schen@firm.com', status: 'active', joined: '2d ago' },
  { name: 'Marcus Webb', role: 'CXO / Partner', email: 'mwebb@firm.com', status: 'active', joined: '5d ago' },
  { name: 'Priya Nair', role: 'Tax Preparer', email: 'pnair@firm.com', status: 'inactive', joined: '1w ago' },
  { name: 'James Liu', role: 'Client', email: 'jliu@email.com', status: 'active', joined: '2w ago' },
]

export default function SuperAdminDashboard() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1400px] mx-auto"
    >
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="System Administration"
          subtitle="Platform health, user management, and Box AI integration overview"
          delay={0}
        />
      </motion.div>

      {/* Stats row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Total Users" value="1,284" change="24 this month" changeType="up" color="var(--color-primary)" icon={Users} delay={50} />
        <StatCard label="Active Sessions" value="47" change="Live now" changeType="neutral" color="var(--color-tertiary)" icon={Activity} delay={100} />
        <StatCard label="Docs Processed" value="98,341" change="12% this week" changeType="up" color="var(--color-secondary)" icon={Database} delay={150} />
        <StatCard label="System Uptime" value="99.97%" change="30-day average" changeType="neutral" color="var(--color-on-surface-variant)" icon={Server} delay={200} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 mb-8">
        {/* Box AI Integration Status */}
        <GlassPanel delay={250}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-11 h-11 rounded-[12px] bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center shadow-[0_0_20px_var(--color-primary)]/20 animate-pulse-glow shrink-0">
              <Bot size={22} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="m-0 text-[16px] font-bold text-[var(--color-on-surface)] tracking-tight">
                Box AI Integration Status
              </h3>
              <p className="m-0 text-[12px] font-medium text-[var(--color-on-surface-variant)] mt-0.5">Real-time API health monitor</p>
            </div>
            <div className="ml-auto">
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 text-[11px] font-bold tracking-widest text-[var(--color-secondary)] uppercase">
                <StatusDot color="var(--color-secondary)" pulse />
                All Systems Go
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {API_SERVICES.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)] hover:bg-[var(--color-surface-highest)] transition-colors duration-300 group"
              >
                <StatusDot color={svc.color} />
                <span className="flex-1 text-[13px] font-semibold text-[var(--color-on-surface)] leading-snug">
                  {svc.name}
                </span>
                <span className="text-[12px] font-medium text-[var(--color-on-surface-variant)] w-14 text-right tabular-nums">{svc.latency}</span>
                <Badge color={svc.color}>{svc.uptime}</Badge>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* System resource usage */}
        <GlassPanel delay={300}>
          <PanelTitle>Resource Usage</PanelTitle>
          <div className="flex flex-col gap-5 mt-2">
            {[
              { label: 'CPU Load', val: 34, color: 'var(--color-tertiary)' },
              { label: 'Memory', val: 61, color: 'var(--color-primary)' },
              { label: 'Storage (Box)', val: 48, color: 'var(--color-secondary)' },
              { label: 'API Rate Limit', val: 22, color: 'var(--color-on-surface-variant)' },
              { label: 'Bandwidth', val: 77, color: '#ffb4ab' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-2">
                  <span className="text-[13px] font-semibold text-[var(--color-on-surface-variant)]">{item.label}</span>
                  <span className="text-[12px] font-bold tracking-wide tabular-nums" style={{ color: item.val > 70 ? item.color : 'var(--color-on-surface)' }}>
                    {item.val}%
                  </span>
                </div>
                <ProgressBar value={item.val} color={item.color} />
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* User management */}
      <motion.div variants={itemVariants}>
        <GlassPanel delay={350}>
          <div className="flex items-center justify-between mb-6">
            <PanelTitle>Recent Users</PanelTitle>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[11px] font-bold tracking-widest uppercase border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/20 transition-colors duration-300">
              Manage All
              <ArrowUpRight size={12} strokeWidth={3} />
            </button>
          </div>

          <div className="grid gap-3">
            {RECENT_USERS.map((u) => (
              <div
                key={u.email}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] transition-all duration-300 hover:bg-[var(--color-surface-highest)] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 bg-[var(--color-surface-container)] ring-1 ring-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]">
                  {u.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">{u.name}</p>
                  <p className="m-0 text-[12px] font-medium text-[var(--color-on-surface-variant)] truncate mt-0.5">{u.email}</p>
                </div>
                <Badge color="var(--color-primary)">{u.role}</Badge>
                <div className="flex items-center justify-center w-6">
                  <StatusDot color={u.status === 'active' ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)'} />
                </div>
                <span className="text-[11px] font-medium text-[var(--color-on-surface-variant)] w-12 text-right shrink-0">
                  {u.joined}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}
