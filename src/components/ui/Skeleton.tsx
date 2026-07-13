import styles from './skeleton.module.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius,
  className,
}: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className || ''}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={`${styles.textGroup} ${className || ''}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="14px"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`${styles.card} ${className || ''}`}>
      <Skeleton height="16px" width="40%" />
      <Skeleton height="32px" width="60%" />
      <Skeleton height="12px" width="80%" />
    </div>
  );
}
