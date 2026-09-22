import { useState, useEffect, useCallback } from 'react'
import { billingApi, patientsApi, apiError } from '../api'
import { ReceiptText, Plus, CreditCard, Clock, CheckCircle, User, AlertTriangle, XCircle, Settings, BedDouble } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '../api'

export default function Billing() {
  const [tab, setTab] = useState('pending')
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Billing</h1>
          <p>Invoices, payments, and financial management</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab==='pending'?'active':''}`} onClick={() => setTab('pending')}>
          <Clock size={14} style={{ marginRight: 4 }} />Pending Payments
        </button>
        <button className={`tab-btn ${tab==='recent'?'active':''}`} onClick={() => setTab('recent')}>
          <ReceiptText size={14} style={{ marginRight: 4 }} />Recent Invoices
        </button>
        <button className={`tab-btn ${tab==='create'?'active':''}`} onClick={() => setTab('create')}>
          <Plus size={14} style={{ marginRight: 4 }} />Create Invoice
        </button>
        <div style={{ flex: 1 }} />
        <button className="tab-btn" onClick={() => setShowSettings(true)} style={{ color: 'var(--color-primary)' }}>
          <Settings size={14} style={{ marginRight: 4 }} />Fee Settings
        </button>
      </div>

      {tab === 'pending' && <PendingPayments />}
      {tab === 'recent' && <RecentInvoices />}
      {tab === 'create' && <CreateInvoiceForm />}

      {showSettings && <FeeSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function FeeSettingsModal({ onClose }) {
  const [rate, setRate] = useState('')
  const [regFee, setRegFee] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminApi.getFacilitySettings()
      .then(r => {
        setRate(r.data.bed_hourly_rate || 0)
        setRegFee(r.data.patient_registration_fee || 100.00)
      })
      .catch(e => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.updateFacilitySettings({ 
        bed_hourly_rate: parseFloat(rate),
        patient_registration_fee: parseFloat(regFee)
      })
      toast.success('Fee settings updated')
      onClose()
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <h3><Settings size={16} style={{ marginRight: 6 }} />Fee Settings</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading ? <p>Loading...</p> : (
              <>
                <div className="form-group">
                  <label className="form-label">Patient Registration Fee (ETB)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    className="form-input" 
                    value={regFee} 
                    onChange={e => setRegFee(e.target.value)} 
                    required 
                  />
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>This fee is charged for new patients. If a patient hasn't visited in 1 month, they will pay 75% of this rate.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Hourly Bed Rate (Birr/hr)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    className="form-input" 
                    value={rate} 
                    onChange={e => setRate(e.target.value)} 
                    required 
                  />
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>This rate will be used to calculate bed charges when invoices are generated.</p>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PENDING PAYMENTS — The core receptionist workflow                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PendingPayments() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    billingApi.listAll({ status: 'pending' })
      .then(r => setInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Failed to load pending invoices'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  if (invoices.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <CheckCircle size={48} style={{ color: 'var(--success)' }} />
          <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>All caught up!</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending payments at this time.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 4, color: 'hsl(38,95%,55%)' }} />
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} awaiting payment
        </span>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Description</th>
                <th>Total (ETB)</th>
                <th>Paid (ETB)</th>
                <th>Remaining (ETB)</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const remaining = (inv.total_amount - inv.paid_amount).toFixed(2)
                return (
                  <tr key={inv.id}>
                    <td><span className="mono patient-num">{inv.invoice_number}</span></td>
                    <td style={{ fontWeight: 500 }}>
                      <User size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {inv.patient_name || 'Unknown Patient'}
                    </td>
                    <td style={{ fontSize: '0.82rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inv.items?.map(i => i.description_en).join(', ') || inv.notes || '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>{Number(inv.total_amount).toLocaleString()}</td>
                    <td>{Number(inv.paid_amount).toLocaleString()}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{Number(remaining).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${inv.status === 'partially_paid' ? 'badge-orange' : 'badge-gray'}`}>
                        {inv.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          <CreditCard size={13} /> Approve & Pay
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          title="Patient cannot pay — void this invoice and the order behind it"
                          onClick={() => setCancelTarget(inv)}
                        >
                          <XCircle size={13} /> Can't Pay
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && (
        <QuickPayModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPaid={() => { setSelectedInvoice(null); load() }}
        />
      )}

      {cancelTarget && (
        <CancelInvoiceModal
          invoice={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => { setCancelTarget(null); load() }}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  CANCEL INVOICE MODAL — Patient can't pay: void invoice + linked order     */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function CancelInvoiceModal({ invoice, onClose, onCancelled }) {
  const [reason, setReason] = useState('Patient unable to pay')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await billingApi.cancel(invoice.id, reason.trim() || undefined)
      toast.success(`Invoice ${invoice.invoice_number} cancelled`)
      onCancelled()
    } catch (err) {
      toast.error(apiError(err, 'Failed to cancel invoice'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3><XCircle size={16} style={{ marginRight: 6, color: 'var(--color-danger)' }} />Cancel Invoice</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.88rem'
            }}>
              <div style={{ marginBottom: '0.3rem' }}>
                <strong>Patient:</strong> {invoice.patient_name || 'Unknown'}
              </div>
              <div style={{ marginBottom: '0.3rem' }}>
                <strong>Invoice:</strong> {invoice.invoice_number}
              </div>
              <div>
                <strong>Order:</strong> {invoice.items?.map(i => i.description_en).join(', ') || invoice.notes || '—'}
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: 'hsl(38,95%,55%)', flexShrink: 0, marginTop: 2 }} />
              <span>
                The lab tests or prescriptions on this invoice will be cancelled and will not
                reach the lab or pharmacy. This cannot be undone — the doctor must re-order.
              </span>
            </div>

            {Number(invoice.paid_amount) > 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
                Note: {Number(invoice.paid_amount).toLocaleString()} ETB has already been paid on this
                invoice. Refund it at the cash desk separately.
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea
                className="form-input"
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Patient unable to pay"
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Keep Invoice</button>
            <button type="submit" className="btn btn-danger" disabled={saving}>
              {saving ? 'Cancelling…' : 'Cancel Invoice & Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  QUICK PAY MODAL — Pay the remaining amount in one click                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function QuickPayModal({ invoice, onClose, onPaid }) {
  const remaining = invoice.total_amount - invoice.paid_amount
  const [form, setForm] = useState({
    amount: remaining,
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
      toast.success(`Payment recorded for ${invoice.patient_name || invoice.invoice_number}`)
      onPaid()
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
          <h3><CreditCard size={16} style={{ marginRight: 6 }} />Approve Payment</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Patient + Invoice summary */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.88rem'
            }}>
              <div style={{ marginBottom: '0.3rem' }}>
                <strong>Patient:</strong> {invoice.patient_name || 'Unknown'}
              </div>
              <div style={{ marginBottom: '0.3rem' }}>
                <strong>Invoice:</strong> {invoice.invoice_number}
              </div>
              <div style={{ marginBottom: '0.3rem' }}>
                <strong>Description:</strong> {invoice.items?.map(i => i.description_en).join(', ') || invoice.notes || '—'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                <div>Total: <strong>{Number(invoice.total_amount).toLocaleString()} ETB</strong></div>
                <div>Remaining: <strong style={{ color: 'var(--color-primary)' }}>{remaining.toFixed(2)} ETB</strong></div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Amount *</label>
              <input
                className="form-input"
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                min={0.01}
                max={remaining}
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
              {saving ? 'Processing…' : '✓ Approve & Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  RECENT INVOICES — All invoices list                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function RecentInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    billingApi.listAll()
      .then(r => setInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  if (invoices.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <ReceiptText size={48} />
          <p style={{ marginTop: '0.5rem' }}>No invoices found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Patient</th>
              <th>Description</th>
              <th>Total (ETB)</th>
              <th>Paid (ETB)</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td className="mono patient-num">{inv.invoice_number}</td>
                <td style={{ fontWeight: 500 }}>
                  <User size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {inv.patient_name || 'Unknown'}
                </td>
                <td style={{ fontSize: '0.82rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.items?.map(i => i.description_en).join(', ') || inv.notes || '—'}
                </td>
                <td style={{ fontWeight: 600 }}>{Number(inv.total_amount).toLocaleString()}</td>
                <td>{Number(inv.paid_amount).toLocaleString()}</td>
                <td>
                  <span className={`badge ${
                    inv.status === 'paid' ? 'badge-green' :
                    inv.status === 'partially_paid' ? 'badge-orange' :
                    'badge-gray'
                  }`}>
                    {inv.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(inv.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  CREATE INVOICE FORM                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function CreateInvoiceForm() {
  const [form, setForm] = useState({ patient_id: '', visit_id: '', items: [{ description_en: '', quantity: 1, unit_price: 0, item_type: 'consultation' }] })
  const [saving, setSaving] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const handleItem = (i, e) => {
    const items = [...form.items]
    items[i] = { ...items[i], [e.target.name]: e.target.value }
    setForm(f => ({ ...f, items }))
  }
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description_en: '', quantity: 1, unit_price: 0, item_type: 'consultation' }] }))
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_,idx) => idx !== i) }))

  const total = form.items.reduce((s, item) => s + (Number(item.quantity) * Number(item.unit_price)), 0)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let finalPatientId = form.patient_id.trim();
      
      // If patient_id doesn't look like a valid 36-char UUID, try to resolve it as an MRN (e.g. CL-2026-...)
      if (finalPatientId.length < 36 && finalPatientId.length > 0) {
        const pRes = await patientsApi.list({ patient_number: finalPatientId });
        if (pRes.data && pRes.data.items && pRes.data.items.length > 0) {
          finalPatientId = pRes.data.items[0].id;
        } else {
          toast.error(`Patient not found with ID/MRN: ${finalPatientId}`);
          setSaving(false);
          return;
        }
      }

      const payload = {
        ...form,
        patient_id: finalPatientId,
        visit_id: form.visit_id || undefined,
        notes: form.notes || undefined
      }
      const res = await billingApi.create(payload)
      toast.success(`Invoice ${res.data.invoice_number} created`)
      setForm({ patient_id:'', visit_id:'', items:[{ description_en:'', quantity:1, unit_price:0, item_type:'consultation'}] })
    } catch (err) {
      toast.error(apiError(err, 'Failed to create invoice'))
    } finally { setSaving(false) }
  }

  return (
    <div className="card">
      <form onSubmit={submit}>
        <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Patient ID or MRN *</label>
            <input className="form-input" name="patient_id" value={form.patient_id} onChange={handle} placeholder="UUID or e.g. CL-2026-00003" required />
          </div>
          <div className="form-group">
            <label className="form-label">Visit ID</label>
            <input className="form-input" name="visit_id" value={form.visit_id} onChange={handle} placeholder="UUID (optional)" />
          </div>
        </div>

        <h4 style={{ marginBottom: '0.75rem' }}>Line Items</h4>
        {form.items.map((item, i) => (
          <div key={i} className="billing-item-row">
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" name="description_en" value={item.description_en} onChange={e => handleItem(i, e)} required />
            </div>
            <div className="form-group" style={{ flex: '0 0 120px' }}>
              <label className="form-label">Qty</label>
              <input className="form-input" type="number" name="quantity" value={item.quantity} onChange={e => handleItem(i, e)} min={1} />
            </div>
            <div className="form-group" style={{ flex: '0 0 150px' }}>
              <label className="form-label">Unit Price (ETB)</label>
              <input className="form-input" type="number" name="unit_price" value={item.unit_price} onChange={e => handleItem(i, e)} min={0} step={0.01} />
            </div>
            <div className="form-group" style={{ flex: '0 0 160px' }}>
              <label className="form-label">Type</label>
              <select className="form-select" name="item_type" value={item.item_type} onChange={e => handleItem(i, e)}>
                {['consultation','lab','pharmacy','bed','procedure','other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {form.items.length > 1 && (
              <button type="button" className="btn btn-danger btn-sm btn-icon" style={{ marginTop:'1.5rem' }} onClick={() => removeItem(i)}>✕</button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginBottom: '1.5rem' }}>
          <Plus size={14}/> Add Item
        </button>

        <div className="billing-total">
          Total: <strong style={{ color: 'var(--color-accent)', fontSize: '1.25rem' }}>{total.toLocaleString()} ETB</strong>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <ReceiptText size={16}/> {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
