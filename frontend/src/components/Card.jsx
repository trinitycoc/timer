import React from 'react'

function Card({ icon, title, description, onClick, variant = 'default' }) {
  return (
    <div className={`card card-${variant}`} onClick={onClick}>
      {icon && <div className="card-icon">{icon}</div>}
      {title && <h4 className="card-title">{title}</h4>}
      {description && <p className="card-description">{description}</p>}
    </div>
  )
}

export default Card

