import React from 'react';

export default function Rupee({ className = '', style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="currentColor"
      className={`bi bi-currency-rupee ${className}`}
      viewBox="0 0 16 16"
      style={{
        display: 'inline-block',
        verticalAlign: '-0.15em',
        ...style
      }}
    >
      <path d="M4 3.06h2.726c1.22 0 2.12.575 2.325 1.724H4v1.051h5.051C8.855 7.012 7.6 7.67 6.138 7.67H4v1.091h2.172l3.22 4.679h1.353L7.351 8.799c1.62-.215 2.921-1.082 3.242-2.936H12V4.81h-1.428c-.244-1.523-1.683-2.45-3.863-2.45H4v.7z" />
    </svg>
  );
}
