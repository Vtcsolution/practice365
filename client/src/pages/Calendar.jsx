import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import Modal from '../components/Modal';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EVENT_TYPES = ['meeting', 'hearing', 'deadline', 'deposition', 'filing', 'consultation', 'other'];

export default function Calendar() {
  const { user } = useAuth();
  const toast = useToast();
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [matters, setMatters] = useState([]);
  const [viewMode, setViewMode] = useState('all');
  const [form, setForm] = useState({
    title: '', description: '', startDate: '', endDate: '', allDay: false,
    eventType: 'meeting', isDeadline: false, matter: '', location: '',
    reminders: [{ interval: 30, unit: 'minutes' }]
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const fetchEvents = async () => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    const params = { start: start.toISOString(), end: end.toISOString() };
    if (viewMode === 'mine') params.attorney = user._id;
    try {
      const res = await api.get('/calendar', { params });
      setEvents(res.data.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchEvents(); }, [year, month, viewMode]);

  const openNew = async (dateStr) => {
    try {
      const res = await api.get('/matters');
      setMatters(res.data.data || []);
    } catch (e) {}
    setForm(f => ({
      ...f, title: '', description: '', startDate: dateStr || '', endDate: '',
      eventType: 'meeting', isDeadline: false, matter: '', location: '',
      reminders: [{ interval: 30, unit: 'minutes' }]
    }));
    setShowNew(true);
  };

  const saveEvent = async () => {
    if (!form.title || !form.startDate) { toast('Title and date required'); return; }
    try {
      const data = { ...form };
      if (!data.matter) delete data.matter;
      if (!data.endDate) data.endDate = data.startDate;
      await api.post('/calendar', data);
      toast(form.isDeadline ? 'Deadline created' : 'Event created');
      setShowNew(false);
      fetchEvents();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const completeDeadline = async (id) => {
    try {
      await api.put(`/calendar/${id}/complete`);
      toast('Deadline marked complete');
      setShowDetail(null);
      fetchEvents();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const deleteEvent = async (id) => {
    try {
      await api.delete(`/calendar/${id}`);
      toast('Event deleted');
      setShowDetail(null);
      fetchEvents();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const addReminder = () => {
    setForm(f => ({ ...f, reminders: [...f.reminders, { interval: 1, unit: 'hours' }] }));
  };

  const removeReminder = (i) => {
    setForm(f => ({ ...f, reminders: f.reminders.filter((_, idx) => idx !== i) }));
  };

  const updateReminder = (i, field, val) => {
    setForm(f => ({
      ...f,
      reminders: f.reminders.map((r, idx) => idx === i ? { ...r, [field]: field === 'interval' ? parseInt(val) || 0 : val } : r)
    }));
  };

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells = useMemo(() => {
    const result = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      let cellDate;
      let otherMonth = false;
      if (dayNum < 1) {
        cellDate = new Date(year, month - 1, daysInPrev + dayNum);
        otherMonth = true;
      } else if (dayNum > daysInMonth) {
        cellDate = new Date(year, month + 1, dayNum - daysInMonth);
        otherMonth = true;
      } else {
        cellDate = new Date(year, month, dayNum);
      }
      const dateStr = cellDate.toISOString().slice(0, 10);
      const dayEvents = events.filter(e => e.startDate?.slice(0, 10) === dateStr);
      result.push({ cellDate, dateStr, otherMonth, dayEvents, day: cellDate.getDate() });
    }
    return result;
  }, [events, year, month, startOffset, daysInMonth, daysInPrev, totalCells]);

  return (
    <div>
      <div className="page-head">
        <div><h1>Calendar</h1><div className="sub">Events, hearings, and deadlines</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`filter-pill ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>Firm-wide</button>
          <button className={`filter-pill ${viewMode === 'mine' ? 'active' : ''}`} onClick={() => setViewMode('mine')}>My Calendar</button>
          <button className="btn-primary-pill" onClick={() => openNew('')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New event
          </button>
        </div>
      </div>

      {/* Calendar nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, minWidth: 170, textAlign: 'center' }}>{MONTHS[month]} {year}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="filter-pill" style={{ padding: '7px 10px' }} onClick={() => setViewDate(new Date(year, month - 1, 1))}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="15" height="15"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="filter-pill" onClick={() => setViewDate(new Date())}>Today</button>
          <button className="filter-pill" style={{ padding: '7px 10px' }} onClick={() => setViewDate(new Date(year, month + 1, 1))}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="15" height="15"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1,
        background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden'
      }}>
        {DOW.map(d => (
          <div key={d} style={{ background: '#fbfbfd', padding: '10px 0', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d}</div>
        ))}
        {cells.map((cell, i) => (
          <div key={i} onClick={() => openNew(cell.dateStr)} style={{
            background: cell.dateStr === todayStr ? 'var(--blue-100)' : cell.otherMonth ? '#fbfbfd' : '#fff',
            minHeight: 92, padding: 8, cursor: 'pointer', overflow: 'hidden'
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: cell.dateStr === todayStr ? 'var(--blue-600)' : cell.otherMonth ? 'var(--ink-400)' : 'var(--ink-600)' }}>
              {cell.day}
            </div>
            {cell.dayEvents.map(ev => (
              <div key={ev._id} onClick={(e) => { e.stopPropagation(); setShowDetail(ev); }} style={{
                marginTop: 4, background: ev.isDeadline ? (ev.deadlineCompleted ? 'var(--green-600)' : (cell.dateStr < todayStr ? 'var(--red-600)' : 'var(--amber-600)')) : 'var(--blue-600)',
                color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '3px 6px', borderRadius: 5,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer'
              }} title={ev.title}>
                {ev.deadlineCompleted ? '✓ ' : ''}{ev.title}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Event detail popup */}
      {showDetail && (
        <Modal onClose={() => setShowDetail(null)}>
          <h3>{showDetail.title}</h3>
          <p className="sub">{showDetail.eventType} · {new Date(showDetail.startDate).toLocaleDateString()}</p>
          {showDetail.description && <p style={{ fontSize: 14, color: 'var(--ink-600)', margin: '0 0 12px' }}>{showDetail.description}</p>}
          {showDetail.location && <p style={{ fontSize: 13, color: 'var(--ink-400)', margin: '0 0 8px' }}>📍 {showDetail.location}</p>}
          {showDetail.matter && <p style={{ fontSize: 13, color: 'var(--ink-400)', margin: '0 0 8px' }}>Matter: {showDetail.matter.name || showDetail.matter}</p>}
          {showDetail.isDeadline && (
            <div style={{ margin: '12px 0' }}>
              {showDetail.deadlineCompleted ? (
                <span className="badge converted">Completed {new Date(showDetail.deadlineCompletedAt).toLocaleDateString()}</span>
              ) : (
                <span className={`badge ${new Date(showDetail.startDate) < new Date() ? 'overdue' : 'pending'}`}>
                  {new Date(showDetail.startDate) < new Date() ? 'Overdue' : 'Pending'}
                </span>
              )}
            </div>
          )}
          <div className="modal-actions">
            {showDetail.isDeadline && !showDetail.deadlineCompleted && (
              <button className="btn btn-primary" onClick={() => completeDeadline(showDetail._id)}>Mark Complete</button>
            )}
            {!(showDetail.isDeadline && showDetail.deadlineCompleted) && (
              <button className="btn btn-ghost" style={{ color: 'var(--red-600)' }} onClick={() => deleteEvent(showDetail._id)}>Delete</button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowDetail(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* New event modal */}
      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <h3>New calendar event</h3>
          <p className="sub">Schedule a meeting, hearing, or deadline.</p>
          <div className="field"><label>Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Client call — Garcia Trust" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Start Date *</label><input type="datetime-local" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div className="field"><label>End Date</label><input type="datetime-local" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Type</label>
              <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value, isDeadline: e.target.value === 'deadline' || f.isDeadline }))}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Matter (optional)</label>
              <select value={form.matter} onChange={e => setForm(f => ({ ...f, matter: e.target.value }))}>
                <option value="">None (standalone)</option>
                {matters.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Courtroom 3B" /></div>
          <div className="field"><label>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.isDeadline} onChange={e => setForm(f => ({ ...f, isDeadline: e.target.checked }))} style={{ width: 'auto' }} id="isDeadline" />
            <label htmlFor="isDeadline" style={{ margin: 0, cursor: 'pointer' }}>Mark as deadline</label>
          </div>

          {/* Reminders */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Reminders</label>
            {form.reminders.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input type="number" min="1" value={r.interval} onChange={e => updateReminder(i, 'interval', e.target.value)} style={{ width: 60, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
                <select value={r.unit} onChange={e => updateReminder(i, 'unit', e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
                <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>before</span>
                {form.reminders.length > 1 && (
                  <button onClick={() => removeReminder(i)} style={{ background: 'none', border: 'none', color: 'var(--red-600)', cursor: 'pointer', fontSize: 16, padding: 4 }}>×</button>
                )}
              </div>
            ))}
            <button onClick={addReminder} className="stat-link" style={{ marginTop: 4 }}>+ Add reminder</button>
          </div>

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEvent}>Save event</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
