import { useState, useEffect, useCallback } from 'react'
import { visitsApi, patientsApi, authApi } from '../api'
import { Plus, Eye, Search, Clock, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './Visits.css'

const STATUS_COLORS = { open: 'badge-green', closed: 'badge-gray', pending: 'badge-orange' }

const EC_MONTH_NAMES = [
  "", "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
  "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
]

const today = new Date();
const currentECYear = today.getFullYear() - 8 + (today.getMonth() > 8 || (today.getMonth() === 8 && today.getDate() >= 11) ? 1 : 0);

export default function Visits() {
  const [visits, setVisits]   = useState([])
  const [queue, setQueue]     = useState([])
  const [loading, setLoading] = useState(true)
  const [queueLoading, setQueueLoading] = useState(true)
  const [status, setStatus]   = useState('open')
  const [ecYear, setEcYear]   = useState('')
  const [ecMonth, setEcMonth] = useState('')
  const [ecDay, setEcDay]     = useState('')
  const [openVisitPatient, setOpenVisitPatient] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role

  const isDoctor = ['doctor', 'admin'].includes(role)
  const isReceptionist = ['receptionist', 'nurse', 'admin'].includes(role)

  const loadVisits = useCallback(async () => {
    setLoading(true)
    try {
      const params = { status, limit: 50 }
      if (status === 'closed' && ecYear && ecMonth && ecDay) {
        params.ec_date = `${ecYear}-${String(ecMonth).padStart(2, '0')}-${String(ecDay).padStart(2, '0')}`
      }
      const res = await visitsApi.list(params)
      setVisits(res.data.items ?? res.data)
    } catch { toast.error('Failed to load visits') }
    finally { setLoading(false) }
  }, [status, ecYear, ecMonth, ecDay])

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    try {
      const res = await patientsApi.todayQueue()
      setQueue(res.data.items ?? res.data)
    } catch {}
    finally { setQueueLoading(false) }
  }, [])

  useEffect(() => { loadVisits() }, [loadVisits])
  useEffect(() => { loadQueue() }, [loadQueue])

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Visits</h1>
          <p>Patient visit queue and management</p>
        </div>
      </div>

      {/* ── Today's Queue (doctor-focused) ─────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Clock size={16} style={{ color:'var(--color-accent)' }} />
            Today's Queue
            {queue.length > 0 && (
              <span className="badge badge-green" style={{ marginLeft:'0.5rem' }}>{queue.length}</span>
            )}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={loadQueue}>↻ Refresh</button>
        </div>

        {queueLoading ? (
          <div className="loading-center" style={{ padding:'1rem' }}><div className="spinner" /></div>
        ) : queue.length === 0 ? (
          <div className="empty-state" style={{ padding:'1.5rem' }}>
            <UserCheck size={36} style={{ opacity:0.35 }} />
            <p style={{ marginTop:'0.5rem', fontSize:'0.9rem' }}>No patients checked in today</p>
            {isReceptionist && (
              <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>
                Go to Patients → All Patients and click "Check In" to add patients to today's queue.
              </p>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient #</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Checked In</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(p => (
                  <tr key={p.id}>
                    <td><span className="mono patient-num">{p.patient_number}</span></td>
                    <td>
                      <div className="patient-name">
                        <div className="avatar avatar-sm">
                          {(p.first_name_en?.[0] || '') + (p.last_name_en?.[0] || '')}
                        </div>
                        <div>
                          <div>{p.first_name_en} {p.last_name_en}</div>
                          {p.first_name_am && (
                            <div className="text-muted" style={{ fontSize:'0.78rem' }}>
                              {p.first_name_am} {p.last_name_am}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{p.phone || '—'}</td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
                      {p.checked_in_at
                        ? new Date(p.checked_in_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                        : '—'}
                    </td>
                    <td style={{ display:'flex', gap:'0.4rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/patients/${p.id}`)}>
                        <Eye size={14} /> View
                      </button>
                      {(isDoctor || isReceptionist) && (
                        <button className="btn btn-accent btn-sm" onClick={() => setOpenVisitPatient(p)}>
                          <Plus size={14} /> Open Visit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Open / Closed visit filter ──────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="tabs">
          {['open','closed'].map(s => (
            <button key={s} className={`tab-btn ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)} Visits
            </button>
          ))}
        </div>
        
        {status === 'closed' && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>Filter by Date (EC):</span>
            <select className="form-select" style={{ width: '80px', padding:'0.25rem 0.5rem', fontSize:'0.85rem' }} value={ecYear} onChange={e => setEcYear(e.target.value)}>
              <option value="">Year</option>
              {Array.from({ length: 10 }, (_, i) => currentECYear - i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="form-select" style={{ width: '110px', padding:'0.25rem 0.5rem', fontSize:'0.85rem' }} value={ecMonth} onChange={e => {
              setEcMonth(e.target.value);
              if (e.target.value && !ecYear) setEcYear(currentECYear.toString());
            }}>
              <option value="">Month</option>
              {EC_MONTH_NAMES.slice(1).map((name, i) => <option key={i+1} value={i+1}>{name}</option>)}
            </select>
            <select className="form-select" style={{ width: '70px', padding:'0.25rem 0.5rem', fontSize:'0.85rem' }} value={ecDay} onChange={e => {
              setEcDay(e.target.value);
              if (e.target.value && !ecYear) setEcYear(currentECYear.toString());
              if (e.target.value && !ecMonth) setEcMonth('1');
            }}>
              <option value="">Day</option>
              {Array.from({ length: 30 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {(ecYear || ecMonth || ecDay) && (
              <>
                {(!ecYear || !ecMonth || !ecDay) && (
                  <span style={{ fontSize:'0.75rem', color:'var(--color-danger)', marginLeft:'0.5rem' }}>Select Year, Month, and Day to filter</span>
                )}
                <button className="btn btn-ghost btn-sm" style={{ padding:'0.25rem 0.5rem', fontSize:'0.8rem', marginLeft:'0.5rem' }} onClick={() => { setEcYear(''); setEcMonth(''); setEcDay(''); }}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : visits.length === 0 ? (
          <div className="empty-state">
            <Clock size={48} />
            <p style={{marginTop:'0.5rem'}}>No {status} visits</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Visit #</th>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Doctor</th>
                  <th>Chief Complaint</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id}>
                    <td><span className="mono patient-num">{v.visit_number}</span></td>
                    <td>{v.patient ? `${v.patient.first_name_en} ${v.patient.last_name_en}` : (v.patient_name || v.patient_id?.slice(0,8)+'…')}</td>
                    <td><span className="badge badge-blue">{v.visit_type}</span></td>
                    <td>{v.doctor_name || '—'}</td>
                    <td style={{ maxWidth: 200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {v.chief_complaint_en || '—'}
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[v.status] || 'badge-gray'}`}>{v.status}</span></td>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
                      {v.created_at ? new Date(v.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/patients/${v.patient_id}`)}>
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Visit Modal */}
      {openVisitPatient && (
        <OpenVisitModal
          patient={openVisitPatient}
          doctor={user}
          onClose={() => setOpenVisitPatient(null)}
          onSaved={() => { 
            setOpenVisitPatient(null); 
            loadVisits(); 
            loadQueue();
            if (['doctor', 'admin'].includes(user?.role) || user?.role?.name === 'doctor') {
              navigate(`/patients/${openVisitPatient.id}`);
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Open Visit Modal ─────────────────────────────────────────────────────────
function OpenVisitModal({ patient, doctor, onClose, onSaved }) {
  const [form, setForm] = useState({ visit_type: 'opd', chief_complaint_en: '', chief_complaint_am: '', attending_doctor_id: doctor?.role === 'doctor' ? doctor.id : '' })
  const [saving, setSaving] = useState(false)
  const [doctors, setDoctors] = useState([])

  const isDoctor = doctor?.role === 'doctor' || doctor?.role?.name === 'doctor'

  useEffect(() => {
    if (!isDoctor) {
      authApi.doctors().then(res => {
        setDoctors(res.data)
        if (res.data.length === 1) {
          setForm(f => ({ ...f, attending_doctor_id: res.data[0].id }))
        }
      }).catch(() => toast.error('Failed to load doctors'))
    } else {
      setForm(f => ({ ...f, attending_doctor_id: doctor.id }))
    }
  }, [isDoctor, doctor])

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.attending_doctor_id) {
      return toast.error("Please select an attending doctor")
    }
    setSaving(true)
    try {
      await visitsApi.open({ ...form, patient_id: patient.id })
      toast.success('Visit opened')
      onSaved()
    } catch (err) {
      const d = err.response?.data?.detail
      toast.error(typeof d === 'object' ? d.en : d || 'Failed to open visit')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Open New Visit</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="selected-patient" style={{ marginBottom:'1rem' }}>
          ✓ {patient.first_name_en} {patient.last_name_en}
          <span className="mono" style={{ marginLeft:'0.5rem', fontSize:'0.8rem', color:'var(--color-primary-light)' }}>
            ({patient.patient_number})
          </span>
        </div>
        <form onSubmit={submit}>
          {!isDoctor && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Attending Doctor *</label>
              <select className="form-select" name="attending_doctor_id" value={form.attending_doctor_id} onChange={handle} required>
                <option value="">-- Select Doctor --</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.full_name_en}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Visit Type</label>
            <select className="form-select" name="visit_type" value={form.visit_type} onChange={handle}>
              <option value="opd">OPD (Outpatient)</option>
              <option value="ipd">IPD (Inpatient)</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Chief Complaint (English) *</label>
            <input className="form-input" name="chief_complaint_en" value={form.chief_complaint_en} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Chief Complaint (Amharic)</label>
            <input className="form-input" name="chief_complaint_am" value={form.chief_complaint_am} onChange={handle} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Opening…' : 'Open Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
