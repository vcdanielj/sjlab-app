import styles from './empty-state.module.css';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      {icon ? (
        <div className={styles.icon}>{icon}</div>
      ) : (
        <div className={styles.icon}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 18h36" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="14" r="1.5" fill="currentColor" />
            <circle cx="17" cy="14" r="1.5" fill="currentColor" />
            <circle cx="22" cy="14" r="1.5" fill="currentColor" />
            <path d="M16 28h16M20 32h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
