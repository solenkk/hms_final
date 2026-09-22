import React, { useState, useEffect, useCallback } from 'react'
import { reportsApi, adminApi, apiError } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  BarChart3, FileSpreadsheet, Printer, AlertCircle,
  Loader2, CalendarDays, Activity, Search, BookOpen,
  Plus, Edit3, ToggleLeft, ToggleRight,
} from 'lucide-react'
import IndicatorModal, { EMR_FIELD_LABELS } from '../components/IndicatorModal'
import toast from 'react-hot-toast'
import './Reports.css'


const COLORS = ['#3b9eff','#2ec98c','#f8a722','#e05c5c','#a78bfa','#34d399']
const PERIODS = ['today', 'week', 'month', 'year']

const EC_MONTH_NAMES = [
  '', 'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehasse', 'Pagume'
]

// ─── Helper: compute Monday of a given date's ISO week ───────────────────────
function isoWeekMonday(d) {
  const dt = new Date(d)
  const day = dt.getDay() || 7
  dt.setDate(dt.getDate() - day + 1)
  return dt.toISOString().slice(0, 10)
}

// ─── Helper: today as YYYY-MM-DD ─────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10) }
function thisYear()  { return new Date().getFullYear() }
function thisMonth() { return new Date().getMonth() + 1 }

// ─── Helper: trigger a browser download from a Blob, no token in any URL ─────
// ─── Helper: trigger a browser download from a Blob ──────────────────────────
function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
}

function printHtmlContent(htmlString, title = 'Report') {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(htmlString)
    printWindow.document.close()
    printWindow.document.title = title
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
  } else {
    toast.error('Popup blocked. Please allow popups for this site to print.')
  }
}

// ─── Helper: parse blob error if server responded with an error JSON ─────────
async function parseBlobError(err, fallbackMessage) {
  if (err?.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text()
      const json = JSON.parse(text)
      return json.detail || json.message || fallbackMessage
    } catch {
      return fallbackMessage
    }
  }
  return err?.response?.data?.detail || err?.message || fallbackMessage
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyReportState({ message = 'No report data available for this period' }) {
  return (
    <div className="hmis-empty-state">
      <AlertCircle size={42} strokeWidth={1.5} />
      <p>{message}</p>
    </div>
  )
}

