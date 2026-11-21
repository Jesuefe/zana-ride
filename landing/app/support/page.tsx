import type { Metadata } from 'next';
import LegalPage from '../../components/LegalPage';

export const metadata: Metadata = {
  title: 'Customer Support',
  description:
    'Get help with Zana rides, food orders, shopping, deliveries and your account. Contact the Zana support team in Kigali, Rwanda.',
  alternates: { canonical: '/support' },
  openGraph: {
    title: 'Zana Ride Customer Support',
    description: 'Help with rides, deliveries, food orders, shopping and your Zana account.',
    url: 'https://zanaride.rw/support',
    siteName: 'Zana Ride',
    locale: 'en_RW',
    type: 'website',
  },
};

export default function SupportPage() {
  return (
    <LegalPage title="How can we help?" updated="21 November 2026">
      <p className="legal-intro">
        The Zana team is here to help. Contact us about a ride, delivery, food
        order, shopping order or anything related to your account.
      </p>

      <h2>Contact customer support</h2>
      <p>
        Email us at{' '}
        <a href="mailto:support@zanaride.rw">support@zanaride.rw</a>. Please
        describe what happened and include your registered phone number and
        ride or order reference when available. This helps us investigate
        faster.
      </p>
      <p>
        You can also use our <a href="/contact">contact page</a> to send a
        message to the Zana team.
      </p>

      <h2>What can we help with?</h2>
      <h3>Rides</h3>
      <p>
        If you have a question about booking a motorcycle or car ride, a driver,
        a fare or a completed trip, email us with the trip details.
      </p>

      <h3>Deliveries</h3>
      <p>
        For help with sending or receiving a package, include the delivery
        reference and explain the issue.
      </p>

      <h3>Food and shopping orders</h3>
      <p>
        If an order is missing, delayed or different from what you expected,
        send us your order reference and a short description of the problem.
      </p>

      <h3>Your account and payments</h3>
      <p>
        Contact us if you need help signing in, updating your account or
        understanding a payment. Never send your password, one time
        verification code, card PIN or mobile money PIN by email.
      </p>

      <h2>Safety</h2>
      <p>
        If someone is in immediate danger, contact the local emergency services
        first. You can then let the Zana team know what happened.
      </p>

      <h2>Useful information</h2>
      <ul>
        <li><a href="/privacy">Read our Privacy Policy</a></li>
        <li><a href="/terms">Read our Terms of Service</a></li>
        <li><a href="/contact">Contact Zana Ride</a></li>
      </ul>

      <h2>Our location</h2>
      <p>
        Zana Ride<br />
        Kigali, Rwanda<br />
        <a href="mailto:support@zanaride.rw">support@zanaride.rw</a>
      </p>
    </LegalPage>
  );
}
