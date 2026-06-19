import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';

export default function Contacts() {
  const { isAttorney } = useAuth();
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ firstName: '', lastName: '', email: '', phone: '', clientType: 'individual', company: '' });

  const fetchClients = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const res = await api.get('/clients', { params });
      setClients(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [search]);

  const openDetail = async (id) => {
    const res = await api.get(`/clients/${id}`);
    setSelected(res.data.data);
  };

  const saveNew = async () => {
    if (!newForm.firstName || !newForm.lastName || !newForm.email) {
      toast('Fill required fields'); return;
    }
    try {
      await api.post('/clients', newForm);
      toast('Client created');
      setShowNew(false);
      setNewForm({ firstName: '', lastName: '', email: '', phone: '', clientType: 'individual', company: '' });
      fetchClients();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  if (selected) {
    const c = selected;
    return (
      <div>
        <button className="detail-back" onClick={() => setSelected(null)}>← Back to Contacts</button>
        <div className="detail-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="avatar" style={{ width: 48, height: 48, fontSize: 18 }}>{c.firstName?.[0]}{c.lastName?.[0]}</span>
            <div>
              <h1>{c.firstName} {c.lastName}</h1>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span className={`badge ${c.clientType === 'individual' ? 'open' : 'pending'}`}>{c.clientType}</span>
                {c.portalAccess && <span className="badge sent">Portal Access</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div className="detail-grid">
            <div><div className="detail-field-label">Email</div><div className="detail-field-value">{c.email}</div></div>
            <div><div className="detail-field-label">Phone</div><div className="detail-field-value">{c.phone || '—'}</div></div>
            <div><div className="detail-field-label">Company</div><div className="detail-field-value">{c.company || '—'}</div></div>
            <div><div className="detail-field-label">Practice Area</div><div className="detail-field-value">{c.practiceArea || '—'}</div></div>
            {c.address && (
              <div><div className="detail-field-label">Address</div><div className="detail-field-value">{[c.address.street, c.address.city, c.address.state, c.address.zip].filter(Boolean).join(', ') || '—'}</div></div>
            )}
            <div><div className="detail-field-label">Assigned Attorney</div><div className="detail-field-value">{c.assignedAttorney ? `${c.assignedAttorney.firstName} ${c.assignedAttorney.lastName}` : '—'}</div></div>
          </div>
        </div>

        {c.matters?.length > 0 && (
          <>
            <h2 className="section-title">Linked Matters</h2>
            <table className="data-table">
              <thead><tr><th>Matter</th><th>Number</th><th>Status</th><th>Practice Area</th></tr></thead>
              <tbody>
                {c.matters.map(m => (
                  <tr key={m._id}>
                    <td data-label="Matter"><div className="name-cell">{m.name}</div></td>
                    <td data-label="Number">{m.matterNumber}</td>
                    <td data-label="Status"><span className={`badge ${m.status}`}>{m.status}</span></td>
                    <td data-label="Practice Area">{m.practiceArea}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Contacts</h1>
          <div className="sub">{clients.length} contact{clients.length !== 1 ? 's' : ''}</div>
        </div>
        {isAttorney && (
          <button className="btn-primary-pill" onClick={() => setShowNew(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New contact
          </button>
        )}
      </div>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search contacts..." />
      </div>
      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : clients.length === 0 ? (
        <div className="empty-state"><p>No contacts found.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Portal</th><th></th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c._id} onClick={() => openDetail(c._id)}>
                <td data-label="Name">
                  <div className="name-cell">
                    <span className="row-avatar">{c.firstName?.[0]}{c.lastName?.[0]}</span>
                    {c.firstName} {c.lastName}
                  </div>
                </td>
                <td data-label="Email">{c.email}</td>
                <td data-label="Phone">{c.phone || '—'}</td>
                <td data-label="Type"><span className={`badge ${c.clientType === 'individual' ? 'open' : 'pending'}`}>{c.clientType}</span></td>
                <td data-label="Portal">{c.portalAccess ? <span className="badge sent">Yes</span> : '—'}</td>
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
          <h3>New contact</h3>
          <p className="sub">Add a client or contact to your firm directory.</p>
          <div className="field"><label>First Name *</label><input value={newForm.firstName} onChange={e => setNewForm(f => ({ ...f, firstName: e.target.value }))} /></div>
          <div className="field"><label>Last Name *</label><input value={newForm.lastName} onChange={e => setNewForm(f => ({ ...f, lastName: e.target.value }))} /></div>
          <div className="field"><label>Email *</label><input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="field"><label>Phone</label><input value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div className="field"><label>Company</label><input value={newForm.company} onChange={e => setNewForm(f => ({ ...f, company: e.target.value }))} /></div>
          <div className="field">
            <label>Type</label>
            <select value={newForm.clientType} onChange={e => setNewForm(f => ({ ...f, clientType: e.target.value }))}>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveNew}>Save contact</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
