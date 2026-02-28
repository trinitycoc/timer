import React from 'react'

function Button({ variant = 'primary', children, onClick, href, ...props }) {
  const className = `btn btn-${variant}`
  
  if (href) {
    return (
      <a 
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    )
  }
  
  return (
    <button className={className} onClick={onClick} {...props}>
      {children}
    </button>
  )
}

export default Button

