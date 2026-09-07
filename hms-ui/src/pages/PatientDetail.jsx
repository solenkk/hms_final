import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { patientsApi, visitsApi, emrApi, labApi, billingApi, pharmacyApi, apiError } from '../api'
import { ArrowLeft, Stethoscope, FlaskConical, ReceiptText, FileText, Plus, CheckCircle, Check, Printer, User, Beaker, Pill, CreditCard, Syringe, XCircle, Edit3, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { CancelInvoiceModal } from './Billing'
import toast from 'react-hot-toast'
import './PatientDetail.css'

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [visits, setVisits] = useState([])
  const [tab, setTab] = useState('visits')
  const [loading, setLoading] = useState(true)

  const loadPatient = () => {
    Promise.all([
      patientsApi.get(id),
      visitsApi.patientVisits(id, { limit: 100 }),
    ]).then(([p, v]) => {
      setPatient(p.data)
      setVisits(v.data.items ?? v.data)
    }).catch(() => toast.error('Failed to load patient'))
    .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPatient()
  }, [id])

  if (loading) return <div className="page-body"><div className="loading-center"><div className="spinner" /></div></div>
  if (!patient) return <div className="page-body"><div className="empty-state">Patient not found</div></div>

  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) : null

  return (
    <div className="page-body">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patients')} style={{ marginBottom:'1rem' }}>
        <ArrowLeft size={14} /> Back to Patients
      </button>

      {patient.registration_paid === false && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fef3c7',
          color: '#b45309',
          padding: '1rem',
          borderRadius: 'var(--border-radius)',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <div>
            ⚠️ <strong>Registration Payment Pending:</strong> This patient will not appear to clinical staff (doctors, pharmacists, lab technicians) until their registration invoice is paid and approved.
          </div>
          {['receptionist', 'cashier', 'admin'].includes(user?.role) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setTab('billing')}
            >
              Go to Billing
            </button>
          )}
        </div>
      )}

      {/* Read-only banner — shown to clinical staff when patient not in today's queue */}
      {patient.registration_paid && !patient.is_checked_in_today && ['doctor', 'nurse', 'lab_technician', 'pharmacist'].includes(user?.role) && (
        <div style={{
          background: 'hsla(220,70%,55%,0.08)',
          border: '1px solid hsla(220,70%,55%,0.25)',
          color: 'var(--text-primary)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.88rem',
          gap: '1rem',
        }}>
          <div>
            📋 <strong>Read-only mode:</strong> This patient is not in today's queue. You can view records, order labs/pharmacy, and edit injections — but cannot open a new visit or edit demographics until the receptionist checks them in.
          </div>
        </div>
      )}

      {/* Check-in nudge for receptionists when patient is not in today's queue */}
      {patient.registration_paid && !patient.is_checked_in_today && ['receptionist', 'admin'].includes(user?.role) && (
        <div style={{
          background: 'hsla(162,72%,45%,0.07)',
          border: '1px solid hsla(162,72%,45%,0.3)',
          color: 'var(--text-primary)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.88rem',
          gap: '1rem',
        }}>
          <div>
            🟡 This patient is <strong>not in today's queue</strong>. Check them in to add them to the doctor's queue for today.
          </div>
          <CheckInBannerButton patientId={patient.id} onCheckedIn={loadPatient} />
        </div>
      )}

      {/* Patient Header Card */}
      <div className="patient-header-card card">
        <div className="patient-avatar-large">
          {patient.first_name_en?.[0]}{patient.last_name_en?.[0]}
        </div>
        <div className="patient-info">
          <div className="patient-full-name">
            <h2>{patient.first_name_en} {patient.last_name_en}</h2>
            {patient.first_name_am && <span className="text-muted amharic">{patient.first_name_am} {patient.last_name_am}</span>}
          </div>
          <div className="patient-meta">
            <MetaItem label="Patient #" value={patient.patient_number} mono />
            <MetaItem label="Age" value={age ? `${age} years` : '—'} />
            <MetaItem label="Gender" value={patient.gender} />
            <MetaItem label="Blood Type" value={patient.blood_type || '—'} />
            <MetaItem label="Phone" value={patient.phone || '—'} />
            <MetaItem label="Consent" value={patient.consent_given ? '✓ Given' : '✗ Not Given'} />
          </div>
        </div>
        <div className="patient-status-col">
          {patient.is_active
            ? <span className="badge badge-green">Active</span>
            : <span className="badge badge-gray">Inactive</span>
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab==='visits'?'active':''}`} onClick={() => setTab('visits')}>
          <Stethoscope size={14} style={{ marginRight:4 }} />Visits
        </button>
        <button className={`tab-btn ${tab==='emr'?'active':''}`} onClick={() => setTab('emr')}>
          <FileText size={14} style={{ marginRight:4 }} />EMR Summary
        </button>
        <button className={`tab-btn ${tab==='lab'?'active':''}`} onClick={() => setTab('lab')}>
          <FlaskConical size={14} style={{ marginRight:4 }} />Lab History
        </button>
        <button className={`tab-btn ${tab==='prescriptions'?'active':''}`} onClick={() => setTab('prescriptions')}>
          <Pill size={14} style={{ marginRight:4 }} />Prescriptions
        </button>
        <button className={`tab-btn ${tab==='billing'?'active':''}`} onClick={() => setTab('billing')}>
          <ReceiptText size={14} style={{ marginRight:4 }} />Billing
        </button>
        <button className={`tab-btn ${tab==='injections'?'active':''}`} onClick={() => setTab('injections')}>
          <Syringe size={14} style={{ marginRight:4 }} />Injections (INJ)
        </button>
      </div>

      {tab === 'visits' && <PatientVisits visits={visits} patientId={id} onRefresh={loadPatient} />}
      {tab === 'emr'    && <PatientEMR patientId={id} />}
      {tab === 'lab'    && <PatientLab patientId={id} />}
      {tab === 'prescriptions' && <PatientPrescriptions patientId={id} patient={patient} />}
      {tab === 'billing' && <PatientBilling patientId={id} onPaymentCompleted={loadPatient} />}
      {tab === 'injections' && <PatientInjections patientId={id} patient={patient} />}
    </div>
  )
}

function MetaItem({ label, value, mono }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className={`meta-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  )
}

function CheckInBannerButton({ patientId, onCheckedIn }) {
  const [loading, setLoading] = useState(false)
  const handleCheckin = async () => {
    setLoading(true)
    try {
      const res = await patientsApi.checkin(patientId)
      const data = res.data
      if (data.needs_reregistration) {
        toast.success(`Checked in. ⚠️ Re-registration invoice created (last visit > ${data.grace_days} days ago).`, { duration: 6000 })
      } else {
        toast.success('Patient checked in to today\'s queue')
      }
      if (onCheckedIn) onCheckedIn()
    } catch (err) {
      const d = err.response?.data?.detail
      toast.error(typeof d === 'object' ? d.en : d || 'Check-in failed')
    } finally { setLoading(false) }
  }
  return (
    <button className="btn btn-accent btn-sm" onClick={handleCheckin} disabled={loading} style={{ whiteSpace:'nowrap' }}>
      {loading ? 'Checking in…' : '✓ Check In'}
    </button>
  )
}

