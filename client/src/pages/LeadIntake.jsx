import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

const PRACTICE_AREAS = [
  'Contract Disputes', 'Estate Planning', 'Real Estate',
  'Business Formation', 'Family Law', 'Personal Injury',
  'Employment Law', 'Immigration', 'Criminal Defense', 'Other'
];

const SOURCES = ['website', 'referral', 'phone', 'walk-in', 'advertisement', 'other'];

export default function LeadIntake() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    practiceArea: 'Contract Disputes', source: 'website',
    referralSource: '', opposingPartyName: '', opposingPartyAttorney: '',
    caseDescription: '', address: { street: '', city: '', state: '', zip: '' }
  });
  const [cfValues, setCfValues] = useState({});

  useEffect(() => {
    if (form.practiceArea) {
      api.get('/custom-fields', { params: { practiceArea: form.practiceArea, appliesTo: 'lead' } })
        .then(r => setCustomFields(r.data.data || []))
        .catch(() => setCustomFields([]));
    }
  }, [form.practiceArea]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAddr = (k, v) => setForm(f => ({ ...f, address: { ...f.address, [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) {
      toast('Please fill required fields');
      return;
    }
    setLoading(true);
    try {
      const data = { ...form };
      if (Object.keys(cfValues).length) data.customFields = cfValues;
      await api.post('/leads/intake', data);
      toast('Lead submitted successfully');
      navigate(user ? '/leads' : '/leads/intake');
      if (!user) {
        setForm({ firstName: '', lastName: '', email: '', phone: '', practiceArea: 'Contract Disputes', source: 'website', referralSource: '', opposingPartyName: '', opposingPartyAttorney: '', caseDescription: '', address: { street: '', city: '', state: '', zip: '' } });
        setCfValues({});
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="intake-page">
      {user && (
        <button className="detail-back" onClick={() => navigate('/leads')}>← Back to Leads</button>
      )}
      <div className="intake-card">
        <h2>Client Intake Form</h2>
        <p className="sub">Please fill out the information below. All fields marked * are required.</p>
        <form onSubmit={submit}>
          <div className="field-row">
            <div className="field">
              <label>First Name *</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
            </div>
            <div className="field">
              <label>Last Name *</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Practice Area *</label>
              <select value={form.practiceArea} onChange={e => set('practiceArea', e.target.value)}>
                {PRACTICE_AREAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}>
                {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {form.source === 'referral' && (
            <div className="field">
              <label>Referral Source</label>
              <input value={form.referralSource} onChange={e => set('referralSource', e.target.value)} placeholder="Who referred you?" />
            </div>
          )}
          <div className="field">
            <label>Street Address</label>
            <input value={form.address.street} onChange={e => setAddr('street', e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>City</label>
              <input value={form.address.city} onChange={e => setAddr('city', e.target.value)} />
            </div>
            <div className="field">
              <label>State</label>
              <input value={form.address.state} onChange={e => setAddr('state', e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>ZIP</label>
            <input value={form.address.zip} onChange={e => setAddr('zip', e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Opposing Party Name</label>
              <input value={form.opposingPartyName} onChange={e => set('opposingPartyName', e.target.value)} />
            </div>
            <div className="field">
              <label>Opposing Party Attorney</label>
              <input value={form.opposingPartyAttorney} onChange={e => set('opposingPartyAttorney', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Case Description</label>
            <textarea value={form.caseDescription} onChange={e => set('caseDescription', e.target.value)}
              placeholder="Briefly describe your legal matter..." rows={4} />
          </div>

          {customFields.length > 0 && (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '20px 0 14px' }}>Additional Information</h3>
              {customFields.map(cf => (
                <div className="field" key={cf._id}>
                  <label>{cf.name}{cf.isRequired ? ' *' : ''}</label>
                  {cf.fieldType === 'select' ? (
                    <select value={cfValues[cf.fieldKey] || ''} onChange={e => setCfValues(v => ({ ...v, [cf.fieldKey]: e.target.value }))}>
                      <option value="">Select...</option>
                      {cf.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : cf.fieldType === 'textarea' ? (
                    <textarea value={cfValues[cf.fieldKey] || ''} onChange={e => setCfValues(v => ({ ...v, [cf.fieldKey]: e.target.value }))} />
                  ) : cf.fieldType === 'checkbox' ? (
                    <input type="checkbox" checked={cfValues[cf.fieldKey] || false} onChange={e => setCfValues(v => ({ ...v, [cf.fieldKey]: e.target.checked }))} style={{ width: 'auto' }} />
                  ) : (
                    <input type={cf.fieldType === 'number' ? 'number' : cf.fieldType === 'date' ? 'date' : 'text'}
                      value={cfValues[cf.fieldKey] || ''} onChange={e => setCfValues(v => ({ ...v, [cf.fieldKey]: e.target.value }))} />
                  )}
                </div>
              ))}
            </>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
            {loading ? 'Submitting...' : 'Submit Intake Form'}
          </button>
        </form>
      </div>
    </div>
  );

  if (!user) {
    return <div style={{ minHeight: '100vh', background: 'var(--paper)', padding: '40px 20px' }}>{content}</div>;
  }
  return content;
}
