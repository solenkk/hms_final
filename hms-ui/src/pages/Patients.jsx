import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi, visitsApi, authApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, UserX, Eye, Phone, UserCheck, Clock, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import './Patients.css'

// ─── helpers ──────────────────────────────────────────────────────────────────
function calcAge(dob) {
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) + 'y'
}

function statusBadge(p) {
  if (p.registration_paid === false)
    return <span className="badge badge-orange">Unpaid Reg</span>
  if (p.is_checked_in_today)
    return <span className="badge badge-green">In Queue</span>
  return p.is_active
    ? <span className="badge badge-blue">Active</span>
    : <span className="badge badge-gray">Inactive</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Patients() {
  const { user } = useAuth()
  const role = user?.role
  const navigate = useNavigate()

  // 'queue' = today's checked-in patients, 'all' = full list
  const [view, setView]       = useState('queue')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)

  const isReceptionist = ['receptionist', 'nurse', 'admin'].includes(role)
  const isDoctor       = ['doctor', 'admin'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (view === 'queue') {
        const res = await patientsApi.todayQueue()
        setPatients(res.data.items ?? res.data)
      } else {
        const params = {}
        const s = search.trim()
        if (s) {
          if (/^P[-]?\d+$/i.test(s))  params.patient_number = s
          else if (/^\+?\d{7,}$/.test(s)) params.phone = s
          else params.query = s
        }
        const res = await patientsApi.list(params)
        setPatients(res.data.items ?? res.data)
      }
    } catch { toast.error('Failed to load patients') }
    finally { setLoading(false) }
  }, [view, search])

  useEffect(() => {
    const t = setTimeout(load, view === 'queue' ? 0 : 350)
    return () => clearTimeout(t)
  }, [load])

  // Check in a patient (receptionist/admin/nurse)
  const handleCheckin = async (p) => {
    try {
      const res = await patientsApi.checkin(p.id)
      const data = res.data
      if (data.needs_reregistration) {
        toast.success(
          `${p.first_name_en} checked in. ⚠️ Re-registration invoice created (last visit > ${data.grace_days} days ago).`,
          { duration: 6000 }
        )
      } else {
        toast.success(`${p.first_name_en} checked in to today's queue`)
      }
      load()
    } catch (err) {
      const d = err.response?.data?.detail
      toast.error(typeof d === 'object' ? d.en : d || 'Check-in failed')
    }
  }

  // Open visit directly from the queue
  const [openVisitPatient, setOpenVisitPatient] = useState(null)

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Patients</h1>
          <p>Patient queue and records</p>
        </div>
        {isReceptionist && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Register Patient
          </button>
        )}
      </div>

      {/* View tabs */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button
          className={`tab-btn ${view === 'queue' ? 'active' : ''}`}
          onClick={() => { setView('queue'); setSearch('') }}
        >
          <Clock size={14} style={{ marginRight: 4 }} />
          Today's Queue
        </button>
        <button
          className={`tab-btn ${view === 'all' ? 'active' : ''}`}
          onClick={() => setView('all')}
        >
          <Users size={14} style={{ marginRight: 4 }} />
          All Patients
        </button>
      </div>

      {/* Search bar (only for All Patients) */}
      {view === 'all' && (
        <div className="toolbar" style={{ marginBottom: '1rem' }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={16} className="search-icon" />
            <input
              className="form-input"
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {view === 'queue' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}>
          {isReceptionist
            ? '🟢 Showing patients checked in today. Use "All Patients" to search and check in more.'
            : '🟢 Showing patients in today\'s queue. Open a visit to begin consultation.'}
        </div>
      )}

      {view === 'all' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}>
          📋 Read-only view of all patients. Lab orders, pharmacy, and injections can still be managed from the patient record.
          {isReceptionist && ' Use "Check In" to add a patient to today\'s queue.'}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <UserX size={48} />
            <p style={{ marginTop: '0.5rem' }}>
              {view === 'queue' ? 'No patients checked in today yet' : 'No patients found'}
            </p>
            {view === 'queue' && isReceptionist && (
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setView('all')}>
                Go to All Patients to check in
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient #</th>
                  <th>Name</th>
                  <th>Age / Gender</th>
                  <th>Phone</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id}>
                    <td><span className="mono patient-num">{p.patient_number}</span></td>
                    <td>
                      <div className="patient-name">
                        <div className="avatar avatar-sm">{(p.first_name_en?.[0] || '') + (p.last_name_en?.[0] || '')}</div>
                        <div>
                          <div>{p.first_name_en} {p.last_name_en}</div>
                          {p.first_name_am && <div className="text-muted" style={{ fontSize:'0.78rem' }}>{p.first_name_am} {p.last_name_am}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{p.date_of_birth ? calcAge(p.date_of_birth) : '—'} / {p.gender}</td>
                    <td><Phone size={12} style={{ marginRight:4, opacity:0.5 }}/>{p.phone || '—'}</td>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                    <td>{statusBadge(p)}</td>
                    <td style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                      {/* View button — always available */}
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/patients/${p.id}`)}>
                        <Eye size={14} /> View
                      </button>

                      {/* Check In — receptionist, queue view shows re-queue option */}
                      {isReceptionist && view === 'all' && !p.is_checked_in_today && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckin(p)}
                          disabled={!p.registration_paid}
                          title={!p.registration_paid ? 'Registration not paid' : 'Check in for today'}
                        >
                          <UserCheck size={14} /> Check In
                        </button>
                      )}
                      {isReceptionist && p.is_checked_in_today && view === 'all' && (
                        <span className="badge badge-green" style={{ padding:'0.3rem 0.6rem', fontSize:'0.75rem' }}>
                          ✓ In Queue
                        </span>
                      )}

                      {/* Open Visit — from queue for doctor/admin */}
                      {view === 'queue' && isDoctor && (
                        <button
                          className="btn btn-accent btn-sm"
                          onClick={() => setOpenVisitPatient(p)}
                        >
                          <Plus size={14} /> Open Visit
                        </button>
                      )}
                      {/* Receptionist can also open visit from queue */}
                      {view === 'queue' && isReceptionist && !isDoctor && (
                        <button
                          className="btn btn-accent btn-sm"
                          onClick={() => setOpenVisitPatient(p)}
                        >
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

      {/* Register Patient Modal */}
      {showModal && (
        <PatientRegisterModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}

      {/* Open Visit Modal */}
      {openVisitPatient && (
        <OpenVisitModal
          patient={openVisitPatient}
          doctor={user}
          onClose={() => setOpenVisitPatient(null)}
          onSaved={() => { 
            setOpenVisitPatient(null); 
            load();
            if (['doctor', 'admin'].includes(user?.role) || user?.role?.name === 'doctor') {
              navigate(`/patients/${openVisitPatient.id}`);
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Open Visit Modal (inline for queued patient) ─────────────────────────────
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
          <h3>Open Visit</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="selected-patient" style={{ marginBottom: '1rem' }}>
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

// ─── Patient Register Modal ───────────────────────────────────────────────────
function PatientRegisterModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name_en: '', last_name_en: '',
    first_name_am: '', last_name_am: '',
    date_of_birth: '', age: '', gender: 'male',
    phone: '', email: '',
    address_en: '', blood_type: '',
    consent_given: true,
  })
  const [ageMode, setAgeMode] = useState(true)
  const [saving, setSaving] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const required = {
      first_name_en: 'First Name (English)',
      last_name_en: 'Last Name (English)',
    }
    for (const [key, label] of Object.entries(required)) {
      if (!form[key]?.trim()) { toast.error(`${label} is required`); return }
    }
    
    if (ageMode) {
      if (!form.age?.trim()) { toast.error(`Age is required`); return }
      const birthYear = new Date().getFullYear() - parseInt(form.age)
      form.date_of_birth = `${birthYear}-01-01`
    } else {
      if (!form.date_of_birth?.trim()) { toast.error(`Date of Birth is required`); return }
    }

    setSaving(true)
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== '' && k !== 'age'))
      await patientsApi.create(payload)
      toast.success('Patient registered successfully')
      onSaved()
    } catch (err) {
      const detail = err.response?.data?.detail
      let msg = 'Registration failed'
      if (typeof detail === 'object' && detail.en) msg = detail.en
      else if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) {
        const fieldErrors = detail
          .map(e => {
            const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null
            const errMsg = (e.msg || '').replace(/^Value error,\s*/, '')
            return field ? `${field}: ${errMsg}` : errMsg
          })
          .filter(Boolean)
        msg = fieldErrors.join('; ') || msg
      }
      toast.error(msg, { duration: 5000 })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Register New Patient</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">First Name (English) *</label>
              <input className="form-input" name="first_name_en" value={form.first_name_en} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name (English) *</label>
              <input className="form-input" name="last_name_en" value={form.last_name_en} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">First Name (Amharic)</label>
              <input className="form-input" name="first_name_am" value={form.first_name_am} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name (Amharic)</label>
              <input className="form-input" name="last_name_am" value={form.last_name_am} onChange={handle} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">{ageMode ? 'Age (Years) *' : 'Date of Birth *'}</label>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 0.25rem', fontSize: '0.75rem', height: 'auto' }} onClick={() => setAgeMode(!ageMode)}>
                  {ageMode ? 'Use Calendar (<1 yr)' : 'Enter Age Instead'}
                </button>
              </div>
              {ageMode ? (
                <input className="form-input" type="number" min="1" max="150" name="age" value={form.age} onChange={handle} placeholder="e.g. 35" required />
              ) : (
                <input className="form-input" type="date" name="date_of_birth" value={form.date_of_birth} onChange={handle} required />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Gender *</label>
              <select className="form-select" name="gender" value={form.gender} onChange={handle}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-input" name="phone" value={form.phone} onChange={handle} placeholder="+251..." required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" name="email" value={form.email} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Blood Type</label>
              <select className="form-select" name="blood_type" value={form.blood_type} onChange={handle}>
                <option value="">Unknown</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => <option key={bt}>{bt}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" name="address_en" value={form.address_en} onChange={handle} />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" name="consent_given" checked={form.consent_given} onChange={handle} />
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Patient has given informed consent for data processing
              </span>
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Registering…' : 'Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
