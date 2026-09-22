import { useState, useEffect } from 'react'
import { adminApi, labApi, apiError } from '../api'
import {
  Plus, UserX, ShieldCheck, Edit2, ToggleLeft, ToggleRight,
  Sliders, Info, AlertCircle, CheckCircle2, Play, KeyRound
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import IndicatorRulesEditor from '../components/IndicatorRulesEditor'
import IndicatorModal, { EMR_FIELD_LABELS } from '../components/IndicatorModal'


const REPORT_EVENT_CODES = [
  "hiv_test_positive",
  "hiv_test_negative",
  "malaria_rdt_positive_pfalciparum",
  "malaria_rdt_positive_pvivax",
  "malaria_rdt_negative",
  "htn_enrollment",
  "dm_enrollment",
  "anc_first_contact",
  "anc_fourth_contact",
  "anc_eight_contacts",
  "maternal_death",
  "contraceptive_new_implant",
  "contraceptive_repeat_implant",
  "contraceptive_new_pill",
  "contraceptive_repeat_pill",
  "contraceptive_new_injectable",
  "contraceptive_repeat_injectable",
  "contraceptive_new_iud",
  "contraceptive_repeat_iud",
  "live_birth",
  "stillbirth",
  "delivery_mode_spontaneous",
  "delivery_mode_cesarean",
  "delivery_mode_instrumental",
  "perinatal_death",
  "obstetric_fistula",
  "measles_case",
  "cholera_case",
  "afp_case",
  "sam_new_case",
  "mam_new_case",
  "anthrax_case",
  "dracunculiasis_case",
  "chikungunya_case",
  "aefi_case",
  "rabies_exposure",
  "new_subtype_flu",
  "neonatal_tetanus",
  "sars_case",
  "dengue_case",
  "human_rabies",
  "smallpox_case",
  "vhf_case",
  "yellow_fever_case",
  "rift_valley_fever",
  "monkeypox_case",
  "covid19_case",
  "brucellosis_case",
  "other_notifiable"
]

export default function Admin() {
  const [tab, setTab] = useState('users') // 'users' | 'indicators' | 'settings'
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [indicators, setIndicators] = useState([])
  const [labTests, setLabTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showIndicatorModal, setShowIndicatorModal] = useState(false)
  const [editingIndicator, setEditingIndicator] = useState(null)
  const [resetPasswordUser, setResetPasswordUser] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [facilitySettings, setFacilitySettings] = useState(null)
  
  const { user: me } = useAuth()

  const loadUsersAndRoles = async () => {
    try {
      const [u, r] = await Promise.all([adminApi.users(), adminApi.roles()])
      setUsers(u.data)
      setRoles(r.data)
    } catch {
      toast.error('Failed to load user administration data')
    }
  }

  const loadIndicators = async () => {
    try {
      const [indRes, labRes] = await Promise.all([
        adminApi.listIndicators(),
        labApi.testTypes()
      ])
      setIndicators(indRes.data)
      setLabTests(labRes.data)
    } catch {
      toast.error('Failed to load reportable indicator configuration')
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'users') {
        await Promise.all([loadUsersAndRoles(), loadIndicators(), loadSettings()])
      } else if (tab === 'indicators') {
        await loadIndicators()
      } else if (tab === 'settings') {
        await loadSettings()
      }
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const res = await adminApi.getFacilitySettings()
      setFacilitySettings(res.data)
    } catch {
      toast.error('Failed to load facility settings')
    }
  }

  const updateSetting = async (field, value) => {
    try {
      const payload = { [field]: value }
      const res = await adminApi.updateFacilitySettings(payload)
      setFacilitySettings(res.data)
      toast.success('Settings updated')
    } catch {
      toast.error('Failed to update settings')
    }
  }

  useEffect(() => {
    load()
  }, [tab])

  const deactivate = async (id) => {
    if (id === me?.id) return toast.error('Cannot deactivate yourself')
    const reason = window.prompt('Reason for deactivating this user?')
    if (reason === null) return
    if (!reason.trim()) return toast.error('A reason is required to deactivate a user')
    try {
      await adminApi.deactivateUser(id, reason.trim())
      toast.success('User deactivated')
      load()
    } catch (err) {
      toast.error(apiError(err, 'Failed to deactivate user'))
    }
  }

  const toggleIndicatorStatus = async (defn) => {
    const isEnabling = !defn.enabled
    try {
      if (isEnabling) {
        await adminApi.updateIndicator(defn.id, { enabled: true })
        toast.success(`Indicator "${defn.label}" enabled`)
      } else {
        await adminApi.disableIndicator(defn.id)
        toast.success(`Indicator "${defn.label}" disabled`)
      }
      load()
    } catch (err) {
      toast.error(apiError(err, `Failed to update status`))
    }
  }

  // Group indicators by section
  const groupedIndicators = {}
  indicators.forEach(ind => {
    const sec = ind.section || 'General'
    if (!groupedIndicators[sec]) groupedIndicators[sec] = []
    groupedIndicators[sec].push(ind)
  })

  return (
    <div className="page-body">
      <style>{`
        .admin-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.5rem;
        }
        .admin-tab-btn {
          padding: 0.5rem 1.2rem;
          font-weight: 500;
          font-size: 0.88rem;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }
        .admin-tab-btn:hover {
          color: var(--text-primary);
        }
        .admin-tab-btn.active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }
        .indicator-section-block {
          margin-bottom: 2rem;
        }
        .indicator-section-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-primary);
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.3rem;
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .indicator-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        .indicator-card {
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-card);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .indicator-card.disabled {
          opacity: 0.6;
        }
        .indicator-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .indicator-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        .indicator-card-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-primary);
        }
        .indicator-badge-row {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }
        .indicator-badge {
          font-size: 0.7rem;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-weight: 500;
          text-transform: uppercase;
        }
        .badge-lab { background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); }
        .badge-emr { background: color-mix(in srgb, var(--color-accent) 15%, transparent); color: var(--color-accent); }
        .badge-btn { background: color-mix(in srgb, var(--color-warning) 15%, transparent); color: var(--color-warning); }
        .badge-threshold { background: color-mix(in srgb, #a78bfa 15%, transparent); color: #a78bfa; }
        
        .indicator-ref-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }
        .indicator-mapping-preview {
          font-size: 0.75rem;
          border-top: 1px dashed var(--border);
          padding-top: 0.5rem;
          margin-top: auto;
          color: var(--text-secondary);
        }
        .indicator-action-bar {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.8rem;
          border-top: 1px solid var(--border);
          padding-top: 0.6rem;
        }
        .live-preview-box {
          background: color-mix(in srgb, var(--bg-surface) 90%, #000);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.8rem;
          margin-top: 1rem;
        }
        .preview-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }
        .preview-content {
          min-height: 40px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .preview-btn-mock {
          padding: 0.35rem 0.8rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          font-size: 0.8rem;
          background: var(--bg-card);
          color: var(--text-primary);
        }
        .threshold-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1.5fr 2fr auto;
          gap: 0.4rem;
          align-items: center;
          margin-bottom: 0.4rem;
        }
        .threshold-row input, .threshold-row select {
          padding: 0.3rem;
          font-size: 0.8rem;
        }
      `}</style>

      <div className="page-header">
        <div className="page-header-left">
          <h1>Administration</h1>
          <p>{tab === 'users' ? 'User management and system configuration' : tab === 'indicators' ? 'Reportable government indicator definitions catalogue' : 'Facility-wide settings for clinical and reporting workflows'}</p>
        </div>
        <div>
          {tab === 'users' ? (
            <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>
              <Plus size={16} /> Create User
            </button>
          ) : tab === 'indicators' ? (
            <button className="btn btn-primary" onClick={() => { setEditingIndicator(null); setShowIndicatorModal(true); }}>
              <Plus size={16} /> Create Indicator
            </button>
          ) : null}
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          👥 System Users
        </button>
        <button className={`admin-tab-btn ${tab === 'indicators' ? 'active' : ''}`} onClick={() => setTab('indicators')}>
          📊 Reportable Indicators
        </button>
        <button className={`admin-tab-btn ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          ⚙️ Facility Settings
        </button>
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h3><ShieldCheck size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />System Users</h3>
          </div>
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedUser(u)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: '0.7rem' }}>
                            {u.full_name_en?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="mono">{u.username}</span>
                        </div>
                      </td>
                      <td>{u.full_name_en}</td>
                      <td><span className="badge badge-blue">{u.role?.name ?? u.role}</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td>
                        {u.is_active
                          ? <span className="badge badge-green">Active</span>
                          : <span className="badge badge-gray">Inactive</span>
                        }
                      </td>
                      <td style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                        {u.is_active && u.id !== me?.id && (
                          <button className="btn btn-danger btn-sm" onClick={() => deactivate(u.id)}>
                            <UserX size={13} /> Deactivate
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
      )}

      {tab === 'indicators' && (
        <div>
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            Object.entries(groupedIndicators).map(([section, items]) => (
              <div key={section} className="indicator-section-block">
                <div className="indicator-section-title">{section}</div>
                <div className="indicator-grid">
                  {items.map(ind => {
                    const testType = ind.context_type === 'lab_test' ? labTests.find(t => String(t.id) === String(ind.context_ref)) : null
                    return (
                      <div key={ind.id} className={`indicator-card ${ind.enabled ? '' : 'disabled'}`}>
                        <div className="indicator-card-header">
                          <span className="indicator-card-title">{ind.label}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ind.enabled ? 'var(--color-green)' : 'var(--text-muted)' }}>
                            {ind.enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        
                        <div className="indicator-badge-row">
                          <span className={`indicator-badge ${ind.context_type === 'lab_test' ? 'badge-lab' : 'badge-emr'}`}>
                            {ind.context_type === 'lab_test' ? 'Lab Test' : 'EMR Field'}
                          </span>
                          <span className={`indicator-badge ${ind.outcome_shape === 'buttons' ? 'badge-btn' : 'badge-threshold'}`}>
                            {ind.outcome_shape}
                          </span>
                        </div>

                        <div className="indicator-ref-label">
                          <strong>Attached to: </strong>
                          {ind.context_type === 'lab_test' 
                            ? (testType ? `${testType.name_en} (ID: ${ind.context_ref})` : `Test Type ID ${ind.context_ref}`)
                            : (EMR_FIELD_LABELS[ind.context_ref] || ind.context_ref)
                          }
                        </div>

                        {ind.outcome_shape === 'buttons' && (
                          <div className="indicator-mapping-preview">
                            <strong>Options ({ind.options?.length || 0}):</strong>
                            <div style={{ marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                              {ind.options?.map(opt => (
                                <span key={opt.id} style={{ background: 'var(--bg-surface)', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.7rem' }}>
                                  {opt.option_label} → <span className="mono" style={{ fontSize: '0.65rem' }}>{opt.report_event_code}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {ind.outcome_shape === 'threshold' && (
                          <div className="indicator-mapping-preview">
                            <strong>Thresholds ({ind.thresholds?.length || 0}):</strong>
                            <div style={{ marginTop: '0.25rem' }}>
                              {ind.thresholds?.map(t => (
                                <div key={t.id} style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', padding: '0.1rem 0' }}>
                                  <span>{t.label} ({t.min_value ?? '-inf'} to {t.max_value ?? '+inf'})</span>
                                  <span className="mono" style={{ fontSize: '0.65rem' }}>{t.report_event_code}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="indicator-action-bar">
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingIndicator(ind); setShowIndicatorModal(true); }}>
                            <Edit2 size={13} style={{ marginRight: 4 }} /> Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleIndicatorStatus(ind)}>
                            {ind.enabled ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                            <span style={{ marginLeft: 4 }}>{ind.enabled ? 'Disable' : 'Enable'}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="card">
          <div className="card-header">
            <h3><Sliders size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Facility Settings</h3>
          </div>
          {loading || !facilitySettings ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Malaria Elimination District</h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Is this woreda targeted for malaria elimination?</p>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={facilitySettings.is_elimination_district} 
                      onChange={(e) => updateSetting('is_elimination_district', e.target.checked)} 
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Leishmaniasis Treatment</h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Does the facility provide Leishmaniasis treatment?</p>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={facilitySettings.provides_leishmaniasis_treatment} 
                      onChange={(e) => updateSetting('provides_leishmaniasis_treatment', e.target.checked)} 
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>NICU Service</h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Does the facility provide NICU services?</p>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={facilitySettings.provides_nicu_service} 
                      onChange={(e) => updateSetting('provides_nicu_service', e.target.checked)} 
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showUserModal && (
        <CreateUserModal roles={roles} onClose={() => setShowUserModal(false)} onSaved={() => { setShowUserModal(false); load() }} />
      )}

      {showIndicatorModal && (
        <IndicatorModal 
          defn={editingIndicator} 
          labTests={labTests} 
          onClose={() => setShowIndicatorModal(false)} 
          onSaved={() => { setShowIndicatorModal(false); load() }} 
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={() => {
            setResetPasswordUser(null)
            loadUsersAndRoles()
          }}
        />
      )}

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onResetPassword={() => {
            setSelectedUser(null)
            setResetPasswordUser(selectedUser)
          }}
        />
      )}
    </div>
  )
}

function UserDetailsModal({ user, onClose, onResetPassword }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>User Details</h3>
          <button className="icon-btn" onClick={onClose}><UserX size={20} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <div className="avatar" style={{ width: 60, height: 60, fontSize: '1.5rem' }}>
              {user.full_name_en?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{user.full_name_en}</h2>
              <div style={{ color: 'var(--text-muted)' }}>@{user.username}</div>
              <div style={{ marginTop: '0.2rem' }}>
                <span className="badge badge-blue">{user.role?.name ?? user.role}</span>
                <span className={`badge ${user.is_active ? 'badge-green' : 'badge-gray'}`} style={{ marginLeft: '0.5rem' }}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</div>
              <div>{user.email || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone</div>
              <div>{user.phone || '—'}</div>
            </div>
            {user.specialization && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Specialization</div>
                <div>{user.specialization}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created At</div>
              <div>{new Date(user.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Login</div>
              <div>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} /> Security & Password
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
              For strict security and compliance reasons, passwords are encrypted using a one-way cryptographic hash (bcrypt) in the database. <strong>It is impossible for anyone, including System Administrators, to view a user's current password in plain text.</strong>
            </p>
            <button className="btn btn-primary btn-sm" onClick={onResetPassword}>
              <KeyRound size={14} style={{ marginRight: '0.4rem' }} /> Force Set New Password
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!password) return toast.error('Enter a new password')
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    
    setSubmitting(true)
    try {
      await adminApi.resetPassword({ user_id: user.id, new_password: password })
      toast.success(`Password for ${user.username} has been reset successfully`)
      onSuccess()
    } catch (err) {
      toast.error(apiError(err, 'Failed to reset password'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>Set Password - {user.username}</h3>
          <button className="icon-btn" onClick={onClose}><UserX size={20} /></button>
        </div>
        <form onSubmit={submit} className="modal-body">
          <div className="form-group">
            <label>New Password</label>
            <input
              type="text" // Use text so admin can see the password they are generating for the user
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="e.g. StrongPass123"
              disabled={submitting}
              autoComplete="off"
            />
            <small className="text-muted" style={{ display: 'block', marginTop: '0.4rem' }}>
              Must be at least 8 characters, contain an uppercase letter, and a number.
            </small>
          </div>
          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Setting...' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateUserModal({ roles, onClose, onSaved }) {
  const [form, setForm] = useState({ username:'', email:'', full_name_en:'', full_name_am:'', password:'', role_name: roles[0]?.name || 'nurse' })
  const [saving, setSaving] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.createUser(form)
      toast.success('User created')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'Failed to create user'))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Create User</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid" style={{ marginBottom:'1rem' }}>
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" name="username" value={form.username} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" name="password" value={form.password} onChange={handle} required minLength={8} />
              <small className="form-hint">Min 8 characters, with an uppercase letter and a digit.</small>
            </div>
            <div className="form-group">
              <label className="form-label">Full Name (EN) *</label>
              <input className="form-input" name="full_name_en" value={form.full_name_en} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name (AM)</label>
              <input className="form-input" name="full_name_am" value={form.full_name_am} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" name="email" value={form.email} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-select" name="role_name" value={form.role_name} onChange={handle}>
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


