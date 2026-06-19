import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';

const ACTION_COLORS = {
  create: 'open', update: 'pending', delete: 'overdue', status_change: 'sent',
  login: 'closed', register: 'open', upload: 'open', version_create: 'sent',
  time_entry_create: 'open', invoice_create: 'sent', invoice_finalize: 'sent',
  payment_received: 'converted', payment_failed: 'overdue', message_sent: 'sent',
  lead_convert: 'converted', signature_sent: 'sent', signature_completed: 'converted',
  matter_access_grant: 'open', matter_access_revoke: 'overdue'
};

export default function AuditLog() {
  const { isAttorney } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ entityType: '', action: '', search: '', startDate: '', endDate: '' });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await api.get('/audit-log', { params });
      setLogs(res.data.data);
      setTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [page, filters]);

  if (!isAttorney) return <div className="empty-state"><p>Audit log access restricted to attorneys.</p></div>;

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <div className="page-head">
        <div><h1>Audit Log</h1><div className="sub">{total} entries (append-only)</div></div>
      </div>

      <div className="toolbar">
        <SearchInput value={filters.search} onChange={v => setFilters(f => ({ ...f, search: v }))} placeholder="Search audit log..." />
        <select value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))}
          style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">All types</option>
          {['lead', 'client', 'matter', 'user', 'calendar_event', 'note', 'document', 'time_entry', 'fixed_charge', 'invoice', 'message', 'firm_settings'].map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
        <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
          style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }} />
        <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
          style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }} />
      </div>

      {loading ? <div className="empty-state"><p>Loading...</p></div> : logs.length === 0 ? (
        <div className="empty-state"><p>No audit log entries found.</p></div>
      ) : (
        <>
          <table className="data-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Type</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log._id} style={{ cursor: 'default' }}>
                  <td data-label="Time" style={{ fontSize: 12, whiteSpace: 'nowrap' }} className="mono">{new Date(log.createdAt).toLocaleString()}</td>
                  <td data-label="User" style={{ fontSize: 13 }}>{log.userId?.firstName} {log.userId?.lastName}</td>
                  <td data-label="Action"><span className={`badge ${ACTION_COLORS[log.action] || 'closed'}`}>{log.action.replace(/_/g, ' ')}</span></td>
                  <td data-label="Type" style={{ fontSize: 13 }}>{log.entityType?.replace('_', ' ')}</td>
                  <td data-label="Details" style={{ fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button className="filter-pill" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600 }}>Page {page} of {totalPages}</span>
              <button className="filter-pill" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
