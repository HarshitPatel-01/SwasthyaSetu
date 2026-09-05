import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

import {
  checkAIHealth,
  analyzeReport,
  analyzeSymptoms,
  analyzeContext,
  translateForPatient,
  translateToEnglish,
  normalizeTranslationLanguage,
} from './ai';

import type {
  Appointment,
  Consultation,
  Consent,
  DiagnosticOrder,
  Facility,
  IntakeSummary,
  MedicalDocument,
  Patient,
  Prescription,
  Referral
} from '@swasthya/shared';

// Load apps/api/.env without requiring an extra runtime dependency. Values already
// present in the environment take precedence. App Passwords copied from Google
// are accepted with or without the display spaces.
function loadLocalEnv() {
  const candidates = [
    resolve(process.cwd(), 'apps/api/.env'),
    resolve(process.cwd(), '.env')
  ];
  const envFile = candidates.find(existsSync);
  if (!envFile) return;
  try {
    const text = readFileSync(envFile, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const equals = line.indexOf('=');
      if (equals <= 0) continue;
      const key = line.slice(0, equals).trim();
      let value = line.slice(equals + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    console.warn('Could not load .env:', error);
  }
}
loadLocalEnv();

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

const dbPath = resolve(process.env.SWASTHYA_DB_PATH || 'data/swasthya.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, latitude REAL, longitude REAL, type TEXT DEFAULT 'Hospital', phone TEXT
  );
  CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, specialty TEXT NOT NULL, phone TEXT,
    availability TEXT, working_hours TEXT NOT NULL, slot_minutes INTEGER NOT NULL DEFAULT 30, facility_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS appointment_slots (
    id TEXT PRIMARY KEY, doctor_id TEXT NOT NULL, facility_id TEXT NOT NULL,
    slot_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    capacity INTEGER NOT NULL DEFAULT 3,
    booked_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(doctor_id, facility_id, slot_date, start_time)
  );
  CREATE TABLE IF NOT EXISTS medical_documents (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
    mime_type TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, data_url TEXT NOT NULL, notes TEXT,
    uploaded_at TEXT NOT NULL, shared_with_care_team INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS appointments_db (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, facility_id TEXT NOT NULL, doctor_id TEXT NOT NULL,
    slot_id TEXT NOT NULL, starts_at TEXT NOT NULL, token INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked', facility_name TEXT, facility_latitude REAL, facility_longitude REAL,
    shared_document_ids TEXT DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS patient_health_profiles (
    patient_id TEXT PRIMARY KEY, medical_condition TEXT DEFAULT '', medical_history TEXT DEFAULT '', allergies TEXT DEFAULT '', medications TEXT DEFAULT '', updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS patient_storage (
    patient_id TEXT PRIMARY KEY, patient_json TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, facility_id TEXT, patient_id TEXT
  );
  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, from_facility_id TEXT NOT NULL, to_facility_id TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, referral_token TEXT, patient_name TEXT, to_facility_name TEXT, from_facility_name TEXT
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, appointment_id TEXT, type TEXT NOT NULL,
    channel TEXT NOT NULL, recipient TEXT, message TEXT NOT NULL, status TEXT NOT NULL,
    provider_message_id TEXT, error TEXT, created_at TEXT NOT NULL, sent_at TEXT
  );  CREATE TABLE IF NOT EXISTS care_consent_requests (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    phone TEXT, latitude REAL, longitude REAL, location_accuracy REAL,
    patient_snapshot TEXT NOT NULL, document_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL, responded_at TEXT
  );  CREATE TABLE IF NOT EXISTS patient_precautions (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, sent_by TEXT NOT NULL, message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, resolved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS health_workers (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL,
    facility_id TEXT, latitude REAL, longitude REAL, active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS medicine_inventory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 20, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS teleconsults (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, appointment_id TEXT, doctor_id TEXT,
    status TEXT NOT NULL DEFAULT 'requested', requested_at TEXT NOT NULL, connected_at TEXT, completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS care_review_requests (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, sent_by TEXT NOT NULL, reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS intakes_db (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, appointment_id TEXT, symptoms TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL, red_flags TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending_review', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS consultations_db (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, doctor_id TEXT NOT NULL, appointment_id TEXT,
    diagnosis TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prescriptions_db (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, consultation_id TEXT NOT NULL, medicines TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS emergency_alerts (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, patient_name TEXT NOT NULL, patient_phone TEXT,
    latitude REAL, longitude REAL, location_accuracy REAL, assigned_worker_id TEXT, assigned_worker_name TEXT,
    assigned_worker_phone TEXT, status TEXT NOT NULL DEFAULT 'active', fallback_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, resolved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS care_consents_db (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'paused', granted_at TEXT, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, patient_id TEXT, action TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS triage_cases (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, intake_id TEXT,
    appointment_id TEXT, doctor_id TEXT, care_review_request_id TEXT, referral_id TEXT, assigned_worker_id TEXT,
    severity_level TEXT NOT NULL DEFAULT 'concerning',
    severity_reasoning TEXT NOT NULL DEFAULT '',
    override_json TEXT DEFAULT '{}',
    case_status TEXT NOT NULL DEFAULT 'new',
    summary_json TEXT NOT NULL DEFAULT '{}',
    transcript_json TEXT NOT NULL DEFAULT '[]',
    frontline_worker_json TEXT,
    follow_up_date TEXT, notes TEXT,
    submitted_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS diagnostic_orders (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, case_id TEXT,
    test_name TEXT NOT NULL, facility_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ordered', ordered_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS care_team_messages (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL,
    sender_role TEXT NOT NULL, sender_id TEXT, sender_name TEXT NOT NULL,
    recipient_role TEXT NOT NULL, recipient_id TEXT, recipient_name TEXT NOT NULL,
    message TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT
  );
`);

function ensureColumn(table: string, column: string, definition: string) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    if (!columns.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) { console.warn(`Database migration skipped for ${table}.${column}:`, error); }
}
ensureColumn('care_team_messages', 'original_message', 'TEXT');
ensureColumn('care_team_messages', 'translated_message', 'TEXT');
ensureColumn('care_team_messages', 'patient_language', 'TEXT');
ensureColumn('care_team_messages', 'target_language', 'TEXT');
ensureColumn('care_team_messages', 'translation_status', 'TEXT');
ensureColumn('patient_precautions', 'translated_message', 'TEXT');
ensureColumn('patient_precautions', 'patient_language', 'TEXT');

// Keep databases created by earlier ZIP versions compatible with the current API.
// Comprehensive SQLite compatibility migration. Older ZIP versions created a subset
// of these tables with fewer columns; bootstrap must work against those databases too.
const migrations: Array<[string, string, string]> = [
  ['users', 'phone', 'TEXT'],
  ['users', 'facility_id', 'TEXT'],
  ['users', 'patient_id', 'TEXT'],
  ['referrals', 'updated_at', "TEXT NOT NULL DEFAULT ''"],
  ['referrals', 'referral_token', 'TEXT'],
  ['referrals', 'patient_name', 'TEXT'],
  ['referrals', 'to_facility_name', 'TEXT'],
  ['referrals', 'from_facility_name', 'TEXT'],
  ['facilities', 'latitude', 'REAL'], ['facilities', 'longitude', 'REAL'], ['facilities', 'type', "TEXT DEFAULT 'Hospital'"], ['facilities', 'phone', 'TEXT'],
  ['doctors', 'phone', 'TEXT'], ['doctors', 'availability', 'TEXT'], ['doctors', 'working_hours', "TEXT NOT NULL DEFAULT '[]'"], ['doctors', 'slot_minutes', 'INTEGER NOT NULL DEFAULT 30'], ['doctors', 'facility_id', "TEXT NOT NULL DEFAULT 'fac-1'"],
  ['appointment_slots', 'capacity', 'INTEGER NOT NULL DEFAULT 3'], ['appointment_slots', 'booked_count', 'INTEGER NOT NULL DEFAULT 0'], ['appointment_slots', 'status', "TEXT NOT NULL DEFAULT 'available'"],
  ['appointments_db', 'slot_id', "TEXT NOT NULL DEFAULT ''"], ['appointments_db', 'starts_at', "TEXT NOT NULL DEFAULT ''"], ['appointments_db', 'token', 'INTEGER NOT NULL DEFAULT 1'], ['appointments_db', 'status', "TEXT NOT NULL DEFAULT 'booked'"], ['appointments_db', 'facility_name', 'TEXT'], ['appointments_db', 'facility_latitude', 'REAL'], ['appointments_db', 'facility_longitude', 'REAL'], ['appointments_db', 'shared_document_ids', "TEXT DEFAULT '[]'"], ['appointments_db', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['patient_health_profiles', 'medical_condition', "TEXT DEFAULT ''"], ['patient_health_profiles', 'medical_history', "TEXT DEFAULT ''"], ['patient_health_profiles', 'allergies', "TEXT DEFAULT ''"], ['patient_health_profiles', 'medications', "TEXT DEFAULT ''"], ['patient_health_profiles', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['patient_storage', 'patient_json', "TEXT NOT NULL DEFAULT '{}'"], ['patient_storage', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['medical_documents', 'mime_type', "TEXT NOT NULL DEFAULT 'application/pdf'"], ['medical_documents', 'size', 'INTEGER NOT NULL DEFAULT 0'], ['medical_documents', 'data_url', "TEXT NOT NULL DEFAULT ''"], ['medical_documents', 'notes', 'TEXT'], ['medical_documents', 'uploaded_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'], ['medical_documents', 'shared_with_care_team', 'INTEGER NOT NULL DEFAULT 1'],
  ['notifications', 'appointment_id', 'TEXT'], ['notifications', 'recipient', 'TEXT'], ['notifications', 'provider_message_id', 'TEXT'], ['notifications', 'error', 'TEXT'], ['notifications', 'sent_at', 'TEXT'],
  ['care_consent_requests', 'phone', 'TEXT'], ['care_consent_requests', 'latitude', 'REAL'], ['care_consent_requests', 'longitude', 'REAL'], ['care_consent_requests', 'location_accuracy', 'REAL'], ['care_consent_requests', 'patient_snapshot', "TEXT NOT NULL DEFAULT '{}'"], ['care_consent_requests', 'document_ids', "TEXT NOT NULL DEFAULT '[]'"], ['care_consent_requests', 'responded_at', 'TEXT'],
  ['patient_precautions', 'resolved_at', 'TEXT'],
  ['health_workers', 'phone', "TEXT NOT NULL DEFAULT ''"], ['health_workers', 'facility_id', 'TEXT'], ['health_workers', 'latitude', 'REAL'], ['health_workers', 'longitude', 'REAL'], ['health_workers', 'active', 'INTEGER NOT NULL DEFAULT 1'],
  ['medicine_inventory', 'quantity', 'INTEGER NOT NULL DEFAULT 0'], ['medicine_inventory', 'low_stock_threshold', 'INTEGER NOT NULL DEFAULT 20'], ['medicine_inventory', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['teleconsults', 'appointment_id', 'TEXT'], ['teleconsults', 'doctor_id', 'TEXT'], ['teleconsults', 'status', "TEXT NOT NULL DEFAULT 'requested'"], ['teleconsults', 'requested_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'], ['teleconsults', 'connected_at', 'TEXT'], ['teleconsults', 'completed_at', 'TEXT'],
  ['care_review_requests', 'status', "TEXT NOT NULL DEFAULT 'pending'"], ['care_review_requests', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'], ['care_review_requests', 'reviewed_at', 'TEXT'],
  ['intakes_db', 'appointment_id', 'TEXT'], ['intakes_db', 'symptoms', "TEXT NOT NULL DEFAULT '[]'"], ['intakes_db', 'red_flags', "TEXT NOT NULL DEFAULT '[]'"], ['intakes_db', 'status', "TEXT NOT NULL DEFAULT 'pending_review'"], ['intakes_db', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['consultations_db', 'appointment_id', 'TEXT'], ['consultations_db', 'diagnosis', "TEXT NOT NULL DEFAULT '[]'"], ['consultations_db', 'notes', "TEXT NOT NULL DEFAULT ''"], ['consultations_db', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['prescriptions_db', 'consultation_id', "TEXT NOT NULL DEFAULT ''"], ['prescriptions_db', 'medicines', "TEXT NOT NULL DEFAULT '[]'"], ['prescriptions_db', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['emergency_alerts', 'patient_phone', 'TEXT'], ['emergency_alerts', 'latitude', 'REAL'], ['emergency_alerts', 'longitude', 'REAL'], ['emergency_alerts', 'location_accuracy', 'REAL'], ['emergency_alerts', 'assigned_worker_id', 'TEXT'], ['emergency_alerts', 'assigned_worker_name', 'TEXT'], ['emergency_alerts', 'assigned_worker_phone', 'TEXT'], ['emergency_alerts', 'status', "TEXT NOT NULL DEFAULT 'active'"], ['emergency_alerts', 'fallback_used', 'INTEGER NOT NULL DEFAULT 0'], ['emergency_alerts', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'], ['emergency_alerts', 'resolved_at', 'TEXT'],
  ['care_consents_db', 'scopes', "TEXT NOT NULL DEFAULT '[]'"], ['care_consents_db', 'status', "TEXT NOT NULL DEFAULT 'paused'"], ['care_consents_db', 'granted_at', 'TEXT'], ['care_consents_db', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['audit_logs', 'patient_id', 'TEXT'], ['audit_logs', 'action', "TEXT NOT NULL DEFAULT ''"], ['audit_logs', 'created_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['triage_cases', 'intake_id', 'TEXT'], ['triage_cases', 'appointment_id', 'TEXT'], ['triage_cases', 'doctor_id', 'TEXT'], ['triage_cases', 'care_review_request_id', 'TEXT'], ['triage_cases', 'referral_id', 'TEXT'], ['triage_cases', 'assigned_worker_id', 'TEXT'], ['triage_cases', 'severity_level', "TEXT NOT NULL DEFAULT 'concerning'"], ['triage_cases', 'severity_reasoning', "TEXT NOT NULL DEFAULT ''"], ['triage_cases', 'override_json', "TEXT DEFAULT '{}'"], ['triage_cases', 'case_status', "TEXT NOT NULL DEFAULT 'new'"], ['triage_cases', 'summary_json', "TEXT NOT NULL DEFAULT '{}'"], ['triage_cases', 'transcript_json', "TEXT NOT NULL DEFAULT '[]'"], ['triage_cases', 'frontline_worker_json', 'TEXT'], ['triage_cases', 'follow_up_date', 'TEXT'], ['triage_cases', 'notes', 'TEXT'], ['triage_cases', 'submitted_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'], ['triage_cases', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['diagnostic_orders', 'case_id', 'TEXT'], ['diagnostic_orders', 'test_name', "TEXT NOT NULL DEFAULT ''"], ['diagnostic_orders', 'facility_name', "TEXT NOT NULL DEFAULT ''"], ['diagnostic_orders', 'status', "TEXT NOT NULL DEFAULT 'ordered'"], ['diagnostic_orders', 'ordered_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP']
];
for (const [table, column, definition] of migrations) ensureColumn(table, column, definition);

// Backfill referral timestamps after migrating older rows.
try { db.prepare("UPDATE referrals SET updated_at=COALESCE(NULLIF(updated_at,''), created_at, ?)").run(now()); } catch { }

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));


// Notification providers are optional and configured through environment variables.
// Booking/cancellation never fails just because a notification provider is unavailable.
const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE ?? (smtpPort === 465 ? 'true' : 'false')).toLowerCase() === 'true';
const mailTransport = smtpUser && smtpPass
  ? nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass }
  })
  : null;

console.log(`Email notifications: ${mailTransport ? `configured (${smtpUser})` : 'not configured'}`);

async function sendPatientNotification(
  patientId: string,
  appointmentId: string | null,
  type: 'appointment_booked' | 'appointment_cancelled' | 'intake_verified' | 'prescription_issued' | 'diagnostic_ordered' | 'referral_created' | 'teleconsult_notes' | 'worker_dispatched' | 'case_resolved' | 'care_reviewed' | string,
  subject: string,
  message: string
) {
  const patient = patients.find(p => p.id === patientId) as any;
  const user = users.find(u => u.patientId === patientId);
  const email = patient?.email || user?.email || process.env.DEMO_PATIENT_EMAIL;
  const envKey = `SWASTHYA_PATIENT_PHONE_${patientId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
  const phone = patient?.notificationPhone || process.env[envKey];
  const results: Record<string, string> = {};

  const createNotification = (channel: string, recipient: string | undefined) => {
    const id = uid('notification');
    db.prepare(`INSERT INTO notifications (id,patient_id,appointment_id,type,channel,recipient,message,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, patientId, appointmentId, type, channel, recipient || null, message, 'pending', now());
    return id;
  };
  const updateNotification = (id: string, status: string, providerMessageId?: string | null, error?: string | null) => {
    db.prepare(`UPDATE notifications SET status=?, provider_message_id=?, error=?, sent_at=? WHERE id=?`)
      .run(status, providerMessageId || null, error || null, status === 'sent' ? now() : null, id);
  };

  // Always register an in-app notification so patient immediately sees it in portal
  const inAppId = createNotification('in_app', email || phone || 'in_app');
  updateNotification(inAppId, 'sent', 'in_app_msg');
  results.inApp = 'sent';

  const emailId = createNotification('gmail', email);
  if (mailTransport && email) {
    try {
      const info = await mailTransport.sendMail({
        from: process.env.SMTP_FROM || process.env.GMAIL_FROM || smtpUser,
        to: email, subject, text: message
      });
      updateNotification(emailId, 'sent', info.messageId);
      results.email = 'sent';
    } catch (error: any) {
      updateNotification(emailId, 'failed', null, String(error?.message || error));
      results.email = 'failed';
    }
  } else {
    updateNotification(emailId, 'not_configured', null, email ? 'Gmail provider is not configured.' : 'Patient email is missing.');
    results.email = email ? 'not_configured' : 'missing_email';
  }

  const smsId = createNotification('sms', phone);
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  if (sid && token && from && phone) {
    try {
      const body = new URLSearchParams({ To: phone, From: from, Body: message });
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body
      });
      if (r.ok) {
        const payload: any = await r.json().catch(() => ({}));
        updateNotification(smsId, 'sent', payload.sid || null);
        results.sms = 'sent';
      } else {
        const detail = await r.text();
        updateNotification(smsId, 'failed', null, detail.slice(0, 1000));
        results.sms = 'failed';
      }
    } catch (error: any) {
      updateNotification(smsId, 'failed', null, String(error?.message || error));
      results.sms = 'failed';
    }
  } else {
    updateNotification(smsId, 'not_configured', null, phone ? 'Twilio provider is not configured.' : 'Patient phone is missing.');
    results.sms = phone ? 'not_configured' : 'missing_phone';
  }
  return results;
}

function hydrateNotifications(patientId?: string) {
  const rows = patientId
    ? db.prepare(`SELECT id,patient_id as patientId,appointment_id as appointmentId,type,channel,recipient,message,status,provider_message_id as providerMessageId,error,created_at as createdAt,sent_at as sentAt FROM notifications WHERE patient_id=? ORDER BY created_at DESC`).all(patientId)
    : db.prepare(`SELECT id,patient_id as patientId,appointment_id as appointmentId,type,channel,recipient,message,status,provider_message_id as providerMessageId,error,created_at as createdAt,sent_at as sentAt FROM notifications ORDER BY created_at DESC`).all();
  return rows as any[];
}

// Appointment capacity: up to 3 patients can be booked into the same
// doctor/date/time slot. The database transaction below makes this safe
// even when two or more patients click Book at exactly the same time.
try { db.exec(`ALTER TABLE facilities ADD COLUMN phone TEXT`); } catch { }
try { db.exec(`ALTER TABLE doctors ADD COLUMN phone TEXT`); } catch { }
try { db.exec(`ALTER TABLE appointment_slots ADD COLUMN capacity INTEGER NOT NULL DEFAULT 3`); } catch { }
try { db.exec(`ALTER TABLE appointment_slots ADD COLUMN booked_count INTEGER NOT NULL DEFAULT 0`); } catch { }

// Older versions made slot_id UNIQUE in appointments_db, which allowed only
// one patient per slot. Rebuild that table once so one slot can hold 50
// independent appointments/tokens.
try {
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='appointments_db'`).get() as any;
  if (schema?.sql && /slot_id\s+TEXT[^,]*UNIQUE/i.test(schema.sql)) {
    db.exec(`
      CREATE TABLE appointments_db_v2 (
        id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, facility_id TEXT NOT NULL, doctor_id TEXT NOT NULL,
        slot_id TEXT NOT NULL, starts_at TEXT NOT NULL, token INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'booked', facility_name TEXT, facility_latitude REAL, facility_longitude REAL,
        shared_document_ids TEXT DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO appointments_db_v2 SELECT id,patient_id,facility_id,doctor_id,slot_id,starts_at,token,status,facility_name,facility_latitude,facility_longitude,shared_document_ids,created_at FROM appointments_db;
      DROP TABLE appointments_db;
      ALTER TABLE appointments_db_v2 RENAME TO appointments_db;
    `);
  }
} catch (migrationError) {
  console.warn('Appointment capacity migration skipped:', migrationError);
}

const MAX_DOCTOR_WORK_MINUTES = 8 * 60;
function validateDoctorHours(hours: any) {
  if (!Array.isArray(hours) || !hours.length) throw new Error('Doctor working hours are required.');
  let total = 0;
  for (const range of hours) {
    if (!Array.isArray(range) || range.length !== 2) throw new Error('Invalid doctor working hours.');
    const [from, to] = range;
    const fm = Number(from.slice(0, 2)) * 60 + Number(from.slice(3, 5));
    const tm = Number(to.slice(0, 2)) * 60 + Number(to.slice(3, 5));
    if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to) || tm <= fm) throw new Error('Invalid doctor working hours.');
    total += tm - fm;
  }
  if (total !== MAX_DOCTOR_WORK_MINUTES) throw new Error('A doctor must be scheduled for exactly 8 working hours per day.');
  return total;
}

const facility: Facility = {
  id: 'fac-1',
  name: 'Seva Rural Health Centre',
  type: 'Primary Health Centre',
  distance: '2.4 km',
  services: [
    'General medicine',
    'Maternal care',
    'Diagnostics',
    'Teleconsult'
  ],
  bedsAvailable: 8
};

const defaultDoctors = [
  {
    id: 'doc-1',
    name: 'Dr. Ananya Sharma',
    specialty: 'General Medicine',
    phone: '+91 98765 43210',
    availability: 'Available today',
    workingHours: [['09:00', '13:00'], ['14:00', '18:00']],
    slotMinutes: 30
  },
  {
    id: 'doc-2',
    name: 'Dr. R. Kumar',
    specialty: 'Paediatrics',
    phone: '+91 98765 43211',
    availability: 'Available today',
    workingHours: [['10:00', '14:00'], ['15:00', '19:00']],
    slotMinutes: 30
  }
];

for (const doctor of defaultDoctors as any[]) {
  db.prepare(`INSERT OR IGNORE INTO doctors (id,name,specialty,phone,availability,working_hours,slot_minutes,facility_id) VALUES (?,?,?,?,?,?,?,?)`)
    .run(doctor.id, doctor.name, doctor.specialty, doctor.phone || null, doctor.availability, JSON.stringify(doctor.workingHours), doctor.slotMinutes || 30, 'fac-1');
  validateDoctorHours(doctor.workingHours);
}

function hydrateDoctors() {
  return (db.prepare(`SELECT id,name,specialty,phone,availability,working_hours as workingHours,slot_minutes as slotMinutes,facility_id as facilityId FROM doctors ORDER BY name`).all() as any[]).map(d => ({ ...d, workingHours: JSON.parse(d.workingHours || '[]') }));
}
const doctors = hydrateDoctors();

function dateOnly(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const m = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${m.year}-${m.month}-${m.day}`;
}
function addDays(date: Date, days: number) { const x = new Date(date); x.setDate(x.getDate() + days); return x; }
function ensureFacility(facilityId: string, name?: string, latitude?: number, longitude?: number, phone?: string) {
  const id = facilityId || 'fac-1';
  const existing = db.prepare('SELECT id FROM facilities WHERE id=?').get(id) as any;
  const latVal = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null;
  const lngVal = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null;
  const phoneVal = phone || null;
  const nameVal = name || null;
  if (!existing) {
    db.prepare('INSERT INTO facilities (id,name,latitude,longitude,type,phone) VALUES (?,?,?,?,?,?)')
      .run(id, name || (id === 'fac-1' ? facility.name : 'Selected healthcare facility'), latVal, lngVal, id === 'fac-1' ? 'Primary Health Centre' : 'Hospital', phoneVal);
  } else if (name || latVal !== null || lngVal !== null || phone) {
    db.prepare('UPDATE facilities SET name=COALESCE(?,name), latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude), phone=COALESCE(?,phone) WHERE id=?')
      .run(nameVal, latVal, lngVal, phoneVal, id);
  }
}
ensureFacility('fac-1', facility.name);
ensureFacility('fac-2', 'District Hospital');
ensureFacility('fac-3', 'Referral Hospital');

function seedDemoDoctorsForFacility(facilityId: string, facilityName?: string) {
  const count = Number((db.prepare('SELECT COUNT(*) AS c FROM doctors WHERE facility_id=?').get(facilityId) as any)?.c || 0);
  if (count > 0) return;
  const base = String(facilityName || 'Demo Hospital').replace(/\s+/g, ' ').trim();
  const demoDoctors = [
    { id: `demo-doc-${facilityId}-1`, name: 'Dr. Ananya Sharma', specialty: 'General Medicine', phone: '+91 98765 43210', availability: 'Available today', workingHours: [['09:00', '13:00'], ['14:00', '18:00']], slotMinutes: 30 },
    { id: `demo-doc-${facilityId}-2`, name: 'Dr. R. Kumar', specialty: 'Paediatrics', phone: '+91 98765 43211', availability: 'Available today', workingHours: [['10:00', '14:00'], ['15:00', '19:00']], slotMinutes: 30 }
  ];
  for (const doctor of demoDoctors) {
    validateDoctorHours(doctor.workingHours);
    db.prepare(`INSERT OR IGNORE INTO doctors (id,name,specialty,phone,availability,working_hours,slot_minutes,facility_id) VALUES (?,?,?,?,?,?,?,?)`)
      .run(doctor.id, doctor.name, doctor.specialty, doctor.phone, doctor.availability, JSON.stringify(doctor.workingHours), doctor.slotMinutes, facilityId);
  }
  console.log(`Demo doctor roster seeded for ${base} (${facilityId})`);
}

function seedSlots(facilityId = 'fac-1', days = 90) {
  const doctorRows = db.prepare('SELECT id,name,specialty,phone,availability,working_hours as workingHours,slot_minutes as slotMinutes,facility_id as facilityId FROM doctors WHERE facility_id=?').all(facilityId) as any[];
  for (let offset = -2; offset < days; offset++) {
    const d = addDays(new Date(), offset);
    const date = dateOnly(d);
    const weekday = new Date(`${date}T12:00:00+05:30`).getDay();
    if (weekday === 0) continue;
    for (const doctor of doctorRows) {
      const workingHours = JSON.parse(doctor.workingHours || '[]');
      validateDoctorHours(workingHours);
      for (const [from, to] of workingHours) {
        let cursor = Number(from.slice(0, 2)) * 60 + Number(from.slice(3, 5));
        const end = Number(to.slice(0, 2)) * 60 + Number(to.slice(3, 5));
        while (cursor < end) {
          const h = Math.floor(cursor / 60), m = cursor % 60;
          const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const endMin = cursor + (doctor.slotMinutes || 30);
          if (endMin > end) break;
          const eh = Math.floor(endMin / 60), em = endMin % 60;
          const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          const slotId = `slot-${doctor.id}-${facilityId}-${date}-${start.replace(':', '')}`;
          db.prepare(`INSERT OR IGNORE INTO appointment_slots (id,doctor_id,facility_id,slot_date,start_time,end_time,status,capacity,booked_count) VALUES (?,?,?,?,?,?,?,?,?)`)
            .run(slotId, doctor.id, facilityId, date, start, endTime, 'available', 3, 0);
          const existingSlot = db.prepare(`SELECT id FROM appointment_slots WHERE doctor_id=? AND facility_id=? AND slot_date=? AND start_time=?`).get(doctor.id, facilityId, date, start) as any;
          if (existingSlot) {
            const count = db.prepare(`SELECT COUNT(*) AS c FROM appointments_db WHERE slot_id=? AND status='booked'`).get(existingSlot.id) as any;
            db.prepare(`UPDATE appointment_slots SET capacity=3, booked_count=?, status=CASE WHEN ? >= 3 THEN 'full' ELSE 'available' END WHERE id=?`).run(Number(count?.c || 0), Number(count?.c || 0), existingSlot.id);
          }
          cursor = endMin;
        }
      }
    }
  }
}
seedSlots();

function hydrateAppointments() {
  return (db.prepare(`SELECT id,patient_id as patientId,facility_id as facilityId,doctor_id as doctorId,starts_at as startsAt,token,status,facility_name as facilityName,facility_latitude as facilityLatitude,facility_longitude as facilityLongitude,shared_document_ids as sharedDocumentIds FROM appointments_db ORDER BY starts_at`).all() as any[]).map(a => ({ ...a, sharedDocumentIds: safeJson<string[]>(a.sharedDocumentIds, []) }));
}

type DemoUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'patient' | 'health_worker' | 'doctor' | 'facility_admin' | 'system_admin';
  facilityId?: string;
  patientId?: string;
  phone?: string;
};

const users: DemoUser[] = [
  {
    id: 'user-patient',
    name: 'Meera Devi',
    email: process.env.DEMO_PATIENT_EMAIL || 'meera@example.com',
    password: 'demo123',
    role: 'patient',
    patientId: 'pat-1',
    phone: '+91 90000 00001'
  },
  {
    id: 'user-worker',
    name: 'Sita ASHA',
    email: 'worker@example.com',
    password: 'demo123',
    role: 'health_worker',
    facilityId: 'fac-1'
  },
  {
    id: 'user-doctor',
    name: 'Dr. Ananya Sharma',
    email: 'doctor@example.com',
    password: 'demo123',
    role: 'doctor',
    facilityId: 'fac-1'
  },
  {
    id: 'user-admin',
    name: 'District Hospital Admin',
    email: 'admin@example.com',
    password: 'demo123',
    role: 'facility_admin',
    facilityId: 'fac-2'
  },
  {
    id: 'user-system',
    name: 'Platform Admin',
    email: 'system@example.com',
    password: 'demo123',
    role: 'system_admin'
  }
];


function persistUser(user: DemoUser) {
  db.prepare(`INSERT INTO users (id,name,email,password,role,facility_id,patient_id,phone) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,password=excluded.password,role=excluded.role,facility_id=excluded.facility_id,patient_id=excluded.patient_id,phone=excluded.phone`)
    .run(user.id, user.name, user.email, user.password, user.role, user.facilityId || null, user.patientId || null, user.phone || null);
}

const savedUsers = db.prepare('SELECT id,name,email,password,role,facility_id as facilityId,patient_id as patientId,phone FROM users').all() as any[];
for (const saved of savedUsers) {
  if (!users.some(u => u.id === saved.id)) users.push({ ...saved, role: saved.role as DemoUser['role'] });
}
for (const user of users) persistUser(user);
for (const user of users) migratePassword(user);

// Healthcare-worker roster used for emergency routing. In production these coordinates
// should come from the worker's verified facility/location service.
const emergencyWorkers = [
  { id: 'hw-1', userId: 'user-worker', name: 'Sita ASHA', phone: '+91 90000 10001', facilityId: 'fac-1', latitude: 23.2599, longitude: 77.4126, active: 1 },
  { id: 'hw-2', userId: 'user-worker-backup', name: 'Ravi Health Worker', phone: '+91 90000 10002', facilityId: 'fac-1', latitude: 23.2805, longitude: 77.4302, active: 1 }
];
for (const worker of emergencyWorkers) {
  db.prepare(`INSERT INTO health_workers (id,user_id,name,phone,facility_id,latitude,longitude,active) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,facility_id=excluded.facility_id,latitude=excluded.latitude,longitude=excluded.longitude,active=excluded.active`)
    .run(worker.id, worker.userId, worker.name, worker.phone, worker.facilityId, worker.latitude, worker.longitude, worker.active);
}

const patients: Patient[] = [
  {
    id: 'pat-1',
    name: 'Meera Devi',
    abhaId: '91-2345-6789-0123',
    age: 28,
    sex: 'Female',
    phone: '+91 90000 00001',
    language: 'Hindi',
    village: 'Kheriya',
    risk: 'high'
  },
  {
    id: 'pat-2',
    name: 'Ramesh Lal',
    abhaId: '91-8012-5501-4788',
    age: 62,
    sex: 'Male',
    phone: '+91 90000 00002',
    language: 'English',
    village: 'Bhanpur',
    risk: 'high'
  },
  {
    id: 'pat-3',
    name: 'Asha Kumari',
    age: 4,
    sex: 'Female',
    phone: '+91 90000 00003',
    language: 'Hindi',
    village: 'Kheriya',
    risk: 'normal'
  },
  {
    id: 'pat-4',
    name: 'Lakshmi Bai',
    abhaId: '91-4455-6677-8899',
    age: 34,
    sex: 'Female',
    phone: '+91 90000 00004',
    language: 'Hindi',
    village: 'Govindpura',
    risk: 'high'
  },
  {
    id: 'pat-5',
    name: 'Suresh Yadav',
    age: 55,
    sex: 'Male',
    phone: '+91 90000 00005',
    language: 'Hindi',
    village: 'Barkheda',
    risk: 'high'
  },
  {
    id: 'pat-6',
    name: 'Kavita Sharma',
    age: 42,
    sex: 'Female',
    phone: '+91 90000 00006',
    language: 'Hindi',
    village: 'Kheriya',
    risk: 'normal'
  },
  {
    id: 'pat-7',
    name: 'Raju Verma',
    age: 8,
    sex: 'Male',
    phone: '+91 90000 00007',
    language: 'Hindi',
    village: 'Bhanpur',
    risk: 'normal'
  },
  {
    id: 'pat-8',
    name: 'Priya Singh',
    age: 29,
    sex: 'Female',
    phone: '+91 90000 00008',
    language: 'English',
    village: 'Govindpura',
    risk: 'normal'
  },
  {
    id: 'pat-9',
    name: 'Gopal Das',
    age: 71,
    sex: 'Male',
    phone: '+91 90000 00009',
    language: 'Hindi',
    village: 'Barkheda',
    risk: 'high'
  }
];

// Keep the registered patient contact mirrored in the permanent user account.
for (const patient of patients) {
  const account = users.find(u => u.patientId === patient.id);
  if (account) { account.phone = patient.phone || account.phone || ''; persistUser(account); }
}

function hydrateCareTeamMessages(patientId?: string, viewerRole?: string) {
  const rows = patientId
    ? db.prepare(`SELECT id,patient_id as patientId,sender_role as senderRole,sender_id as senderId,sender_name as senderName,recipient_role as recipientRole,recipient_id as recipientId,recipient_name as recipientName,message,original_message as originalMessage,translated_message as translatedMessage,patient_language as patientLanguage,target_language as targetLanguage,translation_status as translationStatus,created_at as createdAt,read_at as readAt FROM care_team_messages WHERE patient_id=? ORDER BY created_at ASC`).all(patientId) as any[]
    : db.prepare(`SELECT id,patient_id as patientId,sender_role as senderRole,sender_id as senderId,sender_name as senderName,recipient_role as recipientRole,recipient_id as recipientId,recipient_name as recipientName,message,original_message as originalMessage,translated_message as translatedMessage,patient_language as patientLanguage,target_language as targetLanguage,translation_status as translationStatus,created_at as createdAt,read_at as readAt FROM care_team_messages ORDER BY created_at ASC LIMIT 200`).all() as any[];

  return rows.map((row: any) => {
    const isPatientViewer = viewerRole === 'patient';
    const isFromPatient = row.senderRole === 'patient';
    const original = row.originalMessage || row.message;
    const translated = row.translatedMessage || (row.recipientRole === 'patient' ? row.message : undefined);

    let displayMessage = row.message;
    if (isPatientViewer) {
      if (isFromPatient) {
        displayMessage = original;
      } else {
        displayMessage = translated || row.message || original;
      }
    } else {
      if (isFromPatient) {
        displayMessage = translated || row.message || original;
      } else {
        displayMessage = original;
      }
    }

    return {
      ...row,
      message: displayMessage,
      originalMessage: original,
      translatedMessage: translated,
      patientLanguage: row.patientLanguage || 'HI',
      translationStatus: row.translationStatus || (translated && translated !== original ? 'translated' : 'original'),
    };
  });
}

function seedCareTeamMessages() {
  const count = Number((db.prepare('SELECT COUNT(*) AS c FROM care_team_messages').get() as any)?.c || 0);
  if (count > 0) return;
  const seed = db.prepare(`INSERT INTO care_team_messages (id,patient_id,sender_role,sender_id,sender_name,recipient_role,recipient_id,recipient_name,message,original_message,translated_message,patient_language,translation_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const t = now();
  seed.run(
    uid('msg'),
    'pat-1',
    'health_worker',
    'user-worker',
    'Sita ASHA',
    'care_team',
    'care-team-all',
    'Entire Care Team',
    'नमस्ते मीरा। मैं आपके लक्षणों की जाँच कर रही हूँ और डॉक्टर से जुड़ने में आपकी मदद करूँगी।',
    'Hello Meera. I am checking your symptoms and will help you connect with the doctor.',
    'नमस्ते मीरा। मैं आपके लक्षणों की जाँच कर रही हूँ और डॉक्टर से जुड़ने में आपकी मदद करूँगी।',
    'HI',
    'translated',
    '' + t
  );
  seed.run(
    uid('msg'),
    'pat-1',
    'patient',
    'user-patient',
    'Meera Devi',
    'care_team',
    'care-team-all',
    'Entire Care Team',
    'Thank you. My headache is still there and I am ready for the doctor review.',
    'धन्यवाद। मुझे अभी भी सिरदर्द है और मैं डॉक्टर समीक्षा के लिए तैयार हूँ।',
    'Thank you. My headache is still there and I am ready for the doctor review.',
    'HI',
    'translated',
    '' + new Date(Date.now() + 1000).toISOString()
  );
  seed.run(
    uid('msg'),
    'pat-1',
    'doctor',
    'user-doctor',
    'Dr. Ananya Sharma',
    'care_team',
    'care-team-all',
    'Entire Care Team',
    'मैंने आपका मामला देख लिया है। सीता अगले कदम में मदद करेंगी और मैं क्लिनिकल समीक्षा के लिए उपलब्ध रहूंगी।',
    'I have reviewed your case. Sita will help with the next step and I will remain available for clinical review.',
    'मैंने आपका मामला देख लिया है। सीता अगले कदम में मदद करेंगी और मैं क्लिनिकल समीक्षा के लिए उपलब्ध रहूंगी।',
    'HI',
    'translated',
    '' + new Date(Date.now() + 2000).toISOString()
  );
}
seedCareTeamMessages();


// Persist editable patient health context. Seed only missing rows so existing patient-entered
// information survives API restarts.
for (const p of patients) {
  const existing = db.prepare('SELECT patient_id FROM patient_health_profiles WHERE patient_id=?').get(p.id) as any;
  if (!existing) {
    db.prepare(`INSERT INTO patient_health_profiles (patient_id, medical_condition, medical_history, allergies, medications, updated_at) VALUES (?,?,?,?,?,?)`)
      .run(p.id, p.medicalCondition || '', p.medicalHistory || '', p.allergies || '', p.medications || '', now());
  }
}
const normalizeUiLanguage = (value: unknown): 'EN' | 'HI' | 'TA' | '' => {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'HI' || v === 'HINDI') return 'HI';
  if (v === 'TA' || v === 'TAMIL') return 'TA';
  if (v === 'EN' || v === 'ENGLISH') return 'EN';
  return '';
};
const languageName = (value: unknown) => {
  const code = normalizeUiLanguage(value);
  return code === 'HI' ? 'Hindi' : code === 'TA' ? 'Tamil' : 'English';
};
const languageCode = (value: unknown) => normalizeUiLanguage(value) || 'EN';
const persistPatient = (patient: any) => {
  db.prepare(`INSERT INTO patient_storage (patient_id, patient_json, updated_at) VALUES (?,?,?)
    ON CONFLICT(patient_id) DO UPDATE SET patient_json=excluded.patient_json, updated_at=excluded.updated_at`)
    .run(patient.id, JSON.stringify(patient), now());
};

const savedPatientStorage = db.prepare('SELECT * FROM patient_storage').all() as any[];
for (const saved of savedPatientStorage) {
  try {
    const stored = JSON.parse(saved.patient_json);
    const p = patients.find(x => x.id === saved.patient_id);
    if (p && stored) {
      Object.assign(p, stored, { id: p.id });
      // Existing patient records already contain a language, so preserve it as
      // the account's saved preference instead of asking again at every login.
      if ((p as any).languagePreferenceSet === undefined) {
        (p as any).languagePreferenceSet = Boolean((p as any).language);
      }
    } else if (stored && stored.id) {
      if ((stored as any).languagePreferenceSet === undefined) {
        (stored as any).languagePreferenceSet = Boolean((stored as any).language);
      }
      patients.push(stored);
    }
  } catch { }
}
for (const p of patients) persistPatient(p);
// Upgrade older referral records so every referral has a stable, human-readable token and hospital names.
for (const oldReferral of db.prepare('SELECT * FROM referrals').all() as any[]) {
  const patient = patients.find(p => p.id === oldReferral.patient_id);
  const target = db.prepare('SELECT name FROM facilities WHERE id=?').get(oldReferral.to_facility_id) as any;
  const source = db.prepare('SELECT name FROM facilities WHERE id=?').get(oldReferral.from_facility_id) as any;
  let token = oldReferral.referral_token;
  if (!token) {
    do { token = `REF-${dateOnly(new Date()).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; } while (db.prepare('SELECT id FROM referrals WHERE referral_token=?').get(token));
  }
  db.prepare('UPDATE referrals SET referral_token=?, patient_name=?, to_facility_name=?, from_facility_name=? WHERE id=?')
    .run(token, patient?.name || oldReferral.patient_name || 'Patient', target?.name || oldReferral.to_facility_name || 'Receiving Hospital', source?.name || oldReferral.from_facility_name || 'Sending Facility', oldReferral.id);
}

const savedHealthProfiles = db.prepare('SELECT * FROM patient_health_profiles').all() as any[];
for (const profile of savedHealthProfiles) {
  const p = patients.find(x => x.id === profile.patient_id);
  if (p) {
    p.medicalCondition = profile.medical_condition || '';
    p.medicalHistory = profile.medical_history || '';
    p.allergies = profile.allergies || '';
    p.medications = profile.medications || '';
  }
}

function hydrateConsents(): Consent[] {
  return (db.prepare(`SELECT id, patient_id as patientId, scopes, status, granted_at as grantedAt FROM care_consents_db ORDER BY patient_id`).all() as any[]).map(x => ({
    id: x.id, patientId: x.patientId, scopes: safeJson<string[]>(x.scopes, []), status: x.status, grantedAt: x.grantedAt || undefined
  }));
}
for (const [i, p] of patients.entries()) {
  db.prepare(`INSERT INTO care_consents_db (id,patient_id,scopes,status,granted_at,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(patient_id) DO NOTHING`).run(`con-${i + 1}`, p.id, JSON.stringify(['care', 'referral', 'reminders']), 'active', now(), now());
}
const consents: Consent[] = hydrateConsents();

function refreshConsents() {
  consents.splice(0, consents.length, ...hydrateConsents());
}


function hydrateEmergencyAlerts() {
  return (db.prepare(`SELECT id,patient_id as patientId,patient_name as patientName,patient_phone as patientPhone,latitude,longitude,location_accuracy as locationAccuracy,assigned_worker_id as assignedWorkerId,assigned_worker_name as assignedWorkerName,assigned_worker_phone as assignedWorkerPhone,status,fallback_used as fallbackUsed,created_at as createdAt,resolved_at as resolvedAt FROM emergency_alerts ORDER BY created_at DESC`).all() as any[]).map(x => ({ ...x, fallbackUsed: Boolean(x.fallbackUsed) }));
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestEmergencyWorker(latitude: number, longitude: number) {
  const workers = db.prepare('SELECT * FROM health_workers WHERE active=1 AND latitude IS NOT NULL AND longitude IS NOT NULL').all() as any[];
  if (!workers.length || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return workers.map(w => ({ ...w, distanceKm: distanceKm(latitude, longitude, Number(w.latitude), Number(w.longitude)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
}

function hydrateConsentRequests() {
  return (db.prepare(`SELECT id, patient_id as patientId, status, phone, latitude, longitude, location_accuracy as locationAccuracy, patient_snapshot as patientSnapshot, document_ids as documentIds, created_at as createdAt, responded_at as respondedAt FROM care_consent_requests ORDER BY created_at DESC`).all() as any[]).map(x => ({ ...x, patientSnapshot: (() => { try { return JSON.parse(x.patientSnapshot); } catch { return {}; } })(), documentIds: (() => { try { return JSON.parse(x.documentIds || '[]'); } catch { return []; } })() }));
}

const appointments: Appointment[] = [
  {
    id: 'apt-1',
    patientId: 'pat-1',
    facilityId: 'fac-1',
    doctorId: 'doc-1',
    startsAt: '2026-08-24T10:30:00+05:30',
    token: 1,
    status: 'completed'
  }
];

// Clean up stale demo/upcoming appointment state so past appointments never block new bookings.
// A patient may only have one genuinely upcoming booked appointment; historical appointments
// remain available in the record but must not prevent a new booking.
const staleBooked = db.prepare(`SELECT id, slot_id FROM appointments_db WHERE status='booked' AND starts_at < ?`).all(now()) as any[];
if (staleBooked.length) {
  try {
    db.exec('BEGIN IMMEDIATE');
    for (const a of staleBooked) {
      db.prepare(`UPDATE appointments_db SET status='completed' WHERE id=? AND status='booked'`).run(a.id);
      if (a.slot_id) {
        db.prepare(`UPDATE appointment_slots SET booked_count=MAX(0, booked_count-1), status=CASE WHEN MAX(0, booked_count-1) >= capacity THEN 'full' ELSE 'available' END WHERE id=?`).run(a.slot_id);
      }
    }
    db.exec('COMMIT');
  } catch {
    try { db.exec('ROLLBACK'); } catch {}
  }
}

// Persist the original demo appointment once as a historical visit; subsequent appointments are database-backed.
if ((db.prepare('SELECT COUNT(*) AS c FROM appointments_db').get() as any).c === 0) {
  for (const a of appointments as any[]) {
    const date = a.startsAt.slice(0, 10), time = a.startsAt.slice(11, 16);
    let slot = db.prepare('SELECT id FROM appointment_slots WHERE doctor_id=? AND slot_date=? AND start_time=?').get(a.doctorId, date, time) as any;
    if (!slot) {
      const slotId = `slot-${a.doctorId}-${a.facilityId}-${date}-${time.replace(':', '')}`;
      db.prepare(`INSERT OR IGNORE INTO appointment_slots (id,doctor_id,facility_id,slot_date,start_time,end_time,status,capacity,booked_count) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(slotId, a.doctorId, a.facilityId, date, time, '11:00', 'available', 3, 1);
      slot = { id: slotId };
    } else {
      db.prepare(`UPDATE appointment_slots SET booked_count=1, status='available' WHERE id=?`).run(slot.id);
    }
    db.prepare(`INSERT INTO appointments_db (id,patient_id,facility_id,doctor_id,slot_id,starts_at,token,status,shared_document_ids) VALUES (?,?,?,?,?,?,?,?,?)`).run(a.id, a.patientId, a.facilityId, a.doctorId, slot.id, a.startsAt, a.token, a.status, '[]');
  }
}

function safeJson<T>(value: any, fallback: T): T {
  try { return JSON.parse(value ?? '') as T; } catch { return fallback; }
}

function hydrateIntakes(): IntakeSummary[] {
  return (db.prepare(`SELECT id,patient_id as patientId,appointment_id as appointmentId,symptoms,summary,red_flags as redFlags,status,created_at as createdAt FROM intakes_db ORDER BY created_at DESC`).all() as any[]).map(x => ({ ...x, symptoms: safeJson<string[]>(x.symptoms, []), redFlags: safeJson<string[]>(x.redFlags, []) }));
}
function hydrateConsultations(): any[] {
  return (db.prepare(`SELECT id,patient_id as patientId,doctor_id as doctorId,diagnosis,notes,created_at as createdAt FROM consultations_db ORDER BY created_at DESC`).all() as any[]).map(x => {
    const doc = doctors.find(d => d.id === x.doctorId);
    return {
      ...x,
      doctorName: doc?.name || (x.doctorId === 'worker-1' ? 'ASHA Health Worker' : 'Dr. Ananya Sharma'),
      diagnosis: safeJson<string[]>(x.diagnosis, [])
    };
  });
}
function hydratePrescriptions(): any[] {
  return (db.prepare(`SELECT id,patient_id as patientId,consultation_id as consultationId,medicines,created_at as createdAt FROM prescriptions_db ORDER BY created_at DESC`).all() as any[]).map(x => {
    const con = db.prepare(`SELECT doctor_id,notes FROM consultations_db WHERE id=?`).get(x.consultationId) as any;
    const doc = con ? doctors.find(d => d.id === con.doctor_id) : null;
    return {
      ...x,
      doctorName: doc?.name || 'Dr. Ananya Sharma',
      doctorNotes: con?.notes || '',
      medicines: safeJson<any[]>(x.medicines, [])
    };
  });
}
function hydrateDiagnosticOrders(patientId?: string): DiagnosticOrder[] {
  const rows = patientId
    ? db.prepare(`SELECT id,patient_id as patientId,case_id as caseId,test_name as testName,facility_name as facilityName,status,ordered_at as orderedAt FROM diagnostic_orders WHERE patient_id=? ORDER BY ordered_at DESC`).all(patientId)
    : db.prepare(`SELECT id,patient_id as patientId,case_id as caseId,test_name as testName,facility_name as facilityName,status,ordered_at as orderedAt FROM diagnostic_orders ORDER BY ordered_at DESC`).all();
  return rows as any[];
}

// ── Deterministic severity rule engine (doc-side governance, DB-backed) ────
function computeSeverity(symptoms: string[], redFlags: string[], patientAge: number): {
  level: 'critical' | 'urgent' | 'concerning' | 'routine';
  reasoning: string;
  override?: { overridden: boolean; ruleName: string; originalLevel: string; reason: string };
} {
  const text = [...symptoms, ...redFlags].join(' ').toLowerCase();
  // CRITICAL rules — deterministic red-flag governance
  if (/pregnan|gestation/.test(text) && /headache|vision|blurr|swell/.test(text))
    return { level: 'critical', reasoning: 'Pregnancy with hypertensive symptoms (possible pre-eclampsia). Immediate obstetric assessment required.', override: { overridden: true, ruleName: 'MATERNAL_HYPERTENSION_OVERRIDE', originalLevel: 'urgent', reason: 'Pregnancy + headache/vision/swelling → escalated to CRITICAL per maternal safety protocol.' } };
  if (/chest|crushing|cardiac|heart/.test(text) && /pain|pressure|tight/.test(text))
    return { level: 'critical', reasoning: 'Chest pain pattern consistent with acute coronary syndrome. Immediate cardiac evaluation required.', override: { overridden: true, ruleName: 'CHEST_PAIN_ACS_OVERRIDE', originalLevel: 'urgent', reason: 'Chest pain with exertion/radiation → escalated to CRITICAL per cardiac protocol.' } };
  if (/stroke|hemiplegia|paralys|facial droop|slurr/.test(text))
    return { level: 'critical', reasoning: 'Acute neurological presentation consistent with stroke. Golden-hour thrombolysis window.', override: { overridden: true, ruleName: 'ACUTE_STROKE_OVERRIDE', originalLevel: 'urgent', reason: 'Focal neurology + acute onset → escalated to CRITICAL per stroke protocol.' } };
  if (/unconscious|unresponsive|seizure|convuls/.test(text))
    return { level: 'critical', reasoning: 'Altered consciousness or seizure activity — life-threatening emergency.' };
  // URGENT rules
  if (patientAge <= 12 && /fever|temperature/.test(text))
    return { level: 'urgent', reasoning: `Paediatric patient (age ${patientAge}) with fever. Rapid clinical assessment required to rule out sepsis or meningitis.` };
  if (/tb|tuberculosis|sputum|haemoptysis/.test(text))
    return { level: 'urgent', reasoning: 'Respiratory symptoms consistent with pulmonary TB. NTEP referral and sputum microscopy required.' };
  if (/appendic|right lower|peritonit/.test(text))
    return { level: 'urgent', reasoning: 'Acute abdominal pain pattern — surgical evaluation and USG required urgently.' };
  if (/bleed|haemorrhage|hemorrhage/.test(text))
    return { level: 'urgent', reasoning: 'Active or reported bleeding — requires prompt clinical assessment.' };
  if (/breath|dyspnoea|shortness of breath/.test(text))
    return { level: 'urgent', reasoning: 'Respiratory distress reported. Oxygen saturation assessment required.' };
  // CONCERNING rules
  if (/diabetes|sugar|hba1c/.test(text) || /hypertension|bp|blood pressure/.test(text))
    return { level: 'concerning', reasoning: 'Chronic disease management concern. Review medication compliance and vitals.' };
  if (/rash|skin|itch|allerg/.test(text))
    return { level: 'concerning', reasoning: 'Dermatological presentation. Assess for allergic reaction or infection.' };
  if (/knee|joint|stiffness|arthrit/.test(text))
    return { level: 'concerning', reasoning: 'Musculoskeletal complaint. Functional assessment recommended.' };
  // ROUTINE default
  return { level: 'routine', reasoning: 'No immediate red-flag pattern detected. Routine clinical review at next available appointment.' };
}

function computeStructuredSummary(symptoms: string[], redFlags: string[], rawSummary: string) {
  const text = symptoms.join(' ').toLowerCase();
  let chiefComplaint = symptoms[0] || rawSummary.slice(0, 60);
  let duration = 'Not specified';
  const durationMatch = rawSummary.match(/(\d+)\s*(day|week|hour|month)/i);
  if (durationMatch) duration = `${durationMatch[1]} ${durationMatch[2]}(s)`;
  const conditions: string[] = [];
  const medications: string[] = [];
  if (/pregnan|gestation/.test(text)) conditions.push('Pregnancy');
  if (/hypertension|bp/.test(text)) { conditions.push('Hypertension'); medications.push('Amlodipine (reported)'); }
  if (/diabetes/.test(text)) { conditions.push('Diabetes'); medications.push('Antidiabetic (reported)'); }
  if (/tb|tuberculosis/.test(text)) conditions.push('Suspected TB');
  return {
    chiefComplaint,
    duration,
    symptoms,
    history: { conditions, medications, allergies: [] as string[] },
    redFlags
  };
}

function buildLongitudinalHistory(patientId: string) {
  const history: any[] = [];
  const facilityName = 'Seva Rural Health Centre';
  const appts = (db.prepare('SELECT id,starts_at,status,doctor_id FROM appointments_db WHERE patient_id=? ORDER BY starts_at').all(patientId) as any[]);
  for (const a of appts) {
    const doc = doctors.find(d => d.id === a.doctor_id);
    history.push({ id: `hist-apt-${a.id}`, date: String(a.starts_at || '').slice(0, 10), facility: facilityName, type: 'visit', title: `${a.status === 'completed' ? 'Completed visit' : 'Booked appointment'} · ${doc?.name || 'Clinician'}`, detail: a.status === 'completed' ? 'Appointment completed.' : 'Appointment booked — pending visit.', doctorName: doc?.name, status: a.status });
  }
  const consultations = (db.prepare('SELECT id,created_at,notes,diagnosis FROM consultations_db WHERE patient_id=? ORDER BY created_at').all(patientId) as any[]);
  for (const c of consultations) {
    history.push({ id: `hist-con-${c.id}`, date: String(c.created_at || '').slice(0, 10), facility: facilityName, type: 'visit', title: 'Teleconsultation / Clinical Notes', detail: c.notes || 'Consultation recorded.', doctorName: 'Dr. Ananya Sharma', status: 'completed' });
  }
  const rxs = (db.prepare('SELECT id,created_at,medicines FROM prescriptions_db WHERE patient_id=? ORDER BY created_at').all(patientId) as any[]);
  for (const rx of rxs) {
    const meds = safeJson<any[]>(rx.medicines, []).map((m: any) => m.name || m).join(', ');
    history.push({ id: `hist-rx-${rx.id}`, date: String(rx.created_at || '').slice(0, 10), facility: facilityName, type: 'prescription', title: 'E-Prescription Issued', detail: meds || 'Medicines prescribed.', doctorName: 'Dr. Ananya Sharma', status: 'active' });
  }
  const refs = (db.prepare('SELECT id,created_at,reason,status,to_facility_name FROM referrals WHERE patient_id=? ORDER BY created_at').all(patientId) as any[]);
  for (const r of refs) {
    history.push({ id: `hist-ref-${r.id}`, date: String(r.created_at || '').slice(0, 10), facility: facilityName, type: 'referral', title: `Referral → ${r.to_facility_name || 'Specialist'}`, detail: r.reason || 'Referred for specialist evaluation.', status: r.status });
  }
  const diags = (db.prepare('SELECT id,ordered_at,test_name,facility_name,status FROM diagnostic_orders WHERE patient_id=? ORDER BY ordered_at').all(patientId) as any[]);
  for (const d of diags) {
    history.push({ id: `hist-diag-${d.id}`, date: String(d.ordered_at || '').slice(0, 10), facility: d.facility_name || facilityName, type: 'diagnostic', title: `Diagnostic Ordered: ${d.test_name}`, detail: `Status: ${d.status}`, status: d.status });
  }
  return history.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function hydrateTriageCases(): any[] {
  const rows = db.prepare('SELECT * FROM triage_cases ORDER BY submitted_at DESC').all() as any[];
  return rows.map(row => {
    const patient = patients.find(p => p.id === row.patient_id);
    const submittedAt = String(row.submitted_at || '');
    const msAgo = Date.now() - new Date(submittedAt).getTime();
    const minsAgo = Math.floor(msAgo / 60000);
    const timeAgo = minsAgo < 60 ? `${minsAgo} min ago` : minsAgo < 1440 ? `${Math.floor(minsAgo / 60)}h ago` : `${Math.floor(minsAgo / 1440)}d ago`;
    const summary = safeJson<any>(row.summary_json, {});
    const override = safeJson<any>(row.override_json, {});
    let frontlineWorker = row.frontline_worker_json ? safeJson<any>(row.frontline_worker_json, null) : null;
    if (row.assigned_worker_id) {
      const hw = db.prepare('SELECT id, name, phone, facility_id FROM health_workers WHERE id=?').get(row.assigned_worker_id) as any;
      if (hw) {
        frontlineWorker = {
          name: hw.name,
          role: 'ASHA Worker',
          phone: hw.phone,
          status: (frontlineWorker?.status || 'dispatched') as any,
          distance: frontlineWorker?.distance || '1.5 km'
        };
      }
    }
    // Pull live workers for display if none assigned
    const availableWorkers = (db.prepare('SELECT id,name,phone,facility_id FROM health_workers WHERE active=1').all() as any[]).map(w => ({ id: w.id, name: w.name, role: 'ASHA Worker', phone: w.phone, status: 'available' as const, distance: '1.5 km' }));
    return {
      id: row.id,
      patientId: row.patient_id,
      intakeId: row.intake_id,
      patientName: patient?.name || 'Unknown',
      patientAge: patient?.age || 0,
      patientGender: patient?.sex || 'Unknown',
      patientLanguage: patient?.language || 'Hindi',
      patientAbha: patient?.abhaId,
      patientVillage: patient?.village || '',
      submittedAt,
      timeAgo,
      status: (row.case_status || 'new') as any,
      severity: {
        level: (row.severity_level || 'concerning') as any,
        reasoning: row.severity_reasoning || '',
        override: override?.overridden ? override : undefined
      },
      summary,
      transcript: safeJson<any[]>(row.transcript_json, []),
      longitudinalHistory: buildLongitudinalHistory(row.patient_id),
      frontlineWorker,
      followUpDate: row.follow_up_date || undefined,
      notes: row.notes || undefined,
      _availableWorkers: availableWorkers
    };
  });
}

function autoCreateTriageCase(
  patientId: string,
  intakeId: string,
  symptoms: string[],
  redFlags: string[],
  rawSummary: string,
  appointmentId?: string,
  doctorId?: string,
  careReviewRequestId?: string,
  referralId?: string,
  assignedWorkerId?: string
) {
  // Only create if no open case already exists for this intake
  const existing = db.prepare('SELECT id FROM triage_cases WHERE intake_id=?').get(intakeId) as any;
  if (existing) return existing;
  const patient = patients.find(p => p.id === patientId);
  const age = patient?.age || 0;
  const { level, reasoning, override } = computeSeverity(symptoms, redFlags, age);
  const summary = computeStructuredSummary(symptoms, redFlags, rawSummary);
  const caseId = uid('case');
  const transcript = symptoms.map((s, i) => ({
    question: i === 0 ? 'What is the main reason for your visit today?' : `Can you describe your ${s.toLowerCase()} further?`,
    answer: s,
    timestamp: now()
  }));
  db.prepare('INSERT INTO triage_cases (id,patient_id,intake_id,appointment_id,doctor_id,care_review_request_id,referral_id,assigned_worker_id,severity_level,severity_reasoning,override_json,case_status,summary_json,transcript_json,submitted_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    caseId, patientId, intakeId,
    appointmentId || null, doctorId || null, careReviewRequestId || null, referralId || null, assignedWorkerId || null,
    level, reasoning,
    JSON.stringify(override || {}), 'new',
    JSON.stringify(summary), JSON.stringify(transcript),
    now(), now()
  );
  return { id: caseId };
}

// Seed demo triage cases from existing patients on first boot (only if no cases exist)
try {
  const caseCount = Number((db.prepare('SELECT COUNT(*) AS c FROM triage_cases').get() as any)?.c || 0);
  if (caseCount === 0) {
    const demoIntakes = [
      { patientId: 'pat-1', symptoms: ['Headache for 2 days', 'Blurred vision', 'Swelling in feet', '28 weeks pregnant'], flags: ['Pregnancy with possible pre-eclampsia symptoms'], summary: '28-year-old pregnant patient with headache, blurred vision and pedal oedema for 2 days.' },
      { patientId: 'pat-2', symptoms: ['Crushing chest pain', 'Radiating to left arm', 'Diaphoresis'], flags: ['Chest pain with radiation — possible ACS'], summary: '62-year-old male with acute chest pain radiating to left arm with diaphoresis.' },
      { patientId: 'pat-4', symptoms: ['High fever for 3 days', 'Cough with sputum', 'Night sweats'], flags: ['Sputum-producing cough with night sweats — TB screening required'], summary: '34-year-old with persistent productive cough, fever and night sweats.' },
      { patientId: 'pat-5', symptoms: ['Severe abdominal pain', 'Right lower quadrant', 'Nausea', 'Low-grade fever'], flags: ['RLQ pain — appendicitis evaluation required'], summary: '55-year-old male with acute right lower quadrant pain and guarding.' },
      { patientId: 'pat-6', symptoms: ['BP refill request', 'Hypertension on Amlodipine', 'Occasional headaches'], flags: [], summary: '42-year-old hypertensive patient requesting medication refill.' },
      { patientId: 'pat-7', symptoms: ['High fever 104°F', 'Rash on trunk', 'Lethargy', 'Poor feeding'], flags: ['Child with high fever and rash — urgent paediatric review'], summary: '8-year-old with high fever, trunk rash and lethargy for 2 days.' },
      { patientId: 'pat-8', symptoms: ['Knee pain', 'Joint stiffness in the morning', 'Mild swelling'], flags: [], summary: '29-year-old with bilateral knee pain and morning stiffness.' },
      { patientId: 'pat-9', symptoms: ['Acute slurring of speech', 'Right-sided facial droop', 'Weakness in right arm'], flags: ['Acute stroke symptoms — golden hour critical'], summary: '71-year-old with sudden onset slurring, facial droop and arm weakness.' }
    ];
    for (const demo of demoIntakes) {
      // Ensure demo patient exists in patients array (extra patients are seeded above)
      if (!patients.some(p => p.id === demo.patientId)) continue;
      const intakeId = uid('int');
      db.prepare('INSERT OR IGNORE INTO intakes_db (id,patient_id,symptoms,summary,red_flags,status,created_at) VALUES (?,?,?,?,?,?,?)').run(intakeId, demo.patientId, JSON.stringify(demo.symptoms), demo.summary, JSON.stringify(demo.flags), 'pending_review', now());
      autoCreateTriageCase(demo.patientId, intakeId, demo.symptoms, demo.flags, demo.summary);
    }
    console.log('Demo triage cases seeded from real patient records.');
  }
} catch (seedError) {
  console.warn('Demo triage case seeding skipped:', seedError);
}
if (Number((db.prepare('SELECT COUNT(*) AS c FROM intakes_db').get() as any).c || 0) === 0) {
  db.prepare(`INSERT INTO intakes_db (id,patient_id,appointment_id,symptoms,summary,red_flags,status,created_at) VALUES (?,?,?,?,?,?,?,?)`).run('int-1', 'pat-1', 'apt-1', JSON.stringify(['Headache for 2 days', 'Blurred vision', 'Swelling in feet']), '28-year-old, 7 months pregnant. Reports headache, blurred vision and pedal swelling for 2 days. Blood pressure assessment is recommended urgently.', JSON.stringify(['Pregnancy with possible pre-eclampsia symptoms']), 'pending_review', now());
}

function hydrateMedicalDocuments(): MedicalDocument[] {
  return (db.prepare(`SELECT id,patient_id as patientId,name,type,mime_type as mimeType,size,data_url as dataUrl,notes,uploaded_at as uploadedAt,shared_with_care_team as sharedWithCareTeam FROM medical_documents ORDER BY uploaded_at DESC`).all() as any[]).map(d => ({ ...d, sharedWithCareTeam: Boolean(d.sharedWithCareTeam) }));
}

function seedMedicalDocuments() {
  // Intentionally empty: patients start with no medical reports.
  // Reports are created only when the patient uploads them.
}
seedMedicalDocuments();

function hydratePrecautions() {
  return (db.prepare('SELECT id, patient_id as patientId, sent_by as sentBy, message, translated_message as translatedMessage, patient_language as patientLanguage, status, created_at as createdAt, resolved_at as resolvedAt FROM patient_precautions ORDER BY created_at DESC').all() as any[]);
}

function hydrateReferrals(): Referral[] {
  return (db.prepare(`SELECT id,patient_id as patientId,from_facility_id as fromFacilityId,to_facility_id as toFacilityId,reason,status,created_at as createdAt,updated_at as updatedAt,referral_token as referralToken,patient_name as patientName,to_facility_name as toFacilityName,from_facility_name as fromFacilityName FROM referrals ORDER BY created_at DESC`).all() as any[]);
}

if (Number((db.prepare('SELECT COUNT(*) AS c FROM referrals').get() as any).c || 0) === 0) {
  db.prepare(`INSERT INTO referrals (id,patient_id,from_facility_id,to_facility_id,reason,status,created_at,updated_at,referral_token,patient_name,to_facility_name,from_facility_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('ref-1', 'pat-2', 'fac-1', 'fac-2', 'Cardiology assessment for persistent hypertension', 'accepted', now(), now(), 'REF-DEMO-0001', patients.find(p => p.id === 'pat-2')?.name || 'Patient', 'District Hospital', 'Seva Rural Health Centre');
}

const referrals: Referral[] = hydrateReferrals();

if (Number((db.prepare('SELECT COUNT(*) AS c FROM medicine_inventory').get() as any).c || 0) === 0) {
  const seed = db.prepare('INSERT INTO medicine_inventory (id,name,quantity,low_stock_threshold,updated_at) VALUES (?,?,?,?,?)');
  [['med-1', 'Paracetamol 500mg', 144, 20], ['med-2', 'Amlodipine 5mg', 18, 20], ['med-3', 'ORS sachets', 82, 20]].forEach(([id, name, quantity, threshold]) => seed.run(id, name, quantity, threshold, now()));
}


const audit: { id: string; patientId?: string; action: string; createdAt: string }[] = [];
const savedAudit = db.prepare(`SELECT id,patient_id as patientId,action,created_at as createdAt FROM audit_logs ORDER BY created_at DESC LIMIT 1000`).all() as any[];
audit.push(...savedAudit);

function log(patientId: string | undefined, action: string) {
  const entry = { id: uid('audit'), patientId, action, createdAt: now() };
  db.prepare(`INSERT INTO audit_logs (id,patient_id,action,created_at) VALUES (?,?,?,?)`).run(entry.id, entry.patientId || null, entry.action, entry.createdAt);
  audit.unshift(entry);
  if (audit.length > 1000) audit.pop();
}

function hydrateCareReviewRequests() {
  return (db.prepare(`SELECT id, patient_id as patientId, sent_by as sentBy, reason, status, created_at as createdAt, reviewed_at as reviewedAt FROM care_review_requests ORDER BY created_at DESC`).all() as any[]);
}

function dashboard() {
  const allAppointments = hydrateAppointments();
  const completed = allAppointments.filter((a: any) => a.status === 'completed').length;
  const eligibleVisits = allAppointments.filter((a: any) => a.status !== 'cancelled').length;
  const followUpRate = eligibleVisits ? Math.round((completed / eligibleVisits) * 100) : 0;
  const teleconsults = db.prepare('SELECT COUNT(*) AS c FROM teleconsults').get() as any;
  const medicines = db.prepare('SELECT id,name,quantity,low_stock_threshold as lowStockThreshold,updated_at as updatedAt FROM medicine_inventory ORDER BY name').all() as any[];
  return {
    kpis: {
      waiting: allAppointments.filter((a: any) => a.status === 'booked').length,
      followUpRate,
      referralRate: referrals.length,
      teleconsults: Number(teleconsults?.c || 0)
    },
    queue: allAppointments.filter((a: any) => a.status === 'booked').map((a: any) => ({
      ...a, patient: patients.find(p => p.id === a.patientId)?.name, doctor: doctors.find(d => d.id === a.doctorId)?.name
    })),
    highRisk: patients.filter(p => p.risk === 'high'),
    medicines: medicines.map(m => ({ ...m, status: Number(m.quantity) <= Number(m.lowStockThreshold) ? 'Low stock' : 'In stock' })),
    referrals,
    intakes: hydrateIntakes(),
    consultations: hydrateConsultations(),
    prescriptions: hydratePrescriptions(),
    teleconsultList: (db.prepare(`SELECT * FROM teleconsults ORDER BY requested_at DESC LIMIT 20`).all() as any[]).map((t: any) => ({ ...t, patientName: patients.find(p => p.id === t.patient_id)?.name || 'Patient', doctorName: doctors.find(d => d.id === t.doctor_id)?.name || 'Doctor' })),
    workload: doctors.map(d => ({ ...d, patients: allAppointments.filter((a: any) => a.doctorId === d.id && a.status === 'booked').length })),
    resourceOverview: {
      frontlineWorkers: (db.prepare('SELECT id,name,phone,facility_id FROM health_workers WHERE active=1').all() as any[]).map(w => {
        const assignedCases = db.prepare("SELECT id, patient_id, severity_level, case_status FROM triage_cases WHERE assigned_worker_id=? AND case_status != 'resolved'").all(w.id) as any[];
        return {
          id: w.id,
          name: w.name,
          role: 'ASHA Worker',
          phone: w.phone,
          status: assignedCases.length > 0 ? 'dispatched' : 'available',
          location: `Facility ${w.facility_id || 'fac-1'} (1.5 km)`,
          activeDispatches: assignedCases.length
        };
      })
    }
  };
}


app.get('/api/bootstrap', (req, res) => {
  try {
    const requestedRole = req.query.role ? String(req.query.role) : undefined;
    const requestedPatientId = req.query.patientId ? String(req.query.patientId) : undefined;
    const headerUserId = req.header('x-demo-user-id');
    let actor = headerUserId ? users.find(u => u.id === headerUserId) : undefined;
    if (!actor && requestedRole) {
      actor = users.find(u => u.role === requestedRole);
    }
    if (requestedPatientId && (!actor || actor.role === 'patient')) {
      actor = {
        id: `user-${requestedPatientId}`,
        name: patients.find(p => p.id === requestedPatientId)?.name || 'Patient',
        email: 'patient@example.com',
        password: '',
        role: 'patient',
        patientId: requestedPatientId
      };
    }
    const coreAppointments = hydrateAppointments();

    if (actor?.role === 'patient' && actor.patientId) {
      const mine = <T extends { patientId: string }>(items: T[]) => items.filter(item => item.patientId === actor.patientId);
      const activeCaseRow = (db.prepare("SELECT * FROM triage_cases WHERE patient_id=? AND case_status != 'resolved' ORDER BY submitted_at DESC LIMIT 1").get(actor.patientId) as any);
      let dispatchedWorker: any = null;
      if (activeCaseRow?.assigned_worker_id) {
        const hw = db.prepare('SELECT id, name, phone, facility_id FROM health_workers WHERE id=?').get(activeCaseRow.assigned_worker_id) as any;
        const parsedJson = activeCaseRow.frontline_worker_json ? safeJson<any>(activeCaseRow.frontline_worker_json, null) : null;
        if (hw) {
          dispatchedWorker = {
            id: hw.id,
            name: hw.name,
            role: 'ASHA Worker',
            phone: hw.phone,
            status: parsedJson?.status || 'dispatched',
            distance: parsedJson?.distance || '1.5 km',
            dispatchedAt: activeCaseRow.updated_at || activeCaseRow.submitted_at
          };
        } else if (parsedJson) {
          dispatchedWorker = parsedJson;
        }
      } else if (activeCaseRow?.frontline_worker_json) {
        dispatchedWorker = safeJson<any>(activeCaseRow.frontline_worker_json, null);
      }

      return res.json({
        facility,
        doctors,
        patients: patients.filter(p => p.id === actor.patientId),
        consents: mine(consents),
        appointments: mine(coreAppointments),
        intakes: mine(hydrateIntakes()),
        medicalDocuments: mine(hydrateMedicalDocuments()),
        consultations: mine(hydrateConsultations()),
        prescriptions: mine(hydratePrescriptions()),
        diagnosticOrders: mine(hydrateDiagnosticOrders(actor.patientId)),
        referrals: mine(hydrateReferrals()),
        dispatchedWorker,
        activeCase: activeCaseRow ? {
          id: activeCaseRow.id,
          status: activeCaseRow.case_status,
          severity: activeCaseRow.severity_level,
          notes: activeCaseRow.notes,
          followUpDate: activeCaseRow.follow_up_date
        } : null,
        precautions: mine(hydratePrecautions()),
        consentRequests: mine(hydrateConsentRequests()),
        dashboard: null,
        audit: mine(audit as any[]),
        notifications: hydrateNotifications(actor.patientId),
        careTeamMessages: hydrateCareTeamMessages(actor.patientId, actor.role),
        emergencyAlerts: mine(hydrateEmergencyAlerts()),
        careReviewRequests: mine(hydrateCareReviewRequests()),
        teleconsults: (db.prepare(`SELECT * FROM teleconsults WHERE patient_id=? ORDER BY requested_at DESC`).all(actor.patientId) as any[]),
        workspaceMode: 'full-db'
      });
    }

    const allCases = hydrateTriageCases();
    const dispatchedTasks = allCases
      .filter(c => c.frontlineWorker && c.status !== 'resolved')
      .map(c => ({
        caseId: c.id,
        patientId: c.patientId,
        patientName: c.patientName,
        patientAge: c.patientAge,
        patientSex: c.patientGender,
        locality: c.patientVillage || 'Locality not recorded',
        reason: c.summary?.chiefComplaint || c.notes || 'Home vitals check',
        status: c.frontlineWorker?.status || 'dispatched',
        patientVitals: c.frontlineWorker?.vitalsRecorded || '',
        patientPhone: patients.find(p => p.id === c.patientId)?.phone || '',
        dispatchedAt: c.submittedAt
      }));

    return res.json({
      facility,
      doctors,
      patients,
      consents,
      appointments: coreAppointments,
      intakes: hydrateIntakes(),
      consultations: hydrateConsultations(),
      prescriptions: hydratePrescriptions(),
      diagnosticOrders: hydrateDiagnosticOrders(),
      referrals: hydrateReferrals(),
      cases: allCases,
      dispatchedTasks,
      teleconsults: (db.prepare(`SELECT * FROM teleconsults ORDER BY requested_at DESC LIMIT 20`).all() as any[]).map((t: any) => ({ ...t, patientName: patients.find(p => p.id === t.patient_id)?.name || 'Patient', doctorName: doctors.find(d => d.id === t.doctor_id)?.name || 'Doctor' })),
      precautions: hydratePrecautions(),
      consentRequests: hydrateConsentRequests(),
      medicalDocuments: hydrateMedicalDocuments(),
      // Health workers receive only alerts assigned to their worker record; doctors receive status without coordinates.
      emergencyAlerts: actor?.role === 'health_worker'
        ? (() => { const ids = (db.prepare('SELECT id FROM health_workers WHERE user_id=?').all(actor.id) as any[]).map((x: any) => x.id); return hydrateEmergencyAlerts().filter((a: any) => ids.includes(a.assignedWorkerId)); })()
        : hydrateEmergencyAlerts().map((a: any) => ({ ...a, latitude: null, longitude: null, locationAccuracy: null, assignedWorkerPhone: null })),
      careReviewRequests: hydrateCareReviewRequests(),
      audit,
      notifications: hydrateNotifications(),
      careTeamMessages: hydrateCareTeamMessages(undefined, actor?.role),
      dashboard: dashboard(),
      workspaceMode: 'full-db'
    });
  } catch (error: any) {
    console.error('Core bootstrap failed:', error?.stack || error);
    return res.status(500).json({
      message: 'Unable to load the core healthcare workspace.',
      detail: process.env.NODE_ENV === 'production' ? undefined : String(error?.message || error)
    });
  }
});

app.get('/api/db-status', (_req, res) => {
  const requiredTables = ['users', 'facilities', 'doctors', 'appointments_db', 'appointment_slots'];
  const tables: Record<string, boolean> = {};
  for (const name of requiredTables) {
    try { tables[name] = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)); } catch { tables[name] = false; }
  }
  res.json({ ok: Object.values(tables).every(Boolean), dbPath, tables });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'swasthya-api', time: now() }));

app.get('/api/notifications/:patientId', (req, res) => {
  res.json(hydrateNotifications(req.params.patientId));
});

app.get('/api/notifications/config-status', (_req, res) => {
  res.json({
    email: { configured: Boolean(mailTransport), sender: smtpUser || null },
    sms: { configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER)) }
  });
});

app.post('/api/notifications/test-email', async (req, res) => {
  const to = String(req.body?.to || process.env.DEMO_PATIENT_EMAIL || '').trim();
  if (!mailTransport) return res.status(503).json({ message: 'Gmail SMTP is not configured. Check apps/api/.env.' });
  if (!to) return res.status(400).json({ message: 'A recipient email is required.' });
  try {
    const info = await mailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.GMAIL_FROM || smtpUser,
      to,
      subject: 'SwasthyaSetu test email',
      text: 'SwasthyaSetu email notifications are configured correctly.'
    });
    res.json({ ok: true, messageId: info.messageId, to });
  } catch (error: any) {
    console.error('Test email failed:', error?.stack || error);
    res.status(502).json({ ok: false, message: 'Test email failed.', error: String(error?.message || error) });
  }
});

app.get('/api/nearby-hospitals', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Math.min(Math.max(Number(req.query.radius) || 10000, 1000), 25000);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ message: 'A valid latitude and longitude are required.' });
  }

  const overpassQuery = `[out:json][timeout:20];(nwr[amenity=hospital](around:${radius},${lat},${lng});nwr[healthcare=hospital](around:${radius},${lat},${lng});nwr[amenity=clinic](around:${radius},${lat},${lng}););out center tags;`;
  const endpoints = [
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`,
    `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(overpassQuery)}`,
    `https://overpass.private.coffee/api/interpreter?data=${encodeURIComponent(overpassQuery)}`
  ];

  try {
    let payload: any = null;
    let lastError: any = null;
    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 22000);
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`Map provider returned ${response.status}`);
        payload = await response.json();
        if (payload?.elements) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!payload?.elements) throw lastError || new Error('No live map provider responded');

    const toRad = (v: number) => v * Math.PI / 180;
    const hospitals = payload.elements.map((item: any) => {
      const itemLat = Number(item.lat ?? item.center?.lat);
      const itemLng = Number(item.lon ?? item.center?.lon);
      const tags = item.tags || {};
      const dLat = toRad(itemLat - lat);
      const dLng = toRad(itemLng - lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(itemLat)) * Math.sin(dLng / 2) ** 2;
      const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return {
        id: `osm-${item.type}-${item.id}`,
        name: tags.name || tags['name:en'] || 'Unnamed healthcare facility',
        type: tags.amenity === 'hospital' ? 'Hospital' : (tags.amenity === 'clinic' ? 'Clinic' : (tags.healthcare || 'Hospital')),
        distanceKm: Number(distanceKm.toFixed(1)),
        distance: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`,
        latitude: itemLat,
        longitude: itemLng,
        phone: tags.phone || tags['contact:phone'] || '',
        website: tags.website || tags['contact:website'] || '',
        openingHours: tags.opening_hours || '',
        emergency: tags.emergency === 'yes',
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(', '),
      };
    }).filter((h: any) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude) && h.name !== 'Unnamed healthcare facility')
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, 20);

    return res.json({ source: 'OpenStreetMap', fetchedAt: now(), center: { lat, lng }, hospitals });
  } catch (error) {
    console.error('Nearby hospital lookup failed:', error);
    return res.status(502).json({ message: 'Live hospital data is temporarily unavailable. Check internet access and try Refresh live hospitals again.' });
  }
});

app.get('/api/dashboard', (_req, res) => {
  try { return res.json(dashboard()); }
  catch (error: any) {
    console.error('Dashboard endpoint failed:', error?.stack || error);
    return res.status(200).json({ kpis: { waiting: 0, followUpRate: 0, referralRate: referrals.length, teleconsults: 0 }, queue: [], highRisk: [], medicines: [], referrals, intakes: [], consultations: [], prescriptions: [], teleconsultList: [], workload: [], degraded: true });
  }
});

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}
function verifyPassword(password: string, stored: string) {
  if (!stored?.startsWith('scrypt:')) return stored === password;
  const [, salt, expected] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, 'hex');
  return expectedBuf.length === actual.length && timingSafeEqual(actual, expectedBuf);
}
function migratePassword(user: DemoUser) {
  if (!user.password.startsWith('scrypt:')) { user.password = hashPassword(user.password); persistUser(user); }
}

app.post('/api/auth/login', (req, res) => {
  const user = users.find(u =>
    u.email.toLowerCase() === String(req.body.email || '').toLowerCase() &&
    verifyPassword(String(req.body.password || ''), u.password) &&
    u.role === req.body.role
  );

  if (!user) {
    return res.status(401).json({ message: 'Email, password, or selected role is incorrect.' });
  }

  const { password, ...safeUser } = user;

  if (user.role === 'patient' && user.patientId) {
    const patient = patients.find(p => p.id === user.patientId) as any;
    if (patient) {
      const selected = normalizeUiLanguage(req.body.language);
      if (selected) {
        patient.language = languageName(selected);
        patient.languagePreferenceSet = true;
        persistPatient(patient);
      }
      (safeUser as any).language = languageCode(patient.language);
      (safeUser as any).languagePreferenceSet = patient.languagePreferenceSet !== false;
    }
  }

  res.json({ user: safeUser, token: `demo-token-${user.id}` });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required.' });
  }

  if (users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ message: 'An account already exists for this email.' });
  }

  const user: DemoUser = {
    id: uid('user'),
    name,
    email,
    password: hashPassword(String(password)),
    role,
    facilityId: role === 'patient' ? undefined : 'fac-1',
    phone: role === 'patient' ? String(req.body.phone || '') : ''
  };

  if (role === 'patient') {
    const patient: Patient = {
      id: uid('pat'),
      name,
      age: 0,
      sex: 'Unspecified',
      phone: req.body.phone || '',
      language: 'English',
      languagePreferenceSet: false,
      village: req.body.village || '',
      risk: 'normal'
    } as any;
    patients.push(patient);
    user.patientId = patient.id;
    db.prepare(`INSERT INTO patient_health_profiles (patient_id, medical_condition, medical_history, allergies, medications, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(patient_id) DO NOTHING`)
      .run(patient.id, '', '', '', '', now());
    db.prepare(`INSERT INTO patient_storage (patient_id, patient_json, updated_at) VALUES (?,?,?) ON CONFLICT(patient_id) DO UPDATE SET patient_json=excluded.patient_json, updated_at=excluded.updated_at`)
      .run(patient.id, JSON.stringify(patient), now());
    const consentId = uid('con');
    db.prepare(`INSERT INTO care_consents_db (id,patient_id,scopes,status,granted_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .run(consentId, patient.id, JSON.stringify(['care', 'referral', 'reminders']), 'active', now(), now());
    refreshConsents();
  }

  users.push(user);
  persistUser(user);
  const { password: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token: `demo-token-${user.id}` });
});

app.post('/api/patients', (req, res) => {
  const p: Patient = {
    id: uid('pat'),
    name: req.body.name,
    abhaId: req.body.abhaId,
    age: Number(req.body.age) || 0,
    sex: req.body.sex || 'Unspecified',
    phone: req.body.phone || '',
    language: languageName(req.body.language || 'EN'),
    languagePreferenceSet: true,
    village: req.body.village || '',
    risk: 'normal'
  } as any;
  patients.push(p);
  db.prepare(`INSERT INTO patient_storage (patient_id, patient_json, updated_at) VALUES (?,?,?)`)
    .run(p.id, JSON.stringify(p), now());

  const c: Consent = {
    id: uid('con'),
    patientId: p.id,
    scopes: req.body.scopes || ['care'],
    status: 'active' as const,
    grantedAt: now()
  };
  db.prepare(`INSERT INTO care_consents_db (id,patient_id,scopes,status,granted_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run(c.id, p.id, JSON.stringify(c.scopes), 'active', c.grantedAt, now());
  refreshConsents();
  log(p.id, 'Patient registered and consent captured');
  res.status(201).json({ patient: p, consent: c });
});

app.get('/api/hospital-doctors', (req, res) => {
  const facilityId = String(req.query.facilityId || 'fac-1');
  const facilityName = String(req.query.facilityName || '');
  const latitude = Number(req.query.facilityLatitude);
  const longitude = Number(req.query.facilityLongitude);
  const facilityPhone = String(req.query.facilityPhone || '');
  ensureFacility(facilityId, facilityName, latitude, longitude, facilityPhone);
  // Demo mode: every newly selected live facility gets a small registered roster
  // so the patient can complete the hospital -> doctor -> slot booking flow.
  if (facilityId !== 'fac-1') seedDemoDoctorsForFacility(facilityId, facilityName);
  seedSlots(facilityId, 90);
  const rows = db.prepare(`SELECT id,name,specialty,phone,availability,working_hours as workingHours,slot_minutes as slotMinutes FROM doctors WHERE facility_id=? ORDER BY name`).all(facilityId) as any[];
  const f = db.prepare('SELECT phone FROM facilities WHERE id=?').get(facilityId) as any;
  res.json({ facilityId, doctors: rows.map(d => ({ ...d, workingHours: JSON.parse(d.workingHours || '[]') })), hospitalPhone: f?.phone || facilityPhone || null });
});

app.get('/api/availability', (req, res) => {
  const doctorId = String(req.query.doctorId || '');
  const facilityId = String(req.query.facilityId || 'fac-1');
  const date = String(req.query.date || '');
  ensureFacility(facilityId, String(req.query.facilityName || ''), Number(req.query.facilityLatitude), Number(req.query.facilityLongitude));
  if (!doctorId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'doctorId and date are required.' });
  const doctor = db.prepare('SELECT * FROM doctors WHERE id=?').get(doctorId) as any;
  if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
  seedSlots(facilityId, 90);
  const rows = db.prepare(`SELECT start_time, end_time, capacity, booked_count, status FROM appointment_slots WHERE doctor_id=? AND facility_id=? AND slot_date=? ORDER BY start_time`).all(doctorId, facilityId, date) as any[];
  // Return every generated slot so the patient can see capacity/availability. Full slots remain disabled in the UI.
  res.json({
    doctorId,
    facilityId,
    date,
    slots: rows.map(r => ({
      startTime: r.start_time,
      endTime: r.end_time,
      capacity: Number(r.capacity || 3),
      bookedCount: Number(r.booked_count || 0),
      remaining: Math.max(0, Number(r.capacity || 3) - Number(r.booked_count || 0)),
      status: Number(r.booked_count || 0) >= Number(r.capacity || 3) ? 'full' : 'available'
    })),
    slotCapacity: 3,
    workingHours: JSON.parse(doctor.working_hours),
    slotMinutes: doctor.slot_minutes
  });
});

app.post('/api/appointments', async (req, res) => {
  const { patientId, doctorId, startsAt } = req.body;
  if (!patientId || !doctorId || !startsAt) return res.status(400).json({ message: 'Patient, doctor, date and time are required.' });
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ message: 'Invalid appointment date/time.' });
  if (when.getTime() < Date.now() - 60000) return res.status(400).json({ message: 'Please choose a future time slot.' });
  const date = String(startsAt).slice(0, 10), time = String(startsAt).slice(11, 16);
  const facilityId = String(req.body.facilityId || 'fac-1');
  ensureFacility(facilityId, String(req.body.facilityName || ''), Number(req.body.facilityLatitude), Number(req.body.facilityLongitude));
  seedSlots(facilityId, 90);
  const facilityName = String(req.body.facilityName || facility.name);
  const doctorRow = db.prepare('SELECT id,name,specialty,phone,facility_id FROM doctors WHERE id=?').get(doctorId) as any;
  if (!doctorRow) return res.status(404).json({ message: 'Doctor not found.' });
  if (String(doctorRow.facility_id) !== facilityId) return res.status(409).json({ message: 'This doctor is not registered at the selected hospital.' });
  const slot = db.prepare(`SELECT * FROM appointment_slots WHERE doctor_id=? AND facility_id=? AND slot_date=? AND start_time=?`).get(doctorId, facilityId, date, time) as any;
  if (!slot || Number(slot.booked_count) >= Number(slot.capacity || 3)) return res.status(409).json({ message: 'This time slot is full. A maximum of 3 patients can be booked for this slot.' });
  const sharedDocumentIds = Array.isArray(req.body.sharedDocumentIds) ? req.body.sharedDocumentIds : [];
  const id = uid('apt');
  let token = 0;
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare(`SELECT id FROM appointments_db WHERE patient_id=? AND status='booked' AND starts_at >= ?`).get(patientId, now()) as any;
    if (existing) throw new Error('PATIENT_HAS_APPOINTMENT');
    const locked = db.prepare(`SELECT status, capacity, booked_count FROM appointment_slots WHERE id=?`).get(slot.id) as any;
    const capacity = Number(locked?.capacity || 3);
    const bookedCount = Number(locked?.booked_count || 0);
    if (!locked || bookedCount >= capacity || locked.status === 'full') throw new Error('SLOT_FULL');
    const tokenRow = db.prepare(`SELECT COALESCE(MAX(token),0)+1 AS token FROM appointments_db WHERE slot_id=? AND status='booked'`).get(slot.id) as any;
    token = Number(tokenRow.token);
    if (token > capacity) throw new Error('SLOT_FULL');
    db.prepare(`UPDATE appointment_slots SET booked_count=?, status=? WHERE id=?`).run(bookedCount + 1, bookedCount + 1 >= capacity ? 'full' : 'available', slot.id);
    db.prepare(`INSERT INTO appointments_db (id,patient_id,facility_id,doctor_id,slot_id,starts_at,token,status,facility_name,facility_latitude,facility_longitude,shared_document_ids) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, patientId, facilityId, doctorId, slot.id, startsAt, token, 'booked', facilityName, Number.isFinite(Number(req.body.facilityLatitude)) ? Number(req.body.facilityLatitude) : null, Number.isFinite(Number(req.body.facilityLongitude)) ? Number(req.body.facilityLongitude) : null, JSON.stringify(sharedDocumentIds));
    db.exec('COMMIT');
  } catch (e: any) { try { db.exec('ROLLBACK'); } catch { } if (e.message === 'SLOT_FULL') return res.status(409).json({ message: 'This time slot is full. A maximum of 3 patients can be booked for this slot.' }); if (e.message === 'PATIENT_HAS_APPOINTMENT') return res.status(409).json({ message: 'You already have an upcoming appointment. Cancel it before booking another.' }); throw e; }
  log(patientId, 'Appointment booked');
  const bookedAppointment = hydrateAppointments().find((a: any) => a.id === id) as any;
  const doctor = db.prepare('SELECT name FROM doctors WHERE id=?').get(doctorId) as any;
  const notificationMessage = `SwasthyaSetu: Appointment confirmed with ${doctor?.name || 'your doctor'} on ${new Date(startsAt).toLocaleString('en-IN')} at ${facilityName}. Your token is #${token}.`;
  const notifications = await sendPatientNotification(patientId, id, 'appointment_booked', 'SwasthyaSetu appointment confirmed', notificationMessage);
  res.status(201).json({ ...bookedAppointment, notifications });
});

app.post('/api/medical-documents', (req, res) => {
  const { patientId, name, type, mimeType, size, dataUrl, notes } = req.body;
  if (!patientId || !name || !mimeType || !dataUrl) return res.status(400).json({ message: 'Patient, file name, type and file data are required.' });
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return res.status(400).json({ message: 'Invalid document data.' });
  if (dataUrl.length > 8_000_000) return res.status(413).json({ message: 'File is too large. Please upload a file under about 6 MB.' });
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ message: 'Patient record not found.' });
  const allowed = ['blood_report', 'lab_report', 'prescription', 'scan', 'discharge_summary', 'other'];
  const document: MedicalDocument = { id: uid('meddoc'), patientId, name: String(name), type: allowed.includes(String(type)) ? String(type) as MedicalDocument['type'] : 'other', mimeType: String(mimeType), size: Number(size) || 0, dataUrl: String(dataUrl), notes: notes ? String(notes) : undefined, uploadedAt: now(), sharedWithCareTeam: true };
  db.prepare(`INSERT INTO medical_documents (id,patient_id,name,type,mime_type,size,data_url,notes,uploaded_at,shared_with_care_team) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(document.id, document.patientId, document.name, document.type, document.mimeType, document.size, document.dataUrl, document.notes || null, document.uploadedAt, 1);
  log(patientId, `Medical document uploaded: ${document.name} and shared with the care team`);
  res.status(201).json(document);
});

app.patch('/api/medical-documents/:id', (req, res) => {
  const document = hydrateMedicalDocuments().find(d => d.id === req.params.id);
  if (!document) return res.sendStatus(404);
  const shared = req.body.sharedWithCareTeam === undefined ? document.sharedWithCareTeam : Boolean(req.body.sharedWithCareTeam);
  const notes = req.body.notes === undefined ? document.notes : String(req.body.notes);
  db.prepare(`UPDATE medical_documents SET shared_with_care_team=?, notes=? WHERE id=?`).run(shared ? 1 : 0, notes || null, document.id);
  log(document.patientId, `Medical document sharing updated: ${document.name}`);
  res.json({ ...document, sharedWithCareTeam: shared, notes });
});

app.delete('/api/medical-documents/:id', (req, res) => {
  const document = hydrateMedicalDocuments().find(d => d.id === req.params.id);
  if (!document) return res.status(404).json({ message: 'Medical document not found.' });
  db.prepare('DELETE FROM medical_documents WHERE id=?').run(document.id);
  log(document.patientId, `Medical document removed: ${document.name}`);
  res.json({ ok: true, id: document.id });
});

app.get('/api/medical-documents/:id/file', (req, res) => {
  const document = hydrateMedicalDocuments().find(d => d.id === req.params.id);
  if (!document || !document.dataUrl) return res.status(404).json({ message: 'Medical file not found.' });
  try {
    const match = String(document.dataUrl).match(/^data:[^;]+;base64,(.+)$/);
    if (!match) return res.status(422).json({ message: 'Stored medical file is invalid.' });
    const bytes = Buffer.from(match[1], 'base64');
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename=\"${String(document.name).replace(/[\\\"\r\n]/g, '_')}\"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(bytes);
  } catch {
    return res.status(500).json({ message: 'Unable to open medical file.' });
  }
});

app.get('/api/medical-documents/:patientId', (req, res) => {
  const activeConsent = consents.some(c => c.patientId === req.params.patientId && c.status === 'active');
  if (!activeConsent) return res.json([]);
  res.json(hydrateMedicalDocuments().filter(d => d.patientId === req.params.patientId && d.sharedWithCareTeam));
});

app.get('/api/ai/health', async (_req, res) => {
  const result = await checkAIHealth();

  if (!result.available) {
    return res.status(503).json(result);
  }

  return res.json(result);
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/ai/analyze/report', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'report file is required',
      });
    }

    const file = new File(
      [new Uint8Array(req.file.buffer)],
      req.file.originalname,
      {
        type: req.file.mimetype,
      }
    );

    const result = await analyzeReport(file);

    if (!result.success) {
      return res.status(503).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('AI report analysis error:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/ai/analyze/symptoms', async (req, res) => {
  try {
    const { symptoms } = req.body;

    if (!Array.isArray(symptoms)) {
      return res.status(400).json({
        success: false,
        error: 'symptoms must be an array',
      });
    }

    if (symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one symptom is required',
      });
    }

    const result = await analyzeSymptoms(symptoms);

    if (!result.success) {
      return res.status(503).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('AI symptom analysis error:', error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
});

app.post('/api/ai/analyze/context', async (req, res) => {
  try {
    const {
      patient,
      report_analysis,
      symptom_analysis,
    } = req.body;

    if (!patient || typeof patient !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'patient is required',
      });
    }

    if (
      !report_analysis ||
      typeof report_analysis !== 'object'
    ) {
      return res.status(400).json({
        success: false,
        error: 'report_analysis is required',
      });
    }

    if (
      !symptom_analysis ||
      typeof symptom_analysis !== 'object'
    ) {
      return res.status(400).json({
        success: false,
        error: 'symptom_analysis is required',
      });
    }

    const result = await analyzeContext(
      patient,
      report_analysis,
      symptom_analysis
    );

    if (!result.success) {
      return res.status(503).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error(
      'AI contextual analysis error:',
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
});

app.post('/api/intakes', (req, res) => {
  const rawSymptoms = req.body.symptoms;
  const symptoms: string[] = Array.isArray(rawSymptoms)
    ? rawSymptoms
    : typeof rawSymptoms === 'string'
      ? rawSymptoms.split(',').map(s => s.trim()).filter(Boolean)
      : [];
  const redFlags = symptoms.filter((x: string) => /chest|breath|bleed|pregnan|unconscious/i.test(x));

  const i: IntakeSummary = {
    id: uid('int'),
    patientId: req.body.patientId,
    appointmentId: req.body.appointmentId,
    symptoms,
    summary: `AI-generated intake: ${symptoms.join('; ') || 'No symptoms recorded'}. Requires clinician verification before entering the health record.`,
    redFlags,
    status: 'pending_review',
    createdAt: now()
  };

  db.prepare(`INSERT INTO intakes_db (id,patient_id,appointment_id,symptoms,summary,red_flags,status,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(i.id, i.patientId, i.appointmentId || null, JSON.stringify(i.symptoms), i.summary, JSON.stringify(i.redFlags), i.status, i.createdAt);

  // Auto-create a triage case for every intake (per merge design Q1)
  autoCreateTriageCase(i.patientId, i.id, symptoms, redFlags, i.summary, i.appointmentId);

  log(i.patientId, 'AI intake submitted — pending clinical review');
  res.status(201).json(i);
});

app.patch('/api/intakes/:id/review', (req, res) => {
  const row = db.prepare('SELECT * FROM intakes_db WHERE id=?').get(req.params.id) as any;
  if (!row) return res.sendStatus(404);

  const status = req.body.status === 'rejected' ? 'rejected' : 'verified';
  const summary = req.body.summary || row.summary;

  db.prepare('UPDATE intakes_db SET status=?, summary=? WHERE id=?').run(status, summary, row.id);
  log(row.patient_id, `Intake ${status} by clinician`);

  const updated = hydrateIntakes().find(x => x.id === row.id);
  res.json(updated);
});

app.patch('/api/medicine-inventory/:id', (req, res) => {
  const actor = users.find(u => u.id === req.header('x-demo-user-id'));
  const roleHeader = req.header('x-demo-user-role');
  if (actor?.role === 'health_worker' || roleHeader === 'health_worker') {
    return res.status(403).json({ message: 'Healthcare workers do not have permission to update medicine stock.' });
  }
  const row = db.prepare('SELECT * FROM medicine_inventory WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Medicine not found.' });
  const quantity = Math.max(0, Math.round(Number(req.body.quantity)));
  db.prepare('UPDATE medicine_inventory SET quantity=?, updated_at=? WHERE id=?').run(quantity, now(), row.id);
  const updated = db.prepare('SELECT id,name,quantity,low_stock_threshold as lowStockThreshold,updated_at as updatedAt FROM medicine_inventory WHERE id=?').get(row.id) as any;
  res.json({ medicine: { ...updated, status: Number(updated.quantity) <= Number(updated.lowStockThreshold) ? 'Low stock' : 'In stock' } });
});

app.post('/api/teleconsults', (req, res) => {
  const patientId = String(req.body.patientId || '');
  if (!patients.some(p => p.id === patientId)) return res.status(404).json({ message: 'Patient not found.' });
  const appointmentId = String(req.body.appointmentId || '');
  const doctorId = String(req.body.doctorId || 'doc-1');
  if (appointmentId) {
    const existing = db.prepare("SELECT * FROM teleconsults WHERE appointment_id=? AND status IN ('requested','connected') ORDER BY requested_at DESC LIMIT 1").get(appointmentId) as any;
    if (existing) {
      return res.json({ teleconsult: { id: existing.id, patientId: existing.patient_id, appointmentId: existing.appointment_id, doctorId: existing.doctor_id, status: existing.status, requestedAt: existing.requested_at, connectedAt: existing.connected_at, completedAt: existing.completed_at } });
    }
  }
  const id = uid('tele');
  const requestedAt = now();
  db.prepare('INSERT INTO teleconsults (id,patient_id,appointment_id,doctor_id,status,requested_at) VALUES (?,?,?,?,?,?)').run(id, patientId, appointmentId || null, doctorId, 'requested', requestedAt);
  log(patientId, 'Assisted teleconsult requested');
  res.status(201).json({ teleconsult: { id, patientId, appointmentId: appointmentId || null, doctorId, status: 'requested', requestedAt } });
});

app.get('/api/teleconsults/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM teleconsults WHERE id=?').get(req.params.id) as any;
  if (!t) return res.status(404).json({ message: 'Teleconsult not found.' });
  res.json({ teleconsult: { id: t.id, patientId: t.patient_id, appointmentId: t.appointment_id, doctorId: t.doctor_id, status: t.status, requestedAt: t.requested_at, connectedAt: t.connected_at, completedAt: t.completed_at } });
});

app.patch('/api/teleconsults/:id/status', (req, res) => {
  const status = ['requested', 'connected', 'completed', 'cancelled'].includes(String(req.body.status)) ? String(req.body.status) : null;
  if (!status) return res.status(400).json({ message: 'Invalid teleconsult status.' });
  const row = db.prepare('SELECT * FROM teleconsults WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Teleconsult not found.' });
  const connectedAt = status === 'connected' ? now() : row.connected_at;
  const completedAt = status === 'completed' ? now() : row.completed_at;
  db.prepare('UPDATE teleconsults SET status=?,connected_at=?,completed_at=? WHERE id=?').run(status, connectedAt, completedAt, row.id);
  res.json({ ok: true });
});

app.post('/api/consultations', (req, res) => {
  const c: Consultation = {
    id: uid('con'),
    patientId: req.body.patientId,
    doctorId: req.body.doctorId || 'doc-1',
    diagnosis: req.body.diagnosis || [],
    notes: req.body.notes || '',
    createdAt: now()
  };
  db.prepare(`INSERT INTO consultations_db (id,patient_id,doctor_id,appointment_id,diagnosis,notes,created_at) VALUES (?,?,?,?,?,?,?)`).run(c.id, c.patientId, c.doctorId, req.body.appointmentId || null, JSON.stringify(c.diagnosis), c.notes, c.createdAt);
  let createdPrescription: Prescription | undefined;
  if (Array.isArray(req.body.medicines) && req.body.medicines.length) {
    createdPrescription = { id: uid('rx'), patientId: c.patientId, consultationId: c.id, medicines: req.body.medicines };
    db.prepare(`INSERT INTO prescriptions_db (id,patient_id,consultation_id,medicines,created_at) VALUES (?,?,?,?,?)`).run(createdPrescription.id, createdPrescription.patientId, createdPrescription.consultationId, JSON.stringify(createdPrescription.medicines), now());
  }

  const a = db.prepare('SELECT * FROM appointments_db WHERE id=?').get(req.body.appointmentId) as any;
  if (a) { db.prepare(`UPDATE appointments_db SET status='completed' WHERE id=?`).run(a.id); db.prepare(`UPDATE appointment_slots SET booked_count=MAX(0, booked_count-1), status=CASE WHEN MAX(0, booked_count-1) >= capacity THEN 'full' ELSE 'available' END WHERE id=?`).run(a.slot_id); }

  if (req.body.caseId) {
    db.prepare("UPDATE triage_cases SET case_status='action_taken', doctor_id=?, updated_at=? WHERE id=?").run(c.doctorId, now(), req.body.caseId);
  } else if (req.body.appointmentId) {
    db.prepare("UPDATE triage_cases SET case_status='action_taken', doctor_id=?, updated_at=? WHERE appointment_id=?").run(c.doctorId, now(), req.body.appointmentId);
  }

  log(c.patientId, 'Consultation completed and prescription issued');
  res.status(201).json({ consultation: c, prescription: createdPrescription });
});


app.patch('/api/users/:id', (req, res) => {
  const user = users.find(x => x.id === req.params.id);
  if (!user) return res.sendStatus(404);
  const nextEmail = req.body.email !== undefined ? String(req.body.email).trim() : user.email;
  if (!nextEmail) return res.status(400).json({ message: 'Email address is required.' });
  const duplicate = users.find(x => x.id !== user.id && x.email.toLowerCase() === nextEmail.toLowerCase());
  if (duplicate) return res.status(409).json({ message: 'That email address is already in use.' });
  if (req.body.name !== undefined) user.name = String(req.body.name).trim();
  if (req.body.phone !== undefined) user.phone = String(req.body.phone).trim();
  user.email = nextEmail;
  if (user.role === 'patient' && user.patientId && req.body.phone !== undefined) {
    const patient = patients.find(x => x.id === user.patientId);
    if (patient) {
      patient.phone = user.phone || '';
      db.prepare(`INSERT INTO patient_storage (patient_id, patient_json, updated_at) VALUES (?,?,?) ON CONFLICT(patient_id) DO UPDATE SET patient_json=excluded.patient_json, updated_at=excluded.updated_at`).run(patient.id, JSON.stringify(patient), now());
    }
  }
  persistUser(user);
  const { password, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.patch('/api/patients/:id', (req, res) => {
  const p = patients.find(x => x.id === req.params.id);
  if (!p) return res.sendStatus(404);
  if (req.body.name !== undefined) p.name = String(req.body.name);
  if (req.body.village !== undefined) p.village = String(req.body.village);
  if (req.body.phone !== undefined) {
    p.phone = String(req.body.phone);
    const account = users.find(x => x.patientId === p.id);
    if (account) { account.phone = p.phone; persistUser(account); }
  }
  if (req.body.language !== undefined) { p.language = languageName(req.body.language); (p as any).languagePreferenceSet = true; }
  if (req.body.medicalCondition !== undefined) p.medicalCondition = String(req.body.medicalCondition);
  if (req.body.medicalHistory !== undefined) p.medicalHistory = String(req.body.medicalHistory);
  if (req.body.allergies !== undefined) p.allergies = String(req.body.allergies);
  if (req.body.medications !== undefined) p.medications = String(req.body.medications);
  db.prepare(`INSERT INTO patient_health_profiles (patient_id, medical_condition, medical_history, allergies, medications, updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(patient_id) DO UPDATE SET medical_condition=excluded.medical_condition, medical_history=excluded.medical_history,
    allergies=excluded.allergies, medications=excluded.medications, updated_at=excluded.updated_at`)
    .run(p.id, p.medicalCondition || '', p.medicalHistory || '', p.allergies || '', p.medications || '', now());
  db.prepare(`INSERT INTO patient_storage (patient_id, patient_json, updated_at) VALUES (?,?,?)
    ON CONFLICT(patient_id) DO UPDATE SET patient_json=excluded.patient_json, updated_at=excluded.updated_at`)
    .run(p.id, JSON.stringify(p), now());
  log(p.id, 'Patient medical information updated');
  res.json(p);
});

app.patch('/api/appointments/:id/cancel', async (req, res) => {
  const a = db.prepare('SELECT * FROM appointments_db WHERE id=?').get(req.params.id) as any;
  if (!a) return res.sendStatus(404);
  try { db.exec('BEGIN IMMEDIATE'); db.prepare(`UPDATE appointments_db SET status='cancelled' WHERE id=? AND status='booked'`).run(a.id); db.prepare(`UPDATE appointment_slots SET booked_count=MAX(0, booked_count-1), status=CASE WHEN MAX(0, booked_count-1) >= capacity THEN 'full' ELSE 'available' END WHERE id=?`).run(a.slot_id); db.exec('COMMIT'); } catch (e) { try { db.exec('ROLLBACK'); } catch { } throw e; }
  log(a.patient_id, `Appointment cancelled by patient; token #${a.token} deleted and slot released`);
  const doctor = doctors.find((d: any) => d.id === a.doctor_id) as any;
  const cancellationMessage = `SwasthyaSetu: Your appointment with ${doctor?.name || 'your doctor'} on ${new Date(a.starts_at).toLocaleString('en-IN')} at ${a.facility_name || facility.name} has been cancelled. Token #${a.token} has been deleted and the slot is available again.`;
  const notifications = await sendPatientNotification(a.patient_id, a.id, 'appointment_cancelled', 'SwasthyaSetu appointment cancelled', cancellationMessage);
  res.json({ id: a.id, status: 'cancelled', token: null, tokenDeleted: true, notifications });
});


app.post('/api/care-review-requests', (req, res) => {
  const { patientId, sentBy = 'health_worker', reason } = req.body || {};
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  if (!String(reason || '').trim()) return res.status(400).json({ message: 'Please enter a review reason.' });
  const existing = db.prepare("SELECT id FROM care_review_requests WHERE patient_id=? AND status='pending'").get(patientId) as any;
  if (existing) return res.json({ id: existing.id, status: 'pending', message: 'A review request is already pending for this patient.' });
  const id = uid('review');
  db.prepare(`INSERT INTO care_review_requests (id,patient_id,sent_by,reason,status,created_at) VALUES (?,?,?,?,?,?)`).run(id, patientId, sentBy, String(reason).trim(), 'pending', now());

  // Auto-create / link to doctor triage queue
  const isUrgent = /urgent|critical|emergency|deteriorat|chest|breath|fever|bleed/i.test(reason);
  const flags = isUrgent ? ['Health worker flagged clinical concern for doctor review'] : [];
  autoCreateTriageCase(
    patientId,
    `int-review-${id}`,
    [`Health worker review request: ${String(reason).trim()}`],
    flags,
    `Frontline worker (${sentBy}) requested clinical review: ${String(reason).trim()}`,
    undefined,
    undefined,
    id
  );

  log(patientId, `Health worker requested clinical review: ${String(reason).trim()}`);
  res.status(201).json({ id, status: 'pending', message: 'Clinical review request sent to the doctor.' });
});

app.patch('/api/care-review-requests/:id', (req, res) => {
  const status = String(req.body?.status || 'reviewed');
  if (!['pending', 'reviewed', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid review status.' });
  const row = db.prepare('SELECT * FROM care_review_requests WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Review request not found.' });
  db.prepare('UPDATE care_review_requests SET status=?, reviewed_at=? WHERE id=?').run(status, status === 'pending' ? null : now(), row.id);
  if (status === 'reviewed' || status === 'cancelled') {
    db.prepare("UPDATE triage_cases SET case_status='resolved', updated_at=? WHERE care_review_request_id=?").run(now(), row.id);
  }
  res.json({ id: row.id, status });
});

app.post('/api/care-consent-requests', (req, res) => {
  const patientId = String(req.body.patientId || '');
  const patient = patients.find(p => p.id === patientId) as any;
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  const phone = String(req.body.phone || patient.phone || '').trim();
  const latitude = Number(req.body.latitude); const longitude = Number(req.body.longitude); const accuracy = Number(req.body.locationAccuracy);
  const documentIds = Array.isArray(req.body.documentIds) ? req.body.documentIds : [];
  const snapshot = { id: patient.id, name: patient.name, age: patient.age, sex: patient.sex, village: patient.village, phone, medicalCondition: patient.medicalCondition || '', medicalHistory: patient.medicalHistory || '', allergies: patient.allergies || '', medications: patient.medications || '' };
  const existing = db.prepare("SELECT id FROM care_consent_requests WHERE patient_id=? AND status='pending'").get(patientId) as any;
  if (existing) return res.json({ id: existing.id, status: 'pending', message: 'A consent request is already pending.' });
  const id = uid('consent-request');
  const existingConsent = consents.find(x => x.patientId === patientId);
  if (existingConsent) {
    existingConsent.status = 'paused';
    db.prepare('UPDATE care_consents_db SET status=?,updated_at=? WHERE patient_id=?').run('paused', now(), patientId);
  }
  db.prepare(`INSERT INTO care_consent_requests (id,patient_id,status,phone,latitude,longitude,location_accuracy,patient_snapshot,document_ids,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, patientId, 'pending', phone || null, Number.isFinite(latitude) ? latitude : null, Number.isFinite(longitude) ? longitude : null, Number.isFinite(accuracy) ? accuracy : null, JSON.stringify(snapshot), JSON.stringify(documentIds), now());
  log(patientId, 'Patient requested consent-based care sharing with health worker');
  res.status(201).json({ id, status: 'pending' });
});

app.patch('/api/care-consent-requests/:id', (req, res) => {
  const status = req.body.status === 'approved' ? 'approved' : req.body.status === 'rejected' ? 'rejected' : null;
  if (!status) return res.status(400).json({ message: 'Invalid request status.' });
  const row = db.prepare('SELECT * FROM care_consent_requests WHERE id=?').get(req.params.id) as any;
  if (!row) return res.sendStatus(404);
  db.prepare('UPDATE care_consent_requests SET status=?, responded_at=? WHERE id=?').run(status, now(), row.id);
  const consent = consents.find(x => x.patientId === row.patient_id);
  if (consent) {
    consent.status = status === 'approved' ? 'active' : 'paused';
    db.prepare(`UPDATE care_consents_db SET status=?,updated_at=?,granted_at=CASE WHEN ?='active' THEN ? ELSE granted_at END WHERE patient_id=?`)
      .run(consent.status, now(), consent.status, now(), row.patient_id);
    log(row.patient_id, `Care consent request ${status}`);
  }
  res.json({ id: row.id, status });
});

app.patch('/api/consents/:id', (req, res) => {
  const c = consents.find(x => x.id === req.params.id);
  if (!c) return res.sendStatus(404);
  c.status = req.body.status === 'paused' ? 'paused' : 'active';
  db.prepare(`UPDATE care_consents_db SET status=?,updated_at=?,granted_at=CASE WHEN ?='active' THEN COALESCE(granted_at,?) ELSE granted_at END WHERE patient_id=?`)
    .run(c.status, now(), c.status, now(), c.patientId);
  log(c.patientId, `Care consent ${c.status}`);
  res.json(c);
});

app.post('/api/emergency/alerts', (req, res) => {
  const patientId = String(req.body.patientId || '');
  const patient = patients.find(p => p.id === patientId) as any;
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.locationAccuracy);
  const worker = nearestEmergencyWorker(latitude, longitude);
  const fallbackPhone = '112';
  const id = uid('emergency');
  const alert = {
    id, patientId, patientName: patient.name, patientPhone: patient.phone || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    locationAccuracy: Number.isFinite(accuracy) ? accuracy : null,
    assignedWorkerId: worker?.id || null, assignedWorkerName: worker?.name || null,
    assignedWorkerPhone: worker?.phone || null, status: 'active', fallbackUsed: !worker, createdAt: now(), resolvedAt: null
  };
  db.prepare(`INSERT INTO emergency_alerts (id,patient_id,patient_name,patient_phone,latitude,longitude,location_accuracy,assigned_worker_id,assigned_worker_name,assigned_worker_phone,status,fallback_used,created_at,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, patientId, alert.patientName, alert.patientPhone, alert.latitude, alert.longitude, alert.locationAccuracy, alert.assignedWorkerId, alert.assignedWorkerName, alert.assignedWorkerPhone, 'active', worker ? 0 : 1, alert.createdAt, null);
  log(patientId, worker ? `Emergency alert routed to nearest healthcare worker: ${worker.name}` : 'Emergency alert routed to default emergency number 112 because no healthcare worker was available');
  res.status(201).json({ ...alert, callNumber: worker?.phone || fallbackPhone, callTarget: worker ? 'health_worker' : 'default_emergency', distanceKm: worker ? Number(worker.distanceKm.toFixed(2)) : null });
});

app.patch('/api/emergency/alerts/:id/resolve', (req, res) => {
  const row = db.prepare('SELECT id FROM emergency_alerts WHERE id=?').get(req.params.id) as any;
  if (!row) return res.sendStatus(404);
  db.prepare(`UPDATE emergency_alerts SET status='resolved', resolved_at=? WHERE id=?`).run(now(), row.id);
  res.json(hydrateEmergencyAlerts().find(a => a.id === row.id));
});

app.post('/api/assistance', (req, res) => {
  log(req.body.patientId, 'Patient requested health-worker assistance');
  res.status(201).json({ id: uid('help'), patientId: req.body.patientId, status: 'requested' });
});

app.post('/api/precautions', async (req, res) => {
  const { patientId, sentBy, message } = req.body;
  if (!patientId || !message) return res.status(400).json({ message: 'Patient and precaution message are required.' });
  const patient = patients.find(p => p.id === String(patientId)) as any;
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  const originalMessage = String(message).trim();
  // Always save the worker's precaution first. Translation is an enhancement and
  // must never prevent the actual clinical guidance from reaching the patient.
  const targetLanguage = languageCode(patient.language);
  let translatedText = originalMessage;
  let translatedLanguage = targetLanguage;
  let translationStatus = targetLanguage === 'EN' ? 'not_required' : 'pending';

  if (targetLanguage !== 'EN') {
    const translated = await translateForPatient(originalMessage, patient.language);
    if (translated.success) {
      translatedText = translated.translatedText;
      translatedLanguage = translated.language;
      translationStatus = 'translated';
    } else {
      // Keep the precaution active even when the translation service is down.
      // The original message is retained instead of returning HTTP 503.
      translationStatus = `fallback_original: ${translated.reason}`;
      console.warn(`[precaution] Translation unavailable for ${patient.id}; saving original message. ${translated.reason}`);
    }
  }

  const id = uid('prec');
  db.prepare(`INSERT INTO patient_precautions (id,patient_id,sent_by,message,translated_message,patient_language,status,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, patientId, String(sentBy || 'health_worker'), originalMessage, translatedText, translatedLanguage, 'active', now());
  log(patientId, `Precaution sent by healthcare worker (${translationStatus})`);
  res.status(201).json({
    ...(hydratePrecautions().find(x => x.id === id) || {}),
    originalMessage,
    patientLanguage: translatedLanguage,
    translationStatus
  });
});

app.patch('/api/precautions/:id/resolve', (req, res) => {
  const row = db.prepare('SELECT * FROM patient_precautions WHERE id=?').get(req.params.id) as any;
  if (!row) return res.sendStatus(404);
  db.prepare(`UPDATE patient_precautions SET status='resolved', resolved_at=? WHERE id=? AND status='active'`).run(now(), row.id);
  log(row.patient_id, 'Patient resolved healthcare precaution');
  res.json(hydratePrecautions().find(x => x.id === row.id));
});

app.get('/api/care-team/messages', (req, res) => {
  const patientId = String(req.query.patientId || '');
  const viewerRole = req.query.viewerRole ? String(req.query.viewerRole) : undefined;
  if (!patientId || !patients.some(p => p.id === patientId)) return res.status(404).json({ message: 'Patient not found.' });
  res.json({ messages: hydrateCareTeamMessages(patientId, viewerRole) });
});

app.post('/api/care-team/messages', async (req, res) => {
  const patientId = String(req.body.patientId || '');
  const senderRole = String(req.body.senderRole || '');
  const senderId = req.body.senderId ? String(req.body.senderId) : null;
  const senderName = String(req.body.senderName || '').trim();
  const recipientRole = String(req.body.recipientRole || '');
  const recipientId = req.body.recipientId ? String(req.body.recipientId) : null;
  const recipientName = String(req.body.recipientName || '').trim();
  const message = String(req.body.message || '').trim();
  const allowed = ['patient', 'health_worker', 'doctor'];
  if (!patientId || !patients.some(p => p.id === patientId)) return res.status(404).json({ message: 'Patient not found.' });
  if (!allowed.includes(senderRole)) return res.status(400).json({ message: 'Invalid sender role.' });
  if (!['care_team', ...allowed].includes(recipientRole) || recipientRole === senderRole) return res.status(400).json({ message: 'Choose another care-team role.' });
  if (!senderName || !message) return res.status(400).json({ message: 'Sender and message are required.' });
  if (message.length > 500) return res.status(400).json({ message: 'Message is too long. Keep it under 500 characters.' });

  const patient = patients.find(p => p.id === patientId) as any;
  const targetPatientLang = languageCode(patient?.language);
  const createdAt = now();
  const id = uid('msg');

  let originalMessage = message;
  let translatedMessage: string | null = null;
  let patientLanguage = targetPatientLang;
  let translationStatus = 'not_required';

  if (senderRole === 'patient') {
    // Patient sending to doctor/worker/care-team: translate into English
    const engResult = await translateToEnglish(message, patient?.language);
    if (engResult.success && engResult.translatedText && engResult.translatedText !== message) {
      translatedMessage = engResult.translatedText;
      translationStatus = 'translated';
      console.log(`[care-team] Translated patient reply into English: "${translatedMessage}"`);
    } else {
      translatedMessage = message;
      translationStatus = engResult.success ? 'native' : `fallback: ${engResult.reason}`;
    }
  } else {
    // Doctor or Health Worker sending to patient or care-team: automatically translate to patient's language
    if (targetPatientLang !== 'EN') {
      const patientResult = await translateForPatient(message, targetPatientLang);
      if (patientResult.success) {
        translatedMessage = patientResult.translatedText;
        translationStatus = 'translated';
        console.log(`[care-team] Translated clinician message for patient (${targetPatientLang}): "${translatedMessage}" (engine: ${patientResult.engine})`);
      } else {
        console.warn(`[care-team] Translation failed for patient ${patientId}: ${patientResult.reason}`);
        translatedMessage = message;
        translationStatus = `fallback: ${patientResult.reason}`;
      }
    } else {
      translatedMessage = message;
      translationStatus = 'not_required';
    }
  }

  const people: Record<string, { id: string, name: string }> = {
    patient: { id: `user-${patientId}`, name: patient?.name || 'Patient' },
    health_worker: { id: 'user-worker', name: 'Sita ASHA' },
    doctor: { id: 'user-doctor', name: 'Dr. Ananya Sharma' },
    care_team: { id: 'care-team-all', name: 'Entire Care Team' }
  };
  const targetPerson = people[recipientRole];

  db.prepare(`INSERT INTO care_team_messages (id,patient_id,sender_role,sender_id,sender_name,recipient_role,recipient_id,recipient_name,message,original_message,translated_message,patient_language,translation_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      id,
      patientId,
      senderRole,
      senderId,
      senderName,
      recipientRole,
      targetPerson?.id || recipientId,
      targetPerson?.name || recipientName || (recipientRole === 'care_team' ? 'Entire Care Team' : 'Care team member'),
      message,
      originalMessage,
      translatedMessage,
      patientLanguage,
      translationStatus,
      createdAt
    );

  log(patientId, recipientRole === 'care_team'
    ? `Care-team message broadcast from ${senderRole} to care team (${translationStatus})`
    : `Care-team message sent from ${senderRole} to ${recipientRole} (${translationStatus})`);

  res.status(201).json({
    message: 'Message delivered to the care team.',
    id,
    translationStatus,
    patientLanguage,
    translatedMessage,
    messages: hydrateCareTeamMessages(patientId, senderRole)
  });
});

app.post('/api/care-team/translate', async (req, res) => {
  const text = String(req.body.text || '').trim();
  const targetLanguage = normalizeTranslationLanguage(req.body.targetLanguage);
  if (!text) return res.status(400).json({ message: 'Text to translate is required.' });

  if (targetLanguage === 'EN') {
    const result = await translateToEnglish(text);
    return res.json(result);
  } else {
    const result = await translateForPatient(text, targetLanguage);
    return res.json(result);
  }
});

// Emergency live-location updates are deliberately restricted to the assigned
// frontline worker. Doctors never receive these coordinates through bootstrap.
app.patch('/api/emergency/alerts/:id/location', (req, res) => {
  const row = db.prepare("SELECT * FROM emergency_alerts WHERE id=? AND status='active'").get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Active emergency alert not found.' });
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.locationAccuracy);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ message: 'Valid location is required.' });
  db.prepare('UPDATE emergency_alerts SET latitude=?,longitude=?,location_accuracy=? WHERE id=?').run(latitude, longitude, Number.isFinite(accuracy) ? accuracy : null, row.id);
  res.json({ ok: true, alertId: row.id, latitude, longitude, locationAccuracy: Number.isFinite(accuracy) ? accuracy : null, updatedAt: now() });
});

app.post('/api/referrals', (req, res) => {
  const patientId = String(req.body.patientId || '');
  const reason = String(req.body.reason || '').trim();
  const toFacilityId = String(req.body.toFacilityId || 'fac-2');
  if (!patientId || !patients.some(p => p.id === patientId)) return res.status(404).json({ message: 'Patient not found.' });
  if (!reason) return res.status(400).json({ message: 'Referral reason is required.' });
  const patient = patients.find(p => p.id === patientId)!;
  const fromFacilityId = 'fac-1';
  ensureFacility(toFacilityId, toFacilityId === 'fac-2' ? 'District Hospital' : 'Referral Hospital');
  const target = db.prepare('SELECT id,name FROM facilities WHERE id=?').get(toFacilityId) as any;
  const source = db.prepare('SELECT id,name FROM facilities WHERE id=?').get(fromFacilityId) as any;
  const id = uid('ref');
  let referralToken = '';
  do { referralToken = `REF-${dateOnly(new Date()).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; } while (db.prepare('SELECT id FROM referrals WHERE referral_token=?').get(referralToken));
  const r: any = { id, patientId, fromFacilityId, toFacilityId, reason, status: 'pending', createdAt: now(), updatedAt: now(), referralToken, patientName: patient.name, toFacilityName: target?.name || 'Receiving Hospital', fromFacilityName: source?.name || 'Seva Rural Health Centre' };
  db.prepare(`INSERT INTO referrals (id,patient_id,from_facility_id,to_facility_id,reason,status,created_at,updated_at,referral_token,patient_name,to_facility_name,from_facility_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(r.id, r.patientId, r.fromFacilityId, r.toFacilityId, r.reason, r.status, r.createdAt, r.updatedAt, r.referralToken, r.patientName, r.toFacilityName, r.fromFacilityName);
  referrals.unshift(r);
  log(r.patientId, `Referral ${r.referralToken} created for ${r.toFacilityName}`);
  res.status(201).json(r);
});

app.patch('/api/referrals/:id', (req, res) => {
  const status = String(req.body.status || '');
  if (!['pending', 'accepted', 'completed'].includes(status)) return res.status(400).json({ message: 'Invalid referral status.' });
  const row = db.prepare('SELECT id,patient_id as patientId FROM referrals WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Referral not found.' });
  db.prepare('UPDATE referrals SET status=?,updated_at=? WHERE id=?').run(status, now(), req.params.id);
  log(row.patientId, `Referral ${req.params.id} marked ${status}`);
  res.json(hydrateReferrals().find((x: any) => x.id === req.params.id));
});

app.get('/api/referrals/token/:token', (req, res) => {
  const row = hydrateReferrals().find((x: any) => x.referralToken === String(req.params.token));
  if (!row) return res.status(404).json({ message: 'Referral token not found.' });
  res.json(row);
});

// ══════════════════════════════════════════════════════════════════════════════
// TRIAGE CASE ROUTES — merged from doc-side into main-all SQLite persistence
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/cases', (_req, res) => {
  try { res.json(hydrateTriageCases()); }
  catch (e: any) { console.error('GET /api/cases failed:', e); res.status(500).json({ message: 'Unable to load triage cases.' }); }
});

app.get('/api/cases/:id', (req, res) => {
  const c = hydrateTriageCases().find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ message: 'Case not found.' });
  res.json(c);
});

app.patch('/api/cases/:id/status', (req, res) => {
  const row = db.prepare('SELECT id,patient_id FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const status = String(req.body.status || '');
  if (!['new', 'in_review', 'action_taken', 'resolved'].includes(status)) return res.status(400).json({ message: 'Invalid case status.' });
  db.prepare('UPDATE triage_cases SET case_status=?,updated_at=? WHERE id=?').run(status, now(), row.id);
  log(row.patient_id, `Triage case ${row.id} status → ${status}`);
  res.json(hydrateTriageCases().find(x => x.id === row.id));
});

app.post('/api/cases/:id/prescription', async (req, res) => {
  const row = db.prepare('SELECT id,patient_id,intake_id,care_review_request_id FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const medicines = req.body.medicines || [];
  const doctorNotes = req.body.doctorNotes || req.body.notes || '';
  const consultId = uid('con');
  db.prepare('INSERT INTO consultations_db (id,patient_id,doctor_id,diagnosis,notes,created_at) VALUES (?,?,?,?,?,?)').run(consultId, row.patient_id, 'doc-1', '[]', doctorNotes, now());
  const rxId = uid('rx');
  db.prepare('INSERT INTO prescriptions_db (id,patient_id,consultation_id,medicines,created_at) VALUES (?,?,?,?,?)').run(rxId, row.patient_id, consultId, JSON.stringify(medicines), now());
  db.prepare('UPDATE triage_cases SET case_status=?,updated_at=? WHERE id=?').run('action_taken', now(), row.id);

  // Verify intake & care review requests
  if (row.intake_id) db.prepare("UPDATE intakes_db SET status='verified' WHERE id=?").run(row.intake_id);
  db.prepare("UPDATE intakes_db SET status='verified' WHERE patient_id=? AND status='pending_review'").run(row.patient_id);
  db.prepare("UPDATE care_review_requests SET status='reviewed', reviewed_at=? WHERE patient_id=? AND status='pending'").run(now(), row.patient_id);

  // Send notification to patient
  const medSummary = medicines.map((m: any) => `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`).join(', ');
  await sendPatientNotification(row.patient_id, null, 'prescription_issued', 'New E-Prescription Issued by Dr. Ananya Sharma', `Dr. Ananya Sharma has issued an e-prescription with medicines: ${medSummary || 'Prescribed medications'}. ${doctorNotes ? `Doctor advice: ${doctorNotes}` : ''}`);

  log(row.patient_id, `E-Prescription issued via triage case ${row.id}`);
  res.json({ ok: true, prescriptionId: rxId, consultationId: consultId });
});

app.post('/api/cases/:id/diagnostics', async (req, res) => {
  const row = db.prepare('SELECT id,patient_id,intake_id,care_review_request_id FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const diagId = uid('diag');
  const testName = req.body.testName || 'Lab investigation';
  const facilityName = req.body.facilityName || 'Diagnostic Facility';
  db.prepare('INSERT INTO diagnostic_orders (id,patient_id,case_id,test_name,facility_name,status,ordered_at) VALUES (?,?,?,?,?,?,?)').run(diagId, row.patient_id, row.id, testName, facilityName, 'ordered', now());
  db.prepare('UPDATE triage_cases SET case_status=?,updated_at=? WHERE id=?').run('action_taken', now(), row.id);

  // Verify intake
  if (row.intake_id) db.prepare("UPDATE intakes_db SET status='verified' WHERE id=?").run(row.intake_id);
  db.prepare("UPDATE intakes_db SET status='verified' WHERE patient_id=? AND status='pending_review'").run(row.patient_id);

  // Send notification to patient
  await sendPatientNotification(row.patient_id, null, 'diagnostic_ordered', 'Diagnostic Test Ordered by Doctor', `Dr. Ananya Sharma has ordered diagnostic test '${testName}' at ${facilityName}.`);

  log(row.patient_id, `Diagnostic '${testName}' ordered via triage case ${row.id}`);
  res.json({ ok: true, diagnosticId: diagId });
});

app.post('/api/cases/:id/referral', async (req, res) => {
  const row = db.prepare('SELECT id,patient_id,intake_id,care_review_request_id FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const patient = patients.find(p => p.id === row.patient_id);
  let token = '';
  do { token = `REF-${dateOnly(new Date()).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; } while (db.prepare('SELECT id FROM referrals WHERE referral_token=?').get(token));
  const refId = uid('ref');
  const targetFacility = req.body.toFacilityName || 'Referral Hospital';
  const reason = req.body.reason || 'Specialist evaluation';
  db.prepare('INSERT INTO referrals (id,patient_id,from_facility_id,to_facility_id,reason,status,created_at,updated_at,referral_token,patient_name,to_facility_name,from_facility_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(refId, row.patient_id, 'fac-1', 'fac-2', reason, 'pending', now(), now(), token, patient?.name || 'Patient', targetFacility, 'Seva Rural Health Centre');
  referrals.splice(0, referrals.length, ...hydrateReferrals());
  db.prepare('UPDATE triage_cases SET case_status=?,referral_id=?,updated_at=? WHERE id=?').run('action_taken', refId, now(), row.id);

  // Verify intake
  if (row.intake_id) db.prepare("UPDATE intakes_db SET status='verified' WHERE id=?").run(row.intake_id);
  db.prepare("UPDATE intakes_db SET status='verified' WHERE patient_id=? AND status='pending_review'").run(row.patient_id);

  // Send notification to patient
  await sendPatientNotification(row.patient_id, null, 'referral_created', 'Specialist Referral Issued by Doctor', `You have been referred to ${targetFacility} for: ${reason}. Your referral tracking token is ${token}.`);

  log(row.patient_id, `Referral created via triage case ${row.id} → ${targetFacility}`);
  res.json({ ok: true, referralId: refId, referralToken: token });
});

app.post('/api/cases/:id/resolve', async (req, res) => {
  const row = db.prepare('SELECT id,patient_id,intake_id,care_review_request_id FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const actionType = req.body.actionType || 'resolve';
  const nextStatus = actionType === 'followup' ? 'action_taken' : 'resolved';
  db.prepare('UPDATE triage_cases SET case_status=?,follow_up_date=?,notes=?,updated_at=? WHERE id=?').run(nextStatus, req.body.followUpDate || null, req.body.notes || null, now(), row.id);

  // Verify intake & care review requests
  if (row.intake_id) db.prepare("UPDATE intakes_db SET status='verified' WHERE id=?").run(row.intake_id);
  db.prepare("UPDATE intakes_db SET status='verified' WHERE patient_id=? AND status='pending_review'").run(row.patient_id);
  if (row.care_review_request_id && actionType !== 'followup') {
    db.prepare("UPDATE care_review_requests SET status='reviewed', reviewed_at=? WHERE id=?").run(now(), row.care_review_request_id);
  }

  // Send notification to patient
  await sendPatientNotification(
    row.patient_id,
    null,
    'case_resolved',
    actionType === 'followup' ? 'Care Follow-Up Scheduled by Doctor' : 'Clinical Case Resolved by Doctor',
    actionType === 'followup'
      ? `Dr. Ananya Sharma scheduled a clinical follow-up on ${req.body.followUpDate || 'upcoming date'}. Notes: ${req.body.notes || 'Review required'}.`
      : `Dr. Ananya Sharma has reviewed and resolved your clinical case. Notes: ${req.body.notes || 'Care plan complete.'}`
  );

  log(row.patient_id, actionType === 'followup' ? `Follow-up scheduled for ${req.body.followUpDate}` : `Triage case ${row.id} resolved`);
  res.json({ ok: true });
});

app.post('/api/cases/:id/consultation', async (req, res) => {
  const row = db.prepare('SELECT id,patient_id,intake_id,care_review_request_id FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const consultId = uid('con');
  const clinicalText = req.body.doctorNotes || req.body.notes || '';
  const notes = [clinicalText, req.body.vitals ? `Vitals: ${req.body.vitals}` : ''].filter(Boolean).join('\n');
  db.prepare('INSERT INTO consultations_db (id,patient_id,doctor_id,diagnosis,notes,created_at) VALUES (?,?,?,?,?,?)').run(consultId, row.patient_id, 'doc-1', '[]', notes, now());
  db.prepare('UPDATE triage_cases SET case_status=?,doctor_id=?,updated_at=? WHERE id=?').run('in_review', req.body.doctorId || 'doc-1', now(), row.id);

  // Verify intake & care review requests
  if (row.intake_id) db.prepare("UPDATE intakes_db SET status='verified' WHERE id=?").run(row.intake_id);
  db.prepare("UPDATE intakes_db SET status='verified' WHERE patient_id=? AND status='pending_review'").run(row.patient_id);
  db.prepare("UPDATE care_review_requests SET status='reviewed', reviewed_at=? WHERE patient_id=? AND status='pending'").run(now(), row.patient_id);

  // Send notification to patient
  await sendPatientNotification(row.patient_id, null, 'teleconsult_notes', 'Consultation Notes Recorded by Doctor', `Dr. Ananya Sharma has recorded notes for your consultation: ${req.body.doctorNotes || 'Consultation complete.'} ${req.body.vitals ? `Recorded vitals: ${req.body.vitals}` : ''}`);

  log(row.patient_id, `Teleconsult notes saved via triage case ${row.id}`);
  res.json({ ok: true, consultationId: consultId });
});

app.post('/api/cases/:id/dispatch-worker', async (req, res) => {
  const row = db.prepare('SELECT id,patient_id FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const workerId = req.body.workerId;
  const workerName = req.body.workerName;
  let worker: any = null;
  if (workerId) {
    worker = db.prepare('SELECT id, name, phone, facility_id FROM health_workers WHERE id=?').get(workerId);
  }
  if (!worker && workerName) {
    worker = db.prepare('SELECT id, name, phone, facility_id FROM health_workers WHERE name=?').get(workerName);
  }
  if (!worker) {
    worker = db.prepare('SELECT id, name, phone, facility_id FROM health_workers WHERE active=1 LIMIT 1').get();
  }
  if (!worker) return res.status(404).json({ message: 'No health worker available for dispatch.' });

  const workerInfo = JSON.stringify({
    id: worker.id,
    name: worker.name,
    role: 'ASHA Worker',
    phone: worker.phone,
    status: 'dispatched',
    distance: req.body.distance || '1.5 km',
    dispatchedAt: now()
  });
  db.prepare('UPDATE triage_cases SET assigned_worker_id=?,frontline_worker_json=?,updated_at=? WHERE id=?').run(worker.id, workerInfo, now(), row.id);

  // Send notification to patient
  await sendPatientNotification(row.patient_id, null, 'worker_dispatched', 'Frontline Health Worker Dispatched to Your Location', `Dr. Ananya Sharma has dispatched ASHA Worker ${worker.name} for an urgent on-site visit and vitals monitoring. Contact phone: ${worker.phone}.`);

  log(row.patient_id, `Frontline worker ${worker.name} dispatched for case ${row.id}`);
  res.json({ ok: true, workerId: worker.id, workerName: worker.name });
});

app.patch('/api/cases/:id/worker-visit', async (req, res) => {
  const row = db.prepare('SELECT id,patient_id,frontline_worker_json FROM triage_cases WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ message: 'Case not found.' });
  const vitals = req.body.vitals || '';
  const notes = req.body.notes || '';
  const currentWorker = safeJson<any>(row.frontline_worker_json, {});
  const updatedWorker = JSON.stringify({
    ...currentWorker,
    status: 'completed',
    completedAt: now(),
    vitalsRecorded: vitals,
    workerNotes: notes
  });
  db.prepare("UPDATE triage_cases SET frontline_worker_json=?,updated_at=? WHERE id=?").run(updatedWorker, now(), row.id);
  if (vitals || notes) {
    const consultId = uid('con');
    db.prepare('INSERT INTO consultations_db (id,patient_id,doctor_id,diagnosis,notes,created_at) VALUES (?,?,?,?,?,?)')
      .run(consultId, row.patient_id, 'worker-1', '[]', `[ASHA Home Visit] Vitals: ${vitals}. Notes: ${notes}`, now());
  }
  log(row.patient_id, `Frontline worker completed home visit for case ${row.id}`);
  res.json({ ok: true });
});

app.post('/api/cases/simulate', (req, res) => {
  try {
    const type = req.body.type === 'urgent' ? 'urgent' : 'critical';
    // Pick a random patient that doesn't already have an open case
    const openCasePatients = (db.prepare("SELECT patient_id FROM triage_cases WHERE case_status != 'resolved'").all() as any[]).map(r => r.patient_id);
    const eligible = patients.filter(p => !openCasePatients.includes(p.id));
    const patient = eligible.length > 0 ? eligible[Math.floor(Math.random() * eligible.length)] : patients[Math.floor(Math.random() * patients.length)];
    const scenarioPool = type === 'critical' ? [
      { symptoms: ['Severe headache', 'Blurred vision', 'Swelling in feet', '28 weeks pregnant'], complaint: 'Severe headache and visual disturbance at 28 weeks gestation', flags: ['Pregnancy with possible pre-eclampsia symptoms'] },
      { symptoms: ['Crushing chest pain', 'Radiating to left arm', 'Sweating', 'Shortness of breath'], complaint: 'Acute crushing chest pain radiating to left arm', flags: ['Chest pain with radiation — possible ACS'] },
      { symptoms: ['Sudden right-sided weakness', 'Slurred speech', 'Facial droop'], complaint: 'Acute onset right hemiparesis with facial droop', flags: ['Acute stroke symptoms — golden hour critical'] }
    ] : [
      { symptoms: ['High fever for 3 days', 'Cough with yellow sputum', 'Night sweats'], complaint: 'Persistent fever with productive cough and night sweats', flags: ['Sputum-producing cough with night sweats — TB screening required'] },
      { symptoms: ['Severe abdominal pain', 'Right lower quadrant', 'Nausea', 'Low-grade fever'], complaint: 'Acute right lower quadrant abdominal pain', flags: ['RLQ pain with guarding — appendicitis evaluation required'] },
      { symptoms: ['High fever', 'Rash', 'Lethargy', 'Poor feeding'], complaint: 'Paediatric high fever with rash and lethargy', flags: ['Child with high fever and rash — urgent paediatric review'] }
    ];
    const scenario = scenarioPool[Math.floor(Math.random() * scenarioPool.length)];
    const intakeId = uid('int');
    const summary = `AI-generated intake: ${scenario.symptoms.join('; ')}. Requires clinician verification.`;
    db.prepare('INSERT INTO intakes_db (id,patient_id,symptoms,summary,red_flags,status,created_at) VALUES (?,?,?,?,?,?,?)').run(intakeId, patient.id, JSON.stringify(scenario.symptoms), summary, JSON.stringify(scenario.flags), 'pending_review', now());
    const triageCase = autoCreateTriageCase(patient.id, intakeId, scenario.symptoms, scenario.flags, summary);
    if (triageCase) {
      db.prepare('UPDATE triage_cases SET severity_level=? WHERE id=?').run(type, triageCase.id);
    }
    log(patient.id, `Simulated ${type} case created`);
    const hydrated = triageCase ? hydrateTriageCases().find(c => c.id === triageCase.id) : null;
    res.json(hydrated || { id: intakeId, patientName: patient.name });
  } catch (e: any) {
    console.error('Simulate case error:', e);
    res.status(500).json({ message: 'Unable to simulate case.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.path}` });
});
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled API error:', err?.stack || err);
  if (!res.headersSent) res.status(500).json({ message: 'Internal API error. Check the API terminal for details.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Swasthya Setu API: http://localhost:${PORT}`);
});
