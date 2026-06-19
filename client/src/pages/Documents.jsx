import { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';

const ICON_BY_MIME = {
  'application/pdf': { color: '#e2473c', label: 'PDF' },
  'application/msword': { color: '#2e5cff', label: 'DOC' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { color: '#2e5cff', label: 'DOCX' },
  'image/jpeg': { color: '#1aa86c', label: 'JPG' },
  'image/png': { color: '#1aa86c', label: 'PNG' },
  'text/plain': { color: '#94a3b8', label: 'TXT' },
};

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Documents() {
  const toast = useToast();
  const fileRef = useRef();
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [showVersions, setShowVersions] = useState(null);
  const [matters, setMatters] = useState([]);
  const [clients, setClients] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploadForm, setUploadForm] = useState({ matter: '', client: '', folder: '/', tags: '', description: '', name: '' });
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchDocs = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (currentFolder) params.folder = currentFolder;
      const res = await api.get('/documents', { params });
      setDocs(res.data.data);
      const fRes = await api.get('/documents/folders');
      setFolders(fRes.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, [search, currentFolder]);

  const openUpload = async () => {
    try {
      const [mRes, cRes] = await Promise.all([api.get('/matters'), api.get('/clients')]);
      setMatters(mRes.data.data || []);
      setClients(cRes.data.data || []);
    } catch (e) {}
    setUploadForm({ matter: '', client: '', folder: currentFolder || '/', tags: '', description: '', name: '' });
    setSelectedFile(null);
    setShowUpload(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast('Select a file'); return; }
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('folder', uploadForm.folder || '/');
    if (uploadForm.matter) fd.append('matter', uploadForm.matter);
    if (uploadForm.client) fd.append('client', uploadForm.client);
    if (uploadForm.tags) fd.append('tags', uploadForm.tags);
    if (uploadForm.description) fd.append('description', uploadForm.description);
    if (uploadForm.name) fd.append('name', uploadForm.name);

    try {
      const res = await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast(res.data.versioned ? `New version uploaded (v${res.data.data.currentVersion})` : 'Document uploaded');
      setShowUpload(false);
      fetchDocs();
    } catch (err) {
      toast(err.response?.data?.message || 'Upload failed');
    }
  };

  const openPreview = (doc) => {
    const previewable = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain'];
    if (previewable.includes(doc.mimeType)) {
      setShowPreview(doc);
    } else {
      window.open(`/api/documents/${doc._id}/download`, '_blank');
    }
  };

  const openVersions = async (docId) => {
    const res = await api.get(`/documents/${docId}`);
    setShowVersions(res.data.data);
  };

  const deleteDoc = async (id) => {
    try {
      await api.delete(`/documents/${id}`);
      toast('Document deleted');
      fetchDocs();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed');
    }
  };

  const uniqueFolders = ['/', ...folders.filter(f => f !== '/')];

  return (
    <div>
      <div className="page-head">
        <div><h1>Documents</h1><div className="sub">{docs.length} document{docs.length !== 1 ? 's' : ''}</div></div>
        <button className="btn-primary-pill" onClick={openUpload}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Upload document
        </button>
      </div>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search documents..." />
        <button className={`filter-pill ${!currentFolder ? 'active' : ''}`} onClick={() => setCurrentFolder('')}>All folders</button>
        {uniqueFolders.map(f => (
          <button key={f} className={`filter-pill ${currentFolder === f ? 'active' : ''}`} onClick={() => setCurrentFolder(f)}>
            {f === '/' ? 'Root' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : docs.length === 0 ? (
        <div className="empty-state"><p>No documents found.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Folder</th><th>Size</th><th>Version</th><th>Uploaded By</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {docs.map(doc => {
              const info = ICON_BY_MIME[doc.mimeType] || { color: 'var(--ink-400)', label: 'FILE' };
              return (
                <tr key={doc._id} onClick={() => openPreview(doc)}>
                  <td data-label="Name">
                    <div className="name-cell">
                      <span style={{
                        width: 32, height: 32, borderRadius: 8, background: info.color + '18',
                        color: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 10, flexShrink: 0
                      }}>{info.label}</span>
                      <div>
                        <div>{doc.name}</div>
                        {doc.tags?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            {doc.tags.map(t => <span key={t} style={{ fontSize: 10, background: 'var(--blue-100)', color: 'var(--blue-600)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{t}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td data-label="Folder" style={{ fontSize: 13, color: 'var(--ink-400)' }}>{doc.folder}</td>
                  <td data-label="Size">{fmtSize(doc.fileSize)}</td>
                  <td data-label="Version">
                    <button className="stat-link" onClick={(e) => { e.stopPropagation(); openVersions(doc._id); }}>
                      v{doc.currentVersion}
                    </button>
                  </td>
                  <td data-label="Uploaded By">{doc.uploadedBy?.firstName} {doc.uploadedBy?.lastName}</td>
                  <td data-label="Date" style={{ fontSize: 13 }}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                  <td data-label="">
                    <div className="row-actions" onClick={e => e.stopPropagation()}>
                      <button className="row-icon-btn" title="Download" onClick={() => window.open(`/api/documents/${doc._id}/download`, '_blank')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button className="row-icon-btn" title="Delete" onClick={() => deleteDoc(doc._id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Upload modal */}
      {showUpload && (
        <Modal onClose={() => setShowUpload(false)}>
          <h3>Upload document</h3>
          <p className="sub">Upload a file to a matter or client. Re-uploading the same filename creates a new version.</p>
          <div className="field">
            <label>File *</label>
            <input type="file" ref={fileRef} onChange={e => setSelectedFile(e.target.files[0])} style={{ padding: 8 }} />
          </div>
          <div className="field"><label>Name (optional — defaults to filename)</label><input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Matter</label>
              <select value={uploadForm.matter} onChange={e => setUploadForm(f => ({ ...f, matter: e.target.value }))}>
                <option value="">None</option>
                {matters.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Client</label>
              <select value={uploadForm.client} onChange={e => setUploadForm(f => ({ ...f, client: e.target.value }))}>
                <option value="">None</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Folder</label><input value={uploadForm.folder} onChange={e => setUploadForm(f => ({ ...f, folder: e.target.value }))} placeholder="/" /></div>
          <div className="field"><label>Tags (comma-separated)</label><input value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. contract, signed" /></div>
          <div className="field"><label>Description</label><textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpload}>Upload</button>
          </div>
        </Modal>
      )}

      {/* In-browser preview */}
      {showPreview && (
        <Modal onClose={() => setShowPreview(null)}>
          <h3 style={{ marginBottom: 12 }}>{showPreview.name}</h3>
          <div style={{ background: '#f8f8fa', borderRadius: 10, overflow: 'hidden', minHeight: 300 }}>
            {showPreview.mimeType === 'application/pdf' ? (
              <iframe src={`/api/documents/${showPreview._id}/preview`} style={{ width: '100%', height: 500, border: 'none' }} title="PDF Preview" />
            ) : showPreview.mimeType?.startsWith('image/') ? (
              <img src={`/api/documents/${showPreview._id}/preview`} alt={showPreview.name} style={{ width: '100%', maxHeight: 500, objectFit: 'contain' }} />
            ) : showPreview.mimeType === 'text/plain' ? (
              <iframe src={`/api/documents/${showPreview._id}/preview`} style={{ width: '100%', height: 400, border: 'none' }} title="Text Preview" />
            ) : (
              <div className="empty-state"><p>Preview not available for this file type. Use download instead.</p></div>
            )}
          </div>
          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => window.open(`/api/documents/${showPreview._id}/download`, '_blank')}>Download</button>
            <button className="btn btn-primary" onClick={() => setShowPreview(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Version history */}
      {showVersions && (
        <Modal onClose={() => setShowVersions(null)}>
          <h3>Version History — {showVersions.name}</h3>
          <p className="sub">All versions are retained. Re-uploading the same filename creates a new version.</p>
          {showVersions.versions?.length > 0 ? (
            <div>
              {[...showVersions.versions].reverse().map(v => (
                <div key={v._id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Version {v.versionNumber}{v.versionNumber === showVersions.currentVersion ? ' (current)' : ''}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>
                      {v.uploadedBy?.firstName} {v.uploadedBy?.lastName} · {new Date(v.uploadedAt).toLocaleString()} · {fmtSize(v.fileSize)}
                    </div>
                  </div>
                  <button className="row-icon-btn" title="Download this version" onClick={() => window.open(`/api/documents/${showVersions._id}/download?version=${v.versionNumber}`, '_blank')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>No version history.</p></div>
          )}
          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowVersions(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
