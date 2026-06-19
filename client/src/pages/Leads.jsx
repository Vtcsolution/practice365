import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';

const STATUSES = ['all', 'new', 'contacted', 'engagement_sent', 'converted', 'declined', 'lost'];

export default function Leads() {
  const { isAttorney } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const [reason, setReason] = useState('');

  const fetchLeads = async () => {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const res = await api.get('/leads', { params });
      setLeads(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [filter, search]);

  const changeStatus = async (id, status) => {
    try {
      const body = { status };
      if (status === 'declined' || status === 'lost') body.reason = reason;
      await api.put(`/leads/${id}/status`, body);
      toast(`Lead ${status === 'declined' ? 'declined' : status === 'lost' ? 'marked lost' : 'updated'}`);
      setStatusModal(null);
      setReason('');
      fetchLeads();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const convertLead = async (id) => {
    try {
      await api.post(`/leads/${id}/convert`);
      toast('Lead converted to Client + Matter');
      fetchLeads();
      setShowDetail(false);
    } catch (err) {
      toast(err.response?.data?.message || 'Conversion failed');
    }
  };

  const openDetail = async (id) => {
    const res = await api.get(`/leads/${id}`);
    setSelected(res.data.data);
    setShowDetail(true);
  };

  if (showDetail && selected) {
    const lead = selected;
    const hasConflict = lead.conflictCheckResult?.hasConflict;
    return (
      <div>
        <button className="detail-back" onClick={() => setShowDetail(false)}>
          ← Back to Leads
        </button>
        <div className="detail-header">
          <div>
            <h1>{lead.firstName} {lead.lastName}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <span className={`badge ${lead.status}`}>{lead.status.replace('_', ' ')}</span>
              {hasConflict && <span className="badge conflict">⚠ Conflict</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {lead.status === 'new' && (
              <button className="btn-primary-pill" onClick={() => changeStatus(lead._id, 'contacted')}>Mark Contacted</button>
            )}
            {lead.status === 'contacted' && (
              <button className="btn-primary-pill" onClick={() => changeStatus(lead._id, 'engagement_sent')}>Send Engagement</button>
            )}
            {lead.status === 'engagement_sent' && isAttorney && (
              <button className="btn-primary-pill" onClick={() => convertLead(lead._id)}>Convert to Client</button>
            )}
            {!['converted', 'declined', 'lost'].includes(lead.status) && (
              <>
                <button className="btn btn-ghost" style={{ flex: 'none', padding: '10px 16px' }}
                  onClick={() => setStatusModal({ id: lead._id, type: 'declined' })}>Decline</button>
                <button className="btn btn-ghost" style={{ flex: 'none', padding: '10px 16px', color: 'var(--red-600)' }}
                  onClick={() => setStatusModal({ id: lead._id, type: 'lost' })}>Mark Lost</button>
              </>
            )}
          </div>
        </div>

        {hasConflict && (
          <div style={{ background: 'var(--red-100)', border: '1px solid var(--red-600)', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
            <strong style={{ color: 'var(--red-600)' }}>Conflict Check Alert</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--red-600)' }}>
              {lead.conflictCheckResult.conflictDetails.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}

        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div className="detail-grid">
            <div><div className="detail-field-label">Email</div><div className="detail-field-value">{lead.email}</div></div>
            <div><div className="detail-field-label">Phone</div><div className="detail-field-value">{lead.phone || '—'}</div></div>
            <div><div className="detail-field-label">Practice Area</div><div className="detail-field-value">{lead.practiceArea}</div></div>
            <div><div className="detail-field-label">Source</div><div className="detail-field-value">{lead.source}</div></div>
            <div><div className="detail-field-label">Opposing Party</div><div className="detail-field-value">{lead.opposingPartyName || '—'}</div></div>
            <div><div className="detail-field-label">Assigned To</div><div className="detail-field-value">{lead.assignedTo?.firstName} {lead.assignedTo?.lastName || '—'}</div></div>
          </div>
          {lead.caseDescription && (
            <div style={{ marginTop: 16 }}>
              <div className="detail-field-label">Case Description</div>
              <div className="detail-field-value" style={{ fontWeight: 400 }}>{lead.caseDescription}</div>
            </div>
          )}
        </div>

        {lead.convertedClientId && (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Converted</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', margin: 0 }}>
              Converted to client on {new Date(lead.convertedAt).toLocaleDateString()}.
              <button className="stat-link" style={{ marginLeft: 8 }} onClick={() => navigate('/contacts')}>View Client →</button>
            </p>
          </div>
        )}

        {statusModal && (
          <Modal onClose={() => { setStatusModal(null); setReason(''); }}>
            <h3>{statusModal.type === 'declined' ? 'Decline Lead' : 'Mark as Lost'}</h3>
            <p className="sub">Provide a reason for {statusModal.type === 'declined' ? 'declining' : 'losing'} this lead.</p>
            <div className="field">
              <label>Reason</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter reason..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setStatusModal(null); setReason(''); }}>Cancel</button>
              <button className="btn btn-danger" onClick={() => changeStatus(statusModal.id, statusModal.type)}>
                {statusModal.type === 'declined' ? 'Decline' : 'Mark Lost'}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <div className="sub">{leads.length} lead{leads.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn-primary-pill" onClick={() => navigate('/leads/intake')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          New lead
        </button>
      </div>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search leads..." />
        {STATUSES.map(s => (
          <button key={s} className={`filter-pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : leads.length === 0 ? (
        <div className="empty-state"><p>No leads found.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Practice Area</th><th>Status</th><th>Source</th><th></th></tr></thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead._id} onClick={() => openDetail(lead._id)}>
                <td data-label="Name">
                  <div className="name-cell">
                    <span className="row-avatar">{lead.firstName?.[0]}{lead.lastName?.[0]}</span>
                    {lead.firstName} {lead.lastName}
                    {lead.conflictCheckResult?.hasConflict && <span className="badge conflict" style={{ marginLeft: 6 }}>⚠</span>}
                  </div>
                </td>
                <td data-label="Email">{lead.email}</td>
                <td data-label="Practice Area">{lead.practiceArea}</td>
                <td data-label="Status"><span className={`badge ${lead.status}`}>{lead.status.replace('_', ' ')}</span></td>
                <td data-label="Source">{lead.source}</td>
                <td data-label="">
                  <div className="row-actions">
                    <button className="row-icon-btn" aria-label="View">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
