import React from 'react';

import { FaTelegramPlane } from 'react-icons/fa';
import { HiChevronRight, HiOutlineMail, HiOutlineLocationMarker, HiOutlineShieldCheck } from 'react-icons/hi';

const moduleLinks = [
  'Dashboard Overview',
  'Attendance Management',
  'Student Records',
  'Assignments and Marksheets',
  'Exams and Announcements',
  'Reports and Calendar',
];

const governanceLinks = [
  'School administration coordination',
  'Role-based access control',
  'Academic record monitoring',
  'Operational communication support',
];

const supportLinks = [
  'Telegram Admin Center',
  'Technical issue tracking',
  'System feedback channel',
  'Release and maintenance updates',
];

function LinkList({ items }) {
  return (
    <ul className="space-y-2 text-sm text-slate-200">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <HiChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--moeys-gold)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Footer() {
  return (
    <footer className="footer-shell mt-10">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 px-2 py-2 lg:px-0">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[rgba(255,255,255,0.72)]">
                Ministry-Inspired Administrative Workspace
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-[0.01em] text-white sm:text-3xl">
                High School Class Management System
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
                Built as a formal school operations portal for attendance oversight, academic coordination,
                communication management, and institution-level reporting aligned with a MOEYS-style interface.
              </p>
            </div>

            <div className="px-1 py-1">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--moeys-gold)]">
                Institutional Contact
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-100">
                <div className="flex items-start gap-3">
                  <HiOutlineLocationMarker className="mt-0.5 h-5 w-5 text-[var(--moeys-gold)]" />
                  <div>
                    <p className="font-semibold">Phnom Penh, Cambodia</p>
                    <p className="text-slate-300">Formal administrative workspace for high school operations</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <HiOutlineMail className="mt-0.5 h-5 w-5 text-[var(--moeys-gold)]" />
                  <div>
                    <p className="font-semibold">class.management@school.edu</p>
                    <p className="text-slate-300">Official support and coordination channel</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <HiOutlineShieldCheck className="mt-0.5 h-5 w-5 text-[var(--moeys-gold)]" />
                  <div>
                    <p className="font-semibold">Protected institutional environment</p>
                    <p className="text-slate-300">Role-based access for administration, teachers, and students</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_280px]">
          <section className="px-1 py-1">
            <p className="footer-panel-title">Core Modules</p>
            <div className="mt-4">
              <LinkList items={moduleLinks} />
            </div>
          </section>

          <section className="px-1 py-1">
            <p className="footer-panel-title">Governance Focus</p>
            <div className="mt-4">
              <LinkList items={governanceLinks} />
            </div>
          </section>

          <section className="px-1 py-1">
            <p className="footer-panel-title">Support Channels</p>
            <div className="mt-4">
              <LinkList items={supportLinks} />
            </div>
          </section>

          <section className="px-1 py-1">
            <p className="footer-panel-title">Quick Access</p>
            <p className="mt-4 text-sm leading-7 text-slate-200">
              Telegram support remains available for fast coordination with the Admin Center and technical team.
            </p>
            <a
              href="https://t.me/+I9OUYneewiA0NTc1"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-telegram mt-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
              aria-label="Open Telegram support"
            >
              <FaTelegramPlane className="h-7 w-7 text-white" />
            </a>
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs uppercase tracking-[0.22em] text-slate-300 md:flex-row md:items-center md:justify-between">
          <p>High School Administration Portal</p>
          <p>MOEYS-style institutional interface</p>
          <p>Education management and reporting environment</p>
        </div>
      </div>
    </footer>
  );
}
