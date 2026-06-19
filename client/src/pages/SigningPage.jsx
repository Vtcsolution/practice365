import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

export default function SigningPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    api.get(`/signatures/sign/${token}`)
      .then(r => setData(r.data.data))
      .catch(err => setError(err.response?.data?.message || 'Invalid or expired link'));
  }, [token]);

  const handleSign = async () => {
    setSigning(true);
    try {
      await api.post(`/signatures/sign/${token}/complete`);
      setCompleted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Signing failed');
    } finally {
      setSigning(false);
    }
  };

  if (completed) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--green-600)" strokeWidth="2.5" width="32" height="32">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ margin: '0 0 8px' }}>Document Signed</h1>
          <p style={{ color: 'var(--ink-600)', fontSize: 14 }}>
            Your signature has been recorded. A certificate of completion has been generated.
            You may close this window.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px' }}>Unable to Sign</h1>
          <p style={{ color: 'var(--red-600)', fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="auth-page"><div className="auth-card"><p>Loading...</p></div></div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Signature Required</h2>
          <p style={{ color: 'var(--ink-600)', fontSize: 14, margin: '0 0 24px' }}>
            Please review the document below and apply your signature.
          </p>

          <div style={{ background: '#fbfbfd', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><div className="detail-field-label">Document</div><div style={{ fontWeight: 700 }}>{data.documentName}</div></div>
              <div><div className="detail-field-label">Matter</div><div style={{ fontWeight: 600 }}>{data.matterName || '—'}</div></div>
              <div><div className="detail-field-label">Signer</div><div style={{ fontWeight: 600 }}>{data.signerName}</div></div>
              <div><div className="detail-field-label">Email</div><div style={{ fontWeight: 600 }}>{data.signerEmail}</div></div>
            </div>
          </div>

          {/* Document preview */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 24, background: '#fff' }}>
            <iframe src={data.previewUrl} style={{ width: '100%', height: 400, border: 'none' }} title="Document Preview" />
          </div>

          {/* Signature area */}
          <div style={{ border: '2px dashed var(--line)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 28, fontFamily: "'Georgia', serif", fontStyle: 'italic', color: 'var(--navy-900)', marginBottom: 8 }}>
              {data.signerName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>
              By clicking "Apply Signature" below, you agree this constitutes your electronic signature.
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSign} disabled={signing}
            style={{ width: '100%', padding: 14, fontSize: 16 }}>
            {signing ? 'Applying signature...' : 'Apply Signature & Complete'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--ink-400)', textAlign: 'center', marginTop: 16 }}>
            Your IP address and browser information will be recorded as part of the signing audit trail.
            This is a single-use signing link.
          </p>
        </div>
      </div>
    </div>
  );
}
