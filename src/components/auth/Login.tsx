import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PasswordInput } from '../common/PasswordInput';

type LoginProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: (identifier: string, newPassword: string) => Promise<string>;
  busy: boolean;
  error: string;
};

export function Login({ onSubmit, onReset, busy, error }: LoginProps) {
  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [resetError, setResetError] = useState('');
  const [resetDone, setResetDone] = useState(false);

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('newPassword') ?? '');
    if (password !== String(data.get('confirmPassword') ?? '')) {
      setResetError('The new passwords do not match.');
      return;
    }
    setResetError('');
    const message = await onReset(String(data.get('identifier') ?? ''), password);
    setResetError(message);
    if (!message) setResetDone(true);
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <div className="slide-brand" style={{ padding: 0, border: 0 }}>
          <div className="brand-icon">
            <span />
          </div>
          <div className="brand-text">Accounting, in clear focus</div>
        </div>

        <div className="art-copy">
          <small className="eyebrow" style={{ color: '#d0e55e' }}></small>
          <h1>
            Make every
            <br />
            number <em>matter.</em>
          </h1>
          <p>
            A connected workspace for your general books, banking, cash flow,
            and executive financial decisions.
          </p>
        </div>

        <div
          className="art-bottom"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#8aa697',
          }}
        >
          <span>Power By Kaynet Tech</span>
          <span>@ 2026</span>
        </div>
      </section>

      <section className="login-side">
        {mode === 'reset' && (
          <form className="login-form" onSubmit={submitReset}>
            <div className="login-title">
              <div className="login-logo-wrap">
                <img src="/images/Hicad.png" alt="HICAD" />
              </div>
              <h2>Reset your password</h2>
              <p>Enter your username and choose a new password.</p>
            </div>
            {resetError && <div className="error-banner">{resetError}</div>}
            {resetDone ? (
              <>
                <div className="success-banner">
                  Your password has been reset. Sign in with the new password.
                </div>
                <button
                  className="btn btn-primary login-submit"
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setResetDone(false);
                    setResetError('');
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <label className="field">
                  Username or email
                  <input
                    name="identifier"
                    autoComplete="username"
                    placeholder="e.g. admin"
                    required
                  />
                </label>
                <label className="field">
                  New password
                  <PasswordInput
                    name="newPassword"
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    minLength={12}
                    required
                  />
                </label>
                <label className="field">
                  Confirm new password
                  <PasswordInput
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <button
                  className="btn btn-primary login-submit"
                  disabled={busy}
                >
                  {busy ? 'Resetting…' : 'Reset password'}
                  <ArrowUpRight size={16} />
                </button>
                <button
                  className="btn btn-ghost login-back"
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setResetError('');
                  }}
                >
                  Back to sign in
                </button>
              </>
            )}
          </form>
        )}

        {mode === 'signin' && (
          <form className="login-form" onSubmit={onSubmit}>
            <div className="login-title">
              <div className="login-logo-wrap">
                <img src="/images/Hicad.png" alt="HICAD" />
              </div>
              <h2>Company sign in</h2>
              <p>Sign in to your company workspace.</p>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <label className="field">
              Username or email
              <input
                name="identifier"
                autoComplete="username"
                placeholder="e.g. admin"
                required
              />
            </label>

            <label className="field">
              Password
              <PasswordInput
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </label>

            <div className="login-options">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" defaultChecked /> Remember device
              </label>
              <button
                className="link-button"
                type="button"
                onClick={() => {
                  setMode('reset');
                  setResetDone(false);
                  setResetError('');
                }}
              >
                Forgot password?
              </button>
            </div>

            <button className="btn btn-primary login-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to Ledger'}
              <ArrowUpRight size={16} />
            </button>

            <div className="secure"></div>
          </form>
        )}
      </section>
    </main>
  );
}
