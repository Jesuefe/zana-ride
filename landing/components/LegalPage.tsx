'use client';

import Link from 'next/link';

/**
 * Shared shell for the privacy policy and terms. Deliberately plain: these
 * are documents people read when something has gone wrong or when a store
 * reviewer is checking compliance, so legibility beats art direction.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="legal">
      <header className="legal-head">
        <Link href="/" className="legal-back">
          <span className="legal-mark">
            <img src="/zana-mark.png" alt="" width={34} height={26} />
            <span>
              z<span>a</span>na
            </span>
          </span>
        </Link>
      </header>

      <main className="legal-body">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        {children}

        <footer className="legal-foot">
          <Link href="/">Back to Zana</Link>
          <a href="mailto:hello@zanaride.rw">hello@zanaride.rw</a>
        </footer>
      </main>
    </div>
  );
}
