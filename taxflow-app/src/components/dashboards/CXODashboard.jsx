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
  hidden: { opacity: 0, y: 20 },
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

const SEV_COLOR = { high: '#f87171', medium: '#fbbf24', low: '#94a3b8' }

export default function CXODashboard() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="Executive Overview"
          subtitle="Firm-wide document compliance, portfolio health, and critical alerts"
          delay={0}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients" value="5,939" change="142 new this quarter" changeType="up" color="#06b6d4" icon={Users} delay={50} />
        <StatCard label="Docs Pending" value="2,418" change="↓ 12% from last week" changeType="up" color="#a78bfa" icon={FileText} delay={100} />
        <StatCard label="Avg. Compliance" value="87.4%" change="+1.8% this month" changeType="up" color="#34d399" icon={TrendingUp} delay={150} />
        <StatCard label="Overdue Filings" value="31" change="7 critical" changeType="down" color="#f87171" icon={AlertTriangle} delay={200} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Portfolio compliance */}
        <GlassPanel delay={250}>
          <PanelTitle>Portfolio Compliance Rates</PanelTitle>
          {FIRMS.map((firm) => (
            <div key={firm.name} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{firm.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
                    {firm.docs.toLocaleString()} docs
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: firm.trend.startsWith('+') ? '#34d399' : '#f87171' }}>
                    {firm.trend}
                  </span>
                  <span
                    style={{
                      fontSize: 12, fontWeight: 700,
                      color: firm.compliance >= 90 ? '#34d399' : firm.compliance >= 80 ? '#fbbf24' : '#f87171',
                    }}
                  >
                    {firm.compliance}%
                  </span>
                </div>
              </div>
              <ProgressBar
                value={firm.compliance}
                color={firm.compliance >= 90 ? '#34d399' : firm.compliance >= 80 ? '#fbbf24' : '#f87171'}
              />
            </div>
          ))}
        </GlassPanel>

        {/* Tax year progress */}
        <GlassPanel delay={300}>
          <PanelTitle>Tax Year 2024 — Filing Progress</PanelTitle>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Returns Filed', val: 3812, total: 5939, color: '#34d399' },
              { label: 'Under Review', val: 1241, total: 5939, color: '#06b6d4' },
              { label: 'Awaiting Docs', val: 748, total: 5939, color: '#fbbf24' },
              { label: 'Not Started', val: 138, total: 5939, color: '#f87171' },
            ].map(item => {
              const pct = Math.round((item.val / item.total) * 100)
              return (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>
                      {item.val.toLocaleString()} &nbsp;<span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>({pct}%)</span>
                    </span>
                  </div>
                  <ProgressBar value={pct} color={item.color} />
                </div>
              )
            })}
          </div>

          <div
            style={{
              marginTop: 20, padding: '12px 16px', borderRadius: 12,
              background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={13} color="#06b6d4" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#06b6d4' }}>
                38 days until April 15 filing deadline
              </span>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Overdue alerts */}
      <motion.div variants={itemVariants}>
        <GlassPanel delay={350}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <PanelTitle>Critical Alerts & Overdue Filings</PanelTitle>
            <Badge color="#f87171">31 Overdue</Badge>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {ALERTS.map((a) => (
              <div
                key={a.client + a.issue}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid ${SEV_COLOR[a.severity]}20`,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.045)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
              >
                <div
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: SEV_COLOR[a.severity],
                    boxShadow: `0 0 6px ${SEV_COLOR[a.severity]}80`,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff' }}>{a.client}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{a.issue}</p>
                </div>
                <Badge color={SEV_COLOR[a.severity]}>{a.severity}</Badge>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>Due {a.due}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}
