import React from 'react';
import PropTypes from 'prop-types';
import styles from './SubmitButton.module.css';
const SubmitButton = ({
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
  variant = 'primary',
  children,
  className,
  ...rest
}) => {
  const handleClick = (e) => {
    if (!disabled && !loading && onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`${styles.button} ${styles[variant]} ${loading ? styles.loading : ''} ${className || ''}`}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden='true' />}
      <span className={styles.content}>{children}</span>
    </button>
  );
};

SubmitButton.propTypes = {
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default SubmitButton;
