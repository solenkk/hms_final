import { useEffect, useState } from 'react'
import { reportsApi, labApi, pharmacyApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Users, Stethoscope, BedDouble, DollarSign,
  FlaskConical, Pill, AlertTriangle, TrendingUp, Clock,
  Droplets, Microscope, CheckCircle2, Activity
} from 'lucide-react'
import './Dashboard.css'

const PERIOD_OPTIONS = ['today', 'week', 'month', 'year']

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const role = user?.role || ''

  const [summary, setSummary]     = useState(null)
  const [visitData, setVisitData] = useState(null)
  const [period, setPeriod]       = useState('week')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const promises = [reportsApi.dashboard().catch(() => ({ data: {} }))]
    const isAdmin  = role === 'admin'
    const isDoctor = role === 'doctor'
    const needsVisitChart = isAdmin || isDoctor || role === 'receptionist' || role === 'nurse'
    if (needsVisitChart) {
      promises.push(reportsApi.visits(period).catch(() => ({ data: {} })))
    }

    Promise.all(promises).then(([s, v]) => {
      setSummary(s.data)
      if (v) setVisitData(v.data)
    }).finally(() => setLoading(false))
  }, [period, role])

  if (loading) return (
    <div className="page-body">
      <div className="loading-center"><div className="spinner" /></div>
    </div>
  )

  const visits = summary?.visits || {}
  const beds   = summary?.beds   || {}
  const alerts = summary?.alerts || {}

  const visitChartData = visitData?.breakdown
    ? Object.entries(visitData.breakdown).map(([name, count]) => ({ name, count }))
    : []

  // ── Role-based card rendering ─────────────────────────────────────────────
  const renderCards = () => {
    // Lab Technician: only their relevant data
    if (role === 'lab_technician') {
      return (
        <>
          <div className="stats-grid">
            <StatCard
              icon={<Droplets size={20} />}
              iconBg="hsl(210,80%,55%)"
              label="Awaiting Collection"
              value={alerts.lab_awaiting_collection ?? 0}
              sub="patients waiting for draw"
              color="hsl(210,80%,55%)"
              onClick={() => navigate('/lab')}
              clickable
            />
            <StatCard
              icon={<Microscope size={20} />}
              iconBg="hsl(270,65%,58%)"
              label="Awaiting Analysis"
              value={alerts.lab_awaiting_analysis ?? 0}
              sub="samples ready to run"
              color="hsl(270,65%,58%)"
              onClick={() => navigate('/lab')}
              clickable
            />
            <StatCard
              icon={<CheckCircle2 size={20} />}
              iconBg="hsl(150,65%,45%)"
              label="Completed Today"
              value={alerts.lab_completed_today ?? 0}
              sub="tests finalized"
              color="hsl(150,65%,45%)"
            />
            <StatCard
              icon={<Activity size={20} />}
              iconBg="hsl(0,75%,58%)"
              label="Abnormal Results"
              value={alerts.lab_abnormal_today ?? 0}
              sub="requires doctor review"
              color={alerts.lab_abnormal_today > 0 ? "var(--color-danger)" : "var(--text-muted)"}
              onClick={() => alerts.lab_abnormal_today > 0 ? navigate('/lab') : null}
              clickable={alerts.lab_abnormal_today > 0}
            />
          </div>

          <div className="dashboard-charts" style={{ marginTop: '1.5rem', display: 'block' }}>
            <div className="card">
              <div className="card-header">
                <h3>Recent Completed Tests</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Test Name</th>
                      <th>Completed Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.recent_labs && alerts.recent_labs.length > 0 ? (
                      alerts.recent_labs.map(lab => (
                        <tr key={lab.id}>
                          <td>{lab.patient_name}</td>
                          <td><span className="badge badge-gray">{lab.test_name}</span></td>
                          <td>{new Date(lab.resulted_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No tests completed yet today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )
    }

    // Pharmacist: only their relevant data
    if (role === 'pharmacist') {
      return (
        <div className="stats-grid">
          <StatCard
            icon={<Pill size={20} />}
            iconBg="hsl(150,65%,45%)"
            label="Pending Prescriptions"
            value={alerts.pending_prescriptions ?? '—'}
            sub="paid & awaiting dispensing"
            color="hsl(150,65%,45%)"
            onClick={() => navigate('/pharmacy')}
            clickable
          />
          <StatCard
            icon={<AlertTriangle size={20} />}
            iconBg="hsl(38,95%,55%)"
            label="Low Stock Drugs"
            value={alerts.low_stock_drugs ?? 0}
            sub="below threshold"
            color="hsl(38,95%,55%)"
          />
        </div>
      )
    }

    // Doctor: no revenue
    if (role === 'doctor') {
      return (
        <div className="stats-grid">
          <StatCard
            icon={<Stethoscope size={20} />}
            iconBg="var(--color-primary)"
            label="Total Visits"
            value={visits.total ?? '—'}
            sub={`${visits.open ?? 0} open · ${visits.closed ?? 0} closed`}
            color="var(--color-primary)"
          />
          <StatCard
            icon={<FlaskConical size={20} />}
            iconBg="hsl(270,65%,58%)"
            label="Pending Labs"
            value={alerts.pending_lab_orders ?? 0}
            sub="awaiting collection or result"
            color="hsl(270,65%,58%)"
            onClick={() => navigate('/lab')}
            clickable
          />
          <StatCard
            icon={<Pill size={20} />}
            iconBg="hsl(0,75%,58%)"
            label="Low Stock Drugs"
            value={alerts.low_stock_drugs ?? 0}
            sub="below threshold"
            color="var(--color-danger)"
          />
          <StatCard
            icon={<BedDouble size={20} />}
            iconBg="var(--color-accent)"
            label="Beds Occupied"
            value={`${beds.occupied ?? 0} / ${beds.total ?? 0}`}
            sub={`${beds.available ?? 0} available`}
            color="var(--color-accent)"
          />
        </div>
      )
    }

    // Admin / Receptionist / Nurse / Cashier: full cards
    return (
      <div className="stats-grid">
        <StatCard
          icon={<Stethoscope size={20} />}
          iconBg="var(--color-primary)"
          label="Total Visits"
          value={visits.total ?? '—'}
          sub={`${visits.open ?? 0} open · ${visits.closed ?? 0} closed`}
          color="var(--color-primary)"
        />
        <StatCard
          icon={<BedDouble size={20} />}
          iconBg="var(--color-accent)"
          label="Beds Occupied"
          value={`${beds.occupied ?? 0} / ${beds.total ?? 0}`}
          sub={`${beds.available ?? 0} available`}
          color="var(--color-accent)"
        />

        <StatCard
          icon={<FlaskConical size={20} />}
          iconBg="hsl(270,65%,58%)"
          label="Pending Labs"
          value={alerts.pending_lab_orders ?? 0}
          sub="awaiting collection or result"
          color="hsl(270,65%,58%)"
          onClick={() => navigate('/lab')}
          clickable
        />
        <StatCard
          icon={<Pill size={20} />}
          iconBg="hsl(0,75%,58%)"
          label="Low Stock Drugs"
          value={alerts.low_stock_drugs ?? 0}
          sub="below threshold"
          color="var(--color-danger)"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          iconBg="hsl(38,95%,55%)"
          label="Expiring Drugs"
          value={alerts.expiring_drugs_90d ?? 0}
          sub="within 90 days"
          color="var(--color-warning)"
        />
      </div>
    )
  }

  // For lab_tech and pharmacist, just show the minimal dashboard
  const isMinimalRole = role === 'lab_technician' || role === 'pharmacist'

  return (
    <div className="page-body dashboard">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>Overview of clinic operations today</p>
        </div>
        {!isMinimalRole && (
          <div className="tabs">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p}
                className={`tab-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stat Cards */}
      {renderCards()}

      {/* Charts — only for roles that need them */}
      {!isMinimalRole && (
        <div className="dashboard-charts">
          <div className="card chart-card">
            <div className="card-header">
              <h3>Visit Breakdown</h3>
              <span className="badge badge-blue"><TrendingUp size={11}/> {period}</span>
            </div>
            {visitChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={visitChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--color-primary-light)' }}
                  />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No visit data for this period.</div>
            )}
          </div>

          {role !== 'doctor' && (
            <div className="card chart-card">
              <div className="card-header">
                <h3>Bed Occupancy</h3>
              </div>
              <div className="bed-stats">
                <BedMeter label="Occupied" value={beds.occupied} total={beds.total} color="var(--color-primary)" />
                <BedMeter label="Available" value={beds.available} total={beds.total} color="var(--color-accent)" />
                <div className="bed-numbers">
                  <div className="bed-num">
                    <span className="bed-num-value">{beds.total ?? 0}</span>
                    <span className="bed-num-label">Total Beds</span>
                  </div>
                  <div className="bed-num">
                    <span className="bed-num-value">{beds.occupied ?? 0}</span>
                    <span className="bed-num-label">Occupied</span>
                  </div>
                  <div className="bed-num">
                    <span className="bed-num-value">{beds.available ?? 0}</span>
                    <span className="bed-num-label">Available</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {(alerts.pending_lab_orders > 0 || alerts.low_stock_drugs > 0) && !isMinimalRole && (
        <div className="card alert-card">
          <div className="card-header">
            <h3>Action Required</h3>
          </div>
          <div className="alert-list">
            {alerts.pending_lab_orders > 0 && (
              <div className="alert-item orange" style={{ cursor:'pointer' }} onClick={() => navigate('/lab')}>
                <FlaskConical size={16} />
                <span>{alerts.pending_lab_orders} lab order{alerts.pending_lab_orders > 1 ? 's' : ''} pending collection/results</span>
              </div>
            )}
            {alerts.low_stock_drugs > 0 && (
              <div className="alert-item red">
                <Pill size={16} />
                <span>{alerts.low_stock_drugs} drug{alerts.low_stock_drugs > 1 ? 's' : ''} below minimum stock level</span>
              </div>
            )}
            {alerts.expiring_drugs_90d > 0 && (
              <div className="alert-item orange">
                <AlertTriangle size={16} />
                <span>{alerts.expiring_drugs_90d} drug batch{alerts.expiring_drugs_90d > 1 ? 'es' : ''} expiring within 90 days</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, iconBg, label, value, sub, color, onClick, clickable }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: clickable ? 'pointer' : 'default', transition: 'transform 0.15s', ...(clickable ? {} : {}) }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { if (clickable) e.currentTarget.style.transform = 'translateY(0)' }}
      title={clickable ? 'Click to view' : ''}
    >
      <div className="stat-icon" style={{ background: `${iconBg}20`, color: iconBg }}>
        {icon}
      </div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-change" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      {clickable && <div style={{ fontSize:'0.72rem', marginTop:'0.25rem', color: iconBg, opacity: 0.8 }}>→ Click to view queue</div>}
    </div>
  )
}

function BedMeter({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="bed-meter">
      <div className="bed-meter-label">
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="bed-meter-bar">
        <div className="bed-meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
