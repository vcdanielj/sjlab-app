import styles from './badge.module.css';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ variant = 'neutral', size = 'sm', children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${styles[size]}`}>
      {children}
    </span>
  );
}
