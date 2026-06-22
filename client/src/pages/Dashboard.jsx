import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const RANGE_TARGETS = { today: 1.9, week: 9.5, month: 38, year: 456 };
const RANGE_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' };

function fmtMoney(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtAxis(n) {
  if (n >= 1000) return '$' + (n / 1000).toLocaleString('en-US', { minimumFractionDigits: n >= 10000 ? 0 : 1, maximumFractionDigits: n >= 10000 ? 0 : 1 }) + 'K';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function BarChart({ title, actual, expected, target }) {
  const max = Math.max(actual, expected, target, 1) * 1.15;
  const h = (v) => Math.max((v / max) * 130, 0);
  const mid = max / 2;
  return (
    <div className="card dash-bar-card">
      <h3 className="dash-bar-title">{title}</h3>
      <div className="dash-bar-labels">
        <span>{fmtAxis(max)}</span>
        <span>{fmtAxis(mid)}</span>
        <span>$0.00</span>
      </div>
      <svg viewBox="0 0 160 170" preserveAspectRatio="xMidYMid meet" className="dash-bar-svg">
        <line x1="30" y1="10" x2="150" y2="10" stroke="var(--line)" strokeWidth="0.5" />
        <line x1="30" y1="75" x2="150" y2="75" stroke="var(--line)" strokeWidth="0.5" />
        <line x1="30" y1="140" x2="150" y2="140" stroke="var(--line)" strokeWidth="0.5" />
        <rect x="40" y={140 - h(actual)} width="24" height={h(actual)} fill="var(--blue-600)" rx="3" />
        <rect x="72" y={140 - h(expected)} width="24" height={h(expected)} fill="var(--blue-500)" rx="3" />
        <rect x="104" y={140 - h(target)} width="24" height={h(target)} fill="var(--navy-800)" rx="3" />
        <text x="52" y="158" textAnchor="middle" className="dash-bar-label">Actual</text>
        <text x="84" y="158" textAnchor="middle" className="dash-bar-label">Expected</text>
        <text x="116" y="158" textAnchor="middle" className="dash-bar-label">Target</text>
      </svg>
    </div>
  );
}

function AnnualChart({ data, targetMonthly }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.actual), targetMonthly, 1) * 1.15;
  const w = 500, h = 180, px = 50, py = 10;
  const cw = w - px - 10, ch = h - py - 25;
  const sx = (i) => px + (i / (data.length - 1 || 1)) * cw;
  const sy = (v) => py + ch - (v / max) * ch;
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(d.actual).toFixed(1)}`).join(' ');
  const tgtY = sy(targetMonthly);

  return (
    <div className="card" style={{ padding: '24px 20px' }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', margin: '0 0 8px' }}>Detailed Annual Report</h3>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 10, background: 'var(--navy-800)', borderRadius: 2 }} /> Target
        </span>
        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 10, background: 'var(--blue-600)', borderRadius: 2 }} /> Actual
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }} preserveAspectRatio="xMidYMid meet">
        <text x={px - 6} y={py + 4} textAnchor="end" fontSize="9" fill="var(--ink-400)">{fmtAxis(max)}</text>
        <text x={px - 6} y={py + ch / 2 + 3} textAnchor="end" fontSize="9" fill="var(--ink-400)">{fmtAxis(max / 2)}</text>
        <text x={px - 6} y={py + ch + 4} textAnchor="end" fontSize="9" fill="var(--ink-400)">$0</text>
        <line x1={px} y1={py} x2={px + cw} y2={py} stroke="var(--line)" strokeWidth="0.5" />
        <line x1={px} y1={py + ch / 2} x2={px + cw} y2={py + ch / 2} stroke="var(--line)" strokeWidth="0.5" />
        <line x1={px} y1={py + ch} x2={px + cw} y2={py + ch} stroke="var(--line)" strokeWidth="0.5" />
        <line x1={px} y1={tgtY} x2={px + cw} y2={tgtY} stroke="var(--navy-800)" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.5" />
        <path d={path} fill="none" stroke="var(--blue-600)" strokeWidth="2.5" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={sx(i)} cy={sy(d.actual)} r="4" fill="var(--blue-600)" stroke="#fff" strokeWidth="2" />
            <text x={sx(i)} y={h - 4} textAnchor="middle" fontSize="8" fill="var(--ink-400)">{d.month}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

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

  const rate = stats?.defaultBillingRate || 250;
  const revActual = stats?.revenue?.[range] || 0;
  const revTarget = target * rate;
  const now = new Date();
  const dayFrac = (now.getHours() * 60 + now.getMinutes()) / (8 * 60);
  const periodFracs = {
    today: Math.max(dayFrac, 0.1),
    week: Math.max((now.getDay() || 7) / 5, 0.2),
    month: Math.max(now.getDate() / 22, 0.1),
    year: Math.max((Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000)) / 260, 0.1)
  };
  const revExpected = revActual / periodFracs[range];
  const monthlyTarget = rate * (RANGE_TARGETS.month || 38);

  if (loading) return <div className="empty-state"><p>Loading dashboard...</p></div>;

  return (
    <div>
      <div className="tabs">
        {[['personal', 'Personal Dashboard'], ['firm', 'Firm Dashboard'], ['feed', 'Firm Feed']].map(([k, l]) => (
          <button key={k} className={`tab ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {activeTab === 'personal' && (
        <>
          {/* Today's Agenda */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Today's Agenda</h2>
            <button className="stat-link" onClick={() => setAgendaHidden(!agendaHidden)}>( {agendaHidden ? 'Show' : 'Hide'} )</button>
          </div>
          {!agendaHidden && (
            <div className="agenda-grid">
              <div className="agenda-card">
                <div className="agenda-stat">
                  <span className="agenda-num">{stats?.overdueDeadlines || 0}</span>
                  <span className="agenda-label">Tasks Due Today</span>
                  <button className="agenda-add" onClick={() => navigate('/tasks')}>+</button>
                </div>
                <div className="agenda-msg">{stats?.overdueDeadlines ? `${stats.overdueDeadlines} task(s) need attention` : 'You have no tasks due today'}</div>
              </div>
              <div className="agenda-card">
                <div className="agenda-stat">
                  <span className="agenda-num">{stats?.todayEvents?.length || 0}</span>
                  <span className="agenda-label">Calendar Events</span>
                  <button className="agenda-add" onClick={() => navigate('/calendar')}>+</button>
                </div>
                <div className="agenda-msg">{stats?.todayEvents?.length ? stats.todayEvents.map(e => e.title).join(', ') : 'You have no events scheduled for today'}</div>
              </div>
            </div>
          )}

          {/* Hourly + Billing row */}
          <div className="metrics-row">
            <div>
              <h2 className="section-title">Hourly Metrics for {user?.firstName} {user?.lastName} <span className="help">?</span></h2>
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
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button className="stat-link" onClick={() => navigate('/billing')}>Personal performance settings</button>
                </div>
              </div>
            </div>

            {canViewBilling && (
              <div>
                <h2 className="section-title">Billing Metrics for Firm <span className="help">?</span></h2>
                <div className="billing-grid">
                  {[
                    { title: 'Draft Bills', val: stats?.billing?.draft?.count || 0 },
                    { title: 'Total in Draft', val: stats?.billing?.draft?.total ? fmtMoney(stats.billing.draft.total) : '—', isMoney: true },
                    { title: 'Unpaid Bills', val: stats?.billing?.unpaid?.count || 0 },
                    { title: 'Total in Unpaid', val: stats?.billing?.unpaid?.total ? fmtMoney(stats.billing.unpaid.total) : '—', isMoney: true },
                    { title: 'Overdue Bills', val: stats?.billing?.overdue?.count || 0, cls: 'danger' },
                    { title: 'Total in Overdue', val: stats?.billing?.overdue?.total ? fmtMoney(stats.billing.overdue.total) : '—', isMoney: true, cls: 'danger' },
                  ].map((item, i) => (
                    <div key={i} className={`stat-card ${item.isMoney ? 'total' : ''}`} onClick={() => navigate('/billing')} style={{ cursor: 'pointer' }}>
                      <span className="stat-title">{item.title}</span>
                      <span className={`stat-value ${item.cls || ''}`}>{item.val}</span>
                      {!item.isMoney && item.val === 0 && item.title === 'Draft Bills' && (
                        <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>(<button className="stat-link" onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}>Create new bills</button>)</div>
                      )}
                      {!item.isMoney && item.title === 'Unpaid Bills' && (
                        <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>(Approve from <button className="stat-link" onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}>Draft</button> or <button className="stat-link" onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}>Pending Approval</button>)</div>
                      )}
                      <div className="stat-foot"><button className="view-link" onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}>View</button></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Financial Metrics - Bar Charts */}
          {canViewBilling && (
            <>
              <h2 className="section-title" style={{ marginTop: 32 }}>Financial Metrics for {user?.firstName} {user?.lastName} <span className="help">?</span></h2>
              <div className="financial-grid">
                {Object.entries(RANGE_LABELS).map(([key, label]) => {
                  const act = stats?.revenue?.[key] || 0;
                  const tgt = RANGE_TARGETS[key] * rate;
                  const frac = periodFracs[key];
                  const exp = act / frac;
                  return <BarChart key={key} title={label} actual={act} expected={exp} target={tgt} />;
                })}
              </div>
            </>
          )}

          {/* Annual Report */}
          {canViewBilling && stats?.revenue?.monthly && (
            <div style={{ marginTop: 28 }}>
              <AnnualChart data={stats.revenue.monthly} targetMonthly={monthlyTarget} />
            </div>
          )}
        </>
      )}

      {/* FIRM DASHBOARD */}
      {activeTab === 'firm' && (
        <>
          <div className="stats-cards-row">
            <div className="kpi-card"><div className="kpi-label">Active Matters</div><div className="kpi-value">{stats?.activeMatters || 0}</div></div>
            <div className="kpi-card"><div className="kpi-label">Pending Leads</div><div className="kpi-value amber">{stats?.pendingLeads || 0}</div></div>
            <div className="kpi-card"><div className="kpi-label">Total Clients</div><div className="kpi-value">{stats?.totalClients || 0}</div></div>
            <div className="kpi-card"><div className="kpi-label">Collected (YTD)</div><div className="kpi-value green">{fmtMoney(stats?.billing?.collectedYTD)}</div></div>
          </div>

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

      {/* FIRM FEED */}
      {activeTab === 'feed' && (
        <>
          <h2 className="section-title">Recent Firm Activity <span className="help">?</span></h2>
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
                    <div className="feed-time">{a.createdBy?.firstName} {a.createdBy?.lastName} · {a.matter?.name || ''} · {new Date(a.createdAt).toLocaleString()}</div>
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
