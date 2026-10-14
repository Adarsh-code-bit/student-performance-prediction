import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Boxes, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.message || 'Invalid email or password. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #312E81 50%, #1E293B 100%)',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      {/* Decorative background circles */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0
      }}>
        <div style={{
          position: 'absolute', width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          top: '-200px', left: '-200px', borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)',
          bottom: '-100px', right: '-100px', borderRadius: '50%'
        }} />
      </div>

      {/* Login Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '420px',
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.2)',
        padding: '40px 36px',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {/* Logo */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #818CF8, #4F46E5)',
            borderRadius: '14px',
            boxShadow: '0 4px 16px rgba(79, 70, 229, 0.4)',
            marginBottom: '18px'
          }}>
            <Boxes size={28} color="#fff" />
          </div>

          <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: 700,
            letterSpacing: '2px', textTransform: 'uppercase',
            background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            SmartInventory
          </div>

          <h1 style={{
            fontSize: '26px', fontWeight: 800, color: '#0F172A',
            letterSpacing: '-0.5px', margin: '10px 0 6px'
          }}>
            Welcome Back
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', fontWeight: 500, margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: '10px', padding: '12px 14px',
            marginBottom: '20px', animation: 'fadeIn 0.2s ease'
          }}>
            <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#DC2626', fontWeight: 500, margin: 0 }}>
              {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email Field */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#334155', marginBottom: '7px'
            }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                color: '#94A3B8', pointerEvents: 'none', display: 'flex', alignItems: 'center'
              }}>
                <Mail size={16} />
              </div>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 14px 11px 40px',
                  fontSize: '14px', fontFamily: 'inherit',
                  color: '#1E293B', background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '10px', outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#818CF8';
                  e.target.style.boxShadow = '0 0 0 3px rgba(129, 140, 248, 0.15)';
                  e.target.style.background = '#fff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#F8FAFC';
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '26px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#334155', marginBottom: '7px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                color: '#94A3B8', pointerEvents: 'none', display: 'flex', alignItems: 'center'
              }}>
                <Lock size={16} />
              </div>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 14px 11px 40px',
                  fontSize: '14px', fontFamily: 'inherit',
                  color: '#1E293B', background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '10px', outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#818CF8';
                  e.target.style.boxShadow = '0 0 0 3px rgba(129, 140, 248, 0.15)';
                  e.target.style.background = '#fff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#F8FAFC';
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              fontSize: '15px', fontWeight: 700,
              fontFamily: 'inherit',
              color: '#fff',
              background: loading
                ? 'linear-gradient(135deg, #A5B4FC, #818CF8)'
                : 'linear-gradient(135deg, #6366F1, #4F46E5)',
              border: 'none', borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(79, 70, 229, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s ease',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5, #4338CA)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 70, 229, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #6366F1, #4F46E5)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '18px', height: '18px',
                  border: '2.5px solid rgba(255,255,255,0.4)',
                  borderTop: '2.5px solid #fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={17} />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Demo Hint */}
        <div style={{
          marginTop: '28px', padding: '14px 16px',
          background: '#F1F5F9', borderRadius: '10px',
          border: '1px solid #E2E8F0'
        }}>
          <p style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Demo Accounts
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {[
              ['admin@example.com', 'Admin'],
              ['manager@example.com', 'Store Manager'],
              ['picker@example.com', 'Picker'],
              ['auditor@example.com', 'Auditor'],
            ].map(([demoEmail, role]) => (
              <button
                key={demoEmail}
                type="button"
                onClick={() => { setEmail(demoEmail); setPassword('password123'); }}
                style={{
                  textAlign: 'left', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '3px 0',
                  fontSize: '12px', color: '#4F46E5', fontWeight: 600,
                  fontFamily: 'inherit', textDecoration: 'underline',
                  textDecorationStyle: 'dotted', textUnderlineOffset: '2px'
                }}
                title={`Fill ${demoEmail} / password123`}
              >
                {role}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px', marginBottom: 0 }}>
            Password for all demo accounts: <strong>password123</strong>
          </p>
        </div>

        {/* Footer */}
        <p style={{
          marginTop: '24px', textAlign: 'center',
          fontSize: '12px', color: '#94A3B8', fontWeight: 500
        }}>
          Smart Inventory v1.0 · Quick Commerce Platform
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
