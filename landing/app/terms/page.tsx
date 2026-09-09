import LegalPage from '../../components/LegalPage';

export const metadata = {
  title: 'Terms of Service — Zana',
  description: 'The terms you agree to when using Zana.',
};

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="9 September 2026">
      <p className="legal-intro">
        These are the terms you agree to when you use Zana. Using the app means
        accepting them. If you do not, please do not use the service.
      </p>

      <p>
        Zana is operated by Bastion Holdings Ltd, Kigali, Rwanda. Questions to{' '}
        <a href="mailto:hello@zanaride.rw">hello@zanaride.rw</a>.
      </p>

      <h2>What Zana is</h2>
      <p>
        Zana connects people who need transport or delivery with independent
        drivers, and connects customers with shops and market agents.{' '}
        <strong>We are a platform, not a transport company.</strong> Drivers are
        independent contractors, not our employees. Merchants sell their own
        goods on their own terms.
      </p>
      <p>
        This distinction matters when something goes wrong. We take
        responsibility for the platform working properly. We are not the party
        driving the motorcycle or cooking the food.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or over</li>
        <li>Give accurate details, and keep your phone number current — it is how we reach you</li>
        <li>One account per person</li>
        <li>Keep your login to yourself. Anything done from your account is treated as done by you</li>
        <li>Tell us immediately if you think someone else has access</li>
      </ul>

      <h2>Rides and deliveries</h2>
      <p>
        The fare or fee shown before you book is what you will be charged for
        that journey, based on the distance between the points you selected. If
        you change the destination mid-trip, the fare changes accordingly.
      </p>
      <p>
        Drivers accept jobs at their own discretion. We cannot guarantee a
        driver will be available, and estimated arrival times are estimates,
        affected by traffic and weather like anything else in Kigali.
      </p>
      <p>
        Cancelling after a driver has set off may incur a fee reflecting the
        distance they have already travelled.
      </p>

      <h2>What you may not send</h2>
      <p>
        Riders inspect packages before pickup. You may not send cash, illegal
        drugs, weapons, live animals, hazardous or flammable material, or
        anything unlawful. Attempting to do so will end your account and may be
        reported.
      </p>
      <p>
        For anything valuable or fragile, tell the rider. We are not liable for
        loss or damage to items whose nature you did not disclose.
      </p>

      <h2>Orders from shops and markets</h2>
      <p>
        Merchants set their own prices and are responsible for what they sell,
        including its quality, safety and description. Market agents buy on your
        behalf at the price on the day, which varies.
      </p>
      <p>
        Because an order can only be prepared and collected from one place at a
        time, a basket holds items from a single shop or market. Starting an
        order elsewhere replaces the current basket.
      </p>
      <p>
        Problems with goods should be raised with us promptly. We will help
        resolve them with the merchant, but the contract for the goods is
        between you and them.
      </p>

      <h2>Paying</h2>
      <ul>
        <li>Rides may be paid by wallet, mobile money or cash</li>
        <li>Shop and market orders must be paid before preparation begins — cash is not accepted, because an agent has to buy the goods before you receive them</li>
        <li>Deliveries may be paid by wallet, mobile money or cash to the rider</li>
      </ul>
      <p>
        Money in your Zana wallet is held for paying for Zana services and can
        be withdrawn to your mobile money account, subject to the minimum our
        payment provider imposes. It does not earn interest and is not a bank
        deposit.
      </p>
      <p>
        Refunds are considered case by case. Where a service was not delivered,
        we refund it. Where you simply changed your mind after a driver
        travelled or an agent bought goods, we may not.
      </p>

      <h2>Conduct</h2>
      <p>
        Treat drivers, merchants, agents and other customers with basic respect.
        Abuse, harassment, discrimination, threats or violence end your account
        immediately and may be reported to the authorities. This applies equally
        whichever side of a transaction you are on.
      </p>
      <p>
        The emergency alert is for emergencies. Misusing it delays a response to
        someone who genuinely needs it.
      </p>

      <h2>Ratings</h2>
      <p>
        You can rate deliveries, merchants and drivers. Ratings must reflect
        your actual experience. We remove ratings that are abusive, false, or
        placed by someone who was not party to the transaction.
      </p>

      <h2>Where our responsibility ends</h2>
      <p>
        We work to keep Zana running, but we cannot promise it will never be
        unavailable. Network outages, payment provider failures and power cuts
        happen.
      </p>
      <p>
        We are not liable for the conduct of a driver, merchant or customer, for
        goods sold by a merchant, or for loss arising from a journey you chose
        to take. Where we are liable, that liability is limited to the amount
        you paid for the service in question.
      </p>
      <p>
        Nothing here removes rights you have under Rwandan consumer law.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can close your account at any time by writing to us. We may suspend
        or close an account that breaks these terms, is used fraudulently, or
        puts someone at risk. Where we can, we will tell you why.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Material changes will be shown in the app
        before taking effect. Continuing to use Zana afterwards means accepting
        them.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the laws of Rwanda, and disputes fall to the
        courts of Kigali.
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
