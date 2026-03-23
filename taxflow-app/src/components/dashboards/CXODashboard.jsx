import { motion } from 'framer-motion'
import { TrendingUp, FileText, AlertTriangle, CheckCircle, DollarSign, Users, Clock } from 'lucide-react'
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

const FIRMS = [
  { name: 'Enterprises Division', docs: 1842, compliance: 94, status: 'good', trend: '+2.1%' },
  { name: 'SMB Portfolio', docs: 3201, compliance: 87, status: 'warn', trend: '-0.5%' },
  { name: 'Private Wealth', docs: 612, compliance: 98, status: 'good', trend: '+0.8%' },
  { name: 'Startups & VC', docs: 284, compliance: 72, status: 'alert', trend: '-3.2%' },
]

const ALERTS = [
  { client: 'Nexus Corp', issue: 'W-2 Forms Missing (3)', severity: 'high', due: 'Mar 15' },
  { client: 'Blueprint LLC', issue: 'Amendment Required — Sch. C', severity: 'medium', due: 'Mar 20' },
  { client: 'Aura Wellness', issue: 'Estimated Tax Payment Overdue', severity: 'high', due: 'Mar 10' },
  { client: 'Summit Partners', issue: 'K-1 Distribution Unreviewed', severity: 'low', due: 'Apr 1' },
]

const SEV_COLOR = { high: '#ffb4ab', medium: 'var(--color-tertiary)', low: 'var(--color-on-surface-variant)' }

export default function CXODashboard() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1400px] mx-auto"
    >
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="Executive Overview"
          subtitle="Firm-wide document compliance, portfolio health, and critical alerts"
          delay={0}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Total Clients" value="5,939" change="142 new this quarter" changeType="up" color="var(--color-tertiary)" icon={Users} delay={50} />
        <StatCard label="Docs Pending" value="2,418" change="↓ 12% from last week" changeType="up" color="var(--color-primary)" icon={FileText} delay={100} />
        <StatCard label="Avg. Compliance" value="87.4%" change="+1.8% this month" changeType="up" color="var(--color-secondary)" icon={TrendingUp} delay={150} />
        <StatCard label="Overdue Filings" value="31" change="7 critical" changeType="down" color="#ffb4ab" icon={AlertTriangle} delay={200} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        {/* Portfolio compliance */}
        <GlassPanel delay={250}>
          <PanelTitle>Portfolio Compliance Rates</PanelTitle>
          <div className="flex flex-col gap-6">
            {FIRMS.map((firm) => (
              <div key={firm.name}>
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[var(--color-on-surface)]">{firm.name}</span>
                    <span className="text-[12px] font-medium text-[var(--color-on-surface-variant)] px-2 py-0.5 rounded-md bg-[var(--color-surface-high)]">
                      {firm.docs.toLocaleString()} docs
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[12px] font-bold ${firm.trend.startsWith('+') ? 'text-[var(--color-secondary)]' : 'text-[#ffb4ab]'}`}>
                      {firm.trend}
                    </span>
                    <span
                      className="text-[14px] font-extrabold"
                      style={{ color: firm.compliance >= 90 ? 'var(--color-secondary)' : firm.compliance >= 80 ? 'var(--color-tertiary)' : '#ffb4ab' }}
                    >
                      {firm.compliance}%
                    </span>
                  </div>
                </div>
                <ProgressBar
                  value={firm.compliance}
                  color={firm.compliance >= 90 ? 'var(--color-secondary)' : firm.compliance >= 80 ? 'var(--color-tertiary)' : '#ffb4ab'}
                />
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Tax year progress */}
        <GlassPanel delay={300}>
          <PanelTitle>Tax Year 2024 — Filing Progress</PanelTitle>

          <div className="flex flex-col gap-5 mt-2">
            {[
              { label: 'Returns Filed', val: 3812, total: 5939, color: 'var(--color-secondary)' },
              { label: 'Under Review', val: 1241, total: 5939, color: 'var(--color-tertiary)' },
              { label: 'Awaiting Docs', val: 748, total: 5939, color: 'var(--color-primary)' },
              { label: 'Not Started', val: 138, total: 5939, color: '#ffb4ab' },
            ].map((item, idx) => {
              const pct = Math.round((item.val / item.total) * 100)
              return (
                <div key={item.label}>
                  <div className="flex justify-between mb-2">
                    <span className="text-[13px] font-semibold text-[var(--color-on-surface-variant)]">{item.label}</span>
                    <span className="text-[13px] font-bold" style={{ color: item.color }}>
                      {item.val.toLocaleString()} &nbsp;<span className="text-[var(--color-on-surface-variant)] font-medium">({pct}%)</span>
                    </span>
                  </div>
                  <ProgressBar value={pct} color={item.color} />
                </div>
              )
            })}
          </div>

          <div className="mt-8 p-4 rounded-xl flex items-center gap-3 bg-[var(--color-tertiary)]/10 border border-[var(--color-tertiary)]/20 shadow-[0_4px_20px_color-mix(in_srgb,var(--color-tertiary)_10%,transparent)]">
            <Clock size={16} className="text-[var(--color-tertiary)] shrink-0" strokeWidth={2.5} />
            <span className="text-[13px] font-bold text-[var(--color-tertiary)] tracking-wide">
              38 days until April 15 filing deadline
            </span>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Overdue alerts */}
      <motion.div variants={itemVariants}>
        <GlassPanel delay={350}>
          <div className="flex items-center justify-between mb-6">
            <PanelTitle>Critical Alerts & Overdue Filings</PanelTitle>
            <Badge color="#ffb4ab">31 Overdue</Badge>
          </div>

          <div className="flex flex-col gap-3">
            {ALERTS.map((a) => (
              <div
                key={a.client + a.issue}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-[var(--color-surface-high)] border transition-all duration-300 group hover:bg-[var(--color-surface-highest)] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)]"
                style={{ borderColor: `color-mix(in srgb, ${SEV_COLOR[a.severity]} 25%, transparent)` }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: SEV_COLOR[a.severity],
                    boxShadow: `0 0 10px ${SEV_COLOR[a.severity]}`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">{a.client}</p>
                  <p className="m-0 text-[12px] font-medium text-[var(--color-on-surface-variant)] truncate mt-0.5">{a.issue}</p>
                </div>
                <Badge color={SEV_COLOR[a.severity]}>{a.severity}</Badge>
                <span className="text-[11px] font-medium text-[var(--color-on-surface-variant)] shrink-0 w-[60px] text-right">Due {a.due}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}
