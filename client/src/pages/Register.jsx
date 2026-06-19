import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'attorney' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="sub">Get started with Practice365</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>First name</label>
            <input name="firstName" value={form.firstName} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Last name</label>
            <input name="lastName" value={form.lastName} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          <div className="field">
            <label>Role</label>
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="attorney">Attorney</option>
              <option value="staff">Staff / Paralegal</option>
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>
        <Link to="/login" className="link">Already have an account? Sign in</Link>
      </div>
    </div>
  );
}
