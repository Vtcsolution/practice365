import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';

const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Billing() {
  const { isAttorney, canViewBilling } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('time');
  const [timeEntries, setTimeEntries] = useState([]);
  const [fixedCharges, setFixedCharges] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewTime, setShowNewTime] = useState(false);
  const [showNewCharge, setShowNewCharge] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showInvoice, setShowInvoice] = useState(null);
  const [showAdjustment, setShowAdjustment] = useState(null);

  // Forms
  const [timeForm, setTimeForm] = useState({ matter: '', durationMinutes: 60, clientDescription: '', internalNote: '', date: new Date().toISOString().slice(0, 10) });
  const [chargeForm, setChargeForm] = useState({ matter: '', amount: '', clientDescription: '', internalNote: '', isBillable: true, date: new Date().toISOString().slice(0, 10) });
  const [genForm, setGenForm] = useState({ matterId: '', periodStart: '', periodEnd: '', dueDate: '' });
  const [adjForm, setAdjForm] = useState({ description: '', amount: 0, type: 'adjustment' });

  const fetchAll = async () => {
    try {
      const [teRes, fcRes, invRes, mRes] = await Promise.all([
        api.get('/time-entries'),
        api.get('/fixed-charges'),
        api.get('/invoices'),
        api.get('/matters')
      ]);
      setTimeEntries(teRes.data.data);
      setFixedCharges(fcRes.data.data);
      setInvoices(invRes.data.data);
      setMatters(mRes.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Time entry
  const saveTimeEntry = async () => {
    if (!timeForm.matter || !timeForm.clientDescription) { toast('Matter and description required'); return; }
    try {
      await api.post('/time-entries', { ...timeForm, durationMinutes: parseInt(timeForm.durationMinutes) });
      toast('Time entry saved');
      setShowNewTime(false);
      fetchAll();
    } catch (err) { toast(err.response?.data?.message || 'Failed'); }
  };

  // Fixed charge
  const saveCharge = async () => {
    if (!chargeForm.matter || !chargeForm.amount || !chargeForm.clientDescription) { toast('Fill required fields'); return; }
    try {
      await api.post('/fixed-charges', { ...chargeForm, amount: parseFloat(chargeForm.amount) });
      toast('Fixed charge saved');
      setShowNewCharge(false);
      fetchAll();
    } catch (err) { toast(err.response?.data?.message || 'Failed'); }
  };

  // Generate invoice
  const generateInvoice = async () => {
    if (!genForm.matterId) { toast('Select a matter'); return; }
    try {
      const res = await api.post('/invoices/generate', genForm);
      toast(`Invoice ${res.data.data.invoiceNumber} created`);
      setShowGenerate(false);
      fetchAll();
    } catch (err) { toast(err.response?.data?.message || 'Failed'); }
  };

  // Finalize
  const finalize = async (id) => {
    try {
      await api.put(`/invoices/${id}/finalize`);
      toast('Invoice finalized & sent');
      setShowInvoice(null);
      fetchAll();
    } catch (err) { toast(err.response?.data?.message || 'Failed'); }
  };

  // Void
  const voidInv = async (id) => {
    try {
      await api.put(`/invoices/${id}/void`);
      toast('Invoice voided');
      setShowInvoice(null);
      fetchAll();
    } catch (err) { toast(err.response?.data?.message || 'Failed'); }
  };

  // Adjustment
  const saveAdjustment = async () => {
    if (!adjForm.description) { toast('Description required'); return; }
    try {
      await api.post(`/invoices/${showAdjustment}/adjustment`, adjForm);
      toast('Adjustment added');
      setShowAdjustment(null);
      fetchAll();
    } catch (err) { toast(err.response?.data?.message || 'Failed'); }
  };

  const openNew = (type) => {
    if (type === 'time') {
      setTimeForm({ matter: matters[0]?._id || '', durationMinutes: 60, clientDescription: '', internalNote: '', date: new Date().toISOString().slice(0, 10) });
      setShowNewTime(true);
    } else {
      setChargeForm({ matter: matters[0]?._id || '', amount: '', clientDescription: '', internalNote: '', isBillable: true, date: new Date().toISOString().slice(0, 10) });
      setShowNewCharge(true);
    }
  };

  // Stats
  const draftTotal = invoices.filter(i => i.status === 'draft').reduce((s, i) => s + (i.total || 0), 0);
  const unpaidTotal = invoices.filter(i => ['sent', 'partially_paid'].includes(i.status)).reduce((s, i) => s + (i.balanceDue || 0), 0);
  const overdueTotal = invoices.filter(i => ['sent', 'partially_paid'].includes(i.status) && new Date(i.dueDate) < new Date()).reduce((s, i) => s + (i.balanceDue || 0), 0);
  const collectedTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);

  if (!canViewBilling) {
    return <div className="empty-state"><p>You don't have permission to view billing information.</p></div>;
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Billing</h1><div className="sub">Time tracking, fixed charges, and invoicing</div></div>
      </div>

      <div className="stats-cards-row">
        <div className="kpi-card"><div className="kpi-label">Draft</div><div className="kpi-value">{fmtMoney(draftTotal)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Unpaid</div><div className="kpi-value amber">{fmtMoney(unpaidTotal)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Overdue</div><div className="kpi-value red">{fmtMoney(overdueTotal)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Collected (YTD)</div><div className="kpi-value green">{fmtMoney(collectedTotal)}</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {[['time', 'Time Entries'], ['charges', 'Fixed Charges'], ['invoices', 'Invoices']].map(([k, l]) => (
          <button key={k} className={`tab ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="empty-state"><p>Loading...</p></div> : (
        <>
          {/* ===== TIME ENTRIES TAB ===== */}
          {activeTab === 'time' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn-primary-pill" onClick={() => openNew('time')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  Manual entry
                </button>
              </div>
              {timeEntries.length === 0 ? (
                <div className="empty-state"><p>No time entries yet. Use the timer or add a manual entry.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Matter</th><th>Description</th><th>Duration</th><th>Rate</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {timeEntries.map(te => (
                      <tr key={te._id}>
                        <td data-label="Date" style={{ fontSize: 13 }}>{new Date(te.date).toLocaleDateString()}</td>
                        <td data-label="Matter" style={{ fontSize: 13 }}>{te.matter?.name || '—'}</td>
                        <td data-label="Description">
                          <div>{te.clientDescription}</div>
                          {te.internalNote && <div style={{ fontSize: 11, color: 'var(--ink-400)', fontStyle: 'italic', marginTop: 2 }}>🔒 {te.internalNote}</div>}
                        </td>
                        <td data-label="Duration" className="mono" style={{ fontSize: 13 }}>{Math.floor(te.durationMinutes / 60)}h {te.durationMinutes % 60}m</td>
                        <td data-label="Rate">{fmtMoney(te.billingRate)}/hr</td>
                        <td data-label="Amount" style={{ fontWeight: 700 }}>{fmtMoney(te.lineAmount)}</td>
                        <td data-label="Status"><span className={`badge ${te.isBilled ? 'sent' : 'open'}`}>{te.isBilled ? 'Billed' : 'Unbilled'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ===== FIXED CHARGES TAB ===== */}
          {activeTab === 'charges' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn-primary-pill" onClick={() => openNew('charge')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  New fixed charge
                </button>
              </div>
              {fixedCharges.length === 0 ? (
                <div className="empty-state"><p>No fixed charges yet.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Matter</th><th>Description</th><th>Amount</th><th>Billable</th><th>Status</th></tr></thead>
                  <tbody>
                    {fixedCharges.map(fc => (
                      <tr key={fc._id}>
                        <td data-label="Date" style={{ fontSize: 13 }}>{new Date(fc.date).toLocaleDateString()}</td>
                        <td data-label="Matter" style={{ fontSize: 13 }}>{fc.matter?.name || '—'}</td>
                        <td data-label="Description">
                          <div>{fc.clientDescription}</div>
                          {fc.internalNote && <div style={{ fontSize: 11, color: 'var(--ink-400)', fontStyle: 'italic', marginTop: 2 }}>🔒 {fc.internalNote}</div>}
                        </td>
                        <td data-label="Amount" style={{ fontWeight: 700 }}>{fmtMoney(fc.amount)}</td>
                        <td data-label="Billable"><span className={`badge ${fc.isBillable ? 'open' : 'closed'}`}>{fc.isBillable ? 'Yes' : 'No'}</span></td>
                        <td data-label="Status"><span className={`badge ${fc.isBilled ? 'sent' : 'open'}`}>{fc.isBilled ? 'Billed' : 'Unbilled'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ===== INVOICES TAB ===== */}
          {activeTab === 'invoices' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                {isAttorney && (
                  <button className="btn-primary-pill" onClick={() => { setGenForm({ matterId: matters[0]?._id || '', periodStart: '', periodEnd: '', dueDate: '' }); setShowGenerate(true); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                    Generate invoice
                  </button>
                )}
              </div>
              {invoices.length === 0 ? (
                <div className="empty-state"><p>No invoices yet.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Invoice #</th><th>Client</th><th>Matter</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {invoices.map(inv => {
                      const overdue = ['sent', 'partially_paid'].includes(inv.status) && new Date(inv.dueDate) < new Date();
                      return (
                        <tr key={inv._id} onClick={() => setShowInvoice(inv)}>
                          <td data-label="Invoice #" style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                          <td data-label="Client">{inv.client?.firstName} {inv.client?.lastName}</td>
                          <td data-label="Matter" style={{ fontSize: 13 }}>{inv.matter?.name}</td>
                          <td data-label="Amount" style={{ fontWeight: 700 }}>{fmtMoney(inv.total)}</td>
                          <td data-label="Paid">{fmtMoney(inv.amountPaid)}</td>
                          <td data-label="Balance" style={{ fontWeight: 700, color: inv.balanceDue > 0 ? 'var(--red-600)' : undefined }}>{fmtMoney(inv.balanceDue)}</td>
                          <td data-label="Due" style={{ fontSize: 13 }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                          <td data-label="Status"><span className={`badge ${overdue ? 'overdue' : inv.status}`}>{overdue ? 'Overdue' : inv.status}</span></td>
                          <td data-label="">
                            <div className="row-actions" onClick={e => e.stopPropagation()}>
                              <button className="row-icon-btn" onClick={() => setShowInvoice(inv)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== NEW TIME ENTRY MODAL ===== */}
      {showNewTime && (
        <Modal onClose={() => setShowNewTime(false)}>
          <h3>Manual time entry</h3>
          <p className="sub">Log time manually with two separate description fields.</p>
          <div className="field">
            <label>Matter *</label>
            <select value={timeForm.matter} onChange={e => setTimeForm(f => ({ ...f, matter: e.target.value }))}>
              {matters.map(m => <option key={m._id} value={m._id}>{m.name} ({m.billingType})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Duration (minutes) *</label><input type="number" min="1" value={timeForm.durationMinutes} onChange={e => setTimeForm(f => ({ ...f, durationMinutes: e.target.value }))} /></div>
            <div className="field"><label>Date</label><input type="date" value={timeForm.date} onChange={e => setTimeForm(f => ({ ...f, date: e.target.value }))} /></div>
          </div>
          <div className="field"><label>Client-Facing Description *</label><input value={timeForm.clientDescription} onChange={e => setTimeForm(f => ({ ...f, clientDescription: e.target.value }))} placeholder="Appears on invoices" /></div>
          <div className="field"><label>Internal Note <span style={{ fontWeight: 400, color: 'var(--ink-400)' }}>(never on invoices)</span></label><textarea value={timeForm.internalNote} onChange={e => setTimeForm(f => ({ ...f, internalNote: e.target.value }))} rows={2} placeholder="Private notes..." /></div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowNewTime(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTimeEntry}>Save entry</button>
          </div>
        </Modal>
      )}

      {/* ===== NEW FIXED CHARGE MODAL ===== */}
      {showNewCharge && (
        <Modal onClose={() => setShowNewCharge(false)}>
          <h3>New fixed charge</h3>
          <p className="sub">Add a flat-amount charge to a matter.</p>
          <div className="field">
            <label>Matter *</label>
            <select value={chargeForm.matter} onChange={e => setChargeForm(f => ({ ...f, matter: e.target.value }))}>
              {matters.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Amount ($) *</label><input type="number" min="0" step="0.01" value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="field"><label>Date</label><input type="date" value={chargeForm.date} onChange={e => setChargeForm(f => ({ ...f, date: e.target.value }))} /></div>
          </div>
          <div className="field"><label>Client-Facing Description *</label><input value={chargeForm.clientDescription} onChange={e => setChargeForm(f => ({ ...f, clientDescription: e.target.value }))} placeholder="Appears on invoices" /></div>
          <div className="field"><label>Internal Note <span style={{ fontWeight: 400, color: 'var(--ink-400)' }}>(never on invoices)</span></label><textarea value={chargeForm.internalNote} onChange={e => setChargeForm(f => ({ ...f, internalNote: e.target.value }))} rows={2} /></div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={chargeForm.isBillable} onChange={e => setChargeForm(f => ({ ...f, isBillable: e.target.checked }))} style={{ width: 'auto' }} id="billableCheck" />
            <label htmlFor="billableCheck" style={{ margin: 0, cursor: 'pointer' }}>Billable</label>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowNewCharge(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveCharge}>Save charge</button>
          </div>
        </Modal>
      )}

      {/* ===== GENERATE INVOICE MODAL ===== */}
      {showGenerate && (
        <Modal onClose={() => setShowGenerate(false)}>
          <h3>Generate invoice</h3>
          <p className="sub">Pull unbilled time entries and billable fixed charges into a draft invoice.</p>
          <div className="field">
            <label>Matter *</label>
            <select value={genForm.matterId} onChange={e => setGenForm(f => ({ ...f, matterId: e.target.value }))}>
              {matters.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Period Start</label><input type="date" value={genForm.periodStart} onChange={e => setGenForm(f => ({ ...f, periodStart: e.target.value }))} /></div>
            <div className="field"><label>Period End</label><input type="date" value={genForm.periodEnd} onChange={e => setGenForm(f => ({ ...f, periodEnd: e.target.value }))} /></div>
          </div>
          <div className="field"><label>Due Date</label><input type="date" value={genForm.dueDate} onChange={e => setGenForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowGenerate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={generateInvoice}>Generate Draft</button>
          </div>
        </Modal>
      )}

      {/* ===== INVOICE DETAIL MODAL ===== */}
      {showInvoice && (
        <Modal onClose={() => setShowInvoice(null)}>
          <h3>Invoice {showInvoice.invoiceNumber}</h3>
          <p className="sub">{showInvoice.client?.firstName} {showInvoice.client?.lastName} · {showInvoice.matter?.name}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><div className="detail-field-label">Status</div><span className={`badge ${showInvoice.status}`}>{showInvoice.status}</span></div>
            <div><div className="detail-field-label">Total</div><div style={{ fontWeight: 800, fontSize: 18 }}>{fmtMoney(showInvoice.total)}</div></div>
            <div><div className="detail-field-label">Balance Due</div><div style={{ fontWeight: 800, fontSize: 18, color: showInvoice.balanceDue > 0 ? 'var(--red-600)' : 'var(--green-600)' }}>{fmtMoney(showInvoice.balanceDue)}</div></div>
          </div>
          {showInvoice.dueDate && <div style={{ fontSize: 13, color: 'var(--ink-400)', marginBottom: 12 }}>Due: {new Date(showInvoice.dueDate).toLocaleDateString()}{showInvoice.isFinalized ? ` · Finalized: ${new Date(showInvoice.finalizedAt).toLocaleDateString()}` : ''}</div>}

          {/* Line items — Internal Notes NEVER shown */}
          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 700, color: 'var(--ink-400)', fontSize: 11, textTransform: 'uppercase' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 700, color: 'var(--ink-400)', fontSize: 11, textTransform: 'uppercase' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 700, color: 'var(--ink-400)', fontSize: 11, textTransform: 'uppercase' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 700, color: 'var(--ink-400)', fontSize: 11, textTransform: 'uppercase' }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 700, color: 'var(--ink-400)', fontSize: 11, textTransform: 'uppercase' }}>Amount</th>
              </tr></thead>
              <tbody>
                {showInvoice.lineItems?.map((li, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 4px' }}>{li.date ? new Date(li.date).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '8px 4px' }}>{li.description}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{li.quantity ? `${li.quantity.toFixed(2)} hrs` : '—'}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{li.rate ? fmtMoney(li.rate) : '—'}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span style={{ fontWeight: 700 }}>{fmtMoney(showInvoice.subtotal)}</span></div>
            {showInvoice.adjustments !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Adjustments</span><span style={{ fontWeight: 700 }}>{fmtMoney(showInvoice.adjustments)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}><span>Total</span><span>{fmtMoney(showInvoice.total)}</span></div>
          </div>

          <div className="modal-actions" style={{ marginTop: 16 }}>
            {showInvoice.status === 'draft' && isAttorney && (
              <button className="btn btn-primary" onClick={() => finalize(showInvoice._id)}>Finalize & Send</button>
            )}
            {showInvoice.isFinalized && isAttorney && (
              <button className="btn btn-ghost" onClick={() => { setAdjForm({ description: '', amount: 0, type: 'adjustment' }); setShowAdjustment(showInvoice._id); setShowInvoice(null); }}>Add Adjustment</button>
            )}
            {showInvoice.status !== 'paid' && showInvoice.status !== 'void' && isAttorney && (
              <button className="btn btn-ghost" style={{ color: 'var(--red-600)' }} onClick={() => voidInv(showInvoice._id)}>Void</button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowInvoice(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* ===== ADJUSTMENT MODAL ===== */}
      {showAdjustment && (
        <Modal onClose={() => setShowAdjustment(null)}>
          <h3>Add adjustment</h3>
          <p className="sub">Add a credit or adjustment to a finalized invoice.</p>
          <div className="field">
            <label>Type</label>
            <select value={adjForm.type} onChange={e => setAdjForm(f => ({ ...f, type: e.target.value }))}>
              <option value="adjustment">Adjustment</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="field"><label>Description *</label><input value={adjForm.description} onChange={e => setAdjForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Courtesy discount" /></div>
          <div className="field"><label>Amount ($) <span style={{ fontWeight: 400, color: 'var(--ink-400)' }}>(negative for credit)</span></label><input type="number" step="0.01" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowAdjustment(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveAdjustment}>Save adjustment</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
