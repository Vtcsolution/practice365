import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

export default function Tasks() {
  const toast = useToast();
  const [deadlines, setDeadlines] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [overdueRes, allRes] = await Promise.all([
          api.get('/calendar/overdue-deadlines'),
          api.get('/calendar', { params: { isDeadline: 'true' } })
        ]);
        setDeadlines(overdueRes.data.data);
        setAllEvents(allRes.data.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const complete = async (id) => {
    try {
      await api.put(`/calendar/${id}/complete`);
      toast('Deadline completed');
      setAllEvents(prev => prev.map(e => e._id === id ? { ...e, deadlineCompleted: true, deadlineCompletedAt: new Date().toISOString() } : e));
      setDeadlines(prev => prev.filter(e => e._id !== id));
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const displayed = filter === 'all' ? allEvents
    : filter === 'overdue' ? deadlines
    : filter === 'pending' ? allEvents.filter(e => !e.deadlineCompleted)
    : allEvents.filter(e => e.deadlineCompleted);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="page-head">
        <div><h1>Tasks & Deadlines</h1><div className="sub">Track deadlines across all matters</div></div>
      </div>
      <div className="stats-cards-row">
        <div className="kpi-card"><div className="kpi-label">Total Deadlines</div><div className="kpi-value">{allEvents.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Pending</div><div className="kpi-value amber">{allEvents.filter(e => !e.deadlineCompleted).length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Overdue</div><div className="kpi-value red">{deadlines.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Completed</div><div className="kpi-value green">{allEvents.filter(e => e.deadlineCompleted).length}</div></div>
      </div>
      <div className="toolbar">
        {['all', 'pending', 'overdue', 'completed'].map(f => (
          <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : displayed.length === 0 ? (
        <div className="empty-state"><p>No deadlines found.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th></th><th>Deadline</th><th>Matter</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {displayed.map(e => {
              const overdue = !e.deadlineCompleted && e.startDate?.slice(0, 10) < today;
              return (
                <tr key={e._id}>
                  <td data-label="Done" style={{ width: 40 }}>
                    <input type="checkbox" checked={!!e.deadlineCompleted} onChange={() => !e.deadlineCompleted && complete(e._id)}
                      style={{ width: 18, height: 18, accentColor: 'var(--blue-600)', cursor: 'pointer' }} disabled={e.deadlineCompleted} />
                  </td>
                  <td data-label="Deadline" style={{ textDecoration: e.deadlineCompleted ? 'line-through' : 'none', color: e.deadlineCompleted ? 'var(--ink-400)' : undefined }}>
                    {e.title}
                  </td>
                  <td data-label="Matter">{e.matter?.name || '—'}</td>
                  <td data-label="Due">{overdue ? <span className="badge overdue">{e.startDate?.slice(0, 10)} · Overdue</span> : e.startDate?.slice(0, 10)}</td>
                  <td data-label="Status">
                    <span className={`badge ${e.deadlineCompleted ? 'converted' : overdue ? 'overdue' : 'pending'}`}>
                      {e.deadlineCompleted ? 'Completed' : overdue ? 'Overdue' : 'Pending'}
                    </span>
                  </td>
                  <td data-label="">
                    {!e.deadlineCompleted && (
                      <button className="btn-primary-pill" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => complete(e._id)}>Complete</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
