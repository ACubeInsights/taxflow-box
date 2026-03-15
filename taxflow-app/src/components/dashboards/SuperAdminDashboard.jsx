import { motion } from 'framer-motion'
import { Shield, Users, Activity, Server, Bot, CheckCircle, AlertTriangle, Cpu, Globe, Database } from 'lucide-react'
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

const API_SERVICES = [
  { name: 'Box AI Document Intelligence', status: 'operational', latency: '42ms', uptime: '99.98%', color: '#34d399' },
  { name: 'Metadata Extraction Engine', status: 'operational', latency: '78ms', uptime: '99.95%', color: '#34d399' },
  { name: 'OCR Processing Pipeline', status: 'degraded', latency: '210ms', uptime: '98.2%', color: '#fbbf24' },
  { name: 'Authentication Service', status: 'operational', latency: '18ms', uptime: '100%', color: '#34d399' },
  { name: 'Storage API (Box)', status: 'operational', latency: '54ms', uptime: '99.99%', color: '#34d399' },
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
    >
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="System Administration"
          subtitle="Platform health, user management, and Box AI integration overview"
          delay={0}
        />
      </motion.div>

      {/* Stats row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value="1,284" change="24 this month" changeType="up" color="#a78bfa" icon={Users} delay={50} />
        <StatCard label="Active Sessions" value="47" change="Live now" changeType="neutral" color="#06b6d4" icon={Activity} delay={100} />
        <StatCard label="Docs Processed" value="98,341" change="12% this week" changeType="up" color="#34d399" icon={Database} delay={150} />
        <StatCard label="System Uptime" value="99.97%" change="30-day average" changeType="neutral" color="#fbbf24" icon={Server} delay={200} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-6">
        {/* Box AI Integration Status */}
        <GlassPanel delay={250}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(6,182,212,0.12)',
                border: '1px solid rgba(6,182,212,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bot size={17} color="#06b6d4" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                Box AI Integration Status
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Real-time API health monitor</p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusDot color="#34d399" pulse />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#34d399' }}>All Systems Go</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {API_SERVICES.map((svc) => (
              <div
                key={svc.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <StatusDot color={svc.color} />
                <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
                  {svc.name}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{svc.latency}</span>
                <Badge
                  color={svc.color}
                >
                  {svc.uptime}
                </Badge>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* System resource usage */}
        <GlassPanel delay={300}>
          <PanelTitle>Resource Usage</PanelTitle>
          {[
            { label: 'CPU Load', val: 34, color: '#06b6d4' },
            { label: 'Memory', val: 61, color: '#a78bfa' },
            { label: 'Storage (Box)', val: 48, color: '#34d399' },
            { label: 'API Rate Limit', val: 22, color: '#fbbf24' },
            { label: 'Bandwidth', val: 77, color: '#f87171' },
          ].map((item) => (
            <div key={item.label} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: item.val > 70 ? item.color : 'rgba(255,255,255,0.6)' }}>
                  {item.val}%
                </span>
              </div>
              <ProgressBar value={item.val} color={item.color} />
            </div>
          ))}
        </GlassPanel>
      </motion.div>

      {/* User management */}
      <motion.div variants={itemVariants}>
        <GlassPanel delay={350}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <PanelTitle>Recent Users</PanelTitle>
            <button
              style={{
                fontSize: 12, fontWeight: 600, color: '#06b6d4',
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.1)'}
            >
              Manage All Users
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {RECENT_USERS.map((u) => (
              <div
                key={u.email}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'background 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
              >
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                    flexShrink: 0,
                  }}
                >
                  {u.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff' }}>{u.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{u.email}</p>
                </div>
                <Badge color="#a78bfa">{u.role}</Badge>
                <StatusDot color={u.status === 'active' ? '#34d399' : 'rgba(255,255,255,0.2)'} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', width: 48, textAlign: 'right', flexShrink: 0 }}>
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
