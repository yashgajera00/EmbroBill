import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authAPI from '../services/authAPI';
import logo from '../assets/logo.jpg';

export default function Login({ onLoginSuccess, triggerAlert }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authAPI.login(username, password);
      if (data.success) {
        onLoginSuccess(data.username);
        triggerAlert('Logged in successfully.', 'success');
        navigate('/create-invoice');
      } else {
        setError(data.error || 'Invalid username or password.');
        triggerAlert(data.error || 'Invalid credentials.', 'danger');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errMsg = err.response?.data?.error || 'Authentication server unreachable.';
      setError(errMsg);
      triggerAlert(errMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper" style={{ backgroundColor: '#0b1120', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
      <div className="login-container" style={{ width: '100%', maxWidth: '480px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)' }}>
        <div className="login-card" style={{ width: '100%', margin: '16px' }}>
          <div className="login-logo d-flex flex-column align-items-center mb-2">
          <img
            src={logo}
            alt="Logo"
            style={{
              width: '85px',
              height: '85px',
              borderRadius: '16px',
              objectFit: 'cover',
              marginBottom: '12px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
            }}
          />
          <span style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--primary-color)' }}>
            EmbroBill
          </span>
        </div>


        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            <i className="bi bi-exclamation-octagon-fill me-2"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="id_username" className="form-label fw-bold text-black">Username</label>
            <div className="input-group">
              <span className="input-group-text bg-white"><i className="bi bi-person text-muted"></i></span>
              <input
                type="text"
                className="form-control bg-white text-black"
                id="id_username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="id_password" className="form-label fw-bold text-black">Password</label>
            <div className="input-group">
              <span className="input-group-text bg-white"><i className="bi bi-lock text-muted"></i></span>
              <input
                type="password"
                className="form-control bg-white text-black"
                id="id_password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2.5 fs-6 shadow-sm"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Signing In...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right"></i> Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  </div>
);
}
