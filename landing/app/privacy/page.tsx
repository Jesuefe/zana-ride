import LegalPage from '../../components/LegalPage';

export const metadata = {
  title: 'Privacy Policy — Zana',
  description: 'How Zana collects, uses and protects your information.',
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="9 September 2026">
      <p className="legal-intro">
        This policy explains what Zana collects, why, and what you can do about
        it. It is written to be read rather than to satisfy a lawyer, and it
        describes what the app actually does.
      </p>

      <p>
        Zana is operated by Bastion Holdings Ltd in Kigali, Rwanda. If anything
        here is unclear, write to{' '}
        <a href="mailto:hello@zanaride.rw">hello@zanaride.rw</a>.
      </p>

      <h2>What we collect</h2>

      <h3>Information you give us</h3>
      <ul>
        <li>Your name and phone number when you create an account</li>
        <li>Your email address, if you provide one</li>
        <li>Addresses you save, such as home or work</li>
        <li>Photographs you take of packages when sending a delivery</li>
        <li>Ratings and comments you leave</li>
      </ul>

      <h3>Location</h3>
      <p>
        Zana is a transport service, so location is central to how it works.
        What we collect depends on who you are.
      </p>
      <p>
        <strong>If you are a customer</strong>, we collect your location only
        while you are using the app — to set your pickup point, show nearby
        shops, and follow your ride or delivery on the map. We do not collect
        your location when the app is closed.
      </p>
      <p>
        <strong>If you are a driver</strong>, we collect your location
        continuously while you are online and carrying a job,{' '}
        <strong>including when the app is in the background and your screen is
        off</strong>. This is necessary: a customer waiting for a parcel needs
        to see where it is, and we cannot offer you nearby work without knowing
        where you are. Location collection stops when you go offline. You can
        withdraw this permission at any time in your phone settings, though the
        driver app cannot function without it.
      </p>

      <h3>Payments</h3>
      <p>
        Payments are processed by our payment providers. Zana stores a record of
        the amount, the method used, and a reference number.{' '}
        <strong>We never see or store your card number, PIN, or mobile money
        password.</strong> Card details are entered on the payment provider&rsquo;s
        own page, not ours.
      </p>

      <h3>Collected automatically</h3>
      <ul>
        <li>Device type and operating system version</li>
        <li>Records of trips, deliveries and orders</li>
        <li>Records of calls made through the app — the fact of the call and its duration, never its content</li>
        <li>Error reports when something goes wrong</li>
      </ul>

      <h2>What we do with it</h2>
      <ul>
        <li>Match you with a driver, or match a driver with a job</li>
        <li>Show a live position so customers can follow a ride or parcel</li>
        <li>Calculate fares and delivery fees from distance</li>
        <li>Process payments and keep a record for your wallet history</li>
        <li>Let you and your driver call each other without exchanging numbers</li>
        <li>Respond to an emergency alert, which shares your location with our safety team</li>
        <li>Investigate a dispute about a delivery, using the pickup and drop-off photographs</li>
        <li>Fix problems and improve the service</li>
      </ul>
      <p>
        We do not sell your information. We do not share it with advertisers.
      </p>

      <h2>Who else sees it</h2>
      <p>Only where it is needed to provide the service:</p>
      <ul>
        <li>
          <strong>Your driver</strong> sees your first name, your pickup and
          drop-off, and can call you through the app. They do not see your phone
          number.
        </li>
        <li>
          <strong>A merchant or market agent</strong> sees what you ordered and
          a delivery address. They do not see your other activity.
        </li>
        <li>
          <strong>Our payment provider</strong> receives the amount and your
          phone number to process a mobile money charge.
        </li>
        <li>
          <strong>Our SMS provider</strong> receives your phone number to send
          verification codes.
        </li>
        <li>
          <strong>Authorities</strong>, where we are legally required to
          disclose, or where there is a genuine risk to someone&rsquo;s safety.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account details, for as long as your account exists</li>
        <li>Trip and order history, for seven years, because tax law requires it</li>
        <li>Package photographs, for 30 days, then deleted automatically</li>
        <li>Location traces, for 90 days</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>Location permission can be withdrawn in your phone settings at any time</li>
        <li>You can ask for a copy of your data, or ask us to delete your account, by writing to us</li>
        <li>You can correct your details in the app</li>
      </ul>
      <p>
        Deleting your account removes your personal details. Financial records
        are retained where the law requires it, with your identity removed where
        possible.
      </p>

      <h2>Security</h2>
      <p>
        Traffic between the app and our servers is encrypted. Passwords are
        hashed and cannot be read by us. Access to production data is limited to
        the people who need it. No system is perfect, and we will tell you
        promptly if something happens that affects you.
      </p>

      <h2>Children</h2>
      <p>
        Zana is not for anyone under 18. We do not knowingly collect information
        from children. If you believe a child has an account, write to us and we
        will remove it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we will tell you in the
        app before it takes effect. The date at the top always reflects the
        current version.
      </p>

      <h2>Contact</h2>
      <p>
        Bastion Holdings Ltd
        <br />
        Kigali, Rwanda
        <br />
        <a href="mailto:hello@zanaride.rw">hello@zanaride.rw</a>
      </p>
    </LegalPage>
  );
}
