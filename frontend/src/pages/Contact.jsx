import React, { useState } from 'react'
import SectionTitle from '../components/SectionTitle'
import Button from '../components/Button'

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [status, setStatus] = useState({ type: null, message: '' })

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    setStatus({
      type: 'success',
      message: 'Thanks for reaching out! Our contact form is being upgraded—please use Discord or WhatsApp for now.'
    })
    setFormData({ name: '', email: '', message: '' })
  }

  return (
    <section className="contact-page">
      <SectionTitle>Contact Us</SectionTitle>
      <div className="contact-content">
        <p className="page-description">
          Have questions or want to join the Trinity family? Get in touch with us!
        </p>

        {/* <div className="contact-note">
          <p>You can contact <span className="highlight-name">Admin | HellRaiser</span> or <span className="highlight-name">Staff | Thomas Shelby</span> on <strong>Band</strong> to join Trinity.</p>
        </div> */}

        <div className="contact-layout">
          <div className="contact-methods">
            <div className="contact-card">
              <div className="contact-icon">💬</div>
              <h4>Discord</h4>
              <p>Join our Discord server for instant communication and community updates</p>
              <a
                href="https://discord.gg/Cqsq65tY2S"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Join Discord
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-icon">📱</div>
              <h4>WhatsApp</h4>
              <p>Connect with us on WhatsApp for recruitment and clan discussions</p>
              <a
                href="https://chat.whatsapp.com/HBCQFJ6xvcy5Lq8tW3YjG6"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Join WhatsApp
              </a>
            </div>
          </div>

          <div className="feedback-form">
            <h3>Feedback &amp; Questions</h3>
            <p>Share your thoughts or ask anything about Trinity. We usually respond within a day.</p>
            <form onSubmit={handleSubmit}>
              <label htmlFor="contact-name">Name</label>
              <input
                type="text"
                id="contact-name"
                name="name"
                placeholder="Your name"
                value={formData.name}
                onChange={handleChange}
                required
              />

              <label htmlFor="contact-email">Email</label>
              <input
                type="email"
                id="contact-email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <label htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                name="message"
                placeholder="Tell us how we can help..."
                rows="5"
                value={formData.message}
                onChange={handleChange}
                required
              />

              {status.message && (
                <div
                  className={`form-status ${status.type === 'success' ? 'form-status--success' : 'form-status--error'}`}
                  role={status.type === 'error' ? 'alert' : 'status'}
                >
                  {status.message}
                </div>
              )}

              <Button type="submit">Send Feedback</Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact

