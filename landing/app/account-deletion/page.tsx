import LegalPage from '../../components/LegalPage';

export const metadata = {
  title: 'Delete Your Account — Zana',
  description: 'How to request deletion of your Zana account and data.',
};

export default function AccountDeletion() {
  return (
    <LegalPage title="Delete Your Account" updated="19 September 2026">
      <p className="legal-intro">
        Zana is operated by Bastion Holdings Ltd in Kigali, Rwanda. This page
        explains how to request deletion of your Zana account — as a
        customer, driver, merchant, or agent — and what happens to your data
        when you do.
      </p>

      <h2>How to request deletion</h2>
      <p>
        Send an email to{' '}
        <a href="mailto:hello@zanaride.rw?subject=Account deletion request">
          hello@zanaride.rw
        </a>{' '}
        with the subject line &ldquo;Account deletion request&rdquo;, from
        the email address or phone number associated with your account.
        Include:
      </p>
      <ul>
        <li>The phone number your Zana account is registered under</li>
        <li>Whether your account is a customer, driver, merchant, or agent account</li>
      </ul>
      <p>
        We confirm the request and complete deletion within 30 days.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your name, email, and profile details</li>
        <li>Saved addresses</li>
        <li>Photographs you&rsquo;ve uploaded, such as delivery package photos or driver documents</li>
        <li>Your wallet balance is paid out or refunded before the account is closed</li>
      </ul>

      <h2>What&rsquo;s retained, and for how long</h2>
      <p>
        Some records can&rsquo;t be deleted immediately, for legal or
        financial reasons:
      </p>
      <ul>
        <li>Trip and order history, for seven years, because tax law requires it — with your name and contact details removed where possible</li>
        <li>Records of a specific transaction or dispute already in progress, until it&rsquo;s resolved</li>
      </ul>
      <p>
        Deleting your account removes your personal details from our active
        systems. Financial records are retained only where the law requires
        it, with your identity removed where possible.
      </p>

      <p>
        Questions about this process can go to{' '}
        <a href="mailto:hello@zanaride.rw">hello@zanaride.rw</a>.
      </p>
    </LegalPage>
  );
}
