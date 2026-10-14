import '../../components/company-hero.css';

export const metadata = {
  title: 'Ogbiti Davis Kalu | Founder & CEO — Zana Ride',
  description:
    'Meet Ogbiti Davis Kalu, founder of Bastion Holdings and Chief Executive Officer of Zana Ride in Kigali, Rwanda.',
  openGraph: {
    title: 'Ogbiti Davis Kalu | Zana Ride',
    description:
      'Founder of Bastion Holdings and Chief Executive Officer of Zana Ride, Rwanda.',
    type: 'profile',
    images: ['/kalu-portrait.png'],
  },
};

export default function CompanyPage() {
  return (
    <main className="kalu-page">
      <header className="kalu-topbar">
        <a className="kalu-wordmark" href="/" aria-label="Zana home">
          ZANA<span>.</span>
        </a>
        <nav aria-label="Main navigation" className="kalu-nav">
          <a href="#leadership">Leadership</a>
          <a href="#biography">Biography</a>
          <a href="#ventures">Ventures</a>
          <a href="/" className="kalu-nav__cta">Explore Zana</a>
        </nav>
      </header>

      <section className="kalu-hero" id="leadership">
        <div className="kalu-hero__inner">
          <div className="kalu-hero__copy">
            <p className="kalu-eyebrow"><span /> Founder &amp; Chief Executive Officer</p>
            <h1>Ogbiti Davis <em>Kalu</em></h1>
            <p className="kalu-hero__lede">
              Founder of Bastion Holdings and Chief Executive of Zana Ride, Rwanda’s homegrown
              mobility platform — built to connect people, deliveries and everyday commerce
              across Kigali.
            </p>
            <div className="kalu-facts" aria-label="Profile details">
              <div><span>Based in</span><strong>Kigali, Rwanda</strong></div>
              <div><span>Holding company</span><strong>Bastion Holdings</strong></div>
              <div><span>Flagship venture</span><strong>Zana Ride</strong></div>
            </div>
          </div>
          <div className="kalu-hero__portrait">
            <div className="kalu-hero__portrait-frame">
              <img
                src="/kalu-portrait.png"
                alt="Ogbiti Davis Kalu, Founder and Chief Executive Officer"
                width={757}
                height={767}
                fetchPriority="high"
              />
            </div>
            <p className="kalu-hero__caption">Building for the way Kigali moves.</p>
          </div>
        </div>
        <div className="kalu-hero__bottomline" aria-hidden="true"><span /> BUILT IN RWANDA <span /> MADE FOR THE CITY <span /></div>
      </section>

      <section className="kalu-bio" id="biography">
        <div className="kalu-section-label">01 / The founder</div>
        <div className="kalu-bio__grid">
          <h2>A builder’s approach to Rwanda’s growing economy.</h2>
          <div className="kalu-bio__copy">
            <p>
              Ogbiti Davis Kalu founded Bastion Holdings with a simple conviction: Kigali’s
              fast-growing economy needed infrastructure built specifically for it, not adapted
              from elsewhere. That conviction became <strong>Zana Ride</strong> — a ride-hailing,
              delivery and marketplace platform designed around how people in Kigali actually
              move, shop and get paid.
            </p>
            <p>
              Before Zana Ride, his work centered on <strong>currency exchange</strong>, giving
              him a practical view of how money moves through Rwanda’s economy — cash, mobile
              money and digital payments, often within the same transaction. That grounding
              informs how Bastion Holdings approaches payments and builds services for the
              realities of the local market.
            </p>
            <p>
              His approach is straightforward: build for the market in front of you, move
              deliberately, and keep the people using the platform — drivers, riders and
              merchants — at the center of every decision.
            </p>
          </div>
        </div>
      </section>

      <section className="kalu-ventures" id="ventures">
        <div className="kalu-ventures__head">
          <div className="kalu-section-label">02 / The work</div>
          <h2>What Bastion Holdings builds.</h2>
          <p>A Rwanda-rooted holding company focused on mobility, commerce and practical financial services.</p>
        </div>
        <div className="kalu-ventures__grid">
          <article className="kalu-venture-card">
            <span className="kalu-venture-card__index">01</span>
            <div>
              <p className="kalu-venture-card__tag">Flagship venture</p>
              <h3>Zana Ride</h3>
              <p>
                A Kigali-first mobility, delivery and marketplace platform connecting riders,
                drivers, merchants and market agents — built around how the city moves every day.
              </p>
              <a href="https://app.zanaride.rw">Explore Zana <span aria-hidden="true">↗</span></a>
            </div>
          </article>
          <article className="kalu-venture-card">
            <span className="kalu-venture-card__index">02</span>
            <div>
              <p className="kalu-venture-card__tag">Holding company</p>
              <h3>Bastion Holdings</h3>
              <p>
                The parent company behind Zana Ride, focused on building services shaped by
                local needs and the realities of doing business in Rwanda.
              </p>
              <a href="https://zanaride.rw">Visit Zana Ride <span aria-hidden="true">↗</span></a>
            </div>
          </article>
        </div>
      </section>

      <footer className="kalu-footer">
        <a className="kalu-wordmark" href="/">ZANA<span>.</span></a>
        <p>Ogbiti Davis Kalu · Kigali, Rwanda</p>
        <a href="mailto:hello@zanaride.rw">Contact Zana <span aria-hidden="true">↗</span></a>
      </footer>
    </main>
  );
}
