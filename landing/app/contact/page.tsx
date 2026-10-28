import type { Metadata } from 'next';
import ContactForm from './contact-form';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Contact the Zana Ride team in Kigali, Rwanda, for general enquiries, business partnerships, merchant onboarding and investment conversations.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Zana Ride',
    description: 'Talk to the Zana Ride team in Kigali, Rwanda.',
    url: 'https://zanaride.rw/contact',
    siteName: 'Zana Ride',
    locale: 'en_RW',
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <main className="site-shell contact-page">
      <header className="site-header contact-header">
        <a className="brand" href="/" aria-label="Zana home">
          <img src="/zana-mark.png" alt="" width="42" height="34" />
          <span>zana<span className="brand-dot">.</span></span>
        </a>
        <nav className="contact-header-actions" aria-label="Contact page navigation">
          <a className="contact-back-link" href="/">Back to home</a>
          <a className="nav-cta" href="https://app.zanaride.rw">Open Zana <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="contact-hero">
        <div className="contact-hero-copy">
          <p className="eyebrow"><span className="live-dot" /> WE'RE HERE TO HELP</p>
          <h1>Let’s talk<span className="brand-dot">.</span></h1>
          <p>Have a question, an idea, or a partnership in mind? Tell us what you need. The Zana team is based in Kigali, Rwanda.</p>
          <div className="contact-location"><span className="contact-location-icon">↗</span><span><strong>Kigali, Rwanda</strong><small>Rides · Deliveries · Shopping</small></span></div>
        </div>
        <div className="contact-orbit-art" aria-hidden="true">
          <div className="contact-orbit contact-orbit-a" />
          <div className="contact-orbit contact-orbit-b" />
          <div className="contact-art-disc"><span>✳</span></div>
          <div className="contact-art-note"><span className="contact-art-note-icon">↗</span><span><strong>Good things start</strong><small>with a conversation.</small></span></div>
          <span className="contact-art-label">MOVE KIGALI</span>
        </div>
      </section>

      <section className="contact-content">
        <div className="contact-form-panel">
          <div className="contact-panel-heading">
            <p className="eyebrow eyebrow-dark">SEND A MESSAGE</p>
            <h2>What can we help<br />you with?</h2>
            <p>Share a few details and we’ll prepare an email for you to send to our team.</p>
          </div>
          <ContactForm />
        </div>

        <aside className="contact-side">
          <div className="contact-direct-card">
            <span className="contact-direct-icon">@</span>
            <p className="contact-card-kicker">PREFER EMAIL?</p>
            <h3>Write to us directly.</h3>
            <p>For questions, partnerships, merchant enquiries or investor conversations, email our team.</p>
            <a className="contact-email-link" href="mailto:support@zanaride.rw">support@zanaride.rw <span aria-hidden="true">↗</span></a>
          </div>
          <div className="contact-topics">
            <p className="eyebrow eyebrow-dark">HOW CAN WE HELP?</p>
            <div className="contact-topic"><span>01</span><div><strong>Customers</strong><p>Questions about rides, deliveries or shopping.</p></div></div>
            <div className="contact-topic"><span>02</span><div><strong>Drivers & merchants</strong><p>Joining the network or growing with Zana.</p></div></div>
            <div className="contact-topic"><span>03</span><div><strong>Partners & investors</strong><p>Strategic partnerships and business opportunities.</p></div></div>
          </div>
          <a className="contact-home-link" href="/">← Explore Zana Ride</a>
        </aside>
      </section>

      <footer className="contact-footer">
        <a className="brand brand-footer" href="/"><img src="/zana-mark.png" alt="" width="36" height="29" /><span>zana<span className="brand-dot">.</span></span></a>
        <span>© {new Date().getFullYear()} Zana Ride · Kigali, Rwanda</span>
        <a href="mailto:support@zanaride.rw">Say hello ↗</a>
      </footer>
    </main>
  );
}
