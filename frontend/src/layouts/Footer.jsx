import React from 'react'
import { Link } from 'react-router-dom'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand footer-section">
          <h4 className="footer-title">Trinity</h4>
          <p className="footer-text">
            Trinity is a family of dedicated Clash of Clans players committed to growth, teamwork, and competitive
            excellence. Discover our clans, track CWL progress, and join a community that supports every member.
          </p>
        </div>

        <div className="footer-section footer-links">
          <h4 className="footer-heading">Quick Links</h4>
          <ul>
            <li>
              <Link to="/" className="footer-link-item">
                Home
              </Link>
            </li>
            <li>
              <Link to="/about" className="footer-link-item">
                About
              </Link>
            </li>
            <li>
              <Link to="/clans" className="footer-link-item">
                Clans
              </Link>
            </li>
            <li>
              <Link to="/cwl" className="footer-link-item">
                CWL
              </Link>
            </li>
            <li>
              <Link to="/features" className="footer-link-item">
                Features
              </Link>
            </li>
          </ul>
        </div>

        <div className="footer-section footer-socials">
          <h4 className="footer-heading">Connect With Us</h4>
          <div className="footer-socials-list">
            <a
              href="https://discord.gg/Cqsq65tY2S"
              className="footer-social footer-social--discord"
              aria-label="Discord"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.333 18.333 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.59.099 18.085a.082.082 0 00.031.057c2.053 1.506 4.041 2.422 5.994 3.03a.077.077 0 00.084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.172 13.172 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.191.372-.291a.074.074 0 01.078-.01c3.927 1.793 8.18 1.793 12.062 0a.074.074 0 01.079.009c.12.1.246.198.372.292a.077.077 0 01-.006.128 12.64 12.64 0 01-1.873.891.076.076 0 00-.04.107c.36.698.772 1.363 1.226 1.993a.076.076 0 00.084.028c1.96-.608 3.949-1.525 6.002-3.03a.077.077 0 00.03-.056c.5-5.177-.838-9.674-3.548-13.69a.061.061 0 00-.032-.028zM8.02 15.331c-1.183 0-2.155-1.086-2.155-2.419 0-1.332.955-2.418 2.155-2.418 1.21 0 2.175 1.096 2.155 2.418 0 1.333-.955 2.419-2.155 2.419zm7.975 0c-1.183 0-2.155-1.086-2.155-2.419 0-1.332.955-2.418 2.155-2.418 1.21 0 2.175 1.096 2.155 2.418 0 1.333-.945 2.419-2.155 2.419z" />
              </svg>
            </a>
            <a
              href="https://chat.whatsapp.com/HBCQFJ6xvcy5Lq8tW3YjG6"
              className="footer-social footer-social--whatsapp"
              aria-label="WhatsApp"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.52 3.475A11.85 11.85 0 0012.075 0C5.495.003.255 5.243.257 11.822a11.74 11.74 0 001.845 6.281L0 24l6.06-1.995a11.86 11.86 0 005.99 1.602h.005c6.577-.003 11.815-5.243 11.818-11.822A11.746 11.746 0 0020.52 3.475zm-8.445 17.26h-.004a9.82 9.82 0 01-4.995-1.356l-.358-.212-3.597 1.183 1.183-3.506-.233-.36a9.79 9.79 0 01-1.51-5.233C2.564 6.35 6.411 2.5 11.12 2.5a9.71 9.71 0 016.909 2.86 9.73 9.73 0 012.857 6.935c-.004 5.707-4.848 10.441-10.811 10.44zm5.935-7.82c-.326-.163-1.927-.949-2.227-1.057-.301-.112-.52-.163-.737.162-.215.326-.847 1.058-1.038 1.276-.19.215-.379.244-.704.082-.326-.163-1.375-.507-2.62-1.617-.968-.86-1.62-1.92-1.81-2.245-.19-.326-.02-.5.143-.662.147-.146.326-.379.49-.568.164-.19.219-.326.328-.543.108-.215.054-.406-.027-.569-.082-.163-.737-1.776-1.01-2.434-.266-.64-.538-.552-.737-.563-.19-.01-.406-.01-.625-.01-.215 0-.569.082-.864.406-.296.326-1.133 1.107-1.133 2.697 0 1.59 1.159 3.13 1.322 3.346.163.215 2.284 3.49 5.534 4.888.774.334 1.379.534 1.85.682.777.247 1.484.212 2.043.128.623-.093 1.927-.787 2.198-1.547.27-.76.27-1.41.19-1.547-.082-.137-.301-.219-.625-.379z" />
              </svg>
            </a>
            <a
              href="https://clashatlas.vercel.app/"
              className="footer-social footer-social--clashatlas"
              aria-label="ClashAtlas"
              target="_blank"
              rel="noopener noreferrer"
              title="Explore Clash of Clans world"
            >
              🗺️
            </a>
          </div>
        </div>

        <div className="footer-section footer-copy">
          <h4 className="footer-heading">Copyright</h4>
          <p className="footer-text">
            All images, graphics, and content on this website are the property of Trinity. Any use or reproduction of
            these materials without permission is strictly prohibited.
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          &copy;{year} Trinity. Built by{' '}
          <a href="https://github.com/abhiiiijain" target="_blank" rel="noopener noreferrer">
            Hell Raiser
          </a>
        </p>
      </div>
    </footer>
  )
}

export default Footer

