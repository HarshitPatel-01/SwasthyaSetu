# Swasthya Setu

Swasthya Setu is a demonstration platform for connected rural healthcare. It gives patients, frontline health workers, clinicians, facilities, and system administrators a shared continuity-of-care workflow—from appointment booking and guided intake through clinical review, referrals, prescriptions, and follow-up.

> This is a demonstration application. It is not approved for clinical use and must not be used to make, delay, or replace medical decisions.

## Highlights

- Role-based portals for Patient, Health Worker, Doctor/Specialist, Facility Admin, and System Admin
- Patient-only access scope: patient sessions are restricted to their own record and cannot open staff portals
- Appointment booking with doctor-aware digital tokens
- Guided multilingual-ready AI intake, always marked **pending clinical review**
- Doctor verification, consultation notes, and prescription issuance
- Referral, medicine availability, high-risk patient, and live queue views
- Shared TypeScript domain contracts and PostgreSQL-ready relational schema
- Low-bandwidth-friendly responsive UI and provider-neutral AI/OCR/speech boundaries

## Technology

| Area | Choice |
| --- | --- |
| Web client | React, TypeScript, Vite |
| API | Node.js, Express, TypeScript |
| UI | Custom responsive CSS, Lucide icons |
| Domain contracts | Shared TypeScript package |
| Production schema | PostgreSQL SQL migration |
| Demo persistence | SQLite database (`data/swasthya.sqlite`) |

## Prerequisites

- Node.js 20 or newer (Node 22+ recommended)
- npm 10 or newer

## Quick start

```bash
git clone https://github.com/HarshitPatel-01/SwasthyaSetu.git
cd SwasthyaSetu
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API starts at [http://localhost:4000](http://localhost:4000).

To create an optimized production build:

```bash
npm run build
```

## Demo accounts

All seeded accounts use the password `demo123`.

| Stakeholder | Email | Portal |
| --- | --- | --- |
| Patient | `meera@example.com` | Personal care record and appointments |
| Health worker | `worker@example.com` | Community care operations |
| Doctor | `doctor@example.com` | Intake review and clinical care |
| Facility administrator | `admin@example.com` | Queue, stock, referral, and risk monitoring |
| System administrator | `system@example.com` | Network-wide operations |

You may also create a new account from the registration page. A newly registered patient automatically receives an individual patient record and active care consent in the demo data store.

## Application routes

The app uses hash routes so it can run from a static host without server rewrites.

| Route | Access |
| --- | --- |
| `#/login` | Sign in |
| `#/register` | Create a stakeholder account |
| `#/patient/home` | Patient portal |
| `#/doctor/home` | Doctor portal |
| `#/health_worker/home` | Health worker portal |
| `#/facility_admin/home` | Facility administration portal |
| `#/system_admin/home` | System administration portal |

The client routes unauthorized users back to their permitted workspace. The bootstrap API also scopes patient data to the signed-in patient identity used by the demo.

## Project structure

```text
apps/
  api/                 Express API and SQLite database storage
  web/                 React application
database/
  001_initial.sql      PostgreSQL-ready clinical data schema
packages/
  shared/              Shared domain models and role types
openapi.yaml           REST API contract
```

## Key workflows

1. A patient signs in, books a doctor-aware appointment, and receives a queue token.
2. The patient submits guided symptoms through the intake screen.
3. The intake is explicitly labelled AI-generated and remains pending until a clinician reviews it.
4. A doctor verifies or returns the intake, records consultation notes, and issues a prescription.
5. Healthcare workers view live queue, patient history, high-risk follow-up, and medicine stock levels (stock editing is restricted to facility/system administrators).

## Data and safety notes

