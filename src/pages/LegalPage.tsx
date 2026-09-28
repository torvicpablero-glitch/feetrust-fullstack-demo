import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, FileText, ArrowLeft } from 'lucide-react';

const EFFECTIVE = 'Effective 2026 · FeeTrust™';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-2">{title}</h2>
      <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Terms() {
  return (
    <>
      <Section title="1. Acceptance of Terms">
        <p>By creating an account or using FeeTrust you agree to these Terms of Service. If you do not agree, do not use the platform.</p>
      </Section>
      <Section title="2. Accounts and Roles">
        <p>FeeTrust supports Customer, Worker, and Business accounts. You are responsible for the accuracy of the information you provide and for maintaining the confidentiality of your credentials. You must not impersonate another person or entity.</p>
      </Section>
      <Section title="3. Worker &amp; Business Accounts">
        <p>Workers and Business owners are responsible for maintaining accurate establishment details. FeeTrust reserves the right to suspend accounts that misrepresent identity or post unauthorized commercial establishments.</p>
      </Section>
      <Section title="4. Merits, Ratings and Endorsements">
        <p>Merits represent genuine customer recognition of service. You may not award merits to yourself, create duplicate accounts to inflate ratings, or use automated means to generate merits. FeeTrust may remove merits and ratings that violate these rules and may suspend offending accounts.</p>
      </Section>
      <Section title="5. Acceptable Use">
        <p>You agree not to misuse the platform, including by attempting to gain unauthorized access, scraping, reverse engineering, or disrupting the service.</p>
      </Section>
      <Section title="6. Subscriptions and Plans">
        <p>Business plans are billed as described at signup. Plan limits (for example employee seats) are enforced by the platform. Continued use after a plan change constitutes acceptance of the updated plan terms.</p>
      </Section>
      <Section title="7. Termination">
        <p>You may delete your account at any time from your Profile settings. FeeTrust may suspend or terminate accounts that violate these Terms.</p>
      </Section>
      <Section title="8. Disclaimer and Limitation of Liability">
        <p>The platform is provided "as is". To the maximum extent permitted by law, FeeTrust is not liable for indirect or consequential damages arising from use of the service.</p>
      </Section>
      <Section title="9. Changes to These Terms">
        <p>We may update these Terms. Material changes will be communicated in-app. Continued use after an update constitutes acceptance.</p>
      </Section>
    </>
  );
}

function Privacy() {
  return (
    <>
      <Section title="1. Information We Collect">
        <p>Account information (name, email address, password hash, selected account role). For Worker and Business accounts: job title or position, establishment name, profile avatar, and public workplace coordinates used for map discovery.</p>
      </Section>
      <Section title="2. How We Use Information">
        <p>To operate the reputation and merit system, authenticate you, display establishments on the map, compute ratings and merit levels, and provide customer support.</p>
      </Section>
      <Section title="3. Legal Bases and Sharing">
        <p>We process data to perform our contract with you and for legitimate business interests. We do not sell personal data. Service providers (hosting, database, and email delivery) process data on our behalf under contract.</p>
      </Section>
      <Section title="4. Data Retention">
        <p>Account and merit records are retained while your account is active. Deleting your account permanently removes your account, business establishment, and associated records.</p>
      </Section>
      <Section title="5. Your Rights">
        <p>Depending on your jurisdiction you may have rights to access, correct, export, or delete your personal data, and to object to certain processing. You can delete your account and data from Profile → Settings, or contact us.</p>
      </Section>
      <Section title="6. Security">
        <p>Passwords are stored as salted hashes. Access to production data is restricted. Database credentials are held server-side only and are never shipped to the browser.</p>
      </Section>
      <Section title="7. Cookies and Local Storage">
        <p>We use browser local storage to keep you signed in and to cache map data for offline use. We do not use third-party advertising cookies.</p>
      </Section>
      <Section title="8. Contact">
        <p>For privacy requests, contact <a className="text-indigo-600 dark:text-indigo-400 font-semibold underline" href="mailto:jm@feetrust.com">jm@feetrust.com</a>.</p>
      </Section>
    </>
  );
}

export default function LegalPage() {
  const { pathname } = useLocation();
  const isPrivacy = pathname.includes('privacy');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-['Outfit',sans-serif]">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link
          to="/auth"
          className="inline-flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Link>

        <div className="flex items-center gap-3 mb-2">
          {isPrivacy ? <Shield className="w-7 h-7 text-indigo-600" /> : <FileText className="w-7 h-7 text-indigo-600" />}
          <h1 className="text-3xl font-black">{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-8">{EFFECTIVE}</p>

        <div className="flex gap-3 mb-8">
          <Link
            to="/terms"
            className={`text-xs font-bold px-3 py-1.5 rounded-full border ${!isPrivacy ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className={`text-xs font-bold px-3 py-1.5 rounded-full border ${isPrivacy ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            Privacy Policy
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          {isPrivacy ? <Privacy /> : <Terms />}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-8">
          FeeTrust™ • Chicago • Contact <a className="underline" href="mailto:jm@feetrust.com">jm@feetrust.com</a>
        </p>
      </div>
    </div>
  );
}
