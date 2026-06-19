import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    api.get('/portal/branding').then(r => setBranding(r.data.data)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header className="topbar">
        <NavLink to="/portal" className="brand">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" style={{ height: 32, borderRadius: 6 }} />
          ) : (
            <span className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" width="18" height="18">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          <span>{branding?.firmName || 'Client Portal'}</span>
        </NavLink>
        <div className="topbar-right">
          <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 14 }}>{user?.firstName} {user?.lastName}</span>
          <button className="icon-btn" onClick={() => { logout(); navigate('/login'); }} title="Logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="16,17 21,12 16,7" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div className="tabs" style={{ marginBottom: 24 }}>
          <NavLink to="/portal" end className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>Matters</NavLink>
          <NavLink to="/portal/documents" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>Documents</NavLink>
          <NavLink to="/portal/invoices" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>Invoices</NavLink>
          <NavLink to="/portal/messages" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>Messages</NavLink>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

function PortalMatters() {
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/portal/matters').then(r => setMatters(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Your Matters</h2>
      {matters.length === 0 ? <div className="empty-state"><p>No matters found.</p></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matters.map(m => (
            <div key={m._id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>{m.matterNumber} · {m.practiceArea}</div>
                </div>
                <span className={`badge ${m.status}`}>{m.status}</span>
              </div>
              {m.responsibleAttorney && (
                <div style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 8 }}>
                  Attorney: {m.responsibleAttorney.firstName} {m.responsibleAttorney.lastName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortalDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/portal/documents').then(r => setDocs(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Shared Documents</h2>
      {docs.length === 0 ? <div className="empty-state"><p>No documents shared with you yet.</p></div> : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Matter</th><th>Shared</th><th></th></tr></thead>
          <tbody>
            {docs.map(doc => (
              <tr key={doc._id}>
                <td style={{ fontWeight: 600 }}>{doc.name}</td>
                <td style={{ fontSize: 13 }}>{doc.matter?.name || '—'}</td>
                <td style={{ fontSize: 13 }}>{doc.sharedAt ? new Date(doc.sharedAt).toLocaleDateString() : '—'}</td>
                <td>
                  <button className="row-icon-btn" onClick={() => window.open(`/api/documents/${doc._id}/preview`, '_blank')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PortalInvoices() {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    api.get('/portal/invoices').then(r => setInvoices(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pay = async (inv) => {
    setPaying(inv._id);
    try {
      const intentRes = await api.post('/portal/payments/create-intent', { invoiceId: inv._id });
      const { testMode } = intentRes.data.data;

      if (testMode) {
        await api.post('/portal/payments/confirm', {
          invoiceId: inv._id,
          paymentIntentId: `pi_test_${Date.now()}`,
          amount: inv.balanceDue
        });
        toast('Payment successful (test mode)');
        const updated = await api.get('/portal/invoices');
        setInvoices(updated.data.data);
      } else {
        toast('Stripe checkout would open here with real keys');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Payment failed');
      try {
        await api.post('/portal/payments/failed', { invoiceId: inv._id, reason: err.response?.data?.message || 'Payment error' });
      } catch (e) {}
    } finally {
      setPaying(null);
    }
  };

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Your Invoices</h2>
      {invoices.length === 0 ? <div className="empty-state"><p>No invoices yet.</p></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {invoices.map(inv => {
            const overdue = ['sent', 'partially_paid'].includes(inv.status) && new Date(inv.dueDate) < new Date();
            return (
              <div key={inv._id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{inv.invoiceNumber}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>{inv.matter?.name} · Due: {new Date(inv.dueDate).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(inv.balanceDue)}</div>
                    <span className={`badge ${overdue ? 'overdue' : inv.status}`}>{overdue ? 'Overdue' : inv.status}</span>
                  </div>
                </div>
                {inv.balanceDue > 0 && inv.status !== 'void' && (
                  <button className="btn-primary-pill" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                    onClick={() => pay(inv)} disabled={paying === inv._id}>
                    {paying === inv._id ? 'Processing...' : `Pay ${fmtMoney(inv.balanceDue)}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PortalMessages() {
  const toast = useToast();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/portal/messages/threads').then(r => setThreads(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openThread = async (thread) => {
    setActiveThread(thread);
    const res = await api.get(`/portal/messages/threads/${thread._id}`);
    setMessages(res.data.data);
  };

  const send = async () => {
    if (!newMsg.trim()) return;
    try {
      await api.post('/portal/messages', { threadId: activeThread._id, body: newMsg });
      setNewMsg('');
      const res = await api.get(`/portal/messages/threads/${activeThread._id}`);
      setMessages(res.data.data);
      toast('Message sent');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;

  if (activeThread) {
    return (
      <div>
        <button className="detail-back" onClick={() => setActiveThread(null)}>← Back to threads</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{activeThread.matter?.name || 'Message Thread'}</h2>
        <div className="card" style={{ padding: 0, marginBottom: 16 }}>
          <div style={{ maxHeight: 400, overflowY: 'auto', padding: '16px 20px' }}>
            {messages.map(msg => (
              <div key={msg._id} style={{ marginBottom: 16, textAlign: msg.sender?._id === user?._id ? 'right' : 'left' }}>
                <div style={{
                  display: 'inline-block', maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                  background: msg.sender?._id === user?._id ? 'var(--blue-600)' : '#f0f0f5',
                  color: msg.sender?._id === user?._id ? '#fff' : 'var(--ink-900)', fontSize: 14, lineHeight: 1.5, textAlign: 'left'
                }}>
                  {msg.body}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>
                  {msg.sender?.firstName} · {new Date(msg.createdAt).toLocaleTimeString()}
                  {msg.status === 'read' && msg.sender?._id === user?._id && <span style={{ marginLeft: 6 }}>✓✓</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: 12, display: 'flex', gap: 8 }}>
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..."
              onKeyDown={e => e.key === 'Enter' && send()}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit' }} />
            <button className="btn-primary-pill" onClick={send}>Send</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Messages</h2>
      {threads.length === 0 ? <div className="empty-state"><p>No messages yet.</p></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.map(t => (
            <div key={t._id} className="card" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => openThread(t)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{t.matter?.name || t.subject}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>{t.lastMessagePreview || 'No messages yet'}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString() : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{t.messageCount} msg{t.messageCount !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { PortalLayout, PortalMatters, PortalDocuments, PortalInvoices, PortalMessages };
