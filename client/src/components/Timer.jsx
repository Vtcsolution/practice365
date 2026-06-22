import { useState, useRef, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import Modal from './Modal';

function fmt(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

/**
 * Multiple concurrent timers — one per matter, tracked server-side.
 * Sessions survive page refreshes; restored from GET /time-entries/timer/active on mount.
 */
export default function Timer() {
  const toast = useToast();
  // timers: [{ matterId, matterName, startedAt (Date), seconds, description }]
  const [timers, setTimers] = useState([]);
  const [showPopover, setShowPopover] = useState(false);
  // showSave: { matterId, matterName, stoppedAt, seconds } — the timer being saved
  const [showSave, setShowSave] = useState(null);
  const [matters, setMatters] = useState([]);
  const [showStart, setShowStart] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState('');
  const [startDesc, setStartDesc] = useState('');
  const [desc, setDesc] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [savedEntries, setSavedEntries] = useState([]);
  const popRef = useRef(null);

  const activeTimer = timers.length > 0 ? timers[timers.length - 1] : null;
  const anyRunning = timers.length > 0;

  // Restore active sessions from server on mount
  useEffect(() => {
    api.get('/time-entries/timer/active').then(res => {
      const sessions = res.data.data || [];
      setTimers(sessions.map(s => ({
        matterId: s.matterId,
        matterName: s.matterId, // will be enriched below
        startedAt: new Date(s.startedAt),
        seconds: s.elapsedMinutes * 60,
        description: s.description
      })));
      if (sessions.length > 0) {
        // Enrich matterName
        api.get('/matters').then(r => {
          const map = {};
          (r.data.data || []).forEach(m => { map[m._id] = m.name; });
          setTimers(prev => prev.map(t => ({ ...t, matterName: map[t.matterId] || t.matterId })));
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Tick all running timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => prev.map(t => ({ ...t, seconds: t.seconds + 1 })));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setShowPopover(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadMatters = async () => {
    try {
      const res = await api.get('/matters');
      setMatters(res.data.data || []);
      if (res.data.data?.length) setSelectedMatter(res.data.data[0]._id);
    } catch (e) {}
  };

  const openStartDialog = async () => {
    await loadMatters();
    setStartDesc('');
    setShowStart(true);
  };

  const startTimer = async () => {
    if (!selectedMatter) { toast('Select a matter'); return; }
    if (timers.some(t => t.matterId === selectedMatter)) {
      toast('Timer already running for this matter');
      return;
    }
    try {
      await api.post('/time-entries/timer/start', { matterId: selectedMatter, description: startDesc });
      const matter = matters.find(m => m._id === selectedMatter);
      setTimers(prev => [...prev, {
        matterId: selectedMatter,
        matterName: matter?.name || 'Unknown',
        startedAt: new Date(),
        seconds: 0,
        description: startDesc
      }]);
      setShowStart(false);
      toast(`Timer started: ${matter?.name}`);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to start timer');
    }
  };

  // Stop button: capture the moment, show save dialog
  const stopTimer = (matterId) => {
    const timer = timers.find(t => t.matterId === matterId);
    if (!timer) return;
    const stoppedAt = new Date();
    setTimers(prev => prev.filter(t => t.matterId !== matterId));
    setShowSave({ matterId, matterName: timer.matterName, stoppedAt, seconds: timer.seconds });
    setDesc(timer.description || '');
    setInternalNote('');
  };

  const stopActive = () => {
    if (activeTimer) stopTimer(activeTimer.matterId);
  };

  const saveEntry = async () => {
    if (!showSave) return;
    try {
      await api.post('/time-entries/timer/stop', {
        matterId: showSave.matterId,
        clientDescription: desc || 'Time logged via timer',
        internalNote: internalNote || '',
        stoppedAt: showSave.stoppedAt.toISOString()
      });
      const mins = Math.max(Math.ceil(showSave.seconds / 60), 1);
      toast(`Saved: ${mins} min on ${showSave.matterName}`);
      setSavedEntries(prev => [{
        matterName: showSave.matterName,
        minutes: mins,
        description: desc || 'Timer entry',
        time: new Date()
      }, ...prev]);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save');
    }
    setShowSave(null);
  };

  const discardEntry = async () => {
    if (showSave) {
      // Remove server session without creating an entry
      await api.post('/time-entries/timer/discard', { matterId: showSave.matterId }).catch(() => {});
    }
    setShowSave(null);
  };

  const totalMins = savedEntries.reduce((s, e) => s + e.minutes, 0);
  const totalH = Math.floor(totalMins / 60);
  const totalM = totalMins % 60;

  return (
    <>
      <div className={`timer ${anyRunning ? 'running' : ''}`} ref={popRef}>
        <button className="timer-btn" onClick={anyRunning ? stopActive : openStartDialog}
          aria-label={anyRunning ? 'Stop timer' : 'Start timer'}>
          {anyRunning ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M5 3.5v17l15-8.5z" /></svg>
          )}
        </button>
        <span className="timer-display mono">{activeTimer ? fmt(activeTimer.seconds) : '00:00:00'}</span>
        <button style={{
          width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent',
          color: 'rgba(255,255,255,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative'
        }} onClick={(e) => { e.stopPropagation(); setShowPopover(!showPopover); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {(timers.length > 0 || savedEntries.length > 0) && (
            <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, background: 'var(--blue-500)', borderRadius: '50%', border: '1.5px solid var(--navy-900)' }} />
          )}
        </button>

        {showPopover && (
          <div style={{
            position: 'absolute', top: 48, right: 0, width: 340, background: '#fff',
            borderRadius: 14, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)',
            zIndex: 90, overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
              <span>Time tracking</span>
              <span className="mono" style={{ color: 'var(--blue-600)' }}>{totalH}:{String(totalM).padStart(2, '0')}</span>
            </div>

            {timers.length > 0 && (
              <div style={{ borderBottom: '1px solid var(--line)' }}>
                <div style={{ padding: '8px 18px', fontSize: 11, fontWeight: 700, color: 'var(--ink-400)', textTransform: 'uppercase' }}>
                  Running ({timers.length})
                </div>
                {timers.map(t => (
                  <div key={t.matterId} style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.matterName}</div>
                      <div className="mono" style={{ fontSize: 13, color: 'var(--blue-600)', fontWeight: 600 }}>{fmt(t.seconds)}</div>
                    </div>
                    <button onClick={() => stopTimer(t.matterId)} style={{
                      width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--red-600)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
                    }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => { setShowPopover(false); openStartDialog(); }} style={{
              width: '100%', padding: '12px 18px', border: 'none', borderBottom: '1px solid var(--line)',
              background: 'var(--blue-100)', color: 'var(--blue-600)', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M5 3.5v17l15-8.5z" /></svg>
              Start new timer
            </button>

            {savedEntries.length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {savedEntries.map((e, i) => (
                  <div key={i} style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{e.matterName}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{e.description}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-600)' }}>
                      {Math.floor(e.minutes / 60)}h {e.minutes % 60}m
                    </div>
                  </div>
                ))}
              </div>
            ) : timers.length === 0 && (
              <div style={{ padding: '30px 18px', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13.5 }}>
                No time entries yet today.<br />Start a timer to begin tracking.
              </div>
            )}
          </div>
        )}
      </div>

      {showStart && (
        <Modal onClose={() => setShowStart(false)}>
          <h3>Start timer</h3>
          <p className="sub">Select a matter to begin tracking time.</p>
          <div className="field">
            <label>Matter</label>
            <select value={selectedMatter} onChange={e => setSelectedMatter(e.target.value)}>
              {matters.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
              {matters.length === 0 && <option value="">No matters available</option>}
            </select>
          </div>
          <div className="field">
            <label>Description <span style={{ fontWeight: 400, color: 'var(--ink-400)' }}>(optional)</span></label>
            <input value={startDesc} onChange={e => setStartDesc(e.target.value)} placeholder="What are you working on?" />
          </div>
          {timers.some(t => t.matterId === selectedMatter) && (
            <div style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              Timer already running for this matter
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowStart(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={startTimer}>Start Timer</button>
          </div>
        </Modal>
      )}

      {showSave && (
        <Modal onClose={discardEntry}>
          <h3>Save time entry</h3>
          <p className="sub">Add details before saving to <strong>{showSave.matterName}</strong>.</p>
          <div className="mono" style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, margin: '6px 0 20px', color: 'var(--navy-900)' }}>
            {fmt(showSave.seconds)}
          </div>
          <div className="field">
            <label>Client-Facing Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Drafted settlement letter" />
          </div>
          <div className="field">
            <label>Internal Note <span style={{ fontWeight: 400, color: 'var(--ink-400)' }}>(never shown on invoices)</span></label>
            <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Private notes for internal tracking..." rows={2} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={discardEntry}>Discard</button>
            <button className="btn btn-primary" onClick={saveEntry}>Save entry</button>
          </div>
        </Modal>
      )}
    </>
  );
}
