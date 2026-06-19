import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

const TIMELINE_ICONS = {
  matter_created: 'M12 5v14M5 12h14',
  status_change: 'M9 6h11M9 12h11M9 18h11',
  note_added: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
  document_uploaded: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
  time_entry: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v4l2.5 2.5',
  fixed_charge: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  invoice_created: 'M3 6h18v13H3zM3 10h18M7 14h4',
  invoice_sent: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  payment_received: 'M5 13l4 4L19 7',
  message_sent: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  message_received: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  deadline_set: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  deadline_completed: 'M5 13l4 4L19 7',
  event_scheduled: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  client_contact: 'M12 8a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 12 8ZM5 20c0-3.5 3.1-6 7-6s7 2.5 7 6',
  custom: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z'
};

export default function MatterDetail({ matterId, onBack }) {
  const { canViewBilling } = useAuth();
  const toast = useToast();
  const [matter, setMatter] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [mRes, tRes] = await Promise.all([
          api.get(`/matters/${matterId}`),
          api.get(`/timeline/${matterId}`)
        ]);
        setMatter(mRes.data.data);
        setTimeline(tRes.data.data);
      } catch (err) {
        toast('Failed to load matter');
        onBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matterId]);

  if (loading || !matter) return <div className="empty-state"><p>Loading...</p></div>;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

  const retainerLabel = () => {
    if (!matter.retainer || matter.retainer.type === 'none') return 'None';
    return `${matter.retainer.type.charAt(0).toUpperCase() + matter.retainer.type.slice(1)} — ${fmtMoney(matter.retainer.currentBalance)} / ${fmtMoney(matter.retainer.amount)}`;
  };

  return (
    <div>
      <button className="detail-back" onClick={onBack}>← Back to Matters</button>

      <div className="detail-header">
        <div>
          <h1>{matter.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span className={`badge ${matter.status}`}>{matter.customStatus || matter.status}</span>
            <span className="badge" style={{ background: '#f0f0f5', color: 'var(--ink-600)' }}>{matter.matterNumber}</span>
            <span className="badge" style={{ background: '#f0f0f5', color: 'var(--ink-600)' }}>{matter.billingType?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Matter Summary Block — auto-updates from timeline data, not manually edited */}
      <div className="summary-block">
        <div className="summary-grid">
          <div>
            <div className="detail-field-label">Status</div>
            <div className="detail-field-value"><span className={`badge ${matter.status}`}>{matter.status}</span></div>
          </div>
          <div>
            <div className="detail-field-label">Retainer Status</div>
            <div className="detail-field-value" style={{ fontSize: 13 }}>{retainerLabel()}</div>
          </div>
          <div>
            <div className="detail-field-label">Last Activity</div>
            <div className="detail-field-value">{fmtDate(matter.lastActivityDate)}</div>
          </div>
          <div>
            <div className="detail-field-label">Next Deadline</div>
            <div className="detail-field-value" style={{ color: matter.nextDeadline && new Date(matter.nextDeadline) < new Date() ? 'var(--red-600)' : undefined }}>
              {fmtDate(matter.nextDeadline)}
            </div>
          </div>
          <div>
            <div className="detail-field-label">Last Client Contact</div>
            <div className="detail-field-value">{fmtDate(matter.lastClientContactDate)}</div>
          </div>
          <div>
            <div className="detail-field-label">Total Hours</div>
            <div className="detail-field-value">{(matter.totalBilledHours || 0).toFixed(1)} hrs</div>
          </div>
          {canViewBilling && (
            <div>
              <div className="detail-field-label">Outstanding Balance</div>
              <div className="detail-field-value">{matter.outstandingBalance ? fmtMoney(matter.outstandingBalance) : '—'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {['summary', 'timeline'].map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="card" style={{ padding: 24 }}>
          <div className="detail-grid">
            <div><div className="detail-field-label">Client</div><div className="detail-field-value">{matter.client?.firstName} {matter.client?.lastName}</div></div>
            <div><div className="detail-field-label">Practice Area</div><div className="detail-field-value">{matter.practiceArea}</div></div>
            <div><div className="detail-field-label">Responsible Attorney</div><div className="detail-field-value">{matter.responsibleAttorney?.firstName} {matter.responsibleAttorney?.lastName}</div></div>
            <div><div className="detail-field-label">Open Date</div><div className="detail-field-value">{fmtDate(matter.openDate)}</div></div>
            {matter.closeDate && (
              <div><div className="detail-field-label">Close Date</div><div className="detail-field-value">{fmtDate(matter.closeDate)}</div></div>
            )}
            <div><div className="detail-field-label">Billing Type</div><div className="detail-field-value" style={{ textTransform: 'capitalize' }}>{matter.billingType?.replace('_', ' ')}</div></div>
            {matter.opposingParty && (
              <div><div className="detail-field-label">Opposing Party</div><div className="detail-field-value">{matter.opposingParty}</div></div>
            )}
            {matter.opposingCounsel && (
              <div><div className="detail-field-label">Opposing Counsel</div><div className="detail-field-value">{matter.opposingCounsel}</div></div>
            )}
            {matter.courtName && (
              <div><div className="detail-field-label">Court</div><div className="detail-field-value">{matter.courtName}</div></div>
            )}
            {matter.caseNumber && (
              <div><div className="detail-field-label">Case Number</div><div className="detail-field-value">{matter.caseNumber}</div></div>
            )}
            {matter.judge && (
              <div><div className="detail-field-label">Judge</div><div className="detail-field-value">{matter.judge}</div></div>
            )}
          </div>
          {matter.description && (
            <div style={{ marginTop: 20 }}>
              <div className="detail-field-label">Description</div>
              <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{matter.description}</div>
            </div>
          )}
          {matter.authorizedUsers?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="detail-field-label">Authorized Users</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {matter.authorizedUsers.map(u => (
                  <span key={u._id} className="badge open">{u.firstName} {u.lastName}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800 }}>Matter Timeline</h3>
          {timeline.length === 0 ? (
            <div className="empty-state"><p>No timeline entries yet.</p></div>
          ) : (
            <div className="timeline">
              {timeline.map(entry => (
                <div key={entry._id} className="timeline-item" style={{ opacity: entry.isSuperseded ? 0.5 : 1 }}>
                  <div className="timeline-dot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="2">
                      <path d={TIMELINE_ICONS[entry.entryType] || TIMELINE_ICONS.custom} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="timeline-title">{entry.title}</div>
                  {entry.description && <div className="timeline-desc">{entry.description}</div>}
                  <div className="timeline-meta">
                    {entry.createdBy?.firstName} {entry.createdBy?.lastName} · {new Date(entry.createdAt).toLocaleString()}
                    {entry.isSuperseded && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>(superseded)</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