// ─── Section-grouped preview table ───────────────────────────────────────────
function HmisPreviewTable({ data, year, month }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [traceRule, setTraceRule] = useState(null)

  if (!data || !data.sections || data.sections.length === 0) return <EmptyReportState message="No indicators defined or available for this report type" />

  const sections = data.sections

  // Calculate summary metrics across all data (which is now a list of sections)
  let totalEvents = 0
  let totalIndicators = 0
  
  sections.forEach(sec => {
    (sec.indicators || []).forEach(ind => {
      totalIndicators++
      if (ind.breakdowns && ind.breakdowns.length > 0) {
        totalEvents += ind.breakdowns.reduce((sum, c) => sum + (c.value || 0), 0)
      } else {
        totalEvents += (ind.value || 0)
      }
    })
  })

  // Group rows by section, respecting search term
  const filteredSections = []
  sections.forEach(sec => {
    const term = searchTerm.toLowerCase()
    const secMatches = sec.section_name.toLowerCase().includes(term)
    
    const matchedItems = (sec.indicators || []).filter(ind => {
      if (secMatches) return true
      if (ind.indicator_name.toLowerCase().includes(term)) return true
      if (ind.breakdowns && ind.breakdowns.some(c => c.dimension.toLowerCase().includes(term))) return true
      return false
    })
    
    if (matchedItems.length > 0) {
      filteredSections.push({ ...sec, indicators: matchedItems })
    }
  })

  return (
    <div className="hmis-preview-wrap">
      {/* ── Summary statistics bar ── */}
      <div className="hmis-preview-summary-bar">
        <div className="hmis-summary-stat-pill">
          <span className="hmis-stat-label">Total Indicators</span>
          <span className="hmis-stat-val">{totalIndicators}</span>
        </div>
        <div className="hmis-summary-stat-pill">
          <span className="hmis-stat-label">Report Sections</span>
          <span className="hmis-stat-val">{sections.length}</span>
        </div>
        <div className="hmis-summary-stat-pill highlight">
          <span className="hmis-stat-label">Total Cases / Events</span>
          <span className="hmis-stat-val">{totalEvents}</span>
        </div>

        <div className="hmis-preview-search">
          <Search size={14} className="hmis-search-icon" />
          <input
            type="text"
            className="hmis-search-input"
            placeholder="Filter indicators or sections..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="hmis-clear-search" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <EmptyReportState message={`No indicators match "${searchTerm}"`} />
      ) : (
        filteredSections.map((sec, sIdx) => {
          return (
            <div key={sIdx} className="hmis-section-block">
              <div className="hmis-section-header">
                <span>{sec.section_name}</span>
                <span className="hmis-section-count">{sec.indicators.length} {sec.indicators.length === 1 ? 'indicator' : 'indicators'}</span>
              </div>
              <div className="hmis-table-wrap">
                <table className="hmis-table">
                  <thead>
                    <tr>
                      <th className="hmis-th-indicator">Indicator Name</th>
                      <th className="hmis-th-group" style={{ width: '120px', textAlign: 'right' }}>Value (Total)</th>
                      <th style={{ width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.indicators.map((ind, i) => (
                      <React.Fragment key={i}>
                        {/* Parent Row */}
                        <tr className="hmis-row-parent" style={{ background: 'var(--bg-subtle)' }}>
                          <td className="hmis-td-indicator" style={{ fontWeight: 600 }}>{ind.indicator_code}. {ind.indicator_name}</td>
                          <td className="hmis-td-value td-nonzero" style={{ fontWeight: 600, textAlign: 'right' }}>
                            {!ind.breakdowns || ind.breakdowns.length === 0 ? ind.value : ind.value}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {ind.value > 0 && (
                              <button className="btn btn-ghost btn-xs" onClick={() => setTraceRule(ind.indicator_code)} title="Trace Calculation">
                                <Search size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Child Rows */}
                        {(ind.breakdowns || []).map((child, j) => (
                          <tr key={j} className="hmis-row-child" style={{ background: 'var(--bg-card)' }}>
                            <td className="hmis-td-indicator" style={{ paddingLeft: '2.5rem', color: 'var(--text-secondary)' }}>
                              {child.dimension}
                            </td>
                            <td className={`hmis-td-value ${child.value > 0 ? 'td-nonzero' : ''}`} style={{ textAlign: 'right' }}>
                              {child.value}
                            </td>
                            <td></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
      
      {traceRule && (
        <CalculationTraceModal 
          year={year} 
          month={month} 
          ruleNum={traceRule} 
          onClose={() => setTraceRule(null)} 
        />
      )}
    </div>
  )
}

function PhemPreviewTable({ data }) {
  if (!data || !data.pages || data.pages.length === 0) return <EmptyReportState message="No PHEM data available for this week" />

  let totalIndicators = 0
  let totalEvents = 0
  
  data.pages.forEach(p => {
    (p.indicators || []).forEach(ind => {
      totalIndicators++
      totalEvents += (ind.outpatient || 0) + (ind.inpatient || 0)
    })
  })

  return (
    <div className="hmis-preview-wrap">
      <div className="hmis-preview-summary-bar">
        <div className="hmis-summary-stat-pill">
          <span className="hmis-stat-label">Total Indicators</span>
          <span className="hmis-stat-val">{totalIndicators}</span>
        </div>
        <div className="hmis-summary-stat-pill">
          <span className="hmis-stat-label">Report Pages</span>
          <span className="hmis-stat-val">{data.pages.length}</span>
        </div>
        <div className="hmis-summary-stat-pill highlight">
          <span className="hmis-stat-label">Total Cases / Events</span>
          <span className="hmis-stat-val">{totalEvents}</span>
        </div>
      </div>

      {data.pages.map((page, pIdx) => (
        <div key={pIdx} className="hmis-section-block">
          <div className="hmis-section-header">
            <span>{page.title}</span>
            <span className="hmis-section-count">{page.indicators.length} indicators</span>
          </div>
          <div className="hmis-table-wrap">
            <table className="hmis-table">
              <thead>
                <tr>
                  <th className="hmis-th-indicator">Notifiable Disease / Indicator</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Outpatient</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Inpatient</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Deaths</th>
                </tr>
              </thead>
              <tbody>
                {page.indicators.map((ind, i) => (
                  <tr key={i} className="hmis-row-parent" style={{ background: i % 2 === 0 ? 'var(--bg-subtle)' : 'var(--bg-card)' }}>
                    <td className="hmis-td-indicator" style={{ fontWeight: 500 }}>{ind.indicator}</td>
                    <td className={`hmis-td-value ${ind.outpatient ? 'td-nonzero' : ''}`} style={{ textAlign: 'right' }}>
                      {ind.outpatient !== null ? ind.outpatient : '-'}
                    </td>
                    <td className={`hmis-td-value ${ind.inpatient ? 'td-nonzero' : ''}`} style={{ textAlign: 'right' }}>
                      {ind.inpatient !== null ? ind.inpatient : '-'}
                    </td>
                    <td className={`hmis-td-value ${ind.deaths ? 'td-nonzero' : ''}`} style={{ textAlign: 'right' }}>
                      {ind.deaths !== null ? ind.deaths : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function CalculationTraceModal({ year, month, ruleNum, onClose }) {
  const [trace, setTrace] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    reportsApi.traceIndicator({ year, month, rule_num: ruleNum })
      .then(res => setTrace(res.data))
      .catch(err => toast.error('Failed to load trace'))
      .finally(() => setLoading(false))
  }, [year, month, ruleNum])

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
        <h3 style={{ marginTop: 0 }}>Calculation Trace: Indicator {ruleNum}</h3>
        {loading ? (
          <div className="loading-center"><Loader2 className="spinning" size={32} /></div>
        ) : !trace ? (
          <p>Failed to load trace</p>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <p><strong>Rule Definition:</strong> {trace.rule_definition}</p>
            <p><strong>Total Valid Events:</strong> {trace.total_events_evaluated}</p>
            
            {trace.events_included && trace.events_included.length > 0 ? (
              <table style={{ width: '100%', fontSize: '0.85rem', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '0.5rem' }}>Date</th>
                    <th style={{ padding: '0.5rem' }}>Patient ID</th>
                    <th style={{ padding: '0.5rem' }}>Code</th>
                    <th style={{ padding: '0.5rem' }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.events_included.map((evt, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem' }}>{new Date(evt.event_datetime).toLocaleString()}</td>
                      <td style={{ padding: '0.5rem' }}>{evt.patient_id}</td>
                      <td style={{ padding: '0.5rem' }}>{evt.code}</td>
                      <td style={{ padding: '0.5rem' }}>{evt.source_record_type} ({evt.source_record_id})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No events found for this indicator.</p>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Cohort preview ──────────────────────────────────────────────────────────
function CohortPreviewTable({ data }) {
  if (!data || data.length === 0) return <EmptyReportState message="No cohort data available" />

  const row = data[0]?.groups || {}
  const cohorts = Object.entries(row)
  const outcomeKeys = cohorts.length > 0 ? Object.keys(cohorts[0][1] || {}) : []

  return (
    <div className="hmis-preview-wrap">
      <div className="hmis-section-block">
        <div className="hmis-section-header">
          <span>6-Month Cohort Outcomes (Hypertension / Diabetes Mellitus)</span>
        </div>
        <div className="hmis-table-wrap">
          <table className="hmis-table">
            <thead>
              <tr>
                <th className="hmis-th-indicator">Outcome Classification</th>
                {cohorts.map(([key]) => (
                  <th key={key} className="hmis-th-group">{key.toUpperCase()} Cohort</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outcomeKeys.map((outcome, i) => (
                <tr key={outcome} className={i % 2 === 0 ? 'hmis-row-even' : 'hmis-row-odd'}>
                  <td className="hmis-td-indicator" style={{ textTransform: 'capitalize', fontWeight: outcome === 'enrolled' ? 'bold' : 'normal' }}>
                    {outcome.replace(/_/g, ' ')}
                  </td>
                  {cohorts.map(([key, values]) => {
                    const count = values[outcome] ?? 0
                    return (
                      <td key={key} className={`hmis-td-value ${count > 0 ? 'td-nonzero' : ''}`}>
                        {count}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Government Reports Tab ───────────────────────────────────────────────────
function GovernmentReportsTab() {
  const [subTab, setSubTab] = useState('monthly')

  // Monthly state
  const [month, setMonth]   = useState(null)
  const [year, setYear]     = useState(null)
  const [gregorianRange, setGregorianRange] = useState(null)
  const [periodLoading, setPeriodLoading] = useState(false)

  // Weekly state
  const [weekStart, setWeekStart] = useState(isoWeekMonday(todayISO()))
  const [weekLabel, setWeekLabel] = useState(null)
  const [weekLabelLoading, setWeekLabelLoading] = useState(false)

  // Cohort state
  const [cohortDate, setCohortDate] = useState(todayISO())

  // Report data
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [fetched, setFetched]       = useState(false)

  // Export state
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf]     = useState(false)

  // ── Fetch EPI week label whenever weekStart changes ──
  useEffect(() => {
    if (!weekStart) return
    setWeekLabelLoading(true)
    reportsApi.hmisWeekLabel(weekStart)
      .then(r => setWeekLabel(r.data))
      .catch(() => setWeekLabel(null))
      .finally(() => setWeekLabelLoading(false))
  }, [weekStart])

  // Fetch default EC period on mount
  useEffect(() => {
    if (subTab === 'monthly' && month === null && year === null) {
      setPeriodLoading(true)
      reportsApi.hmisEthiopianPeriod(null, null).then(r => {
        setYear(r.data.ethiopian_year)
        setMonth(r.data.ethiopian_month)
        setGregorianRange(r.data.gregorian_display_range)
      }).finally(() => setPeriodLoading(false))
    }
  }, [subTab, month, year])

  // Update Gregorian range when EC month/year changes
  useEffect(() => {
    if (subTab === 'monthly' && year !== null && month !== null) {
      setPeriodLoading(true)
      reportsApi.hmisEthiopianPeriod(year, month).then(r => {
        setGregorianRange(r.data.gregorian_display_range)
      }).finally(() => setPeriodLoading(false))
    }
  }, [year, month, subTab])

  // Reset preview when sub-tab or params change
  useEffect(() => {
    setReportData(null)
    setFetched(false)
  }, [subTab, month, year, weekStart, cohortDate])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setFetched(false)
    try {
      let res
      if (subTab === 'monthly') {
        res = await reportsApi.hmisMonthly(year, month)
      } else if (subTab === 'weekly') {
        res = await reportsApi.hmisWeekly(`${weekStart}T00:00:00`)
      } else {
        res = await reportsApi.hmisCohort(`${cohortDate}T00:00:00`)
      }
      setReportData(res.data)
      setFetched(true)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load report data')
      setReportData(null)
      setFetched(true)
    } finally {
      setLoading(false)
    }
  }, [subTab, month, year, weekStart, cohortDate])

  // ── Excel Export Handler (Monthly & Weekly) ──
  const handleExcelExport = async () => {
    setExportingExcel(true)
    try {
      if (subTab === 'monthly') {
        const res = await reportsApi.hmisExportExcel(year, month)
        const filename = `HMIS_Monthly_Report_${year}_${String(month).padStart(2, '0')}.xlsx`
        downloadBlob(
          new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          filename
        )
        toast.success(`Exported ${filename}`)
      } else if (subTab === 'weekly') {
        const res = await reportsApi.hmisExportWeeklyExcel(`${weekStart}T00:00:00`)
        const filename = `PHEM_Weekly_Report_${weekStart}.xlsx`
        downloadBlob(
          new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          filename
        )
        toast.success(`Exported ${filename}`)
      }
    } catch (err) {
      const errMsg = await parseBlobError(err, 'Failed to export Excel report')
      toast.error(errMsg)
    } finally {
      setExportingExcel(false)
    }
  }

  // ── HTML / PDF Print Export Handler (Monthly & Weekly) ──
  const handleHtmlExport = async () => {
    setExportingPdf(true)
    try {
      if (subTab === 'monthly') {
        const res = await reportsApi.hmisExportHtml(year, month)
        const text = await res.data.text()
        printHtmlContent(text, `HMIS_Monthly_${year}_${month}`)
        toast.success('Print document prepared')
      } else if (subTab === 'weekly') {
        const res = await reportsApi.hmisExportWeeklyHtml(`${weekStart}T00:00:00`)
        const text = await res.data.text()
        printHtmlContent(text, `PHEM_Weekly_${weekStart}`)
        toast.success('Print document prepared')
      }
    } catch (err) {
      const errMsg = await parseBlobError(err, 'Failed to prepare print report')
      toast.error(errMsg)
    } finally {
      setExportingPdf(false)
    }
  }

  const currentYear = year || 2017 // fallback if null
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)

  return (
    <div className="hmis-tab-root">
      {/* Sub-tab navigation */}
      <div className="hmis-subtab-bar">
        {[
          { key: 'monthly', label: '📋 Monthly HMIS' },
          { key: 'weekly',  label: '📆 Weekly PHEM (Disease Surveillance)' },
          { key: 'cohort',  label: '🩺 Cohort Outcomes (HTN/DM)' },
        ].map(st => (
          <button
            key={st.key}
            id={`hmis-subtab-${st.key}`}
            className={`hmis-subtab-btn ${subTab === st.key ? 'active' : ''}`}
            onClick={() => setSubTab(st.key)}
          >
            {st.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* ── Monthly Controls ── */}
          {subTab === 'monthly' && (
            <div className="hmis-controls-row">
              <div className="hmis-control-group">
                <label className="hmis-label" htmlFor="hmis-month">Ethiopian Month</label>
                <select
                  id="hmis-month"
                  className="hmis-select"
                  value={month || ''}
                  onChange={e => setMonth(Number(e.target.value))}
                  disabled={periodLoading}
                >
                  {EC_MONTH_NAMES.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="hmis-control-group">
                <label className="hmis-label" htmlFor="hmis-year">Ethiopian Year</label>
                <select
                  id="hmis-year"
                  className="hmis-select"
                  value={year || ''}
                  onChange={e => setYear(Number(e.target.value))}
                  disabled={periodLoading}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {gregorianRange && (
                <div className="hmis-week-label-badge" style={{ marginTop: 'auto', marginBottom: '8px' }}>
                  <CalendarDays size={14} />
                  <span>
                    <strong>Gregorian:</strong> {gregorianRange}
                  </span>
                </div>
              )}
              {periodLoading && <Loader2 size={14} className="spinning" style={{ marginTop: 'auto', marginBottom: '8px', color: 'var(--text-muted)' }} />}
              <button
                id="hmis-generate-btn"
                className="btn btn-primary hmis-generate-btn"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? <Loader2 size={15} className="spinning" /> : <Activity size={15} />}
                {loading ? 'Generating…' : 'Generate Preview'}
              </button>
            </div>
          )}

          {/* ── Weekly Controls ── */}
          {subTab === 'weekly' && (
            <div className="hmis-controls-row">
              <div className="hmis-control-group">
                <label className="hmis-label" htmlFor="hmis-week-start">Week Start (Monday)</label>
                <input
                  id="hmis-week-start"
                  type="date"
                  className="hmis-input"
                  value={weekStart}
                  onChange={e => setWeekStart(isoWeekMonday(e.target.value))}
                />
              </div>
              {weekLabel && (
                <div className="hmis-week-label-badge">
                  <CalendarDays size={14} />
                  <span>
                    <strong>WHO EPI Wk {weekLabel.iso_epi_week}/{weekLabel.iso_year}</strong>
                    &nbsp;·&nbsp;{weekLabel.ec_label}
                  </span>
                </div>
              )}
              {weekLabelLoading && <Loader2 size={14} className="spinning" style={{ color: 'var(--text-muted)' }} />}
              <button
                id="hmis-generate-weekly-btn"
                className="btn btn-primary hmis-generate-btn"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? <Loader2 size={15} className="spinning" /> : <Activity size={15} />}
                {loading ? 'Generating…' : 'Generate Preview'}
              </button>
            </div>
          )}

          {/* ── Cohort Controls ── */}
          {subTab === 'cohort' && (
            <div className="hmis-controls-row">
              <div className="hmis-control-group">
                <label className="hmis-label" htmlFor="hmis-cohort-date">Target Assessment Date</label>
                <input
                  id="hmis-cohort-date"
                  type="date"
                  className="hmis-input"
                  value={cohortDate}
                  onChange={e => setCohortDate(e.target.value)}
                />
              </div>
              <p className="hmis-helper-text">
                Evaluates 6-month HTN/DM outcomes for patients enrolled ~6 months prior to selected date.
              </p>
              <button
                id="hmis-generate-cohort-btn"
                className="btn btn-primary hmis-generate-btn"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? <Loader2 size={15} className="spinning" /> : <Activity size={15} />}
                {loading ? 'Generating…' : 'Generate Preview'}
              </button>
            </div>
          )}

          {/* ── Export buttons (Available for Monthly & Weekly) ── */}
          {(subTab === 'monthly' || subTab === 'weekly') && (
            <div className="hmis-export-row">
              <button
                id="hmis-export-excel-btn"
                className="btn hmis-export-btn hmis-export-excel"
                onClick={handleExcelExport}
                disabled={exportingExcel}
                title="Download formatted Excel workbook (.xlsx)"
              >
                {exportingExcel ? <Loader2 size={15} className="spinning" /> : <FileSpreadsheet size={15} />}
                {exportingExcel ? 'Exporting…' : 'Export Excel'}
              </button>
              <button
                id="hmis-export-pdf-btn"
                className="btn hmis-export-btn hmis-export-pdf"
                onClick={handleHtmlExport}
                disabled={exportingPdf}
                title="Open high-fidelity print / Save as PDF dialog"
              >
                {exportingPdf ? <Loader2 size={15} className="spinning" /> : <Printer size={15} />}
                {exportingPdf ? 'Preparing…' : 'Print / Export PDF'}
              </button>
            </div>
          )}
        </div>

        {/* ── Preview area ── */}
        <div className="hmis-preview-area">
          {!fetched && !loading && (
            <div className="hmis-prompt-state">
              <BarChart3 size={38} strokeWidth={1.5} />
              <p>
                {subTab === 'monthly' && 'Select a month and year, then click "Generate Preview" to review all reportable indicators.'}
                {subTab === 'weekly'  && 'Choose a week start date, then click "Generate Preview" to view the PHEM surveillance matrix.'}
                {subTab === 'cohort'  && 'Pick a target date, then click "Generate Preview" to calculate 6-month HTN/DM outcomes.'}
              </p>
            </div>
          )}

          {loading && (
            <div className="hmis-loading-state">
              <Loader2 size={32} className="spinning" />
              <p>Aggregating reportable indicators…</p>
            </div>
          )}

          {fetched && !loading && subTab === 'monthly' && (
            <HmisPreviewTable data={reportData} year={year} month={month} />
          )}

          {fetched && !loading && subTab === 'weekly' && (
            <PhemPreviewTable data={reportData} />
          )}

          {fetched && !loading && subTab === 'cohort' && (
            <CohortPreviewTable data={reportData} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Reportable Indicators Catalog List Tab ───

function ReportableIndicatorsTab({ loading, indicators, labTests, onRefresh }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [selectedDefn, setSelectedDefn] = useState(null)

  if (loading) {
    return (
      <div className="hmis-loading-state">
        <Loader2 size={32} className="spinning" />
        <p>Loading reportable indicator definitions...</p>
      </div>
    )
  }

  const filtered = indicators.filter(ind => {
    const matchesSearch = ind.label.toLowerCase().includes(search.toLowerCase()) ||
      (ind.section || '').toLowerCase().includes(search.toLowerCase()) ||
      (ind.context_ref || '').toLowerCase().includes(search.toLowerCase())
    
    const matchesType = filterType === 'all' || ind.context_type === filterType
    return matchesSearch && matchesType
  })

  const grouped = {}
  filtered.forEach(ind => {
    const sec = ind.section || 'General'
    if (!grouped[sec]) grouped[sec] = []
    grouped[sec].push(ind)
  })

  const handleToggleStatus = async (ind) => {
    try {
      if (ind.enabled) {
        await adminApi.disableIndicator(ind.id)
        toast.success(`Disabled indicator: ${ind.label}`)
      } else {
        await adminApi.updateIndicator(ind.id, { enabled: true })
        toast.success(`Enabled indicator: ${ind.label}`)
      }
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(apiError(err, 'Failed to update indicator status'))
    }
  }

  return (
    <div className="hmis-tab-root">
      <div className="hmis-controls-row" style={{ marginBottom: '1.25rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div className="hmis-control-group" style={{ flex: 1, minWidth: '240px' }}>
          <span className="hmis-label">Search Indicators</span>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by label, section or context reference..."
              className="hmis-input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="hmis-control-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span className="hmis-label">Filter & Manage</span>
          <div className="hmis-subtab-bar" style={{ gap: '0.35rem', display: 'flex', alignItems: 'center' }}>
            <button className={`hmis-subtab-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All</button>
            <button className={`hmis-subtab-btn ${filterType === 'lab_test' ? 'active' : ''}`} onClick={() => setFilterType('lab_test')}>Lab Tests</button>
            <button className={`hmis-subtab-btn ${filterType === 'emr_field' ? 'active' : ''}`} onClick={() => setFilterType('emr_field')}>EMR Fields</button>
            <button
              className="hmis-subtab-btn"
              onClick={() => { setSelectedDefn(null); setShowModal(true) }}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '0.25rem'
              }}
            >
              <Plus size={14} /> Add Indicator
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyReportState message="No indicators match the search or filter criteria" />
      ) : (
        Object.entries(grouped).map(([section, items]) => (
          <div key={section} className="indicator-section-block" style={{ marginBottom: '2rem' }}>
            <div className="indicator-section-title" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.3rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {section}
            </div>
            <div className="indicator-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {items.map(ind => {
                const testType = ind.context_type === 'lab_test' ? labTests.find(t => String(t.id) === String(ind.context_ref)) : null
                return (
                  <div key={ind.id} className={`indicator-card ${ind.enabled ? '' : 'disabled'}`} style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: ind.enabled ? 1 : 0.6 }}>
                    <div className="indicator-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span className="indicator-card-title" style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{ind.label}</span>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span className="indicator-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: ind.enabled ? 'color-mix(in srgb, var(--color-green) 15%, transparent)' : 'color-mix(in srgb, var(--text-muted) 15%, transparent)', color: ind.enabled ? 'var(--color-green)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          {ind.enabled ? 'Active' : 'Disabled'}
                        </span>
                        
                        <button
                          className="btn btn-ghost btn-xs btn-icon"
                          title="Edit Indicator"
                          onClick={() => { setSelectedDefn(ind); setShowModal(true) }}
                          style={{ padding: '0.15rem 0.3rem', borderRadius: '4px' }}
                        >
                          <Edit3 size={13} style={{ color: 'var(--color-primary)' }} />
                        </button>
                        
                        <button
                          className="btn btn-ghost btn-xs btn-icon"
                          title={ind.enabled ? "Disable Indicator" : "Enable Indicator"}
                          onClick={() => handleToggleStatus(ind)}
                          style={{ padding: '0.15rem 0.3rem', borderRadius: '4px' }}
                        >
                          {ind.enabled ? <ToggleRight size={17} style={{ color: 'var(--color-green)' }} /> : <ToggleLeft size={17} style={{ color: 'var(--text-muted)' }} />}
                        </button>
                      </div>
                    </div>

                    <div className="indicator-badge-row" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className={`indicator-badge ${ind.context_type === 'lab_test' ? 'badge-lab' : 'badge-emr'}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 500, textTransform: 'uppercase', background: ind.context_type === 'lab_test' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: ind.context_type === 'lab_test' ? 'var(--color-primary)' : 'var(--color-accent)' }}>
                        {ind.context_type === 'lab_test' ? 'Lab Test' : 'EMR Field'}
                      </span>
                      <span className="indicator-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 500, textTransform: 'uppercase', background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)' }}>
                        {ind.outcome_shape}
                      </span>
                      {(ind.min_age !== null || ind.max_age !== null) && (
                        <span className="indicator-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 500, background: 'color-mix(in srgb, var(--color-purple) 15%, transparent)', color: 'var(--color-purple)' }}>
                          Age: {ind.min_age ?? '0'}–{ind.max_age ?? '∞'} yrs
                        </span>
                      )}
                    </div>

                    <div className="indicator-ref-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <strong>Source Reference: </strong>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {ind.context_type === 'lab_test'
                          ? (testType ? `${testType.name_en} (ID: ${ind.context_ref})` : `Test Type ID ${ind.context_ref}`)
                          : (EMR_FIELD_LABELS[ind.context_ref] || ind.context_ref)
                        }
                      </span>
                    </div>

                    {ind.outcome_shape === 'buttons' && (
                      <div className="indicator-mapping-preview" style={{ fontSize: '0.75rem', borderTop: '1px dashed var(--border)', paddingTop: '0.75rem', marginTop: 'auto', color: 'var(--text-secondary)' }}>
                        <strong>Mapped Outcomes ({ind.options?.length || 0}):</strong>
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {ind.options?.map(opt => (
                            <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                              <span>
                                {opt.option_label} 
                                {opt.option_value && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '0.3rem' }}>({opt.option_value})</span>}
                              </span>
                              <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 500 }}>{opt.report_event_code}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ind.outcome_shape === 'threshold' && (
                      <div className="indicator-mapping-preview" style={{ fontSize: '0.75rem', borderTop: '1px dashed var(--border)', paddingTop: '0.75rem', marginTop: 'auto', color: 'var(--text-secondary)' }}>
                        <strong>Classification Thresholds ({ind.thresholds?.length || 0}):</strong>
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {ind.thresholds?.map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                              <span>{t.label} ({t.min_value ?? '-inf'} to {t.max_value ?? '+inf'})</span>
                              <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 500 }}>{t.report_event_code}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {showModal && (
        <IndicatorModal
          defn={selectedDefn}
          labTests={labTests}
          defaultContextType={filterType === 'emr_field' ? 'emr_field' : 'lab_test'}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            if (onRefresh) onRefresh()
          }}
        />
      )}
    </div>
  )
}


// ─── Main Reports page ────────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuth()
  const role = user?.role || ''
  const [tab, setTab]               = useState('dashboard')
  const [period, setPeriod]         = useState('month')
  const [dashData, setDashData]     = useState(null)
  const [visitsData, setVisitsData] = useState(null)
  const [revenueData, setRevenueData] = useState(null)
  const [diagnoses, setDiagnoses]   = useState([])
  const [stock, setStock]           = useState([])
  const [loading, setLoading]       = useState(true)

  // Catalog Indicators state
  const [indicators, setIndicators] = useState([])
  const [labTests, setLabTests] = useState([])
  const [indicatorsLoading, setIndicatorsLoading] = useState(false)

  useEffect(() => {
    setLoading(true)

    const dashPromise = reportsApi.dashboard()
      .then(r => r.data).catch(() => null)

    const visitsPromise = ['admin', 'doctor', 'receptionist'].includes(role)
      ? reportsApi.visits(period).then(r => r.data).catch(() => null)
      : Promise.resolve(null)

    const revenuePromise = ['admin', 'cashier', 'receptionist'].includes(role)
      ? reportsApi.revenue(period).then(r => r.data).catch(() => null)
      : Promise.resolve(null)

    const diagPromise = ['admin','doctor'].includes(role)
      ? reportsApi.diagnoses().then(r => r.data).catch(() => [])
      : Promise.resolve([])

    const stockPromise = ['admin','pharmacist'].includes(role)
      ? reportsApi.drugStock().then(r => r.data?.slice(0, 10)).catch(() => [])
      : Promise.resolve([])

    Promise.all([dashPromise, visitsPromise, revenuePromise, diagPromise, stockPromise])
      .then(([dash, visits, rev, diag, stk]) => {
        setDashData(dash)
        setVisitsData(visits)
        setRevenueData(rev)
        setDiagnoses(diag || [])
        setStock(stk || [])
      })
      .finally(() => setLoading(false))
  }, [role, period])

  const loadIndicators = useCallback(() => {
    setIndicatorsLoading(true)
    Promise.all([
      adminApi.listIndicators(),
      adminApi.labTestTypes()
    ])
      .then(([indRes, labRes]) => {
        setIndicators(indRes.data || [])
        setLabTests(labRes.data || [])
      })
      .catch(() => {
        toast.error('Failed to load reportable indicator configuration')
      })
      .finally(() => setIndicatorsLoading(false))
  }, [])

  // Load catalog indicators on tab activation
  useEffect(() => {
    if (tab === 'indicators' && indicators.length === 0) {
      loadIndicators()
    }
  }, [tab, indicators.length, loadIndicators])

  if (loading) return <div className="page-body"><div className="loading-center"><div className="spinner" /></div></div>

  const breakdown = visitsData?.breakdown || {}
  const getTypeCount = (typeKey) => {
    const typeData = breakdown[typeKey] || breakdown[typeKey.toLowerCase()] || breakdown[typeKey.toUpperCase()] || {}
    return Object.values(typeData).reduce((sum, count) => sum + count, 0)
  }

  const visitTypeData = [
    { name: 'OPD', value: getTypeCount('opd') },
    { name: 'IPD', value: getTypeCount('ipd') },
    { name: 'Emergency', value: getTypeCount('emergency') },
  ]

  const totalVisits = visitsData?.total ?? 0
  const getStatusCount = (statusKey) => {
    let sum = 0
    Object.values(breakdown).forEach(typeData => {
      sum += typeData[statusKey] || typeData[statusKey.toLowerCase()] || typeData[statusKey.toUpperCase()] || 0
    })
    return sum
  }
  const openVisits   = getStatusCount('open')
  const closedVisits = getStatusCount('closed')
  const totalRevenue = revenueData?.by_payment_method?.reduce((sum, item) => sum + (item.total_etb || 0), 0) ?? 0

  const mappedDiagnoses = diagnoses.map(d => ({
    diagnosis_code: d.diagnosis_code || d.icd10_code || '',
    count: d.count ?? d.frequency ?? 0,
  }))

  const mappedStock = stock.map(s => ({
    ...s,
    name_generic_en: s.name_generic_en || s.name || '',
  }))

  const userRole = (role || '').toLowerCase()
  const tabs = [
    { key: 'dashboard', label: 'Dashboard',         show: true },
    { key: 'diagnoses', label: 'Diagnoses',          show: ['admin','doctor'].includes(userRole) },
    { key: 'stock',     label: 'Drug Stock',         show: ['admin','pharmacist'].includes(userRole) },
    { key: 'hmis',      label: 'Government Reports', show: ['admin', 'doctor'].includes(userRole) },
    { key: 'indicators', label: 'Reportable Indicators', show: userRole === 'admin' },
  ].filter(t => t.show)

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Reports</h1>
          <p>Analytics, statistics, and compliance reports</p>
        </div>
        {tab !== 'hmis' && tab !== 'indicators' && (
          <div className="tabs">
            {PERIODS.map(p => (
              <button key={p} className={`tab-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.key} id={`report-tab-${t.key}`} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="reports-grid">
          <div className="card">
            <div className="card-header"><h3>Visit Type Distribution</h3></div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={visitTypeData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {visitTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header"><h3>Summary Stats</h3></div>
            <div className="report-stat-list">
              <ReportStat label="Total Visits" value={totalVisits} />
              <ReportStat label="Open Visits"  value={openVisits}  color="var(--color-accent)" />
              <ReportStat label="Closed Visits" value={closedVisits} />
              {['admin','cashier','receptionist'].includes(role) && (
                <ReportStat label="Revenue (ETB)" value={totalRevenue.toLocaleString()} color="var(--color-warning)" />
              )}
              <ReportStat label="Pending Labs"   value={dashData?.alerts?.pending_lab_orders ?? 0} color="hsl(270,65%,58%)" />
              <ReportStat label="Beds Total"     value={dashData?.beds?.total ?? 0} />
              <ReportStat label="Beds Occupied"  value={dashData?.beds?.occupied ?? 0} color="var(--color-danger)" />
            </div>
          </div>
        </div>
      )}

      {tab === 'diagnoses' && (
        <div className="card">
          <div className="card-header"><h3>Top Diagnoses</h3></div>
          {mappedDiagnoses.length === 0 ? (
            <div className="empty-state"><BarChart3 size={48}/><p style={{marginTop:'0.5rem'}}>No diagnoses recorded yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={mappedDiagnoses} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="diagnosis_code" tick={{ fill:'var(--text-secondary)', fontSize:11 }} width={80} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8 }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === 'stock' && (
        <div className="card">
          <div className="card-header"><h3>Drug Stock Levels (Bottom 10)</h3></div>
          {!mappedStock || mappedStock.length === 0 ? (
            <div className="empty-state"><BarChart3 size={48}/><p style={{marginTop:'0.5rem'}}>No stock data</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={mappedStock} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name_generic_en" tick={{ fill:'var(--text-secondary)', fontSize:11 }} width={120} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8 }} />
                <Bar dataKey="current_stock" name="Stock" fill="var(--color-accent)" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === 'hmis' && <GovernmentReportsTab />}

      {tab === 'indicators' && (
        <ReportableIndicatorsTab 
          loading={indicatorsLoading} 
          indicators={indicators} 
          labTests={labTests} 
          onRefresh={loadIndicators}
        />
      )}

    </div>
  )
}

function ReportStat({ label, value, color }) {
  return (
    <div className="report-stat-item">
      <span className="report-stat-label">{label}</span>
      <span className="report-stat-value" style={color ? { color } : {}}>{value}</span>
    </div>
  )
}
