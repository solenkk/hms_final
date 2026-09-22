import { useState, useEffect } from 'react'
import { labApi, adminApi, visitsApi, apiError } from '../api'
import { FlaskConical, Plus, Pencil, Trash2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Lab() {
  const [orders, setOrders] = useState([])
  const [testTypes, setTestTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [resultItem, setResultItem] = useState(null)
  const [tab, setTab] = useState('pending')
  const [testTypeModal, setTestTypeModal] = useState(null) // { testType } | { testType: null } for new
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const canVerify = ['doctor', 'admin'].includes(myRole)
  const canOrder = myRole !== 'lab_technician'
  const canWorkOrders = ['lab_technician', 'admin'].includes(myRole)  // only tech & admin accept/collect/enter
  const isAdmin = myRole === 'admin'   // only admin manages the test catalogue & prices

  const loadTestTypes = async () => {
    // Admins also see retired tests so they can bring one back.
    const res = await labApi.testTypes(isAdmin ? { include_inactive: true } : undefined)
    setTestTypes(res.data)
  }

  useEffect(() => {
    Promise.all([labApi.pending(), labApi.testTypes(isAdmin ? { include_inactive: true } : undefined)])
      .then(([o, t]) => { setOrders(o.data); setTestTypes(t.data) })
      .catch(() => toast.error('Failed to load lab data'))
      .finally(() => setLoading(false))
  }, [isAdmin])

  const loadOrders = async () => {
    const res = await labApi.pending()
    setOrders(res.data)
  }

  const accept = async (itemId) => {
    try {
      await labApi.accept(itemId)
      toast.success('Order accepted')
      await loadOrders()
    } catch (err) {
      toast.error(apiError(err, 'Failed to accept order'))
    }
  }

  const collectSample = async (itemId) => {
    try {
      await labApi.collectSample({ lab_order_item_id: itemId })
      toast.success('Sample collected')
      await loadOrders()
    } catch (err) {
      toast.error(apiError(err, 'Failed to collect sample'))
    }
  }

  const verify = async (itemId) => {
    try {
      await labApi.verify(itemId)
      toast.success('Results verified')
      await loadOrders()
    } catch (err) {
      toast.error(apiError(err, 'Failed to verify results'))
    }
  }

  const statusBadge = (s) => {
    const map = { pending: 'badge-orange', accepted: 'badge-purple', sample_collected: 'badge-blue', completed: 'badge-green', cancelled: 'badge-gray' }
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s?.replace('_',' ')}</span>
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Laboratory</h1>
          <p>Lab orders, sample collection, and results</p>
        </div>
        {tab === 'types'
          ? isAdmin && (
            <button className="btn btn-primary" onClick={() => setTestTypeModal({ testType: null })}>
              <Plus size={16} /> Add Test Type
            </button>
          )
          : canOrder && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> New Order
            </button>
          )}
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab==='pending'?'active':''}`} onClick={() => setTab('pending')}>Pending</button>
        <button className={`tab-btn ${tab==='types'?'active':''}`} onClick={() => setTab('types')}>Test Types</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : tab === 'pending' ? (
          orders.length === 0 ? (
            <div className="empty-state"><FlaskConical size={48}/><p style={{marginTop:'0.5rem'}}>No pending lab orders</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Patient</th>
                    <th>Tests</th>
                    <th>Priority</th>
                    <th>Ordered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => o.items?.map(item => (
                    <tr key={item.id}>
                      <td><span className="mono patient-num">{o.order_number}</span></td>
                      <td>{o.patient_name_en || (o.patient_id ? o.patient_id.slice(0,8)+'…' : '—')}</td>
                      <td>{item.test_name_en || item.test_type_name || item.test_type_id}</td>
                      <td><span className={`badge ${o.priority==='urgent'?'badge-red':'badge-blue'}`}>{o.priority}</span></td>
                      <td style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>{new Date(o.ordered_at || o.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                          {canWorkOrders && item.status === 'pending' && (
                            <button className="btn btn-primary btn-sm" onClick={() => accept(item.id)}>
                              Accept
                            </button>
                          )}
                          {canWorkOrders && item.status === 'accepted' && (
                            <button className="btn btn-accent btn-sm" onClick={() => collectSample(item.id)}>
                              Collect Sample
                            </button>
                          )}
                          {canWorkOrders && item.status === 'sample_collected' && (
                            <button className="btn btn-accent btn-sm" onClick={() => setResultItem(item)}>
                              Enter Results
                            </button>
                          )}
                          {item.status === 'completed' && !item.verified_at && (
                            canVerify
                              ? <button className="btn btn-primary btn-sm" onClick={() => verify(item.id)}>Verify</button>
                              : <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Awaiting verification</span>
                          )}
                          {item.verified_at && <span className="badge badge-green">Verified ✓</span>}
                          {!item.verified_at && !canWorkOrders && statusBadge(item.status)}
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          testTypes.length === 0 ? (
            <div className="empty-state">
              <FlaskConical size={48}/>
              <p style={{marginTop:'0.5rem'}}>No lab tests configured yet</p>
              {isAdmin && (
                <button className="btn btn-primary btn-sm" style={{marginTop:'1rem'}} onClick={() => setTestTypeModal({ testType: null })}>
                  <Plus size={14} /> Add the First Test
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Test Name</th>
                    <th>Category</th>
                    <th>Sample</th>
                    <th>Turnaround</th>
                    <th>Price (ETB)</th>
                    <th>Parameters</th>
                    {isAdmin && <th>Status</th>}
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {testTypes.map(t => (
                    <tr key={t.id} style={{ opacity: t.is_active === false ? 0.55 : 1 }}>
                      <td>{t.id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.name_en}</div>
                        {t.name_am && <div className="amharic" style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{t.name_am}</div>}
                      </td>
                      <td>{t.category || '—'}</td>
                      <td>{t.sample_type || '—'}</td>
                      <td>{t.turnaround_hours != null ? `${t.turnaround_hours} h` : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{Number(t.price ?? 0).toFixed(2)}</td>
                      <td>{t.parameters?.length || 0}</td>
                      {isAdmin && (
                        <td>
                          <span className={`badge ${t.is_active === false ? 'badge-gray' : 'badge-green'}`}>
                            {t.is_active === false ? 'Retired' : 'Active'}
                          </span>
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem' }}
                            onClick={() => setTestTypeModal({ testType: t })}
                            title="Edit name, price, sample type or parameters"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showModal && (
        <NewOrderModal
          testTypes={testTypes.filter(t => t.is_active !== false)}
          onClose={() => setShowModal(false)}
          onSaved={async () => { setShowModal(false); await loadOrders() }}
        />
      )}

      {resultItem && (
        <EnterResultsModal
          item={resultItem}
          onClose={() => setResultItem(null)}
          onSaved={async () => { setResultItem(null); await loadOrders() }}
        />
      )}

      {testTypeModal && (
        <TestTypeModal
          testType={testTypeModal.testType}
          onClose={() => setTestTypeModal(null)}
          onSaved={async () => { setTestTypeModal(null); await loadTestTypes() }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  TEST TYPE MODAL — admin adds a new lab test or edits an existing one      */
/* ═══════════════════════════════════════════════════════════════════════════ */

const emptyParam = () => ({
  id: null, parameter_name_en: '', unit: '',
  normal_range_min: '', normal_range_max: '', normal_range_text: ''
})

function TestTypeModal({ testType, onClose, onSaved }) {
  const isEdit = Boolean(testType)
  const existingInd = testType?.indicator_definition
  const [form, setForm] = useState({
    name_en: testType?.name_en ?? '',
    name_am: testType?.name_am ?? '',
    category: testType?.category ?? '',
    sample_type: testType?.sample_type ?? '',
    turnaround_hours: testType?.turnaround_hours ?? '',
    price: testType?.price ?? 0,
    instructions_en: testType?.instructions_en ?? '',
    is_active: testType?.is_active ?? true,
  })
  const [params, setParams] = useState(
    (testType?.parameters ?? []).map(p => ({
      id: p.id,
      parameter_name_en: p.parameter_name_en ?? '',
      unit: p.unit ?? '',
      normal_range_min: p.normal_range_min ?? '',
      normal_range_max: p.normal_range_max ?? '',
      normal_range_text: p.normal_range_text ?? '',
    }))
  )
  const [saving, setSaving] = useState(false)

  const handle = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }
  const handleParam = (i, field, value) =>
    setParams(ps => ps.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  const addParam = () => setParams(ps => [...ps, emptyParam()])
  const removeParam = (i) => setParams(ps => ps.filter((_, idx) => idx !== i))

  const submit = async (e) => {
    e.preventDefault()
    const named = params.filter(p => p.parameter_name_en.trim() !== '')
    if (params.length > 0 && named.length !== params.length) {
      return toast.error('Every parameter needs a name — remove the blank rows')
    }
    setSaving(true)
    const payload = {
      name_en: form.name_en.trim(),
      name_am: form.name_am || null,
      category: form.category || null,
      sample_type: form.sample_type || null,
      turnaround_hours: form.turnaround_hours === '' ? null : parseInt(form.turnaround_hours),
      price: parseFloat(form.price) || 0,
      instructions_en: form.instructions_en || null,
      parameters: named.map((p, index) => ({
        id: p.id ?? undefined,
        parameter_name_en: p.parameter_name_en.trim(),
        unit: p.unit || null,
        normal_range_min: p.normal_range_min === '' ? null : parseFloat(p.normal_range_min),
        normal_range_max: p.normal_range_max === '' ? null : parseFloat(p.normal_range_max),
        normal_range_text: p.normal_range_text || null,
        sort_order: index,
      })),
    }
    try {
      const res = isEdit
        ? await labApi.updateTestType(testType.id, { ...payload, is_active: form.is_active })
        : await labApi.createTestType(payload)
      toast.success(isEdit ? `${payload.name_en} updated` : `${payload.name_en} added to the lab catalogue`)
      ;(res.data?.warnings ?? []).forEach(w => toast(w, { icon: '⚠️' }))
      onSaved()
    } catch (err) {
      toast.error(apiError(err, isEdit ? 'Failed to update test' : 'Failed to add test'))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '680px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3>{isEdit ? `Edit Test — ${testType.name_en}` : 'Add Lab Test'}</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Test Name (EN) *</label>
              <input className="form-input" name="name_en" value={form.name_en} onChange={handle} required placeholder="e.g. Complete Blood Count" />
            </div>
            <div className="form-group">
              <label className="form-label">Test Name (AM)</label>
              <input className="form-input" name="name_am" value={form.name_am} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-input" name="category" value={form.category} onChange={handle} placeholder="e.g. Hematology" />
            </div>
            <div className="form-group">
              <label className="form-label">Sample Type</label>
              <input className="form-input" name="sample_type" value={form.sample_type} onChange={handle} placeholder="e.g. Blood, Urine" />
            </div>
            <div className="form-group">
              <label className="form-label">Price (ETB) *</label>
              <input className="form-input" type="number" step="0.01" min="0" name="price" value={form.price} onChange={handle} required />
              <small className="form-hint">Billed to the patient when a doctor orders this test.</small>
            </div>
            <div className="form-group">
              <label className="form-label">Turnaround (hours)</label>
              <input className="form-input" type="number" min="0" name="turnaround_hours" value={form.turnaround_hours} onChange={handle} placeholder="e.g. 24" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Instructions</label>
            <textarea className="form-input" rows={2} name="instructions_en" value={form.instructions_en} onChange={handle} placeholder="Patient prep, e.g. fasting 8 hours" />
          </div>

          {/* Parameters section */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Result Parameters</label>
              <button type="button" className="btn btn-ghost btn-xs" onClick={addParam}>
                <Plus size={12} /> Add Parameter
              </button>
            </div>
            {params.length === 0 ? (
              <small className="form-hint">
                No parameters yet. Add at least one (e.g. "WBC", unit 10³/µL) — the lab cannot enter results without them.
              </small>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:'240px', overflowY:'auto' }}>
                {params.map((p, i) => (
                  <div key={p.id ?? `new-${i}`} style={{ display:'flex', gap:'0.4rem', alignItems:'flex-start' }}>
                    <input
                      className="form-input" style={{ flex: 2 }} placeholder="Parameter name *"
                      value={p.parameter_name_en}
                      onChange={e => handleParam(i, 'parameter_name_en', e.target.value)}
                    />
                    <input
                      className="form-input" style={{ flex: 1 }} placeholder="Unit"
                      value={p.unit}
                      onChange={e => handleParam(i, 'unit', e.target.value)}
                    />
                    <input
                      className="form-input" style={{ width: 90 }} type="number" step="0.001" placeholder="Min"
                      value={p.normal_range_min}
                      onChange={e => handleParam(i, 'normal_range_min', e.target.value)}
                    />
                    <input
                      className="form-input" style={{ width: 90 }} type="number" step="0.001" placeholder="Max"
                      value={p.normal_range_max}
                      onChange={e => handleParam(i, 'normal_range_max', e.target.value)}
                    />
                    <button type="button" className="btn btn-ghost btn-xs btn-icon"
                            style={{ color:'var(--color-danger)', marginTop: '0.25rem' }}
                            title="Remove parameter" onClick={() => removeParam(i)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', marginBottom: '1rem' }}>
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handle} />
              Active (uncheck to retire — doctors can no longer order it)
            </label>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LabOrdersList({ orders, canWorkOrders, canVerify, onAction, onEnterResults }) {
  if (orders.length === 0) return <div className="empty-state">No lab orders found.</div>

  return (
    <div className="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {orders.map(o => (
        <div key={o.id} className="card order-card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Order #{o.id.slice(0, 8)}</strong> — Patient: {o.patient_name || 'N/A'} (MRN: {o.mrn || 'N/A'})
              <span className={`status-badge status-${o.status}`} style={{ marginLeft: '0.75rem' }}>{o.status}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Order Date: {new Date(o.created_at).toLocaleString()}
            </div>
          </div>
          <div className="card-body">
            <table className="table" style={{ width: '100%', marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Status</th>
                  <th>Results</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(o.items || []).map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.test_name_en}</strong></td>
                    <td><span className={`status-badge status-${item.status}`}>{item.status}</span></td>
                    <td>
                      {item.results && item.results.length > 0 ? (
                        <div style={{ fontSize: '0.85rem' }}>
                          {item.results.map(r => (
                            <div key={r.id || r.parameter_id}>
                              {r.parameter_name_en}: <strong>{r.result_value}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <em style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No results entered yet</em>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {canWorkOrders && item.status === 'pending_sample' && (
                          <button className="btn btn-sm btn-outline" onClick={() => onAction(item.id, 'accept')}>
                            Accept
                          </button>
                        )}
                        {canWorkOrders && item.status === 'pending_sample' && (
                          <button className="btn btn-sm btn-outline" onClick={() => onAction(item.id, 'collect')}>
                            Collect Sample
                          </button>
                        )}
                        {canWorkOrders && item.status === 'in_progress' && (
                          <button className="btn btn-sm btn-primary" onClick={() => onEnterResults(item)}>
                            Enter Results
                          </button>
                        )}
                        {canVerify && item.status === 'completed' && !item.verified_at && (
                          <button className="btn btn-sm btn-success" onClick={() => onAction(item.id, 'verify')}>
                            Verify Results
                          </button>
                        )}
                      </div>
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

function TestCatalogueList({ testTypes, onEdit, onReload }) {
  const [toggling, setToggling] = useState(null)

  const handleToggleActive = async (tt) => {
    setToggling(tt.id)
    try {
      if (tt.is_active) {
        await labApi.retireTestType(tt.id)
        toast.success(`Retired "${tt.name_en}"`)
      } else {
        await labApi.updateTestType(tt.id, { is_active: true })
        toast.success(`Reactivated "${tt.name_en}"`)
      }
      onReload()
    } catch (err) {
      toast.error(apiError(err, 'Failed to update test status'))
    } finally { setToggling(null) }
  }

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3>Test Catalogue ({testTypes.length})</h3>
      </div>
      <div className="card-body">
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Test Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Turnaround</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {testTypes.map(tt => (
              <tr key={tt.id} style={{ opacity: tt.is_active ? 1 : 0.55 }}>
                <td><code>{tt.code}</code></td>
                <td>
                  <strong>{tt.name_en}</strong>
                  {tt.name_am && <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem', fontSize: '0.85rem' }}>({tt.name_am})</span>}
                </td>
                <td>{tt.category || 'General'}</td>
                <td>ETB {tt.price != null ? Number(tt.price).toFixed(2) : '0.00'}</td>
                <td>{tt.turnaround_time_hours ? `${tt.turnaround_time_hours} hrs` : 'N/A'}</td>
                <td>
                  <span className={`badge ${tt.is_active ? 'badge-success' : 'badge-neutral'}`}>
                    {tt.is_active ? 'Active' : 'Retired'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-sm btn-ghost btn-icon" onClick={() => onEdit(tt)} title="Edit Test">
                      <Pencil size={15} />
                    </button>
                    <button
                      className={`btn btn-sm ${tt.is_active ? 'btn-ghost text-danger' : 'btn-outline'}`}
                      disabled={toggling === tt.id}
                      onClick={() => handleToggleActive(tt)}
                    >
                      {tt.is_active ? 'Retire' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreateOrderModal({ onClose, onSaved, testTypes }) {
  const [form, setForm] = useState({ visit_id: '', test_type_ids: [], clinical_notes: '' })
  const [visits, setVisits] = useState([])
  const [loadingVisits, setLoadingVisits] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    visitsApi.list({ status: 'open' })
      .then(r => setVisits(r.data))
      .catch(err => toast.error(apiError(err, 'Failed to load open visits')))
      .finally(() => setLoadingVisits(false))
  }, [])

  const toggleTest = (id) => {
    setForm(f => ({
      ...f,
      test_type_ids: f.test_type_ids.includes(id)
        ? f.test_type_ids.filter(x => x !== id)
        : [...f.test_type_ids, id]
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.visit_id) return toast.error('Select a patient visit')
    if (form.test_type_ids.length === 0) return toast.error('Select at least one lab test')
    setSaving(true)
    try {
      await labApi.createOrder(form)
      toast.success('Lab order created')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'Failed to create order'))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '560px', width: '90%' }}>
        <div className="modal-header">
          <h3>Create Lab Order</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Patient Visit *</label>
            {loadingVisits ? (
              <div className="spinner-sm" />
            ) : (
              <select
                className="form-select"
                value={form.visit_id}
                onChange={e => setForm(f => ({ ...f, visit_id: e.target.value }))}
                required
              >
                <option value="">Select an open visit...</option>
                {visits.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.patient_name || 'Patient'} (MRN: {v.mrn}) — {v.visit_type} ({new Date(v.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Select Lab Tests *</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem' }}>
              {testTypes.filter(t => t.is_active).map(tt => (
                <label key={tt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.test_type_ids.includes(tt.id)}
                    onChange={() => toggleTest(tt.id)}
                  />
                  <span>{tt.name_en}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ETB {Number(tt.price).toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Clinical Notes</label>
            <textarea className="form-input" rows={3} value={form.clinical_notes}
                      onChange={e => setForm(f => ({ ...f, clinical_notes: e.target.value }))} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EnterResultsModal({ item, onClose, onSaved }) {
  const [params, setParams] = useState([])
  const [values, setValues] = useState({})   // parameter_id -> string
  const [indicatorDef, setIndicatorDef] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      labApi.testParameters(item.test_type_id),
      adminApi.listIndicators({ context_type: 'lab_test', enabled_only: true })
    ])
      .then(([paramRes, indRes]) => {
        const parameterList = paramRes.data || []
        setParams(parameterList)
        const match = (indRes.data || []).find(i => String(i.context_ref) === String(item.test_type_id))
        setIndicatorDef(match || null)

        // Pre-fill values if results exist
        if (item.results && item.results.length > 0) {
          const initialVals = {}
          item.results.forEach(r => {
            if (r.parameter_id) initialVals[r.parameter_id] = r.result_value
          })
          setValues(initialVals)
        }
      })
      .catch(err => toast.error(apiError(err, 'Failed to load test parameter configuration')))
      .finally(() => setLoading(false))
  }, [item.test_type_id])

  const range = (p) => {
    if (p.normal_range_text) return p.normal_range_text
    if (p.normal_range_min != null && p.normal_range_max != null) return `${p.normal_range_min}–${p.normal_range_max}`
    return null
  }

  const handleSelectOption = (opt) => {
    setSelectedOption(opt.option_label)
    // Automatically set the result for all parameters or the first parameter
    if (params.length > 0) {
      setValues(v => ({ ...v, [params[0].id]: opt.option_label }))
    }
  }

  const getThresholdClassification = (valStr) => {
    if (!valStr || isNaN(Number(valStr)) || !indicatorDef?.thresholds?.length) return null
    const num = Number(valStr)
    const matched = indicatorDef.thresholds.find(t => {
      const min = t.min_value != null ? Number(t.min_value) : -Infinity
      const max = t.max_value != null ? Number(t.max_value) : Infinity
      return num >= min && num < max
    })
    return matched ? `${num} → will be recorded as "${matched.label}"` : 'Value outside configured ranges'
  }

  const submit = async (e) => {
    e.preventDefault()
    let results = []
    if (params.length > 0) {
      results = params
        .filter(p => (values[p.id] ?? '').trim() !== '')
        .map(p => ({ parameter_id: p.id, result_value: values[p.id].trim() }))
    } else if (selectedOption) {
      // Direct option selection when parameters list is empty
      results = [{ parameter_id: null, result_value: selectedOption }]
    }

    if (results.length === 0) return toast.error('Enter at least one result or select an outcome option')
    setSaving(true)
    try {
      await labApi.enterResults({ lab_order_item_id: item.id, results })
      toast.success('Results submitted')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'Failed to submit results'))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '540px', width: '90%' }}>
        <div className="modal-header">
          <h3>Enter Results — {item.test_name_en || `Test #${item.test_type_id}`}</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              {/* Render catalog-driven Buttons if defined */}
              {indicatorDef && indicatorDef.outcome_shape === 'buttons' && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                    {indicatorDef.label} (Reportable Outcome Selection)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {indicatorDef.options.map(opt => {
                      const isSelected = selectedOption === opt.option_label || (params.length > 0 && values[params[0].id] === opt.option_label)
                      return (
                        <button
                          key={opt.id || opt.option_label}
                          type="button"
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                          style={{ borderRadius: '20px', padding: '0.4rem 1rem' }}
                          onClick={() => handleSelectOption(opt)}
                        >
                          {isSelected && <Check size={14} style={{ marginRight: 4 }} />}
                          {opt.option_label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Parameter inputs */}
              {params.length === 0 && (!indicatorDef || indicatorDef.outcome_shape !== 'buttons') ? (
                <p className="form-hint">No parameters configured for this test.</p>
              ) : (
                params.map(p => {
                  const classification = indicatorDef && indicatorDef.outcome_shape === 'threshold' ? getThresholdClassification(values[p.id]) : null
                  return (
                    <div key={p.id} className="form-group">
                      <label className="form-label">
                        {p.parameter_name_en}{p.unit ? ` (${p.unit})` : ''}
                      </label>
                      <input
                        className="form-input"
                        value={values[p.id] ?? ''}
                        onChange={e => {
                          const val = e.target.value
                          setValues(v => ({ ...v, [p.id]: val }))
                        }}
                      />
                      {range(p) && <small className="form-hint">Normal: {range(p)}</small>}
                      {classification && (
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)', marginTop: '0.25rem', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                          ⚡ {classification}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? 'Submitting…' : 'Submit Results'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