- `database/001_initial.sql` defines entities for patients, consents, appointments, intake summaries, consultations, prescriptions, referrals, diagnostic results, medicine availability, reminders, facilities, staff, and audit logs.
- Operational data is persisted in SQLite at `data/swasthya.sqlite`.
- AI is intentionally presented as assistance only. No AI output is auto-finalized into the clinical record.
- The demo login is for local development only. A production system must use HTTPS, password hashing, OAuth2/OIDC or signed JWTs, server-side authorization, durable PostgreSQL storage, encryption, formal consent policies, audit retention, and applicable healthcare compliance review.

## Available commands

```bash
npm run dev      # Starts the web app and API together
npm run build    # Type-checks and builds both applications
npm run seed     # Starts the API with the included seed data
```

## API contract

The REST API is documented in [openapi.yaml](./openapi.yaml). AI, OCR, and speech capabilities are designed to be implemented through swappable provider adapters rather than hard-coded vendors.


## Database-backed appointment slots
Appointments and availability are persisted in a local SQLite database at `data/swasthya.sqlite`. The API creates appointment slots from each doctor's schedule for the next 90 days. Availability is read from the database and booking atomically changes the selected slot from `available` to `booked`; cancellation returns it to `available`.

The selected live nearby hospital is included in the slot key, so the same doctor/date/time can be offered independently for the selected facility. The frontend requests `/api/availability?doctorId=...&facilityId=...&date=...`.

SQLite is provided by Node.js `node:sqlite`, so use Node 22.5+ (Node 22 LTS recommended).


## Patient SMS + Gmail notifications

Appointment confirmation and cancellation notifications are sent by the API when providers are configured. Booking/cancellation still succeeds if a provider is not configured or temporarily fails.

### Gmail
Set:
- `GMAIL_USER` — the Gmail/Google Workspace sender account
- `GMAIL_APP_PASSWORD` — a Google App Password (recommended; do not use the normal Gmail password)
- `GMAIL_FROM` — optional display/sender address

### SMS (Twilio)
Set:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

For the demo patient, set `SWASTHYA_PATIENT_PHONE_PAT_1=+91XXXXXXXXXX` to a real verified/test number. Do not put a masked UI value such as `•••• 4812` into the SMS provider.

After booking: the patient receives an appointment confirmation by SMS and email. After cancellation: the patient receives a cancellation message stating that the token was deleted and the slot was released.

### Notification persistence

Appointment booking and cancellation notifications are persisted in the SQLite `notifications` table before/while delivery is attempted. Each record stores the patient, appointment, channel (`gmail` or `sms`), recipient, message, delivery status, provider message ID, error (if any), creation time, and sent time. Configure `GMAIL_*` and `TWILIO_*` environment variables to enable live delivery; notification history is still retained when a provider is not configured.


## Unified care-team communication

The current MVP uses three primary care roles—**Patient, Health Worker, and Doctor**—with one shared patient-centered Care Team conversation. Each role can send a short message to the other two roles without opening a separate chat system. Messages are persisted in SQLite through `/api/care-team/messages`. This follows the project brief's goal of one connected care journey and keeps communication simple rather than creating separate applications for every stakeholder.


## Patient-language communication

SwasthyaSetu now treats a patient's language as an account-level preference. On the first patient login, the language selected on the login page is saved to the patient's persistent `patient_storage` record. On later logins, the saved language is returned by the API and the new login-page selection is ignored.

Healthcare-worker and doctor messages sent to a patient, and precautions sent to a patient, are translated server-side into that patient's saved language before the patient sees them. The clinical team keeps the original message.

### Puter.js translation

Hindi/Tamil patient communication is translated server-side with Puter.js. The Node.js API initializes Puter.js with `PUTER_AUTH_TOKEN`, so the token is never exposed to the React client. Puter.js supports Node.js and its AI chat API can be used for the translation request.

Configure `apps/api/.env`:

```env
PUTER_AUTH_TOKEN=your-puter-auth-token
PUTER_TRANSLATION_MODEL=gpt-5-nano
```

`PUTER_TRANSLATION_MODEL` is optional; the backend defaults to `gpt-5-nano`. If Puter is unavailable or no token is configured, the original healthcare message is retained rather than blocking delivery.
