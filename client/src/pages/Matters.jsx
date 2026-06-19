import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import MatterDetail from '../components/MatterDetail';

export default function Matters() {
  const { isAttorney, canViewBilling } = useAuth();
  const toast = useToast();
  const [matters, setMatters] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [clients, setClients] = useState([]);
  const [newForm, setNewForm] = useState({ name: '', client: '', practiceArea: 'Contract Disputes', status: 'open', billingType: 'hourly', description: '' });

  const fetchMatters = async () => {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const res = await api.get('/matters', { params });
      setMatters(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatters(); }, [filter, search]);

  const openNew = async () => {
    const res = await api.get('/clients');
    setClients(res.data.data || []);
    if (res.data.data?.length) setNewForm(f => ({ ...f, client: res.data.data[0]._id }));
    setShowNew(true);
  };

  const saveNew = async () => {
    if (!newForm.name || !newForm.client) { toast('Name and client required'); return; }
    try {
      await api.post('/matters', newForm);
      toast('Matter created');
      setShowNew(false);
      fetchMatters();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

  if (selectedId) {
    return <MatterDetail matterId={selectedId} onBack={() => { setSelectedId(null); fetchMatters(); }} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Matters</h1>
          <div className="sub">{matters.length} matter{matters.length !== 1 ? 's' : ''}</div>
        </div>
        {isAttorney && (
          <button className="btn-primary-pill" onClick={openNew}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New matter
          </button>
        )}
      </div>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search matters..." />
        {['all', 'open', 'pending', 'closed'].map(s => (
          <button key={s} className={`filter-pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : matters.length === 0 ? (
        <div className="empty-state"><p>No matters found.</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Matter</th><th>Client</th><th>Status</th><th>Practice Area</th>
              <th>Hours</th>{canViewBilling && <th>Balance</th>}<th></th>
            </tr>
          </thead>
          <tbody>
            {matters.map(m => (
              <tr key={m._id} onClick={() => setSelectedId(m._id)}>
                <td data-label="Matter"><div className="name-cell">{m.name}</div></td>
                <td data-label="Client">{m.client?.firstName} {m.client?.lastName}</td>
                <td data-label="Status"><span className={`badge ${m.status}`}>{m.status}</span></td>
                <td data-label="Practice Area">{m.practiceArea}</td>
                <td data-label="Hours">{(m.totalBilledHours || 0).toFixed(1)} hrs</td>
                {canViewBilling && <td data-label="Balance">{m.outstandingBalance ? fmtMoney(m.outstandingBalance) : '—'}</td>}
                <td data-label="">
                  <div className="row-actions">
                    <button className="row-icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <h3>New matter</h3>
          <p className="sub">Create a new matter for a client.</p>
          <div className="field"><label>Matter Name *</label><input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Reyes v. Carter — Personal Injury" /></div>
          <div className="field">
            <label>Client *</label>
            <select value={newForm.client} onChange={e => setNewForm(f => ({ ...f, client: e.target.value }))}>
              {clients.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Practice Area</label>
            <select value={newForm.practiceArea} onChange={e => setNewForm(f => ({ ...f, practiceArea: e.target.value }))}>
              {['Contract Disputes', 'Estate Planning', 'Real Estate', 'Business Formation', 'Family Law', 'Personal Injury', 'Employment Law', 'Immigration', 'Criminal Defense'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Billing Type</label>
            <select value={newForm.billingType} onChange={e => setNewForm(f => ({ ...f, billingType: e.target.value }))}>
              <option value="hourly">Hourly</option>
              <option value="flat_fee">Flat Fee</option>
              <option value="contingency">Contingency</option>
              <option value="pro_bono">Pro Bono</option>
            </select>
          </div>
          <div className="field"><label>Description</label><textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveNew}>Create matter</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