function PatientVisits({ visits, patientId, onRefresh }) {
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const canCloseVisit = ['doctor', 'admin'].includes(myRole)

  const handleCloseVisit = async (visitId) => {
    if (!window.confirm('Are you sure you want to close this visit?')) return
    try {
      await visitsApi.close(visitId)
      toast.success('Visit closed successfully')
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(apiError(err, 'Failed to close visit'))
    }
  }

  if (!visits.length) return (
    <div className="card">
      <div className="empty-state"><Stethoscope size={40}/><p style={{marginTop:'0.5rem'}}>No visits recorded</p></div>
    </div>
  )
  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Visit #</th>
              <th>Type</th>
              <th>Complaint</th>
              <th>Status</th>
              <th>Date</th>
              {canCloseVisit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visits.map(v => (
              <tr key={v.id}>
                <td><span className="mono patient-num">{v.visit_number}</span></td>
                <td><span className="badge badge-blue">{v.visit_type}</span></td>
                <td>{v.chief_complaint_en || '—'}</td>
                <td><span className={`badge ${v.status==='open'?'badge-green':'badge-gray'}`}>{v.status}</span></td>
                <td style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>{new Date(v.created_at).toLocaleDateString()}</td>
                {canCloseVisit && (
                  <td>
                    {v.status === 'open' ? (
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        onClick={() => handleCloseVisit(v.id)}
                      >
                        <XCircle size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Close Visit
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Closed</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PatientEMR({ patientId }) {
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const canCreateNote = ['doctor', 'admin'].includes(myRole)

  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [selectedNoteGroup, setSelectedNoteGroup] = useState(null)

  const load = () => {
    emrApi.summary(patientId)
      .then(r => setSummary(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [patientId])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const allergies = summary?.allergies || []
  const diagnoses = summary?.diagnoses || []
  const visits = summary?.recent_visits || []
  const isEmpty = allergies.length === 0 && diagnoses.length === 0 && visits.length === 0

  const dxLabel = (dx) => {
    if (typeof dx === 'string') return dx
    if (dx && typeof dx === 'object') {
      const code = dx.icd10_code || dx.code
      const desc = dx.description_en || dx.description || dx.name_en || dx.name
      return [code, desc].filter(Boolean).join(' — ') || JSON.stringify(dx)
    }
    return String(dx)
  }

  if (isEmpty) {
    return (
      <div className="card">
        <div className="empty-state">
          <FileText size={40}/>
          <p style={{marginTop:'0.5rem'}}>No EMR records</p>
          {canCreateNote && (
            <button className="btn btn-primary btn-sm" style={{marginTop:'1rem'}} onClick={() => setShowNoteModal(true)}>
              <Plus size={14} /> Create Clinical Note
            </button>
          )}
        </div>
        {showNoteModal && <EMRNoteModal patientId={patientId} onClose={() => setShowNoteModal(false)} onSaved={() => { setShowNoteModal(false); load() }} />}
        {/* Still show indicator panel even when no notes */}
        {canCreateNote && <EMRIndicatorPanel patientId={patientId} />}
      </div>
    )
  }

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div></div>
        {canCreateNote && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNoteModal(true)}>
            <Plus size={14} /> Create Clinical Note
          </button>
        )}
      </div>

      {/* Card 1: Core Patient Health Profile (Allergies & Diagnoses) */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:'1.25rem', marginBottom:'1.5rem' }}>
        <section>
          <h4 className="emr-section-title">Allergies</h4>
          {allergies.length === 0 ? (
            <p className="emr-muted">None recorded</p>
          ) : (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
              {allergies.map((a, i) => <span key={i} className="badge badge-red">{a}</span>)}
            </div>
          )}
        </section>

        <section>
          <h4 className="emr-section-title">Diagnoses</h4>
          {diagnoses.length === 0 ? (
            <p className="emr-muted">None recorded</p>
          ) : (
            <ul className="emr-list">
              {diagnoses.map((dx, i) => <li key={i}>{dxLabel(dx)}</li>)}
            </ul>
          )}
        </section>
      </div>

      {/* Card 2: Recent Visits & Clinical Notes */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <h4 className="emr-section-title" style={{ marginBottom:'1rem' }}>Recent Visits & Clinical Notes</h4>
        {visits.length === 0 ? (
          <p className="emr-muted">No visits</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Visit #</th><th>Date</th><th>Status</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.visit_id}>
                    <td><span className="mono">{v.visit_number}</span></td>
                    <td style={{ fontSize:'0.82rem' }}>{v.visit_date ? new Date(v.visit_date).toLocaleDateString() : '—'}</td>
                    <td><span className="badge badge-blue">{v.status?.replace('_',' ')}</span></td>
                    <td style={{ fontSize:'0.82rem' }}>
                      {(v.notes || []).length === 0
                        ? <span className="emr-muted">No notes</span>
                        : (
                          <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                            {v.notes.map((noteGroup, i) => (
                              <button
                                key={i}
                                className="btn btn-ghost btn-xs"
                                onClick={() => setSelectedNoteGroup(noteGroup)}
                                style={{fontSize:'0.75rem'}}
                              >
                                {noteGroup.type} {noteGroup.count > 1 && `(${noteGroup.count})`}
                              </button>
                            ))}
                          </div>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Card 3: Dedicated Government Reportable Indicators Panel */}
      {canCreateNote && <EMRIndicatorPanel patientId={patientId} />}

      {showNoteModal && <EMRNoteModal patientId={patientId} onClose={() => setShowNoteModal(false)} onSaved={() => { setShowNoteModal(false); load() }} />}
      {selectedNoteGroup && <NoteGroupViewerModal noteGroup={selectedNoteGroup} onClose={() => setSelectedNoteGroup(null)} />}
    </>
  )
}


// ─── EMR Indicator Panel (Part C) ─────────────────────────────────────────────
function EMRIndicatorPanel({ patientId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // recordedCodes: set of codes already confirmed this visit (pre-loaded + newly recorded)
  const [recordedCodes, setRecordedCodes] = useState(new Set())
  // feedback map: code → label of the choice just recorded
  const [feedback, setFeedback] = useState({})
  // threshold input values per indicator id
  const [thresholdValues, setThresholdValues] = useState({})
  // recording state per option
  const [recording, setRecording] = useState({})

  const load = async () => {
    try {
      const res = await emrApi.getPatientEMRIndicators(patientId)
      const d = res.data
      setData(d)
      // Seed already-recorded codes from options flagged by backend
      const preRecorded = new Set()
      for (const ind of (d.indicators || [])) {
        for (const opt of (ind.options || [])) {
          if (opt.already_recorded) preRecorded.add(opt.code)
        }
      }
      setRecordedCodes(preRecorded)
    } catch {
      // Non-fatal — silently hide panel on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [patientId])

  if (loading || !data) return null
  if (!data.open_visit_id) return null  // No open visit — panel is read-only/hidden
  if (!data.indicators || data.indicators.length === 0) return null

  const visitId = data.open_visit_id

  // Group indicators by section
  const bySection = {}
  for (const ind of data.indicators) {
    const sec = ind.section || 'General'
    if (!bySection[sec]) bySection[sec] = []
    bySection[sec].push(ind)
  }

  const handleRecord = async (indicator, code, optionLabel) => {
    const key = `${indicator.id}:${code}`
    if (recording[key]) return
    setRecording(r => ({ ...r, [key]: true }))
    try {
      const res = await emrApi.recordIndicator({
        visit_id: visitId,
        indicator_definition_id: indicator.id,
        report_event_code: code,
        option_label: optionLabel,
      })
      const d = res.data
      const resolvedCode = d.code || code
      setRecordedCodes(prev => new Set([...prev, resolvedCode]))
      // Also mark any related contraceptive repeat code
      if (code !== resolvedCode) setRecordedCodes(prev => new Set([...prev, code]))
      const wasNew = d.status === 'recorded'
      const label = d.option_label || optionLabel
      setFeedback(f => ({
        ...f,
        [indicator.id]: {
          label,
          code: resolvedCode,
          isNew: wasNew,
          isAgeException: d.is_age_exception,
          ts: Date.now(),
        }
      }))
      // Auto-clear feedback after 8 seconds
      setTimeout(() => setFeedback(f => { const n = {...f}; delete n[indicator.id]; return n }), 8000)
    } catch (err) {
      toast.error(apiError(err, 'Failed to record indicator'))
    } finally {
      setRecording(r => { const n = {...r}; delete n[`${indicator.id}:${code}`]; return n })
    }
  }

  const handleThreshold = async (indicator) => {
    const raw = thresholdValues[indicator.id]
    if (raw === undefined || raw === '') {
      toast.error('Enter a value first')
      return
    }
    const val = parseFloat(raw)
    if (isNaN(val)) { toast.error('Invalid number'); return }
    // Find matching threshold range
    const match = indicator.thresholds.find(t => {
      const aboveMin = t.min_value === null || val >= t.min_value
      const belowMax = t.max_value === null || val < t.max_value
      return aboveMin && belowMax
    })
    if (!match) { toast.error('Value does not match any configured range'); return }
    await handleRecord(indicator, match.code, `${match.label} (${val})`)
    setThresholdValues(v => { const n = {...v}; delete n[indicator.id]; return n })
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {Object.entries(bySection).map(([section, indicators]) => (
        <div key={section} style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.6rem'
          }}>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)',
            }}>
              {section}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {indicators.map(ind => {
              const fb = feedback[ind.id]
              const hasAnyRecorded = ind.options.some(o => recordedCodes.has(o.code))
                || (fb && fb.code && recordedCodes.has(fb.code))

              return (
                <div key={ind.id} style={{
                  background: 'var(--card-bg)',
                  border: `1px solid ${hasAnyRecorded ? 'hsla(162,72%,45%,0.4)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--border-radius)',
                  padding: '0.85rem 1rem',
                  transition: 'border-color 0.3s',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginBottom: '0.55rem', flexWrap: 'wrap'
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {ind.label}
                    </span>
                    {ind.is_age_exception && (
                      <span title={`Age ${data.patient_age} is outside configured range ${ind.min_age ?? '?'}–${ind.max_age ?? '?'}`} style={{
                        fontSize: '0.7rem', background: 'hsla(38,95%,55%,0.15)',
                        color: 'hsl(38,95%,40%)', border: '1px solid hsla(38,95%,55%,0.3)',
                        borderRadius: '0.3rem', padding: '0.1rem 0.4rem', fontWeight: 600,
                      }}>
                        ⚠ Age exception
                      </span>
                    )}
                    {hasAnyRecorded && (
                      <span style={{
                        fontSize: '0.7rem', background: 'hsla(162,72%,45%,0.1)',
                        color: 'hsl(162,72%,35%)', border: '1px solid hsla(162,72%,45%,0.3)',
                        borderRadius: '0.3rem', padding: '0.1rem 0.4rem', fontWeight: 600,
                      }}>
                        ✓ Recorded
                      </span>
                    )}
                  </div>

                  {/* Feedback message */}
                  {fb && (
                    <div style={{
                      fontSize: '0.8rem', color: 'hsl(162,72%,35%)',
                      background: 'hsla(162,72%,45%,0.08)',
                      border: '1px solid hsla(162,72%,45%,0.25)',
                      borderRadius: '0.3rem', padding: '0.35rem 0.6rem',
                      marginBottom: '0.5rem',
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}>
                      <CheckCircle size={13} />
                      {fb.isNew ? 'Recorded' : 'Already recorded'}: <strong>{fb.label}</strong>
                      {fb.isAgeException && <span style={{ color: 'hsl(38,95%,40%)', marginLeft: 4 }}>(age exception flagged)</span>}
                    </div>
                  )}

                  {/* Buttons shape */}
                  {ind.outcome_shape === 'buttons' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {ind.options.map(opt => {
                        const alreadyDone = recordedCodes.has(opt.code)
                        const isRecording = recording[`${ind.id}:${opt.code}`]
                        return (
                          <button
                            key={opt.code}
                            onClick={() => handleRecord(ind, opt.code, opt.label)}
                            disabled={alreadyDone || isRecording}
                            style={{
                              fontSize: '0.82rem',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.4rem',
                              border: alreadyDone
                                ? '1px solid hsla(162,72%,45%,0.5)'
                                : '1px solid var(--border-color)',
                              background: alreadyDone
                                ? 'hsla(162,72%,45%,0.12)'
                                : 'var(--input-bg, var(--card-bg))',
                              color: alreadyDone ? 'hsl(162,72%,35%)' : 'var(--text-primary)',
                              cursor: alreadyDone ? 'default' : 'pointer',
                              fontWeight: alreadyDone ? 600 : 400,
                              transition: 'all 0.15s',
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                            }}
                          >
                            {alreadyDone && <Check size={12} />}
                            {isRecording ? '…' : opt.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Threshold shape */}
                  {ind.outcome_shape === 'threshold' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        step="any"
                        placeholder="Enter value"
                        value={thresholdValues[ind.id] ?? ''}
                        onChange={e => setThresholdValues(v => ({ ...v, [ind.id]: e.target.value }))}
                        style={{
                          width: '120px', padding: '0.35rem 0.5rem',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.4rem', fontSize: '0.85rem',
                          background: 'var(--input-bg, var(--card-bg))',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleThreshold(ind)}
                        disabled={!thresholdValues[ind.id]}
                      >
                        Record
                      </button>
                      {ind.thresholds.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Ranges: {ind.thresholds.map(t =>
                            `${t.label} (${t.min_value ?? '–∞'}–${t.max_value ?? '∞'})`
                          ).join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}


function PatientLab({ patientId }) {
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const canOrder  = ['doctor', 'admin'].includes(myRole)
  const canApprove = ['doctor', 'admin'].includes(myRole)

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [expanded, setExpanded] = useState(null) // row id expanded for results

  const load = () => {
    setLoading(true)
    labApi.history(patientId)
      .then(r => {
        const data = r.data
        setHistory(Array.isArray(data) ? data : [])
      })
      .catch(() => toast.error('Failed to load lab history'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [patientId])

  const cancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this lab order?')) return
    try {
      await labApi.cancelOrder(orderId)
      toast.success('Lab order cancelled')
      load()
    } catch (err) {
      toast.error(apiError(err, 'Failed to cancel lab order'))
    }
  }

  const approve = async (itemId) => {
    try {
      await labApi.verify(itemId)
      toast.success('Lab result approved')
      load()
    } catch (err) {
      toast.error(apiError(err, 'Failed to approve result'))
    }
  }

  const statusBadge = (s) => {
    const map = {
      pending: 'badge-orange',
      accepted: 'badge-purple',
      sample_collected: 'badge-blue',
      completed: 'badge-teal',
      cancelled: 'badge-gray',
    }
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s?.replace(/_/g, ' ')}</span>
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <>
      {/* Header row with Order Lab button */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <h4 style={{ margin:0, fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>
          <FlaskConical size={16} style={{ marginRight:6, verticalAlign:'middle' }} />
          Lab History
        </h4>
        {canOrder && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowOrderModal(true)}>
            <Plus size={14} /> Order Lab
          </button>
        )}
      </div>

      <div className="card">
        {history.length === 0 ? (
          <div className="empty-state">
            <FlaskConical size={40}/>
            <p style={{marginTop:'0.5rem'}}>No lab history</p>
            {canOrder && (
              <button className="btn btn-primary btn-sm" style={{marginTop:'1rem'}} onClick={() => setShowOrderModal(true)}>
                <Plus size={14} /> Order First Lab Test
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Test</th>
                  <th>Priority</th>
                  <th>Ordered By</th>
                  <th>Lab Tech</th>
                  <th>Status</th>
                  <th>Approved By</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <>
                    <tr
                      key={row.id}
                      style={{ cursor: row.results?.length > 0 ? 'pointer' : 'default', background: expanded === row.id ? 'var(--bg-secondary)' : '' }}
                      onClick={() => row.results?.length > 0 && setExpanded(expanded === row.id ? null : row.id)}
                    >
                      <td><span className="mono patient-num">{row.order_number}</span></td>
                      <td style={{fontWeight:500}}>{row.test_name || '—'}</td>
                      <td>
                        <span className={`badge ${row.priority === 'urgent' || row.priority === 'stat' ? 'badge-red' : 'badge-blue'}`}>
                          {row.priority || 'routine'}
                        </span>
                      </td>
                      <td style={{fontSize:'0.82rem'}}>
                        {row.ordered_by_name
                          ? <span><User size={12} style={{marginRight:3, verticalAlign:'middle'}} />{row.ordered_by_name}</span>
                          : <span className="emr-muted">—</span>}
                      </td>
                      <td style={{fontSize:'0.82rem'}}>
                        {row.technician_name
                          ? <span><Beaker size={12} style={{marginRight:3, verticalAlign:'middle'}} />{row.technician_name}</span>
                          : <span className="emr-muted">Not done</span>}
                      </td>
                      <td>{statusBadge(row.status)}</td>
                      <td style={{fontSize:'0.82rem'}}>
                        {row.verified_at
                          ? <span style={{color:'var(--success)'}}><CheckCircle size={12} style={{marginRight:3, verticalAlign:'middle'}} />{row.approved_by_name || 'Approved'}</span>
                          : <span className="emr-muted">—</span>}
                      </td>
                      <td style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
                        {row.ordered_at ? new Date(row.ordered_at).toLocaleDateString() : '—'}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {/* Doctor can cancel pending_payment order */}
                        {canOrder && row.status === 'pending_payment' && (
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', fontSize: '0.75rem', marginRight: '0.4rem' }}
                            onClick={() => cancelOrder(row.id)}
                          >
                            Cancel
                          </button>
                        )}
                        {/* Doctor can approve completed-but-not-yet-verified results */}
                        {canApprove && row.status === 'completed' && !row.verified_at && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{fontSize:'0.75rem'}}
                            onClick={() => approve(row.id)}
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                        )}
                        {row.verified_at && (
                          <span className="badge badge-green" style={{fontSize:'0.72rem'}}>Approved ✓</span>
                        )}
                        {row.results?.length > 0 && (
                          <button className="btn btn-ghost btn-xs" style={{marginLeft:'0.4rem', fontSize:'0.75rem'}} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                            {expanded === row.id ? 'Hide' : 'Results'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Expandable results row */}
                    {expanded === row.id && row.results?.length > 0 && (
                      <tr key={`${row.id}-results`} style={{background:'var(--bg-secondary)'}}>
                        <td colSpan={9} style={{padding:'1rem 1.5rem'}}>
                          <div style={{fontWeight:600, fontSize:'0.82rem', marginBottom:'0.5rem', color:'var(--text-muted)'}}>
                            Test Results for {row.test_name}
                          </div>
                          <table style={{width:'auto', minWidth:'400px'}}>
                            <thead>
                              <tr>
                                <th style={{fontSize:'0.78rem'}}>Parameter</th>
                                <th style={{fontSize:'0.78rem'}}>Value</th>
                                <th style={{fontSize:'0.78rem'}}>Unit</th>
                                <th style={{fontSize:'0.78rem'}}>Normal Range</th>
                                <th style={{fontSize:'0.78rem'}}>Flag</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.results.map((r, i) => (
                                <tr key={i}>
                                  <td style={{fontSize:'0.82rem'}}>{r.parameter}</td>
                                  <td style={{fontWeight:600, color: r.is_abnormal ? 'var(--danger)' : 'var(--text-primary)'}}>
                                    {r.value ?? '—'}
                                  </td>
                                  <td style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{r.unit || '—'}</td>
                                  <td style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{r.normal_range_text || '—'}</td>
                                  <td>
                                    {r.flag
                                      ? <span className={`badge ${r.flag.startsWith('H') ? 'badge-red' : 'badge-orange'}`}>{r.flag}</span>
                                      : <span className="badge badge-green">Normal</span>
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOrderModal && (
        <LabOrderModal
          patientId={patientId}
          onClose={() => setShowOrderModal(false)}
          onSaved={() => { setShowOrderModal(false); load() }}
        />
      )}
    </>
  )
}

function LabOrderModal({ patientId, onClose, onSaved }) {
  const [visits, setVisits] = useState([])
  const [testTypes, setTestTypes] = useState([])
  const [form, setForm] = useState({ visit_id: '', priority: 'routine', clinical_notes: '' })
  const [selectedTests, setSelectedTests] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      visitsApi.patientVisits(patientId, { limit: 50 }),
      labApi.testTypes(),
    ])
      .then(([vRes, tRes]) => {
        const vs = (vRes.data.items ?? vRes.data).filter(v => v.status === 'open')
        setVisits(vs)
        if (vs.length === 1) setForm(f => ({ ...f, visit_id: vs[0].id }))
        setTestTypes(tRes.data)
      })
      .catch(() => toast.error('Failed to load data'))
  }, [patientId])

  const toggleTest = (id) =>
    setSelectedTests(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.visit_id) return toast.error('Select a visit')
    if (selectedTests.length === 0) return toast.error('Select at least one test')
    setSaving(true)
    try {
      await labApi.createOrder({
        visit_id: form.visit_id,
        test_type_ids: selectedTests,
        priority: form.priority,
        clinical_notes: form.clinical_notes || undefined,
      })
      toast.success('Lab order created')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'Failed to create lab order'))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3><FlaskConical size={16} style={{marginRight:6}} />Order Lab Test</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem'}}>
            <div className="form-group">
              <label className="form-label">Visit *</label>
              <select
                className="form-select"
                value={form.visit_id}
                onChange={e => setForm(f => ({ ...f, visit_id: e.target.value }))}
                required
              >
                <option value="">Select an open visit…</option>
                {visits.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.visit_number} — {v.chief_complaint_en || 'No complaint'} ({new Date(v.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {visits.length === 0 && (
                <small className="form-hint">No open visits. Open a visit first from the Visits tab.</small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Tests *</label>
              <div style={{ maxHeight:'200px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.5rem' }}>
                {testTypes.length === 0 ? (
                  <small className="form-hint">No test types configured.</small>
                ) : testTypes.map(t => (
                  <label key={t.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0', cursor:'pointer' }}>
                    <input type="checkbox" checked={selectedTests.includes(t.id)} onChange={() => toggleTest(t.id)} />
                    <span>{t.name_en}</span>
                    <span style={{ marginLeft:'auto', color:'var(--text-muted)', fontSize:'0.8rem' }}>
                      {t.price != null ? `${Number(t.price).toFixed(2)} ETB` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Clinical Notes</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.clinical_notes}
                onChange={e => setForm(f => ({ ...f, clinical_notes: e.target.value }))}
                placeholder="Reason for test, relevant symptoms…"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || visits.length === 0}>
              {saving ? 'Creating…' : 'Create Lab Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}



function PatientBilling({ patientId, onPaymentCompleted }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const { user } = useAuth()

  const loadInvoices = () => {
    setLoading(true)
    billingApi.list(patientId)
      .then(r => setInvoices(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadInvoices()
  }, [patientId])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div className="card">
      {invoices.length === 0 ? (
        <div className="empty-state"><ReceiptText size={40}/><p style={{marginTop:'0.5rem'}}>No invoices</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Description</th>
                <th>Total (ETB)</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Date</th>
                {['receptionist', 'cashier', 'admin'].includes(user?.role) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td className="mono patient-num">{inv.invoice_number}</td>
                  <td>
                    <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {inv.items?.map(i => i.description_en).join(', ') || inv.notes || 'Other charges'}
                    </div>
                  </td>
                  <td style={{fontWeight:600}}>{inv.total_amount?.toLocaleString()}</td>
                  <td>{inv.paid_amount?.toLocaleString()}</td>
                  <td><span className={`badge ${inv.status==='paid'?'badge-green':inv.status==='partially_paid'?'badge-orange':'badge-gray'}`}>{inv.status}</span></td>
                  <td style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>{new Date(inv.created_at).toLocaleDateString()}</td>
                  {['receptionist', 'cashier', 'admin'].includes(user?.role) && (
                    <td>
                      {inv.status === 'paid' ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✓ Paid</span>
                      ) : inv.status === 'cancelled' ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cancelled</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button className="btn btn-primary btn-xs" onClick={() => setSelectedInvoice(inv)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CreditCard size={12} /> Pay
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            title="Patient cannot pay — void this invoice and the order behind it"
                            onClick={() => setCancelTarget(inv)}
                          >
                            <XCircle size={12} /> Can't Pay
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedInvoice && (
        <RecordPaymentModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSaved={() => {
            setSelectedInvoice(null);
            loadInvoices();
            if (onPaymentCompleted) onPaymentCompleted();
          }}
        />
      )}

      {cancelTarget && (
        <CancelInvoiceModal
          invoice={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {
            setCancelTarget(null);
            loadInvoices();
            if (onPaymentCompleted) onPaymentCompleted();
          }}
        />
      )}
    </div>
  )
}

function RecordPaymentModal({ invoice, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: invoice.total_amount - invoice.paid_amount,
    payment_method: 'cash',
    payment_reference: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await billingApi.pay({
        invoice_id: invoice.id,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        payment_reference: form.payment_reference || null,
        notes: form.notes || null
      })
      toast.success('Payment recorded successfully')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'Failed to record payment'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Record Payment — Inv #{invoice.invoice_number}</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div>Total Amount: <strong>{invoice.total_amount} ETB</strong></div>
              <div>Remaining: <strong style={{ color: 'var(--color-primary)' }}>{(invoice.total_amount - invoice.paid_amount).toFixed(2)} ETB</strong></div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Payment Amount *</label>
              <input
                className="form-input"
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                min={0.01}
                max={(invoice.total_amount - invoice.paid_amount)}
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select
                className="form-select"
                value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="insurance">Insurance</option>
                <option value="waived">Waived</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reference Number (Receipt / Txn ID)</label>
              <input
                className="form-input"
                value={form.payment_reference}
                onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))}
                placeholder="e.g. CBE12345"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional payment notes…"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Processing…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NoteGroupViewerModal({ noteGroup, onClose }) {
  const [fullNotes, setFullNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch all notes in this group
    Promise.all(noteGroup.notes.map(n => emrApi.getNote(n.id)))
      .then(responses => setFullNotes(responses.map(r => r.data)))
      .catch(() => toast.error('Failed to load notes'))
      .finally(() => setLoading(false))
  }, [noteGroup])

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    </div>
  )

  const noteTypeTitle = noteGroup.type?.replace('_', ' ').charAt(0).toUpperCase() + noteGroup.type?.slice(1).replace('_', ' ')

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <h3>{noteTypeTitle} Notes</h3>
            <div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>
              {fullNotes.length} {fullNotes.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{padding:'1.5rem',maxHeight:'60vh',overflowY:'auto'}}>
          {fullNotes.map((note, idx) => (
            <div key={note.id} style={{
              marginBottom: idx < fullNotes.length - 1 ? '2rem' : 0,
              paddingBottom: idx < fullNotes.length - 1 ? '2rem' : 0,
              borderBottom: idx < fullNotes.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                <div style={{fontSize:'0.9rem',fontWeight:600}}>
                  {note.author_name}
                  {note.is_signed && <span style={{marginLeft:'0.5rem',fontSize:'0.85rem',color:'var(--success)'}}>✓ Signed</span>}
                </div>
                <div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>
                  {new Date(note.created_at).toLocaleString()}
                </div>
              </div>

              {note.content_en && (
                <div style={{marginBottom:'1rem'}}>
                  <h4 style={{fontSize:'0.85rem',fontWeight:600,marginBottom:'0.5rem',color:'var(--text-muted)'}}>English</h4>
                  <div style={{whiteSpace:'pre-wrap',lineHeight:1.6,fontSize:'0.95rem'}}>{note.content_en}</div>
                </div>
              )}

              {note.content_am && (
                <div style={{marginBottom:'1rem'}}>
                  <h4 style={{fontSize:'0.85rem',fontWeight:600,marginBottom:'0.5rem',color:'var(--text-muted)'}}>አማርኛ</h4>
                  <div style={{whiteSpace:'pre-wrap',lineHeight:1.6,fontSize:'0.95rem'}}>{note.content_am}</div>
                </div>
              )}

              {note.structured_data && Object.keys(note.structured_data).length > 0 && (
                <div style={{marginTop:'1rem'}}>
                  <h4 style={{fontSize:'0.85rem',fontWeight:600,marginBottom:'0.5rem',color:'var(--text-muted)'}}>Structured Data</h4>
                  <pre style={{background:'var(--bg-secondary)',padding:'0.75rem',borderRadius:'6px',fontSize:'0.8rem',overflowX:'auto'}}>
                    {JSON.stringify(note.structured_data, null, 2)}
                  </pre>
                </div>
              )}

              {note.is_amended && note.amendment_reason && (
                <div style={{marginTop:'1rem',padding:'0.75rem',background:'var(--warning-bg)',borderLeft:'3px solid var(--warning)',borderRadius:'6px'}}>
                  <strong style={{fontSize:'0.8rem',color:'var(--warning)'}}>Amendment:</strong>
                  <div style={{marginTop:'0.25rem',fontSize:'0.85rem'}}>{note.amendment_reason}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function EMRNoteModal({ patientId, onClose, onSaved }) {
  const [visits, setVisits] = useState([])
  const [form, setForm] = useState({
    visit_id: '',
    note_type: 'history',
    content_en: '',
    content_am: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    visitsApi.list({ patient_id: patientId, status: 'open' })
      .then(r => {
        const vs = r.data.items ?? r.data
        setVisits(vs)
        if (vs.length === 1) setForm(f => ({ ...f, visit_id: vs[0].id }))
      })
      .catch(() => toast.error('Failed to load visits'))
  }, [patientId])

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.visit_id) {
      toast.error('Please select a visit')
      return
    }
    if (!form.content_en?.trim() && !form.content_am?.trim()) {
      toast.error('Note content is required')
      return
    }
    setSaving(true)
    try {
      await emrApi.createNote(form)
      toast.success('Clinical note created')
      onSaved()
    } catch (err) {
      const detail = err.response?.data?.detail
      let msg = 'Failed to create note'
      if (typeof detail === 'string') msg = detail
      else if (typeof detail === 'object' && detail.en) msg = detail.en
      else if (Array.isArray(detail)) {
        const msgs = detail.map(e => {
          const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null
          const errMsg = (e.msg || '').replace(/^Value error,\s*/, '')
          return field ? `${field}: ${errMsg}` : errMsg
        }).filter(Boolean)
        msg = msgs.join('; ') || msg
      }
      toast.error(msg, { duration: 5000 })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Create Clinical Note</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group" style={{marginBottom:'1rem'}}>
            <label className="form-label">Visit *</label>
            <select className="form-select" name="visit_id" value={form.visit_id} onChange={handle} required>
              <option value="">Select a visit...</option>
              {visits.map(v => (
                <option key={v.id} value={v.id}>
                  {v.visit_number} — {v.chief_complaint_en || 'No complaint'} ({new Date(v.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
            {visits.length === 0 && (
              <p style={{fontSize:'0.82rem',color:'var(--text-muted)',marginTop:'0.5rem'}}>
                No open visits. Open a visit first from the Visits tab.
              </p>
            )}
          </div>

          <div className="form-group" style={{marginBottom:'1rem'}}>
            <label className="form-label">Note Type *</label>
            <select className="form-select" name="note_type" value={form.note_type} onChange={handle}>
              <option value="history">History</option>
              <option value="examination">Examination</option>
              <option value="assessment">Assessment</option>
              <option value="plan">Plan</option>
              <option value="progress">Progress Note</option>
              <option value="discharge_summary">Discharge Summary</option>
            </select>
          </div>

          <div className="form-group" style={{marginBottom:'1rem'}}>
            <label className="form-label">Clinical Note (English) *</label>
            <textarea
              className="form-input"
              name="content_en"
              rows={8}
              value={form.content_en}
              onChange={handle}
              placeholder="Enter clinical findings, assessment, and plan..."
              required
            />
          </div>

          <div className="form-group" style={{marginBottom:'1rem'}}>
            <label className="form-label">Clinical Note (Amharic)</label>
            <textarea
              className="form-input"
              name="content_am"
              rows={4}
              value={form.content_am}
              onChange={handle}
              placeholder="Optional Amharic translation..."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || visits.length === 0}>
              {saving ? 'Creating…' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PatientPrescriptions({ patientId, patient }) {
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const canOrder = ['doctor', 'admin'].includes(myRole)

  const isPharmacist = ['pharmacist', 'admin'].includes(myRole)
  const canAdministerInjections = ['pharmacist', 'nurse', 'doctor', 'admin'].includes(myRole)

  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [expanded, setExpanded] = useState(null) // prescription id expanded
  const [dispenseForm, setDispenseForm] = useState({}) // item_id -> qty
  const [injNotes, setInjNotes] = useState({}) // item_id -> string

  const load = () => {
    setLoading(true)
    pharmacyApi.patientPrescriptions(patientId)
      .then(r => {
        setPrescriptions(Array.isArray(r.data) ? r.data : [])
      })
      .catch(() => toast.error('Failed to load prescription history'))
      .finally(() => setLoading(false))
  }

  // A doctor may cancel their own mistake up until the patient pays.
  // After payment the money is already in the till, so only an admin can cancel.
  const isAdmin = myRole === 'admin'
  const canCancelRx = (p) => {
    if (['cancelled', 'dispensed'].includes(p.status)) return false
    if (p.status === 'pending_payment') return canOrder      // doctor or admin — not paid yet
    return isAdmin                                            // paid already — admin only
  }

  const cancelRx = async (p) => {
    const paid = p.status !== 'pending_payment'
    const warning = paid
      ? 'This prescription has already been PAID for. Cancelling it leaves the invoice standing so a refund can be issued.\n\n'
      : ''
    const reason = window.prompt(`${warning}Why are you cancelling this prescription?`, '')
    if (reason === null) return   // dismissed
    try {
      await pharmacyApi.cancelPrescription(p.id, reason.trim() || undefined)
      toast.success(paid ? 'Prescription cancelled — refund due to patient' : 'Prescription cancelled')
      load()
    } catch (err) {
      toast.error(apiError(err, 'Failed to cancel prescription'))
    }
  }

  const handleDispense = async (itemId, remaining) => {
    const qtyInput = dispenseForm[itemId]
    const qty = qtyInput !== undefined ? parseInt(qtyInput) : remaining
    if (isNaN(qty) || qty < 1) { toast.error('Enter a valid quantity'); return }
    if (qty > remaining) { toast.error(`Max is ${remaining}`); return }
    try {
      await pharmacyApi.dispense({ prescription_item_id: itemId, quantity_to_dispense: qty })
      toast.success('Medication dispensed ✓')
      setDispenseForm(prev => { const c = { ...prev }; delete c[itemId]; return c })
      load()
    } catch (err) {
      toast.error(apiError(err, 'Failed to dispense'))
    }
  }

  const handleRecordInjection = async (itemId, sessionNum) => {
    const notes = injNotes[itemId]
    try {
      await pharmacyApi.recordInjection({
        prescription_item_id: itemId,
        session_number: sessionNum,
        notes: notes || undefined
      })
      toast.success(`Injection Session ${sessionNum} recorded successfully ✓`)
      setInjNotes(prev => { const c = { ...prev }; delete c[itemId]; return c })
      load()
    } catch (err) {
      toast.error(apiError(err, 'Failed to record injection session'))
    }
  }

  useEffect(() => { load() }, [patientId])

  const statusBadge = (s) => {
    const map = {
      pending_payment: 'badge-gray',
      pending: 'badge-orange',
      dispensed: 'badge-green',
      partially_dispensed: 'badge-purple',
      cancelled: 'badge-red',
    }
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s?.replace(/_/g, ' ')}</span>
  }

  const printPatientPrescription = (p) => {
    const win = window.open('', '_blank', 'width=540,height=700')
    const patientName = patient ? `${patient.first_name_en || ''} ${patient.last_name_en || ''}`.trim() : 'Patient'
    const patientNum  = patient?.patient_number || ''
    const doctorName  = p.prescribed_by_name || 'Dr.'
    const rxDate      = p.prescribed_at ? new Date(p.prescribed_at).toLocaleDateString() : new Date().toLocaleDateString()
    const itemRows = (p.items || []).map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${item.drug_name || 'Drug #' + item.drug_id}</strong><br/><span style="font-size:11px;color:#555">${item.drug_form || ''}</span></td>
        <td>${item.dose || '—'} ${item.strength || ''}</td>
        <td>${item.frequency || '—'}</td>
        <td>${item.duration || '—'} day(s)</td>
        <td>${item.quantity || '—'}</td>
        <td style="font-size:11px">${[item.instructions_en, item.instructions_am].filter(Boolean).join(' / ') || '—'}</td>
      </tr>
    `).join('')
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Prescription - ${patientName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 28px; color: #111; font-size: 13px; }
        .clinic-name { font-size: 19px; font-weight: 700; text-align: center; margin-bottom: 2px; }
        .clinic-sub  { font-size: 12px; color: #555; text-align: center; margin-bottom: 2px; }
        .rx-title    { font-size: 14px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0; }
        hr           { border: none; border-top: 1.5px solid #333; margin: 10px 0; }
        .info-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 14px; }
        .info-row    { font-size: 12px; }
        .info-row span { font-weight: 600; }
        table        { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th           { background: #eee; text-align: left; padding: 5px 6px; font-size: 11px; border-bottom: 1px solid #ccc; }
        td           { padding: 5px 6px; font-size: 12px; border-bottom: 1px dotted #ddd; vertical-align: top; }
        .sig-area    { margin-top: 36px; display: flex; justify-content: space-between; font-size: 12px; }
        .sig-box     { text-align: center; }
        .sig-line    { border-top: 1px solid #555; width: 140px; margin: 28px auto 4px; }
        .footer      { margin-top: 18px; font-size: 10px; color: #888; text-align: center; }
        .rx-symbol   { font-size: 28px; font-weight: 900; float: left; margin-right: 8px; line-height: 1; }
        @media print { body { padding: 10px; } }
      </style>
      </head><body>
        <div class="clinic-name">Kassahun Medium Clinic</div>
        <div class="clinic-sub">Shagar City, Oromia, Ethiopia &nbsp;|&nbsp; Tel: +251 911 000000</div>
        <hr />
        <div style="display:flex;align-items:center">
          <div class="rx-symbol">&#8478;</div>
          <div class="rx-title">Medical Prescription</div>
        </div>
        <div class="info-grid">
          <div class="info-row"><span>Patient Name:</span> ${patientName}</div>
          <div class="info-row"><span>Patient #:</span> ${patientNum}</div>
          <div class="info-row"><span>Prescribed By:</span> ${doctorName}</div>
          <div class="info-row"><span>Date:</span> ${rxDate}</div>
          ${p.notes ? `<div class="info-row" style="grid-column:1/-1"><span>Notes:</span> ${p.notes}</div>` : ''}
        </div>
        <hr />
        <table>
          <thead>
            <tr><th>#</th><th>Drug Name</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Instructions</th></tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="sig-area">
          <div class="sig-box"><div class="sig-line"></div>Doctor Signature &amp; Stamp</div>
          <div class="sig-box"><div class="sig-line"></div>Patient / Guardian</div>
        </div>
        <div class="footer">
          This prescription is valid for 30 days from the date of issue.<br/>
          Kassahun Medium Clinic &mdash; Shagar City, Oromia, Ethiopia
        </div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <h4 style={{ margin:0, fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>
          <Pill size={16} style={{ marginRight:6, verticalAlign:'middle' }} />
          Prescription History
        </h4>
        {canOrder && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowOrderModal(true)}>
            <Plus size={14} /> Prescribe Drug
          </button>
        )}
      </div>

      <div className="card">
        {prescriptions.length === 0 ? (
          <div className="empty-state">
            <Pill size={40}/>
            <p style={{marginTop:'0.5rem'}}>No prescription history found</p>
            {canOrder && (
              <button className="btn btn-primary btn-sm" style={{marginTop:'1rem'}} onClick={() => setShowOrderModal(true)}>
                <Plus size={14} /> Order First Prescription
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prescribed At</th>
                  <th>Prescribed By</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Items</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map(p => (
                  <>
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer', background: expanded === p.id ? 'var(--bg-secondary)' : '' }}
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    >
                      <td style={{fontSize:'0.82rem'}}>
                        {p.prescribed_at ? new Date(p.prescribed_at).toLocaleString() : '—'}
                      </td>
                      <td style={{fontSize:'0.82rem', fontWeight:500}}>
                        {p.prescribed_by_name ? (
                          <span><User size={12} style={{marginRight:3, verticalAlign:'middle'}} />{p.prescribed_by_name}</span>
                        ) : 'Unknown Doctor'}
                      </td>
                      <td>{statusBadge(p.status)}</td>
                      <td style={{fontSize:'0.82rem', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                        {p.notes || <span className="emr-muted">—</span>}
                      </td>
                      <td style={{fontSize:'0.82rem'}}>{p.items?.length || 0} items</td>
                      <td>
                        <div style={{display:'flex', gap:'0.3rem', flexWrap:'wrap'}}>
                          <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); setExpanded(expanded === p.id ? null : p.id) }}>
                            {expanded === p.id ? 'Hide' : 'Details'}
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{display:'inline-flex', alignItems:'center', gap:'0.2rem', color:'var(--color-primary)', borderColor:'var(--color-primary)'}}
                            onClick={e => { e.stopPropagation(); printPatientPrescription(p) }}
                            title="Print prescription for patient"
                          >
                            <Printer size={11} /> Print Rx
                          </button>
                          {canCancelRx(p) && (
                            <button
                              className="btn btn-ghost btn-xs"
                              style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', fontSize: '0.75rem' }}
                              onClick={e => { e.stopPropagation(); cancelRx(p) }}
                              title={p.status === 'pending_payment'
                                ? 'Cancel this prescription — the patient has not paid yet'
                                : 'Patient already paid — cancelling leaves the invoice for a refund'}
                            >
                              Cancel Rx
                            </button>
                          )}
                          {!canCancelRx(p) && canOrder && !isAdmin
                            && !['cancelled', 'dispensed'].includes(p.status) && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}
                                  title="The patient has already paid — ask an administrator to cancel it">
                              Paid — admin only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === p.id && p.items?.length > 0 && (
                      <tr key={`${p.id}-details`} style={{background:'var(--bg-secondary)'}}>
                        <td colSpan={6} style={{padding:'1rem 1.5rem'}}>
                          <div style={{fontWeight:600, fontSize:'0.82rem', marginBottom:'0.5rem', color:'var(--text-muted)'}}>
                            Prescription Details
                          </div>
                          <table style={{width:'100%', minWidth:'600px'}}>
                            <thead>
                              <tr>
                                <th style={{fontSize:'0.78rem'}}>Drug Generic Name</th>
                                <th style={{fontSize:'0.78rem'}}>Dose</th>
                                <th style={{fontSize:'0.78rem'}}>Frequency</th>
                                <th style={{fontSize:'0.78rem'}}>Duration</th>
                                <th style={{fontSize:'0.78rem'}}>Qty Prescribed</th>
                                <th style={{fontSize:'0.78rem'}}>Qty Dispensed</th>
                                <th style={{fontSize:'0.78rem'}}>Instructions</th>
                                <th style={{fontSize:'0.78rem'}}>Dispensed By</th>
                                <th style={{fontSize:'0.78rem'}}>Approve</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.items.map((item, i) => {
                                const remaining = (item.quantity || 0) - (item.dispensed_quantity || 0)
                                const val = dispenseForm[item.id] ?? remaining
                                return (
                                <tr key={i}>
                                  <td style={{fontSize:'0.82rem', fontWeight:500}}>{item.drug_name || `Drug ID #${item.drug_id}`}</td>
                                  <td style={{fontSize:'0.82rem'}}>{item.dose}</td>
                                  <td style={{fontSize:'0.82rem'}}>{item.frequency}</td>
                                  <td style={{fontSize:'0.82rem'}}>{item.duration}</td>
                                  <td style={{fontSize:'0.82rem', fontWeight:600}}>{item.quantity}</td>
                                  <td style={{fontSize:'0.82rem', color: item.dispensed_quantity >= item.quantity ? 'var(--success)' : 'var(--text-muted)'}}>
                                    {item.dispensed_quantity}
                                  </td>
                                  <td style={{fontSize:'0.82rem', maxWidth:'250px', wordBreak:'break-word'}}>
                                    {item.instructions_en && <div>EN: {item.instructions_en}</div>}
                                    {item.instructions_am && <div className="amharic">AM: {item.instructions_am}</div>}
                                    {!item.instructions_en && !item.instructions_am && <span className="emr-muted">—</span>}
                                  </td>
                                  <td style={{fontSize:'0.82rem'}}>
                                    {item.drug_form?.toLowerCase() === 'injection' ? (
                                      <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>Injection Tracker</span>
                                    ) : item.dispenser_name ? (
                                      <span style={{color:'var(--success)', fontWeight:500}}>
                                        <CheckCircle size={12} style={{marginRight:3, verticalAlign:'middle'}} />
                                        {item.dispenser_name}
                                        {item.dispensed_at && <div style={{fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:'normal'}}>{new Date(item.dispensed_at).toLocaleDateString()}</div>}
                                      </span>
                                    ) : (
                                      <span className="emr-muted">—</span>
                                    )}
                                  </td>
                                  <td onClick={e => e.stopPropagation()} style={{minWidth: item.drug_form?.toLowerCase() === 'injection' ? '250px' : '160px'}}>
                                    {p.status === 'cancelled' ? (
                                      <span className="badge badge-red" style={{fontSize:'0.73rem'}}>Cancelled — do not dispense</span>
                                    ) : item.drug_form?.toLowerCase() === 'injection' ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.2rem 0' }}>
                                        {/* Completed logs */}
                                        {item.injection_logs && item.injection_logs.map(log => (
                                          <div key={log.id} style={{ fontSize: '0.78rem', color: 'var(--success)', borderLeft: '2px solid var(--success)', paddingLeft: '6px' }}>
                                            <strong>Session {log.session_number}:</strong> Given by {log.administrator_name || 'Staff'} on {new Date(log.administered_at).toLocaleDateString()}
                                            {log.notes && <div style={{ fontStyle: 'italic', fontSize: '0.72rem', color: 'var(--text-muted)' }}>"{log.notes}"</div>}
                                          </div>
                                        ))}

                                        {/* Next session admin block */}
                                        {remaining > 0 ? (
                                          <div style={{ marginTop: '0.2rem', padding: '0.4rem', border: '1px dashed var(--border)', borderRadius: '4px', background: 'var(--bg-surface)' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                              Next Session: Session {item.dispensed_quantity + 1}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                              <input
                                                type="text"
                                                className="form-input"
                                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', flex: 1 }}
                                                placeholder="Session notes (e.g. Left arm)…"
                                                value={injNotes[item.id] || ''}
                                                disabled={!canAdministerInjections}
                                                onChange={e => setInjNotes({ ...injNotes, [item.id]: e.target.value })}
                                              />
                                              <button
                                                className="btn btn-primary btn-sm"
                                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                                                disabled={!canAdministerInjections}
                                                onClick={() => handleRecordInjection(item.id, item.dispensed_quantity + 1)}
                                              >
                                                ✓ Record
                                              </button>
                                            </div>
                                            {!canAdministerInjections && (
                                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                Staff login required
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="badge badge-green" style={{ fontSize: '0.73rem', width: 'fit-content' }}>
                                            <Check size={11} /> All Sessions Completed
                                          </span>
                                        )}
                                      </div>
                                    ) : remaining > 0 ? (
                                      <div style={{display:'flex', alignItems:'center', gap:'0.3rem', flexWrap:'wrap'}}>
                                        <input
                                          type="number"
                                          className="form-input"
                                          style={{width:'55px', padding:'0.2rem', fontSize:'0.78rem', textAlign:'center', opacity: isPharmacist ? 1 : 0.45, cursor: isPharmacist ? 'auto' : 'not-allowed'}}
                                          min="1" max={remaining}
                                          value={val}
                                          disabled={!isPharmacist}
                                          onChange={e => setDispenseForm({...dispenseForm, [item.id]: e.target.value})}
                                        />
                                        <span title={!isPharmacist ? 'Only a pharmacist can approve dispensing' : ''}>
                                          <button
                                            className="btn btn-primary btn-sm"
                                            style={{padding:'0.2rem 0.4rem', fontSize:'0.73rem', whiteSpace:'nowrap', opacity: isPharmacist ? 1 : 0.45, cursor: isPharmacist ? 'pointer' : 'not-allowed'}}
                                            disabled={!isPharmacist}
                                            onClick={() => isPharmacist && handleDispense(item.id, remaining)}
                                          >
                                            ✓ Approve & Dispense
                                          </button>
                                        </span>
                                        {!isPharmacist && <span style={{fontSize:'0.68rem', color:'var(--text-muted)', fontStyle:'italic', display:'block', width:'100%'}}>Pharmacist only</span>}
                                      </div>
                                    ) : (
                                      <span className="badge badge-green" style={{fontSize:'0.73rem'}}><Check size={11} /> Completed</span>
                                    )}
                                  </td>
                                </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOrderModal && (
        <NewPrescriptionModal
          patientId={patientId}
          onClose={() => setShowOrderModal(false)}
          onSaved={() => { setShowOrderModal(false); load() }}
        />
      )}
    </>
  )
}

function NewPrescriptionModal({ patientId, onClose, onSaved }) {
  const [visits, setVisits] = useState([])
  const [drugs, setDrugs] = useState([])
  const [form, setForm] = useState({ visit_id: '', notes: '' })
  const [items, setItems] = useState([
    { drug_id: '', dose: '', frequency: 'Once daily', duration: '', quantity: 1, instructions_en: '', instructions_am: '' }
  ])
  const [saving, setSaving] = useState(false)
  const [savedRx, setSavedRx] = useState(null)       // holds saved prescription data for print step
  const [outOfStockItems, setOutOfStockItems] = useState([]) // items that were out of stock

  useEffect(() => {
    Promise.all([
      visitsApi.patientVisits(patientId, { limit: 50 }),
      pharmacyApi.drugs(),
    ])
      .then(([vRes, dRes]) => {
        const vs = (vRes.data.items ?? vRes.data).filter(v => v.status === 'open')
        setVisits(vs)
        if (vs.length === 1) setForm(f => ({ ...f, visit_id: vs[0].id }))
        setDrugs(dRes.data)
      })
      .catch(() => toast.error('Failed to load visit or pharmacy data'))
  }, [patientId])

  const addItem = () => {
    setItems(prev => [...prev, { drug_id: '', dose: '', frequency: 'Once daily', duration: '', quantity: 1, instructions_en: '', instructions_am: '' }])
  }

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.visit_id) return toast.error('Please select an open visit')

    // Validate items
    const invalidItem = items.some(it => !it.drug_id || !it.dose || !it.frequency || !it.duration || it.quantity < 1)
    if (invalidItem) return toast.error('Please fill all drug item details correctly')

    setSaving(true)
    try {
      await pharmacyApi.prescribe({
        visit_id: form.visit_id,
        items: items.map(it => ({
          drug_id: parseInt(it.drug_id),
          dose: it.dose,
          frequency: it.frequency,
          duration: it.duration,
          quantity: parseInt(it.quantity),
          instructions_en: it.instructions_en || undefined,
          instructions_am: it.instructions_am || undefined,
        })),
        notes: form.notes || undefined,
      })

      // Check if any item was out of stock
      const oos = items.filter(it => {
        const d = drugs.find(dr => String(dr.id) === String(it.drug_id))
        return d && d.current_stock <= 0
      }).map(it => {
        const d = drugs.find(dr => String(dr.id) === String(it.drug_id))
        return { ...it, drug_name: d?.name_generic_en, drug_form: d?.drug_form, strength: d?.strength }
      })

      if (oos.length > 0) {
        // Some drugs are out of stock — go to print-and-confirm step
        setOutOfStockItems(oos)
        setSavedRx({ visit_id: form.visit_id, notes: form.notes, items: oos })
        toast.success('Prescription saved. Please print for patient.')
      } else {
        toast.success('Prescription created successfully')
        onSaved()
      }
    } catch (err) {
      toast.error(apiError(err, 'Failed to create prescription'))
    } finally { setSaving(false) }
  }

  const printOutOfStockSlip = (patientData) => {
    const win = window.open('', '_blank', 'width=540,height=680')
    const rxDate = new Date().toLocaleDateString()
    const rxTime = new Date().toLocaleTimeString()
    const itemRows = outOfStockItems.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${item.drug_name || 'Drug'}</strong><br/><span style="font-size:11px;color:#555">${item.drug_form || ''} ${item.strength || ''}</span></td>
        <td>${item.dose || '—'}</td>
        <td>${item.frequency || '—'}</td>
        <td>${item.duration || '—'} day(s)</td>
        <td>${item.quantity || '—'}</td>
        <td style="font-size:11px">${[item.instructions_en, item.instructions_am].filter(Boolean).join(' / ') || '—'}</td>
      </tr>
    `).join('')
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Out-of-Stock Prescription</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 28px; color: #111; font-size: 13px; }
        .clinic-name { font-size: 19px; font-weight: 700; text-align: center; margin-bottom: 2px; }
        .clinic-sub  { font-size: 12px; color: #555; text-align: center; margin-bottom: 2px; }
        .rx-title    { font-size: 14px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0; }
        hr           { border: none; border-top: 1.5px solid #333; margin: 10px 0; }
        .notice      { background:#fff3cd; border:1px solid #ffc107; border-radius:4px; padding:8px 12px; font-size:12px; margin-bottom:10px; }
        .info-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 14px; }
        .info-row    { font-size: 12px; } .info-row span { font-weight: 600; }
        table        { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th           { background: #eee; text-align: left; padding: 5px 6px; font-size: 11px; border-bottom: 1px solid #ccc; }
        td           { padding: 5px 6px; font-size: 12px; border-bottom: 1px dotted #ddd; vertical-align: top; }
        .sig-area    { margin-top: 32px; display: flex; justify-content: space-between; font-size: 12px; }
        .sig-box     { text-align: center; } .sig-line { border-top: 1px solid #555; width: 140px; margin: 28px auto 4px; }
        .footer      { margin-top: 14px; font-size: 10px; color: #888; text-align: center; }
        .rx-symbol   { font-size: 28px; font-weight: 900; float: left; margin-right: 8px; line-height: 1; }
        @media print { body { padding: 10px; } }
      </style></head><body>
        <div class="clinic-name">Kassahun Medium Clinic</div>
        <div class="clinic-sub">Shagar City, Oromia, Ethiopia &nbsp;|&nbsp; Tel: +251 911 000000</div>
        <hr />
        <div style="display:flex;align-items:center">
          <div class="rx-symbol">&#8478;</div>
          <div class="rx-title">Medical Prescription (External Referral)</div>
        </div>
        <div class="notice">⚠️ The following medications are currently <strong>out of stock</strong> at our pharmacy. The patient has been referred to purchase from an external pharmacy.</div>
        <div class="info-grid">
          <div class="info-row"><span>Date:</span> ${rxDate} ${rxTime}</div>
          <div class="info-row"><span>Doctor:</span> ${patientData?.doctorName || '___________'}</div>
        </div>
        <hr />
        <table>
          <thead><tr><th>#</th><th>Drug Name</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Instructions</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="sig-area">
          <div class="sig-box"><div class="sig-line"></div>Doctor Signature &amp; Stamp</div>
          <div class="sig-box"><div class="sig-line"></div>Patient / Guardian</div>
        </div>
        <div class="footer">Kassahun Medium Clinic &mdash; Shagar City, Oromia, Ethiopia &mdash; Valid 30 days</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: '850px' }}>
        <div className="modal-header">
          <h3><Pill size={16} style={{marginRight:6}} />{savedRx ? 'Print & Confirm — Out-of-Stock Drugs' : 'New Drug Prescription'}</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* ── Post-save: out-of-stock print confirmation ── */}
        {savedRx ? (
          <div style={{padding:'2rem', display:'flex', flexDirection:'column', gap:'1.2rem'}}>
            <div style={{background:'hsla(38,100%,50%,0.12)', border:'1px solid hsla(38,100%,50%,0.4)', borderRadius:'var(--radius-md)', padding:'1rem 1.2rem'}}>
              <div style={{fontWeight:700, fontSize:'0.95rem', marginBottom:'0.4rem', color:'var(--color-warning, #f59e0b)'}}>
                ⚠️ Prescription saved — {outOfStockItems.length} drug(s) out of stock
              </div>
              <p style={{margin:0, fontSize:'0.85rem', color:'var(--text-secondary)'}}>
                The following drugs are <strong>out of stock</strong> at our pharmacy. Please print a prescription slip so the patient can purchase them from another pharmacy. Click <strong>"I Have Printed"</strong> to confirm.
              </p>
            </div>

            <div style={{border:'1px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'var(--bg-secondary)'}}>
                    <th style={{padding:'0.5rem 0.75rem', fontSize:'0.78rem', textAlign:'left'}}>Drug Name</th>
                    <th style={{padding:'0.5rem 0.75rem', fontSize:'0.78rem', textAlign:'left'}}>Dose</th>
                    <th style={{padding:'0.5rem 0.75rem', fontSize:'0.78rem', textAlign:'left'}}>Frequency</th>
                    <th style={{padding:'0.5rem 0.75rem', fontSize:'0.78rem', textAlign:'left'}}>Duration</th>
                    <th style={{padding:'0.5rem 0.75rem', fontSize:'0.78rem', textAlign:'left'}}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {outOfStockItems.map((it, i) => (
                    <tr key={i} style={{borderTop:'1px solid var(--border)'}}>
                      <td style={{padding:'0.5rem 0.75rem', fontSize:'0.85rem', fontWeight:600}}>{it.drug_name}</td>
                      <td style={{padding:'0.5rem 0.75rem', fontSize:'0.85rem'}}>{it.dose}</td>
                      <td style={{padding:'0.5rem 0.75rem', fontSize:'0.85rem'}}>{it.frequency}</td>
                      <td style={{padding:'0.5rem 0.75rem', fontSize:'0.85rem'}}>{it.duration} day(s)</td>
                      <td style={{padding:'0.5rem 0.75rem', fontSize:'0.85rem'}}>{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{display:'flex', gap:'0.75rem', flexWrap:'wrap'}}>
              <button
                type="button"
                className="btn btn-primary"
                style={{display:'inline-flex', alignItems:'center', gap:'0.4rem'}}
                onClick={() => printOutOfStockSlip({})}
              >
                <Printer size={15} /> Print Prescription for Patient
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{display:'inline-flex', alignItems:'center', gap:'0.4rem', borderColor:'var(--success)', color:'var(--success)'}}
                onClick={() => { toast.success('Confirmed: prescription printed for patient'); onSaved() }}
              >
                <CheckCircle size={15} /> I Have Printed &amp; Given to Patient
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={submit}>
          <div style={{padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.2rem', maxHeight:'70vh', overflowY:'auto'}}>
            <div className="form-group">
              <label className="form-label">Visit *</label>
              <select
                className="form-select"
                value={form.visit_id}
                onChange={e => setForm(f => ({ ...f, visit_id: e.target.value }))}
                required
              >
                <option value="">Select an open visit…</option>
                {visits.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.visit_number} — {v.chief_complaint_en || 'No complaint'} ({new Date(v.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {visits.length === 0 && (
                <small className="form-hint">No open visits. Open a visit first from the Visits tab.</small>
              )}
            </div>

            <div className="prescription-items-section">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                <span className="form-label" style={{ fontWeight: 600 }}>Prescribed Drugs *</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                  <Plus size={12} /> Add Drug
                </button>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'1rem', position:'relative', background:'var(--bg-secondary)' }}>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        style={{ position:'absolute', top:'0.5rem', right:'0.5rem', padding:'0.2rem 0.4rem', fontSize:'0.75rem' }}
                        onClick={() => removeItem(idx)}
                      >
                        ✕
                      </button>
                    )}

                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'0.8rem', marginTop:'0.5rem' }}>
                      <div className="form-group">
                        <label className="form-label">Drug *</label>
                        <select
                          className="form-select"
                          value={it.drug_id}
                          onChange={e => updateItem(idx, 'drug_id', e.target.value)}
                          required
                        >
                          <option value="">Select drug…</option>
                          {drugs.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name_generic_en} {d.strength} {d.name_brand ? `(${d.name_brand})` : ''} {d.current_stock <= 0 ? '⚠ Out of Stock' : `[Stock: ${d.current_stock}]`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Dose *</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 500mg, 1 tab"
                          value={it.dose}
                          onChange={e => updateItem(idx, 'dose', e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Frequency *</label>
                        <select
                          className="form-select"
                          value={it.frequency}
                          onChange={e => updateItem(idx, 'frequency', e.target.value)}
                          required
                        >
                          {['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 8 hours', 'Every 12 hours', 'PRN (As needed)'].map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Duration *</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 5 days, 1 week"
                          value={it.duration}
                          onChange={e => updateItem(idx, 'duration', e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Total Qty *</label>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.8rem', marginTop:'0.8rem' }}>
                      <div className="form-group">
                        <label className="form-label">Instructions (English)</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Take after food"
                          value={it.instructions_en}
                          onChange={e => updateItem(idx, 'instructions_en', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Instructions (Amharic)</label>
                        <input
                          className="form-input"
                          placeholder="ምሳሌ፡ ከምግብ በኋላ ይውሰዱ"
                          value={it.instructions_am}
                          onChange={e => updateItem(idx, 'instructions_am', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center', borderStyle: 'dashed', padding: '0.6rem' }}
                  onClick={addItem}
                >
                  <Plus size={16} /> Add Another Drug
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Prescription Notes</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any special remarks, clinical indications, or warnings…"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || visits.length === 0}>
              {saving ? 'Creating…' : 'Create Prescription'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

function PatientInjections({ patientId, patient }) {
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const canAdministerInjections = ['pharmacist', 'nurse', 'doctor', 'admin'].includes(myRole)

  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [injNotes, setInjNotes] = useState({})

  const load = () => {
    setLoading(true)
    pharmacyApi.patientPrescriptions(patientId)
      .then(r => {
        setPrescriptions(Array.isArray(r.data) ? r.data : [])
      })
      .catch(() => toast.error('Failed to load injection history'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [patientId])

  const handleRecordInjection = async (itemId, sessionNum) => {
    const notes = injNotes[itemId]
    try {
      await pharmacyApi.recordInjection({
        prescription_item_id: itemId,
        session_number: sessionNum,
        notes: notes || undefined
      })
      toast.success(`Injection Session ${sessionNum} recorded successfully ✓`)
      setInjNotes(prev => { const c = { ...prev }; delete c[itemId]; return c })
      load()
    } catch (err) {
      toast.error(apiError(err, 'Failed to record injection session'))
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const injectionItems = []
  prescriptions.forEach(p => {
    (p.items || []).forEach(item => {
      if (item.drug_form?.toLowerCase() === 'injection') {
        injectionItems.push({ ...item, prescription: p })
      }
    })
  })

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <h4 style={{ margin:0, fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>
          <Syringe size={16} style={{ marginRight:6, verticalAlign:'middle' }} />
          Injection Follow-up & Administration Schedule
        </h4>
        <span className="badge badge-purple">{injectionItems.length} Injection Orders</span>
      </div>

      <div className="card">
        {injectionItems.length === 0 ? (
          <div className="empty-state">
            <Syringe size={40}/>
            <p style={{marginTop:'0.5rem'}}>No injection prescriptions found for this patient</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Drug Name</th>
                  <th>Dose & Frequency</th>
                  <th>Prescribed Qty</th>
                  <th>Sessions Given</th>
                  <th>Status & Next Session</th>
                </tr>
              </thead>
              <tbody>
                {injectionItems.map(item => {
                  const remaining = (item.quantity || 0) - (item.dispensed_quantity || 0)
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong style={{ fontSize: '0.9rem' }}>{item.drug_name || `Drug ID #${item.drug_id}`}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Prescribed by {item.prescription?.prescribed_by_name || 'Doctor'} on {new Date(item.prescription?.prescribed_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <div><strong>Dose:</strong> {item.dose}</div>
                        <div><strong>Freq:</strong> {item.frequency} ({item.duration} days)</div>
                        {item.instructions_en && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.instructions_en}</div>}
                      </td>
                      <td style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                        {item.quantity} sessions
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600, color: item.dispensed_quantity >= item.quantity ? 'var(--success)' : 'var(--color-primary)' }}>
                          {item.dispensed_quantity} of {item.quantity} given
                        </div>
                        {item.injection_logs && item.injection_logs.length > 0 && (
                          <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {item.injection_logs.map(log => (
                              <div key={log.id} style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                                ✓ <strong>Session {log.session_number}:</strong> {log.administrator_name || 'Staff'} ({new Date(log.administered_at).toLocaleDateString()})
                                {log.notes && <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginLeft: 4 }}>"{log.notes}"</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: '240px' }}>
                        {remaining > 0 ? (
                          <div style={{ padding: '0.5rem', border: '1px dashed var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-primary)' }}>
                              Next: Session #{item.dispensed_quantity + 1}
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.78rem', flex: 1 }}
                                placeholder="Notes (site/arm)…"
                                value={injNotes[item.id] || ''}
                                disabled={!canAdministerInjections}
                                onChange={e => setInjNotes({ ...injNotes, [item.id]: e.target.value })}
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                disabled={!canAdministerInjections}
                                onClick={() => handleRecordInjection(item.id, item.dispensed_quantity + 1)}
                              >
                                ✓ Record
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="badge badge-green">
                            ✓ All {item.quantity} Sessions Complete
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
