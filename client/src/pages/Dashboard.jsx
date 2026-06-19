import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const RANGE_TARGETS = { today: 1.9, week: 9.5, month: 38, year: 456 };
const RANGE_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' };

export default function Dashboard() {
  const { user, canViewBilling } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('personal');
  const [range, setRange] = useState('today');
  const [stats, setStats] = useState(null);
  const [agendaHidden, setAgendaHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const hours = stats?.hours?.[range] || 0;
  const target = RANGE_TARGETS[range];
  const pct = Math.min(hours / target, 1);
  const circ = 2 * Math.PI * 82;
  const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

  if (loading) return <div className="empty-state"><p>Loading dashboard...</p></div>;

  return (
    <div>
      <div className="tabs">
        {[['personal', 'Personal Dashboard'], ['firm', 'Firm Dashboard'], ['feed', 'Firm Feed']].map(([k, l]) => (
          <button key={k} className={`tab ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {/* ========== PERSONAL DASHBOARD ========== */}
      {activeTab === 'personal' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Today's Agenda</h2>
            <button className="stat-link" onClick={() => setAgendaHidden(!agendaHidden)}>{agendaHidden ? 'Show' : 'Hide'}</button>
          </div>
          {!agendaHidden && (
            <div className="agenda-grid">
              <div className="agenda-card">
                <div className="agenda-stat">
                  <span className="agenda-num">{stats?.overdueDeadlines || 0}</span>
                  <span className="agenda-label">Tasks Due Today</span>
                </div>
                <div className="agenda-msg">{stats?.todayEvents?.length ? stats.todayEvents.map(e => e.title).join(', ') : 'No tasks due today'}</div>
              </div>
              <div className="agenda-card">
                <div className="agenda-stat">
                  <span className="agenda-num">{stats?.todayEvents?.length || 0}</span>
                  <span className="agenda-label">Calendar Events</span>
                </div>
                <div className="agenda-msg">{stats?.todayEvents?.length ? stats.todayEvents.map(e => e.title).join(', ') : 'No events scheduled'}</div>
              </div>
            </div>
          )}

          <div className="metrics-row">
            <div>
              <h2 className="section-title"><span className="help">?</span>Hourly Metrics for {user?.firstName} {user?.lastName}</h2>
              <div className="card billable-card">
                <h3 className="billable-head">Billable Hours Target</h3>
                <div className="range-tabs">
                  {Object.keys(RANGE_LABELS).map(r => (
                    <button key={r} className={`range-tab ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{RANGE_LABELS[r]}</button>
                  ))}
                </div>
                <div className="gauge-wrap">
                  <div className="gauge">
                    <svg viewBox="0 0 200 200">
                      <circle className="gauge-track" cx="100" cy="100" r="82" />
                      <circle className="gauge-fill" cx="100" cy="100" r="82" strokeDasharray={`${pct * circ} ${circ}`} />
                    </svg>
                    <div className="gauge-center">
                      <span className="gauge-hours">{hours.toFixed(1)} Hours</span>
                      <span className="gauge-target">{target} Hours</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {canViewBilling && (
              <div>
                <h2 className="section-title"><span className="help">?</span>Billing Metrics for Firm</h2>
                <div className="billing-grid">
                  {[
                    { title: 'Draft Bills', val: stats?.billing?.draft?.count || 0, cls: 'zero' },
                    { title: 'Total in Draft', val: stats?.billing?.draft?.total ? fmtMoney(stats.billing.draft.total) : '—', isMoney: true },
                    { title: 'Unpaid Bills', val: stats?.billing?.unpaid?.count || 0, cls: 'zero' },
                    { title: 'Total in Unpaid', val: stats?.billing?.unpaid?.total ? fmtMoney(stats.billing.unpaid.total) : '—', isMoney: true },
                    { title: 'Overdue Bills', val: stats?.billing?.overdue?.count || 0, cls: 'danger' },
                    { title: 'Total in Overdue', val: stats?.billing?.overdue?.total ? fmtMoney(stats.billing.overdue.total) : '—', isMoney: true, cls: 'danger' },
                  ].map((item, i) => (
                    <div key={i} className={`stat-card ${item.isMoney ? 'total' : ''}`} onClick={() => navigate('/billing')} style={{ cursor: 'pointer' }}>
                      <span className="stat-title">{item.title}</span>
                      <span className={item.isMoney ? (item.val === '—' ? 'total-dash' : `stat-value ${item.cls || ''}`) : `stat-value ${item.cls || ''}`}>{item.val}</span>
                      <div className="stat-foot"><button className="view-link">View →</button></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== FIRM DASHBOARD ========== */}
      {activeTab === 'firm' && (
        <>
          <div className="stats-cards-row">
            <div className="kpi-card"><div className="kpi-label">Active Matters</div><div className="kpi-value">{stats?.activeMatters || 0}</div></div>
            <div className="kpi-card"><div className="kpi-label">Pending Leads</div><div className="kpi-value amber">{stats?.pendingLeads || 0}</div></div>
            <div className="kpi-card"><div className="kpi-label">Total Clients</div><div className="kpi-value">{stats?.totalClients || 0}</div></div>
            <div className="kpi-card"><div className="kpi-label">Collected (YTD)</div><div className="kpi-value green">{fmtMoney(stats?.billing?.collectedYTD)}</div></div>
          </div>

          {/* Overdue Deadlines */}
          {stats?.overdueDeadlinesList?.length > 0 && (
            <DashSection title="Overdue Deadlines" color="var(--red-600)" count={stats.overdueDeadlinesList.length}>
              {stats.overdueDeadlinesList.map(d => (
                <DashRow key={d._id} onClick={() => navigate('/tasks')}>
                  <span style={{ fontWeight: 700 }}>{d.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>{d.matter?.name || '—'}</span>
                  <span className="badge overdue">Due {new Date(d.startDate).toLocaleDateString()}</span>
                </DashRow>
              ))}
            </DashSection>
          )}

          {/* Overdue Invoices */}
          {stats?.overdueInvoicesList?.length > 0 && (
            <DashSection title="Overdue Invoices" color="var(--red-600)" count={stats.overdueInvoicesList.length}>
              {stats.overdueInvoicesList.map(inv => (
                <DashRow key={inv._id} onClick={() => navigate('/billing')}>
                  <span style={{ fontWeight: 700 }}>{inv.invoiceNumber}</span>
                  <span style={{ fontSize: 13 }}>{inv.client?.firstName} {inv.client?.lastName} — {inv.matter?.name}</span>
                  <span className="badge overdue">{fmtMoney(inv.balanceDue)} due {new Date(inv.dueDate).toLocaleDateString()}</span>
                </DashRow>
              ))}
            </DashSection>
          )}

          {/* Retainer Alerts */}
          {stats?.retainerAlerts?.length > 0 && (
            <DashSection title="Retainer Not Collected" color="var(--amber-600)" count={stats.retainerAlerts.length}>
              {stats.retainerAlerts.map(m => (
                <DashRow key={m._id} onClick={() => navigate('/matters')}>
                  <span style={{ fontWeight: 700 }}>{m.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>{m.client?.firstName} {m.client?.lastName} · {m.totalBilledHours?.toFixed(1)} hrs logged</span>
                  <span className="badge pending">Retainer: {fmtMoney(m.retainer?.currentBalance || 0)}</span>
                </DashRow>
              ))}
            </DashSection>
          )}

          {/* Inactive Matters */}
          {stats?.inactiveMatters?.length > 0 && (
            <DashSection title={`No Activity in ${stats.inactivityDays}+ Days`} color="var(--ink-400)" count={stats.inactiveMatters.length}>
              {stats.inactiveMatters.map(m => (
                <DashRow key={m._id} onClick={() => navigate('/matters')}>
                  <span style={{ fontWeight: 700 }}>{m.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>{m.client?.firstName} {m.client?.lastName}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>Last: {m.lastActivityDate ? new Date(m.lastActivityDate).toLocaleDateString() : 'Never'}</span>
                </DashRow>
              ))}
            </DashSection>
          )}

          {/* Pending Leads */}
          {stats?.pendingLeadsList?.length > 0 && (
            <DashSection title="Pending Leads" color="var(--blue-600)" count={stats.pendingLeadsList.length}>
              {stats.pendingLeadsList.map(l => (
                <DashRow key={l._id} onClick={() => navigate('/leads')}>
                  <span style={{ fontWeight: 700 }}>{l.firstName} {l.lastName}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>{l.practiceArea} · {l.source}</span>
                  <span className={`badge ${l.status}`}>{l.status}</span>
                </DashRow>
              ))}
            </DashSection>
          )}

          {!stats?.overdueDeadlinesList?.length && !stats?.overdueInvoicesList?.length && !stats?.retainerAlerts?.length && !stats?.inactiveMatters?.length && !stats?.pendingLeadsList?.length && (
            <div className="empty-state" style={{ marginTop: 20 }}><p>All clear — no alerts or items requiring attention.</p></div>
          )}
        </>
      )}

      {/* ========== FIRM FEED ========== */}
      {activeTab === 'feed' && (
        <>
          <h2 className="section-title"><span className="help">?</span>Recent Firm Activity</h2>
          {stats?.recentActivity?.length > 0 ? (
            <div className="card" style={{ padding: '6px 0' }}>
              {stats.recentActivity.map((a, i) => (
                <div key={i} className="feed-item">
                  <span className="feed-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div className="feed-body">
                    <div className="feed-text"><b>{a.title}</b>{a.description ? ` — ${a.description.substring(0, 120)}` : ''}</div>
                    <div className="feed-time">
                      {a.createdBy?.firstName} {a.createdBy?.lastName} · {a.matter?.name || ''} · {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>No recent activity.</p></div>
          )}
        </>
      )}
    </div>
  );
}

function DashSection({ title, color, count, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {title}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-400)', background: '#f0f0f5', padding: '2px 8px', borderRadius: 6 }}>{count}</span>
      </h3>
      <div className="card" style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function DashRow({ children, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer',
      transition: '.15s background'
    }} onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
       onMouseLeave={e => e.currentTarget.style.background = ''}>
      {children}
    </div>
  );
}
