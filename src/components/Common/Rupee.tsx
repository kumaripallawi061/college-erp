import React from 'react';

interface RupeeIconProps {
  className?: string;
}

export const RupeeIcon: React.FC<RupeeIconProps> = ({ className = 'w-3.5 h-3.5 inline-block -mt-0.5 mr-0.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M6 3h12" />
    <path d="M6 8h12" />
    <path d="M6 13l8.5 8" />
    <path d="M6 13h3a4.5 4.5 0 0 0 0-9" />
  </svg>
);

interface MoneyProps {
  amount: number;
  className?: string;
  iconClassName?: string;
  decimals?: boolean;
}

export const Money: React.FC<MoneyProps> = ({
  amount,
  className = '',
  iconClassName = 'w-3.5 h-3.5 inline-block -mt-0.5 mr-0.5',
  decimals = false,
}) => {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const formatted = safeAmount.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });

  return (
    <span className={`inline-flex items-center font-medium ${className}`}>
      <RupeeIcon className={iconClassName} />
      <span>{formatted}</span>
    </span>
  );
};
