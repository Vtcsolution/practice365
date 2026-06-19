import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';

const NOTE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'client_call', label: 'Client Call' },
  { value: 'internal', label: 'Internal' },
  { value: 'research', label: 'Research' },
  { value: 'court_appearance', label: 'Court Appearance' },
];

export default function Activities() {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [matters, setMatters] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ content: '', noteType: 'general', matter: '', client: '' });
  const [editContent, setEditContent] = useState('');

  const fetchNotes = async () => {
    try {
      const params = {};
      if (filter !== 'all') params.noteType = filter;
      if (search) params.search = search;
      const res = await api.get('/notes', { params });
      setNotes(res.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotes(); }, [filter, search]);

  const openNew = async () => {
    try {
      const [mRes, cRes] = await Promise.all([api.get('/matters'), api.get('/clients')]);
      setMatters(mRes.data.data || []);
      setClients(cRes.data.data || []);
    } catch (e) {}
    setForm({ content: '', noteType: 'general', matter: '', client: '' });
    setShowNew(true);
  };

  const saveNote = async () => {
    if (!form.content.trim()) { toast('Note content required'); return; }
    try {
      const data = { ...form };
      if (!data.matter) delete data.matter;
      if (!data.client) delete data.client;
      await api.post('/notes', data);
      toast('Note created');
      setShowNew(false);
      fetchNotes();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const openEdit = async (note) => {
    const res = await api.get(`/notes/${note._id}`);
    setEditNote(res.data.data);
    setEditContent(res.data.data.content);
  };

  const saveEdit = async () => {
    if (!editContent.trim()) { toast('Content required'); return; }
    try {
      await api.put(`/notes/${editNote._id}`, { content: editContent });
      toast('Note updated (new version created)');
      setEditNote(null);
      fetchNotes();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const typeColor = (t) => {
    const map = { client_call: 'sent', internal: 'pending', research: 'open', court_appearance: 'high', general: 'closed' };
    return map[t] || 'closed';
  };

  return (
    <div>
      <div className="page-head">
        <div><h1>Notes & Activities</h1><div className="sub">{notes.length} note{notes.length !== 1 ? 's' : ''}</div></div>
        <button className="btn-primary-pill" onClick={openNew}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          New note
        </button>
      </div>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search notes..." />
        <button className={`filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {NOTE_TYPES.map(t => (
          <button key={t.value} className={`filter-pill ${filter === t.value ? 'active' : ''}`} onClick={() => setFilter(t.value)}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : notes.length === 0 ? (
        <div className="empty-state"><p>No notes found.</p></div>
      ) : (
        <div className="card" style={{ padding: '6px 0' }}>
          {notes.map(note => (
            <div key={note._id} className="feed-item" style={{ cursor: 'pointer' }} onClick={() => openEdit(note)}>
              <span className="feed-icon" style={{
                background: note.noteType === 'client_call' ? 'var(--blue-100)' : note.noteType === 'research' ? 'var(--green-100)' : note.noteType === 'court_appearance' ? 'var(--red-100)' : note.noteType === 'internal' ? 'var(--amber-100)' : '#f0f0f5',
                color: note.noteType === 'client_call' ? 'var(--blue-600)' : note.noteType === 'research' ? 'var(--green-600)' : note.noteType === 'court_appearance' ? 'var(--red-600)' : note.noteType === 'internal' ? 'var(--amber-600)' : 'var(--ink-600)'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="feed-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={`badge ${typeColor(note.noteType)}`}>{note.noteType.replace('_', ' ')}</span>
                  {note.matter && <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{note.matter.name || note.matter.matterNumber}</span>}
                  {note.client && <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{note.client.firstName} {note.client.lastName}</span>}
                  {note.previousVersion && <span style={{ fontSize: 11, color: 'var(--ink-400)', fontStyle: 'italic' }}>(edited)</span>}
                </div>
                <div className="feed-text" style={{ whiteSpace: 'pre-wrap' }}>{note.content.length > 300 ? note.content.substring(0, 300) + '...' : note.content}</div>
                <div className="feed-time">{note.createdBy?.firstName} {note.createdBy?.lastName} · {new Date(note.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New note modal */}
      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <h3>New note</h3>
          <p className="sub">Add a timestamped note to a client or matter.</p>
          <div className="field">
            <label>Type</label>
            <select value={form.noteType} onChange={e => setForm(f => ({ ...f, noteType: e.target.value }))}>
              {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Matter</label>
              <select value={form.matter} onChange={e => setForm(f => ({ ...f, matter: e.target.value }))}>
                <option value="">None</option>
                {matters.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Client</label>
              <select value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}>
                <option value="">None</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Content *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={6} placeholder="Enter note content..." />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveNote}>Save note</button>
          </div>
        </Modal>
      )}

      {/* Edit note modal (immutable — creates new version) */}
      {editNote && (
        <Modal onClose={() => setEditNote(null)}>
          <h3>Edit note</h3>
          <p className="sub">Editing creates a new version — the original is preserved.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span className={`badge ${typeColor(editNote.noteType)}`}>{editNote.noteType.replace('_', ' ')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>
              Created by {editNote.createdBy?.firstName} {editNote.createdBy?.lastName} · {new Date(editNote.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="field">
            <label>Content</label>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={8} />
          </div>
          {editNote.versionHistory?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'block' }}>Version History</label>
              {editNote.versionHistory.map((v, i) => (
                <div key={v._id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-600)' }}>
                  <span style={{ fontWeight: 600 }}>v{editNote.versionHistory.length - i}</span> — {v.createdBy?.firstName} {v.createdBy?.lastName} · {new Date(v.createdAt).toLocaleString()}
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-400)' }}>{v.content.substring(0, 100)}...</div>
                </div>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setEditNote(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit}>Save new version</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
