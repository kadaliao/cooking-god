import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export function Modal({
  children,
  onClose,
  className = '',
  wide,
}: {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  wide?: boolean;
}) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className={`modal ${wide ? 'wide' : ''} ${className}`}
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}
