import styles from './Sidebar.module.css';

const HexLogo = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="14,1 25,7.5 25,20.5 14,27 3,20.5 3,7.5" fill="#12151a" stroke="#c4983e" strokeWidth="1" />
    <circle cx="14" cy="14" r="3" fill="#c4983e" />
    <line x1="14" y1="1" x2="14" y2="27" stroke="#c4983e" strokeWidth="0.5" strokeOpacity="0.25" />
    <line x1="3" y1="7.5" x2="25" y2="20.5" stroke="#c4983e" strokeWidth="0.5" strokeOpacity="0.25" />
    <line x1="25" y1="7.5" x2="3" y2="20.5" stroke="#c4983e" strokeWidth="0.5" strokeOpacity="0.25" />
  </svg>
);

const NAV = [
  {
    section: 'Principal',
    items: [
      { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
      { id: 'pipeline',  icon: 'ti-settings-2',       label: 'Pipeline' },
      { id: 'planos',    icon: 'ti-file-description',  label: 'Planos' },
    ],
  },
  {
    section: 'Dados',
    items: [
      { id: 'cnaes',      icon: 'ti-building',     label: 'CNAEs' },
      { id: 'municipios', icon: 'ti-map-pin',       label: 'Municípios' },
      { id: 'resultados', icon: 'ti-table',         label: 'Resultados' },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { id: 'usuarios',      icon: 'ti-users',    label: 'Usuários' },
      { id: 'configuracoes', icon: 'ti-settings', label: 'Configurações' },
    ],
  },
];

export default function Sidebar({ active = 'dashboard', onNavigate, user }) {
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <aside className={styles.sidebar}>
      {/* LOGO */}
      <div className={styles.logo}>
        <HexLogo />
        <div className={styles.logoText}>
          <span className={styles.logoMain}>BSF</span>
          <span className={styles.logoSub}>Syndicate</span>
        </div>
      </div>

      {/* NAV */}
      <nav className={styles.nav}>
        {NAV.map(group => (
          <div key={group.section} className={styles.group}>
            <span className={styles.groupLabel}>{group.section}</span>
            {group.items.map(item => (
              <button
                key={item.id}
                className={`${styles.navItem} ${active === item.id ? styles.active : ''}`}
                onClick={() => onNavigate?.(item.id)}
                aria-current={active === item.id ? 'page' : undefined}
              >
                <i className={`ti ${item.icon}`} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* USER */}
      <div className={styles.footer}>
        <div className={styles.user}>
          <div className={styles.avatar} aria-hidden="true">{initials}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name ?? 'Usuário'}</span>
            <span className={styles.userRole}>{user?.role ?? 'Administrador'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}