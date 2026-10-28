'use client';

import { FormEvent, useState } from 'react';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('General enquiry');
  const [message, setMessage] = useState('');
  const [prepared, setPrepared] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent(`Zana Ride enquiry — ${topic}`);
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nEmail: ${email.trim()}\nTopic: ${topic}\n\nMessage:\n${message.trim()}`
    );
    setPrepared(true);
    window.location.href = `mailto:hello@zanaride.rw?subject=${subject}&body=${body}`;
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-field-row">
        <label className="contact-field"><span>Your name</span><input required autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Name and surname" /></label>
        <label className="contact-field"><span>Email address</span><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      </div>
      <label className="contact-field"><span>What is this about?</span>
        <select value={topic} onChange={event => setTopic(event.target.value)}>
          <option>General enquiry</option>
          <option>Customer support</option>
          <option>Driver or merchant onboarding</option>
          <option>Business partnership</option>
          <option>Investment enquiry</option>
          <option>Media enquiry</option>
        </select>
      </label>
      <label className="contact-field"><span>Your message</span><textarea required rows={6} value={message} onChange={event => setMessage(event.target.value)} placeholder="Tell us a little about how we can help..." /></label>
      <button className="button button-primary contact-submit" type="submit">Prepare email <span aria-hidden="true">↗</span></button>
      <p className="contact-form-note">{prepared ? 'Your email app should open with the message prepared. Please press Send in your email app to deliver it.' : 'This form prepares a message in your email app. Nothing is sent until you press Send.'}</p>
    </form>
  );
}
