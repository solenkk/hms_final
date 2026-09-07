import { useState, useEffect, useCallback } from 'react'
import { pharmacyApi, apiError } from '../api'
import { Pill, Plus, Printer, User, Check, CheckCircle, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Pharmacy() {
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const isPharmacist = ['pharmacist', 'admin'].includes(myRole)
  const canAdministerInjections = ['pharmacist', 'nurse', 'doctor', 'admin'].includes(myRole)

  const [drugs, setDrugs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [tab, setTab] = useState('inventory')
  const [showDrugModal, setShowDrugModal] = useState(false)
  const [editDrug, setEditDrug] = useState(null)
  const [stockDrug, setStockDrug] = useState(null)

  // Prescriptions state
  const [prescriptions, setPrescriptions] = useState([])
  const [prescLoading, setPrescLoading] = useState(false)
  const [prescFilter, setPrescFilter] = useState('') // pending, dispensed, partially_dispensed
  const [expandedPresc, setExpandedPresc] = useState(null)
  const [dispenseForm, setDispenseForm] = useState({}) // item_id -> quantity_to_dispense
  const [injNotes, setInjNotes] = useState({}) // item_id -> notes string

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pharmacyApi.drugs({ search: search || undefined, low_stock: lowStock })
      setDrugs(res.data)
    } catch { toast.error('Failed to load drugs') }
    finally { setLoading(false) }
  }, [search, lowStock])

  const loadPrescriptions = useCallback(async () => {
    setPrescLoading(true)
    try {
      const res = await pharmacyApi.listPrescriptions({ status: prescFilter || undefined })
      setPrescriptions(res.data)
    } catch {
      toast.error('Failed to load prescriptions')
    } finally {
      setPrescLoading(false)
    }
  }, [prescFilter])

  const handleDispense = async (itemId, maxQty) => {
    const qtyInput = dispenseForm[itemId];
    const qty = qtyInput !== undefined ? parseInt(qtyInput) : maxQty;
    if (isNaN(qty) || qty < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (qty > maxQty) {
      toast.error(`Cannot dispense more than remaining quantity (${maxQty})`);
      return;
    }

    try {
      await pharmacyApi.dispense({
        prescription_item_id: itemId,
        quantity_to_dispense: qty
      });
      toast.success('Medication dispensed successfully');
      setDispenseForm(prev => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });
      loadPrescriptions();
      load(); // Reload drugs stock
    } catch (err) {
      toast.error(apiError(err, 'Failed to dispense medication'));
    }
  }

  const handleRecordInjection = async (itemId, sessionNum) => {
    const notes = injNotes[itemId];
    try {
      await pharmacyApi.recordInjection({
        prescription_item_id: itemId,
        session_number: sessionNum,
        notes: notes || undefined
      });
      toast.success(`Injection Session ${sessionNum} recorded successfully ✓`);
      setInjNotes(prev => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });
      loadPrescriptions();
      load(); // Reload drugs stock
    } catch (err) {
      toast.error(apiError(err, 'Failed to record injection session'));
    }
  }

  useEffect(() => {
    if (tab === 'prescriptions') {
      loadPrescriptions()
    }
  }, [tab, loadPrescriptions])

  useEffect(() => {
    const t = setTimeout(load, 350)
    return () => clearTimeout(t)
  }, [load])

  const stockBadge = (qty) => {
    if (qty <= 0) return <span className="badge badge-red">Out of Stock</span>
    if (qty <= 50) return <span className="badge badge-orange">Low Stock</span>
    return <span className="badge badge-green">In Stock</span>
  }

  const printDrugRequest = (drug) => {
    const win = window.open('', '_blank', 'width=480,height=600')
    const now = new Date().toLocaleString()
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Drug Requisition</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
          .clinic-name { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 2px; }
          .clinic-sub  { font-size: 13px; color: #555; text-align: center; margin-bottom: 4px; }
          .divider     { border: none; border-top: 1.5px solid #333; margin: 14px 0; }
          .title       { font-size: 15px; font-weight: 700; text-align: center; letter-spacing: 1px; margin-bottom: 16px; text-transform: uppercase; }
          table        { width: 100%; border-collapse: collapse; }
          td           { padding: 6px 4px; font-size: 13px; vertical-align: top; }
          td:first-child { font-weight: 600; width: 40%; color: #444; }
          .footer      { margin-top: 32px; font-size: 11px; color: #888; text-align: center; }
          .stamp-area  { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
          .stamp-box   { text-align: center; }
          .stamp-line  { border-top: 1px solid #666; width: 120px; margin: 28px auto 4px; }
        </style>
      </head>
      <body>
        <div class="clinic-name">Kassahun Medium Clinic</div>
        <div class="clinic-sub">Shagar City, Oromia, Ethiopia</div>
        <hr class="divider" />
        <div class="title">Drug Requisition / Out-of-Stock Notice</div>
        <table>
          <tr><td>Date:</td><td>${now}</td></tr>
          <tr><td>Drug Name:</td><td>${drug.name_generic_en}${drug.name_brand ? ' (' + drug.name_brand + ')' : ''}</td></tr>
          <tr><td>Form:</td><td>${drug.drug_form || '—'}</td></tr>
          <tr><td>Strength:</td><td>${drug.strength || '—'}</td></tr>
          <tr><td>Unit:</td><td>${drug.unit_of_measure || '—'}</td></tr>
          <tr><td>Current Stock:</td><td style="color:red;font-weight:700">${drug.current_stock ?? 0} (Out of Stock)</td></tr>
          <tr><td>Min. Level:</td><td>${drug.min_stock_level ?? '—'}</td></tr>
        </table>
        <div class="stamp-area">
          <div class="stamp-box">
            <div class="stamp-line"></div>
            Requested By
          </div>
          <div class="stamp-box">
            <div class="stamp-line"></div>
            Approved By
          </div>
        </div>
        <div class="footer">Kassahun Medium Clinic &mdash; Shagar City, Oromia, Ethiopia</div>
      </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Pharmacy</h1>
          <p>Drug inventory, prescriptions, and dispensing</p>
        </div>
        {isPharmacist && (
          <button className="btn btn-primary" onClick={() => setShowDrugModal(true)}>
            <Plus size={16} /> Add Drug
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab==='inventory'?'active':''}`} onClick={() => setTab('inventory')}>Inventory</button>
        <button className={`tab-btn ${tab==='prescriptions'?'active':''}`} onClick={() => setTab('prescriptions')}>Prescriptions</button>
      </div>

      {tab === 'inventory' && (
        <>
          <div className="toolbar">
            <div className="search-bar" style={{ flex: 1, maxWidth: 380 }}>
              <input
                className="form-input"
                placeholder="Search drug name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', fontSize:'0.88rem', color:'var(--text-secondary)' }}>
              <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} />
              Low stock only
            </label>
          </div>
          <div className="card">
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : drugs.length === 0 ? (
              <div className="empty-state"><Pill size={48}/><p style={{marginTop:'0.5rem'}}>No drugs found</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Drug Name</th>
                      <th>Form</th>
                      <th>Strength</th>
                      <th>Unit</th>
                      <th>Price (ETB)</th>
                      <th>Stock</th>
                      <th>Status</th>
                      {isPharmacist && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {drugs.map(d => (
                      <tr key={d.id}>
                        <td>{d.id}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{d.name_generic_en}</div>
                          {d.name_brand && <div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{d.name_brand}</div>}
                        </td>
                        <td><span className="badge badge-blue">{d.drug_form}</span></td>
                        <td>{d.strength || '—'}</td>
                        <td>{d.unit_of_measure}</td>
                        <td style={{ fontWeight: 600, color: Number(d.unit_price) > 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
                          {Number(d.unit_price ?? 0).toFixed(2)}
                        </td>
                        <td style={{ fontWeight: 600 }}>{d.current_stock?.toLocaleString()}</td>
                        <td>{stockBadge(d.current_stock)}</td>
                        {isPharmacist && (
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem' }}
                                onClick={() => setEditDrug(d)}
                                title="Edit name, price, strength, form or unit"
                              >
                                <Pencil size={12} /> Edit
                              </button>
                              <button className="btn btn-ghost btn-xs" style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem' }} onClick={() => setStockDrug(d)}>
                                <Plus size={12} /> Add Stock
                              </button>
                              {d.current_stock <= 0 && (
                                <button
                                  className="btn btn-ghost btn-xs"
                                  style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                                  onClick={() => printDrugRequest(d)}
                                  title="Print drug requisition slip"
                                >
                                  <Printer size={12} /> Print Request
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'prescriptions' && (
        <>
          <div className="toolbar" style={{ display:'flex', gap:'1rem', marginBottom:'1rem' }}>
            <div style={{ flex: 1, maxWidth: 280 }}>
              <select className="form-select" value={prescFilter} onChange={e => setPrescFilter(e.target.value)}>
                <option value="">All Prescriptions</option>
                <option value="pending">Pending</option>
                <option value="partially_dispensed">Partially Dispensed</option>
                <option value="dispensed">Dispensed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button className="btn btn-ghost" onClick={loadPrescriptions}>Refresh Queue</button>
          </div>

          <div className="card">
            {prescLoading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : prescriptions.length === 0 ? (
              <div className="empty-state">
                <Pill size={48}/>
                <p style={{marginTop:'0.5rem'}}>No prescriptions found</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Prescribed Date</th>
                      <th>Patient</th>
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
                          style={{ cursor: 'pointer', background: expandedPresc === p.id ? 'var(--bg-secondary)' : '' }}
                          onClick={() => setExpandedPresc(expandedPresc === p.id ? null : p.id)}
                        >
                          <td style={{fontSize:'0.82rem'}}>
                            {p.prescribed_at ? new Date(p.prescribed_at).toLocaleString() : '—'}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {p.patient_name || 'Unknown Patient'}
                            {p.patient_number && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontFamily:'monospace' }}>{p.patient_number}</div>}
                          </td>
                          <td style={{fontSize:'0.82rem'}}>
                            <User size={12} style={{marginRight:4, verticalAlign:'middle'}} />
                            {p.prescribed_by_name || 'Doctor'}
                          </td>
                          <td>
                            <span className={`badge ${
                              p.status === 'dispensed' ? 'badge-green'
                                : p.status === 'partially_dispensed' ? 'badge-purple'
                                : p.status === 'cancelled' ? 'badge-red'
                                : 'badge-orange'
                            }`}>{p.status?.replace(/_/g, ' ')}</span>
                          </td>
                          <td style={{fontSize:'0.82rem', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                            {p.notes || <span className="emr-muted">—</span>}
                          </td>
                          <td style={{fontSize:'0.82rem'}}>{p.items?.length || 0} drugs</td>
                          <td>
                            <button className="btn btn-ghost btn-xs">
                              {expandedPresc === p.id ? 'Hide Details' : 'View / Dispense'}
                            </button>
                          </td>
                        </tr>
                        {expandedPresc === p.id && p.items?.length > 0 && (
                          <tr key={`${p.id}-details`} style={{ background: 'var(--bg-secondary)' }}>
                            <td colSpan={7} style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                Prescription Items & Dispensing Control
                              </div>
                              <table style={{ width: '100%', minWidth: '600px', background: 'var(--bg-card)' }}>
                                <thead>
                                  <tr>
                                    <th style={{ fontSize: '0.78rem' }}>Drug generic name</th>
                                    <th style={{ fontSize: '0.78rem' }}>Instructions</th>
                                    <th style={{ fontSize: '0.78rem' }}>Prescribed Qty</th>
                                    <th style={{ fontSize: '0.78rem' }}>Dispensed Qty</th>
                                    <th style={{ fontSize: '0.78rem' }}>Dispenser (Pharmacist)</th>
                                    <th style={{ fontSize: '0.78rem' }}>Dispense Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.items.map((item) => {
                                    const remaining = item.quantity - item.dispensed_quantity;
                                    const val = dispenseForm[item.id] !== undefined ? dispenseForm[item.id] : remaining;
                                    return (
                                      <tr key={item.id}>
                                        <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                                          {item.drug_name || `Drug #${item.drug_id}`}
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {item.dose} • {item.frequency} • {item.duration}
                                          </div>
                                        </td>
                                        <td style={{ fontSize: '0.82rem', maxWidth: '200px', wordBreak: 'break-word' }}>
                                          {item.instructions_en && <div>EN: {item.instructions_en}</div>}
                                          {item.instructions_am && <div className="amharic">AM: {item.instructions_am}</div>}
                                          {!item.instructions_en && !item.instructions_am && <span className="emr-muted">—</span>}
                                        </td>
                                        <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.quantity}</td>
                                        <td style={{ fontSize: '0.82rem', color: item.dispensed_quantity >= item.quantity ? 'var(--success)' : 'var(--text-muted)' }}>
                                          {item.dispensed_quantity}
                                        </td>
                                        <td style={{ fontSize: '0.82rem' }}>
                                          {item.drug_form?.toLowerCase() === 'injection' ? (
                                            <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>Injection Tracker</span>
                                          ) : item.dispenser_name ? (
                                            <div style={{ color: 'var(--success)', fontWeight: 500 }}>
                                              <CheckCircle size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                                              {item.dispenser_name}
                                              {item.dispensed_at && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{new Date(item.dispensed_at).toLocaleDateString()}</div>}
                                            </div>
                                          ) : (
                                            <span className="emr-muted">Not dispensed yet</span>
                                          )}
                                        </td>
                                        <td onClick={e => e.stopPropagation()} style={{ minWidth: item.drug_form?.toLowerCase() === 'injection' ? '250px' : '160px' }}>
                                          {p.status === 'cancelled' ? (
                                            <span className="badge badge-red" style={{ fontSize: '0.73rem' }}>Cancelled — do not dispense</span>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                              <input
                                                type="number"
                                                className="form-input"
                                                style={{ width: '65px', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center', opacity: isPharmacist ? 1 : 0.45, cursor: isPharmacist ? 'auto' : 'not-allowed' }}
                                                min="1"
                                                max={remaining}
                                                value={val}
                                                disabled={!isPharmacist}
                                                onChange={e => setDispenseForm({ ...dispenseForm, [item.id]: e.target.value })}
                                              />
                                              <span
                                                title={!isPharmacist ? 'Only a pharmacist can approve dispensing' : ''}
                                                style={{ display: 'inline-block' }}
                                              >
                                                <button
                                                  className="btn btn-primary btn-sm"
                                                  style={{ padding: '0.25rem 0.50rem', fontSize: '0.75rem', whiteSpace: 'nowrap', opacity: isPharmacist ? 1 : 0.45, cursor: isPharmacist ? 'pointer' : 'not-allowed' }}
                                                  disabled={!isPharmacist}
                                                  onClick={() => isPharmacist && handleDispense(item.id, remaining)}
                                                >
                                                  ✓ Approve & Dispense
                                                </button>
                                              </span>
                                              {!isPharmacist && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                  Pharmacist login required
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                                              <Check size={12} /> Completed
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
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
        </>
      )}

      {showDrugModal && (
        <DrugFormModal onClose={() => setShowDrugModal(false)} onSaved={() => { setShowDrugModal(false); load() }} />
      )}

      {editDrug && (
        <DrugFormModal drug={editDrug} onClose={() => setEditDrug(null)} onSaved={() => { setEditDrug(null); load() }} />
      )}

      {stockDrug && (
        <AddStockModal drug={stockDrug} onClose={() => setStockDrug(null)} onSaved={() => { setStockDrug(null); load() }} />
      )}
    </div>
  )
}

/* Add a drug, or edit an existing one — same form, `drug` decides the mode. */
const DRUG_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'other']

function DrugFormModal({ drug, onClose, onSaved }) {
  const isEdit = Boolean(drug)
  const [form, setForm] = useState({
    name_generic_en: drug?.name_generic_en ?? '',
    name_generic_am: drug?.name_generic_am ?? '',
    name_brand: drug?.name_brand ?? '',
    drug_form: drug?.drug_form ?? 'tablet',
    unit_of_measure: drug?.unit_of_measure ?? 'mg',
    strength: drug?.strength ?? '',
    unit_price: drug?.unit_price ?? 0,
    reorder_level: drug?.reorder_level ?? 50,
    supplier: drug?.supplier ?? '',
    storage_conditions: drug?.storage_conditions ?? '',
    controlled_substance: drug?.controlled_substance ?? false,
    is_active: drug?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const handle = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (Number(form.unit_price) < 0) return toast.error('Price cannot be negative')
    setSaving(true)
    const payload = {
      name_generic_en: form.name_generic_en,
      name_generic_am: form.name_generic_am || null,
      name_brand: form.name_brand || null,
      drug_form: form.drug_form,
      strength: form.strength || null,
      unit_of_measure: form.unit_of_measure,
      unit_price: parseFloat(form.unit_price) || 0,
      reorder_level: parseInt(form.reorder_level) || 10,
      supplier: form.supplier || null,
      storage_conditions: form.storage_conditions || null,
      controlled_substance: form.controlled_substance,
    }
    try {
      if (isEdit) {
        await pharmacyApi.updateDrug(drug.id, { ...payload, is_active: form.is_active })
        toast.success(`${form.name_generic_en} updated`)
      } else {
        await pharmacyApi.createDrug(payload)
        toast.success('Drug added successfully')
      }
      onSaved()
    } catch (err) {
      toast.error(apiError(err, isEdit ? 'Failed to update drug' : 'Failed to add drug'))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? `Edit Drug — ${drug.name_generic_en}` : 'Add New Drug'}</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Generic Name (EN) *</label>
              <input className="form-input" name="name_generic_en" value={form.name_generic_en} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Generic Name (AM)</label>
              <input className="form-input" name="name_generic_am" value={form.name_generic_am} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Brand Name</label>
              <input className="form-input" name="name_brand" value={form.name_brand} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Form / Type</label>
              <select className="form-select" name="drug_form" value={form.drug_form} onChange={handle}>
                {DRUG_FORMS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Strength (mg / ml)</label>
              <input className="form-input" name="strength" value={form.strength} onChange={handle} placeholder="e.g. 500mg"/>
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <input className="form-input" name="unit_of_measure" value={form.unit_of_measure} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price (ETB) *</label>
              <input className="form-input" type="number" step="0.01" min="0" name="unit_price" value={form.unit_price} onChange={handle} required />
              <small className="form-hint">Charged per unit on the patient's prescription invoice.</small>
            </div>
            <div className="form-group">
              <label className="form-label">Min. Stock Level</label>
              <input className="form-input" type="number" min="0" name="reorder_level" value={form.reorder_level} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input className="form-input" name="supplier" value={form.supplier} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Storage Conditions</label>
              <input className="form-input" name="storage_conditions" value={form.storage_conditions} onChange={handle} placeholder="e.g. 2–8°C" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input type="checkbox" name="controlled_substance" checked={form.controlled_substance} onChange={handle} />
              Controlled substance
            </label>
            {isEdit && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handle} />
                Active (uncheck to retire this drug)
              </label>
            )}
          </div>

          {isEdit && (
            <small className="form-hint" style={{ display: 'block', marginBottom: '1rem' }}>
              Stock ({drug.current_stock?.toLocaleString()} {drug.unit_of_measure}) is not editable here — use Add Stock so batches stay traceable.
            </small>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Drug'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddStockModal({ drug, onClose, onSaved }) {
  const [form, setForm] = useState({
    batch_number: '',
    quantity_received: 100,
    expiry_date: '',
    manufacture_date: '',
    supplier: drug.supplier || '',
    purchase_price: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.batch_number) return toast.error('Batch number is required')
    if (parseInt(form.quantity_received) < 1) return toast.error('Quantity must be at least 1')
    if (!form.expiry_date) return toast.error('Expiry date is required')

    setSaving(true)
    try {
      await pharmacyApi.addBatch({
        drug_id: drug.id,
        batch_number: form.batch_number,
        quantity_received: parseInt(form.quantity_received),
        expiry_date: form.expiry_date,
        manufacture_date: form.manufacture_date || undefined,
        supplier: form.supplier || undefined,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined,
        notes: form.notes || undefined
      })
      toast.success('Stock added successfully')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'Failed to add stock'))
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Add Stock / Batch — {drug.name_generic_en}</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', padding: '1rem 0' }}>
            <div className="form-group">
              <label className="form-label">Batch Number *</label>
              <input className="form-input" name="batch_number" value={form.batch_number} onChange={handle} required placeholder="e.g. B-012" />
            </div>
            <div className="form-group">
              <label className="form-label">Quantity Received *</label>
              <input className="form-input" type="number" min="1" name="quantity_received" value={form.quantity_received} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date *</label>
              <input className="form-input" type="date" name="expiry_date" value={form.expiry_date} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Manufacture Date</label>
              <input className="form-input" type="date" name="manufacture_date" value={form.manufacture_date} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Price (per unit)</label>
              <input className="form-input" type="number" step="0.01" min="0" name="purchase_price" value={form.purchase_price} onChange={handle} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input className="form-input" name="supplier" value={form.supplier} onChange={handle} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} name="notes" value={form.notes} onChange={handle} placeholder="Batch storage details, etc." />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Stock'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
