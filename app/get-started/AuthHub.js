'use client';

import { useState } from 'react';

const cafeFields = [
  { label: 'Owner full name', type: 'text', placeholder: 'Aso Karim' },
  { label: 'Café name', type: 'text', placeholder: 'Bean House' },
  { label: 'Café address', type: 'text', placeholder: 'Ankawa, Erbil' },
  { label: 'Café phone number', type: 'tel', placeholder: '+964 750 123 4567' },
  { label: 'Work email', type: 'email', placeholder: 'hello@beanhouse.com' },
  { label: 'Password', type: 'password', placeholder: 'Create password' },
];

const signInFields = [
  { label: 'Email or phone number', type: 'text', placeholder: 'Enter your email or phone' },
  { label: 'Password', type: 'password', placeholder: 'Enter password' },
];

const customerFields = [
  { label: 'Full name', type: 'text', placeholder: 'Sara Omar' },
  { label: 'Phone number', type: 'tel', placeholder: '+964 750 987 6543' },
  { label: 'Email', type: 'email', placeholder: 'sara@email.com' },
  { label: 'Password', type: 'password', placeholder: 'Create password' },
];

function Field({ label, type, placeholder }) {
  return (
    <label className="formField">
      <span>{label}</span>
      <input type={type} placeholder={placeholder} />
    </label>
  );
}

export default function AuthHub() {
  const [active, setActive] = useState('signup');

  return (
    <div className="authHub">
      <div className="tabRow">
        <button className={active === 'signup' ? 'tabBtn active' : 'tabBtn'} onClick={() => setActive('signup')}>Create café account</button>
        <button className={active === 'signin' ? 'tabBtn active' : 'tabBtn'} onClick={() => setActive('signin')}>Café sign in</button>
        <button className={active === 'customer' ? 'tabBtn active' : 'tabBtn'} onClick={() => setActive('customer')}>Customer sign up</button>
      </div>

      {active === 'signup' && (
        <section className="authCard">
          <div className="authIntro">
            <p className="microLabel accent">New café setup</p>
            <h2>Open your Brewistan account</h2>
            <p>Fill in the main café details first. Once the account is created, the owner moves to campaign setup and QR generation.</p>
          </div>
          <div className="socialRow">
            <button className="socialBtn">Continue with Google</button>
            <button className="socialBtn ghost">Use email and phone</button>
          </div>
          <div className="formGrid twoCol">
            {cafeFields.map((field) => <Field key={field.label} {...field} />)}
          </div>
          <button className="primaryBtn wideBtn">Create café account</button>
        </section>
      )}

      {active === 'signin' && (
        <section className="authCard">
          <div className="authIntro">
            <p className="microLabel accent">Existing café team</p>
            <h2>Sign in to your dashboard</h2>
            <p>Owners, branch managers, and staff can sign in here to approve requests, manage campaigns, and review activity.</p>
          </div>
          <div className="socialRow">
            <button className="socialBtn">Sign in with Google</button>
            <button className="socialBtn ghost">Use email or phone</button>
          </div>
          <div className="formGrid">
            {signInFields.map((field) => <Field key={field.label} {...field} />)}
          </div>
          <button className="primaryBtn wideBtn">Sign in</button>
        </section>
      )}

      {active === 'customer' && (
        <section className="authCard">
          <div className="authIntro">
            <p className="microLabel accent">Customer access</p>
            <h2>Create your customer account</h2>
            <p>Customers join once, then keep all their Brewistan cards in one mobile account across participating cafés.</p>
          </div>
          <div className="socialRow">
            <button className="socialBtn">Continue with Google</button>
            <button className="socialBtn ghost">Use email and phone</button>
          </div>
          <div className="formGrid twoCol">
            {customerFields.map((field) => <Field key={field.label} {...field} />)}
          </div>
          <button className="primaryBtn wideBtn">Create customer account</button>
        </section>
      )}
    </div>
  );
}
