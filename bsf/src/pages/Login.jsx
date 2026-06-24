import { useState } from 'react';
import styles from './Login.module.css';

const HexLogo = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="#12151a" stroke="#c4983e" strokeWidth="1" />
    <polygon points="18,8 27,13 27,23 18,28 9,23 9,13" fill="#c4983e" fillOpacity="0.12" />
    <line x1="18" y1="2" x2="18" y2="34" stroke="#c4983e" strokeWidth="0.5" strokeOpacity="0.3" />
    <line x1="4" y1="10" x2="32" y2="26" stroke="#c4983e" strokeWidth="0.5" strokeOpacity="0.3" />
    <line x1="32" y1="10" x2="4" y2="26" stroke="#c4983e" strokeWidth="0.5" strokeOpacity="0.3" />
    <circle cx="18" cy="18" r="3" fill="#c4983e" />
  </svg>
);

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // TODO: integrate real auth
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    if (onLogin) onLogin({ email });
  };

  return (
    <div className={styles.root}>
      {/* LEFT PANEL */}
      <div className={styles.left}>
        <div className={styles.gridOverlay} aria-hidden="true" />

        <div className={styles.logoMark}>
          <HexLogo size={36} />
          <div className={styles.logoText}>
            <span className={styles.logoMain}>BSF</span>
            <span className={styles.logoSub}>Business Syndicate Framework</span>
          </div>
        </div>

        <h1 className={styles.headline}>
          Inteligência<br />de <em>mercado</em><br />estruturada.
        </h1>
        <p className={styles.tagline}>
          Pipeline de dados segmentado por CNAEs e municípios para análise de oportunidades de negócio.
        </p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>1.3k+</span>
            <span className={styles.statLabel}>CNAEs</span>
          </div>
          <div className={styles.dividerV} />
          <div className={styles.stat}>
            <span className={styles.statNum}>5.5k</span>
            <span className={styles.statLabel}>Municípios</span>
          </div>
          <div className={styles.dividerV} />
          <div className={styles.stat}>
            <span className={styles.statNum}>∞</span>
            <span className={styles.statLabel}>Planos</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className={styles.right}>
        <p className={styles.formTitle}>Acesso ao sistema</p>
        <h2 className={styles.formSubtitle}>Bem-vindo de volta.</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">E-mail corporativo</label>
            <div className={styles.inputWrap}>
              <input
                id="email"
                className={styles.input}
                type="email"
                placeholder="usuario@empresa.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <i className={`ti ti-mail ${styles.inputIcon}`} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Senha</label>
            <div className={styles.inputWrap}>
              <input
                id="password"
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.inputIconBtn}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              Manter conectado
            </label>
            <button type="button" className={styles.forgot}>Esqueceu a senha?</button>
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? <span className={styles.spinner} /> : 'Entrar'}
          </button>
        </form>

        <div className={styles.footer}>
          <div className={styles.footerLine} />
          <span className={styles.footerText}>Acesso restrito a usuários autorizados</span>
          <div className={styles.footerLine} />
        </div>

        <span className={styles.version}>v1.0.0</span>
      </div>
    </div>
  );
}