import styles from './ThemeToggle.module.css';

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      className={styles.btn}
      onClick={onToggle}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      <span className={`${styles.track} ${isDark ? styles.dark : styles.light}`}>
        <span className={styles.thumb}>
          <i className={`ti ${isDark ? 'ti-moon' : 'ti-sun'}`} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}