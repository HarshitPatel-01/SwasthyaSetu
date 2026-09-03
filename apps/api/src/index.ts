import express from 'express';
import cors from 'cors';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import type { 
  Appointment, 
  Consultation, 
  Consent, 
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
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, appointment_id TEXT, type TEXT NOT NULL,
    channel TEXT NOT NULL, recipient TEXT, message TEXT NOT NULL, status TEXT NOT NULL,
    provider_message_id TEXT, error TEXT, created_at TEXT NOT NULL, sent_at TEXT
  );
`);

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

async function sendPatientNotification(patientId: string, appointmentId: string | null, type: 'appointment_booked' | 'appointment_cancelled', subject: string, message: string) {
  const patient = patients.find(p => p.id === patientId) as any;
  const user = users.find(u => u.patientId === patientId);
  const email = patient?.email || user?.email || process.env.DEMO_PATIENT_EMAIL;
  const envKey = `SWASTHYA_PATIENT_PHONE_${patientId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
  const phone = patient?.notificationPhone || process.env[envKey];
  const results: Record<string, string> = {};

  const createNotification = (channel: 'gmail' | 'sms', recipient: string | undefined) => {
    const id = uid('notification');
    db.prepare(`INSERT INTO notifications (id,patient_id,appointment_id,type,channel,recipient,message,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, patientId, appointmentId, type, channel, recipient || null, message, 'pending', now());
    return id;
  };
  const updateNotification = (id: string, status: string, providerMessageId?: string | null, error?: string | null) => {
    db.prepare(`UPDATE notifications SET status=?, provider_message_id=?, error=?, sent_at=? WHERE id=?`)
      .run(status, providerMessageId || null, error || null, status === 'sent' ? now() : null, id);
  };

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
try { db.exec(`ALTER TABLE facilities ADD COLUMN phone TEXT`); } catch {}
try { db.exec(`ALTER TABLE doctors ADD COLUMN phone TEXT`); } catch {}
try { db.exec(`ALTER TABLE appointment_slots ADD COLUMN capacity INTEGER NOT NULL DEFAULT 3`); } catch {}
try { db.exec(`ALTER TABLE appointment_slots ADD COLUMN booked_count INTEGER NOT NULL DEFAULT 0`); } catch {}

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
    const fm = Number(from.slice(0,2))*60 + Number(from.slice(3,5));
    const tm = Number(to.slice(0,2))*60 + Number(to.slice(3,5));
    if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to) || tm <= fm) throw new Error('Invalid doctor working hours.');
    total += tm - fm;
  }
  if (total > MAX_DOCTOR_WORK_MINUTES) throw new Error('A doctor cannot be scheduled for more than 8 working hours per day.');
  return total;
}
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

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

const doctors = [
  {
    id: 'doc-1', 
    name: 'Dr. Ananya Sharma', 
    specialty: 'General Medicine',
    phone: '+91 98765 43210',
    availability: 'Available today',
    workingHours: [['09:00','13:00'], ['14:00','18:00']],
    slotMinutes: 30
  }, 
  {
    id: 'doc-2', 
    name: 'Dr. R. Kumar', 
    specialty: 'Paediatrics',
    phone: '+91 98765 43211',
    availability: 'Available today',
    workingHours: [['10:00','14:00'], ['15:00','19:00']],
    slotMinutes: 30
  }
];

for (const doctor of doctors as any[]) {
  db.prepare(`INSERT OR REPLACE INTO doctors (id,name,specialty,phone,availability,working_hours,slot_minutes,facility_id) VALUES (?,?,?,?,?,?,?,?)`)
    .run(doctor.id, doctor.name, doctor.specialty, doctor.phone || null, doctor.availability, JSON.stringify(doctor.workingHours), doctor.slotMinutes || 30, 'fac-1');
  validateDoctorHours(doctor.workingHours);
}

function dateOnly(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const m = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${m.year}-${m.month}-${m.day}`;
}
function addDays(date: Date, days: number) { const x = new Date(date); x.setDate(x.getDate() + days); return x; }
function ensureFacility(facilityId: string, name?: string, latitude?: number, longitude?: number, phone?: string) {
  const id = facilityId || 'fac-1';
  const existing = db.prepare('SELECT id FROM facilities WHERE id=?').get(id) as any;
  if (!existing) {
    db.prepare('INSERT INTO facilities (id,name,latitude,longitude,type,phone) VALUES (?,?,?,?,?,?)')
      .run(id, name || (id === 'fac-1' ? facility.name : 'Selected healthcare facility'), Number.isFinite(latitude) ? latitude : null, Number.isFinite(longitude) ? longitude : null, id === 'fac-1' ? 'Primary Health Centre' : 'Hospital', phone || null);
  } else if (name || Number.isFinite(latitude) || Number.isFinite(longitude) || phone) {
    db.prepare('UPDATE facilities SET name=COALESCE(?,name), latitude=COALESCE(?,latitude), longitude=COALESCE(?,longitude), phone=COALESCE(?,phone) WHERE id=?')
      .run(name || null, Number.isFinite(latitude) ? latitude : null, Number.isFinite(longitude) ? longitude : null, phone || null, id);
  }
}
ensureFacility('fac-1', facility.name);

function seedDemoDoctorsForFacility(facilityId: string, facilityName?: string) {
  const count = Number((db.prepare('SELECT COUNT(*) AS c FROM doctors WHERE facility_id=?').get(facilityId) as any)?.c || 0);
  if (count > 0) return;
  const base = String(facilityName || 'Demo Hospital').replace(/\s+/g, ' ').trim();
  const demoDoctors = [
    { id: `demo-doc-${facilityId}-1`, name: 'Dr. Ananya Sharma', specialty: 'General Medicine', phone: '+91 98765 43210', availability: 'Available today', workingHours: [['09:00','13:00'],['14:00','18:00']], slotMinutes: 30 },
    { id: `demo-doc-${facilityId}-2`, name: 'Dr. R. Kumar', specialty: 'Paediatrics', phone: '+91 98765 43211', availability: 'Available today', workingHours: [['10:00','14:00'],['15:00','19:00']], slotMinutes: 30 }
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
        let cursor = Number(from.slice(0,2))*60 + Number(from.slice(3,5));
        const end = Number(to.slice(0,2))*60 + Number(to.slice(3,5));
        while (cursor < end) {
          const h = Math.floor(cursor/60), m = cursor % 60;
          const start = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          const endMin = cursor + (doctor.slotMinutes || 30);
          if (endMin > end) break;
          const eh = Math.floor(endMin/60), em = endMin % 60;
          const endTime = `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
          const slotId = `slot-${doctor.id}-${facilityId}-${date}-${start.replace(':','')}`;
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
  return (db.prepare(`SELECT id,patient_id as patientId,facility_id as facilityId,doctor_id as doctorId,starts_at as startsAt,token,status,facility_name as facilityName,facility_latitude as facilityLatitude,facility_longitude as facilityLongitude,shared_document_ids as sharedDocumentIds FROM appointments_db ORDER BY starts_at`).all() as any[]).map(a => ({ ...a, sharedDocumentIds: JSON.parse(a.sharedDocumentIds || '[]') }));
}

type DemoUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'patient' | 'health_worker' | 'doctor' | 'system_admin';
  facilityId?: string;
  patientId?: string;
};

const users: DemoUser[] = [
  {
    id: 'user-patient',
    name: 'Meera Devi',
    email: process.env.DEMO_PATIENT_EMAIL || 'meera@example.com',
    password: 'demo123',
    role: 'patient',
    patientId: 'pat-1'
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
    id: 'user-system',
    name: 'Platform Admin',
    email: 'system@example.com',
    password: 'demo123',
    role: 'system_admin'
  }
];

const patients: Patient[] = [
  {
    id: 'pat-1',
    name: 'Meera Devi',
    abhaId: '91-2345-6789-0123',
    age: 28,
    sex: 'Female',
    phone: '•••• 4812',
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
    phone: '•••• 7721',
    language: 'English',
    village: 'Bhanpur',
    risk: 'high'
  },
  {
    id: 'pat-3',
    name: 'Asha Kumari',
    age: 4,
    sex: 'Female',
    phone: '•••• 1190',
    language: 'Hindi',
    village: 'Kheriya',
    risk: 'normal'
  }
];

// Persist editable patient health context. Seed only missing rows so existing patient-entered
// information survives API restarts.
for (const p of patients) {
  const existing = db.prepare('SELECT patient_id FROM patient_health_profiles WHERE patient_id=?').get(p.id) as any;
  if (!existing) {
    db.prepare(`INSERT INTO patient_health_profiles (patient_id, medical_condition, medical_history, allergies, medications, updated_at) VALUES (?,?,?,?,?,?)`)
      .run(p.id, p.medicalCondition || '', p.medicalHistory || '', p.allergies || '', p.medications || '', now());
  }
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

const consents: Consent[] = patients.map((p, i) => ({
  id: `con-${i + 1}`,
  patientId: p.id,
  scopes: ['care', 'referral', 'reminders'],
  status: 'active',
  grantedAt: now()
}));

const appointments: Appointment[] = [
  {
    id: 'apt-1',
    patientId: 'pat-1',
    facilityId: 'fac-1',
    doctorId: 'doc-1',
    startsAt: '2026-08-24T10:30:00+05:30',
    token: 12,
    status: 'booked'
  }
];

// Persist the original demo appointment once; subsequent appointments are database-backed.
if ((db.prepare('SELECT COUNT(*) AS c FROM appointments_db').get() as any).c === 0) {
  for (const a of appointments as any[]) {
    const date = a.startsAt.slice(0,10), time = a.startsAt.slice(11,16);
    const slot = db.prepare('SELECT id FROM appointment_slots WHERE doctor_id=? AND slot_date=? AND start_time=?').get(a.doctorId, date, time) as any;
    if (slot) {
      db.prepare(`UPDATE appointment_slots SET booked_count=1, status='available' WHERE id=?`).run(slot.id);
      db.prepare(`INSERT INTO appointments_db (id,patient_id,facility_id,doctor_id,slot_id,starts_at,token,status,shared_document_ids) VALUES (?,?,?,?,?,?,?,?,?)`).run(a.id,a.patientId,a.facilityId,a.doctorId,slot.id,a.startsAt,a.token,a.status,'[]');
    }
  }
}

const intakes: IntakeSummary[] = [
  {
    id: 'int-1',
    patientId: 'pat-1',
    appointmentId: 'apt-1',
    symptoms: [
      'Headache for 2 days',
      'Blurred vision',
      'Swelling in feet'
    ],
    summary: '28-year-old, 7 months pregnant. Reports headache, blurred vision and pedal swelling for 2 days. Blood pressure assessment is recommended urgently.',
    redFlags: ['Pregnancy with possible pre-eclampsia symptoms'],
    status: 'pending_review',
    createdAt: now()
  }
];

const consultations: Consultation[] = []; 
const prescriptions: Prescription[] = [];

function hydrateMedicalDocuments(): MedicalDocument[] {
  return (db.prepare(`SELECT id,patient_id as patientId,name,type,mime_type as mimeType,size,data_url as dataUrl,notes,uploaded_at as uploadedAt,shared_with_care_team as sharedWithCareTeam FROM medical_documents ORDER BY uploaded_at DESC`).all() as any[]).map(d => ({ ...d, sharedWithCareTeam: Boolean(d.sharedWithCareTeam) }));
}

function seedMedicalDocuments() {
  const count = Number((db.prepare(`SELECT COUNT(*) as count FROM medical_documents`).get() as any).count);
  if (count > 0) return;
  const seed = db.prepare(`INSERT INTO medical_documents (id,patient_id,name,type,mime_type,size,data_url,notes,uploaded_at,shared_with_care_team) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  seed.run('doc-report-1','pat-1','Blood_Report_Aug2026.pdf','blood_report','application/pdf',245000,'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMT4+ZW5kb2JqCjMgMCBvYmo8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDMwMCAyMDBdIC9Db250ZW50cyA0IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PCAvTGVuZ3RoIDQ0Pj5zdHJlYW0KQlQgL0YxIDEyIFRmIDQwIDE1MCBUZCAoU3dhc3RoeWFTZXR1IG1lZGljYWwgcmVwb3J0KSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCnRyYWlsZXI8PCAvUm9vdCAxIDAgUj4+CiUlRU9GCg==','Blood investigation report uploaded by patient.',now(),1);
  seed.run('doc-report-2','pat-1','Antenatal_Record.pdf','other','application/pdf',512000,'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMT4+ZW5kb2JqCjMgMCBvYmo8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDMwMCAyMDBdIC9Db250ZW50cyA0IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PCAvTGVuZ3RoIDQ0Pj5zdHJlYW0KQlQgL0YxIDEyIFRmIDQwIDE1MCBUZCAoU3dhc3RoeWFTZXR1IG1lZGljYWwgcmVwb3J0KSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCnRyYWlsZXI8PCAvUm9vdCAxIDAgUj4+CiUlRU9GCg==','Previous antenatal record.',now(),1);
}
seedMedicalDocuments();

const referrals: Referral[] = [
  {
    id: 'ref-1',
    patientId: 'pat-2',
    fromFacilityId: 'fac-1',
    toFacilityId: 'fac-2',
    reason: 'Cardiology assessment for persistent hypertension',
    status: 'accepted'
  }
];

const audit: {
  id: string;
  patientId?: string;
  action: string;
  createdAt: string
}[] = [];

function log(patientId: string | undefined, action: string) { 
  audit.unshift({
    id: uid('audit'),
    patientId,
    action,
    createdAt: now()
  }); 
}

function dashboard() { 
  return {
    kpis: {
      waiting: hydrateAppointments().filter(a => a.status === 'booked').length,
      followUpRate: 82,
      referralRate: 76,
      teleconsults: 14
    }, 
    queue: hydrateAppointments().filter((a: any) => a.status === 'booked').map((a: any) => ({
      ...a,
      patient: patients.find(p => p.id === a.patientId)?.name,
      doctor: doctors.find(d => d.id === a.doctorId)?.name
    })), 
    highRisk: patients.filter(p => p.risk === 'high'), 
    medicines: [
      { name: 'Paracetamol 500mg', quantity: 144, status: 'In stock' },
      { name: 'Amlodipine 5mg', quantity: 18, status: 'Low stock' },
      { name: 'ORS sachets', quantity: 82, status: 'In stock' }
    ], 
    referrals, 
    workload: doctors.map(d => ({
      ...d,
      patients: hydrateAppointments().filter((a: any) => a.doctorId === d.id && a.status === 'booked').length + 3
    }))
  }; 
}

app.get('/api/bootstrap', (req, res) => {
  const actor = users.find(u => u.id === req.header('x-demo-user-id'));
  
  if (actor?.role === 'patient' && actor.patientId) {
    const mine = <T extends { patientId: string }>(items: T[]) => 
      items.filter(item => item.patientId === actor.patientId);
      
    return res.json({
      facility,
      doctors,
      patients: patients.filter(p => p.id === actor.patientId),
      consents: consents.filter(c => c.patientId === actor.patientId),
      appointments: mine(hydrateAppointments()),
      intakes: mine(intakes),
      medicalDocuments: hydrateMedicalDocuments().filter(d => d.patientId === actor.patientId && d.sharedWithCareTeam && consents.some(c => c.patientId === d.patientId && c.status === 'active')),
      consultations: mine(consultations),
      prescriptions: mine(prescriptions),
      referrals: mine(referrals),
      dashboard: null,
      audit: audit.filter(a => a.patientId === actor.patientId),
      notifications: hydrateNotifications(actor.patientId)
    });
  }
  
  res.json({
    facility,
    doctors,
    patients,
    consents,
    appointments: hydrateAppointments(),
    intakes,
    consultations,
    prescriptions,
    referrals,
    medicalDocuments: hydrateMedicalDocuments().filter(d => d.sharedWithCareTeam && consents.some(c => c.patientId === d.patientId && c.status === 'active')),
    dashboard: dashboard(),
    audit,
    notifications: hydrateNotifications()
  });
});

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
  res.json(dashboard());
});

app.post('/api/auth/login', (req, res) => {
  const user = users.find(u => 
    u.email.toLowerCase() === String(req.body.email || '').toLowerCase() && 
    u.password === req.body.password && 
    u.role === req.body.role
  );
  
  if (!user) {
    return res.status(401).json({ message: 'Email, password, or selected role is incorrect.' });
  }
  
  const { password, ...safeUser } = user;
  res.json({ user: safeUser, token: `demo-token-${user.id}` });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required.' });
  }
  const allowedRoles: DemoUser['role'][] = ['patient', 'health_worker', 'doctor', 'system_admin'];
  if (!allowedRoles.includes(role as DemoUser['role'])) {
    return res.status(400).json({ message: 'This administration role is not available. Use System Admin for facility administration.' });
  }
  
  if (users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ message: 'An account already exists for this email.' });
  }
  
  const user: DemoUser = {
    id: uid('user'),
    name,
    email,
    password,
    role,
    facilityId: role === 'patient' ? undefined : 'fac-1'
  };
  
  if (role === 'patient') {
    const patient: Patient = {
      id: uid('pat'),
      name,
      age: 0,
      sex: 'Unspecified',
      phone: req.body.phone || '',
      language: 'English',
      village: req.body.village || '',
      risk: 'normal'
    };
    patients.push(patient);
    user.patientId = patient.id;
    consents.push({
      id: uid('con'),
      patientId: patient.id,
      scopes: ['care'],
      status: 'active',
      grantedAt: now()
    });
  }
  
  users.push(user);
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
    language: req.body.language || 'English',
    village: req.body.village || '',
    risk: 'normal'
  }; 
  patients.push(p); 
  
  const c: Consent = {
    id: uid('con'),
    patientId: p.id,
    scopes: req.body.scopes || ['care'],
    status: 'active' as const,
    grantedAt: now()
  }; 
  consents.push(c); 
  
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
  res.json({ facilityId, doctors: rows.map(d => ({...d, workingHours: JSON.parse(d.workingHours || '[]')})), hospitalPhone: f?.phone || facilityPhone || null });
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
  const rows = db.prepare(`SELECT start_time, capacity, booked_count FROM appointment_slots WHERE doctor_id=? AND facility_id=? AND slot_date=? AND status!='full' AND booked_count < capacity ORDER BY start_time`).all(doctorId, facilityId, date) as any[];
  // Return only bookable times. Capacity and occupancy remain backend/database-only.
  res.json({ doctorId, facilityId, date, slots: rows.map(r => r.start_time), slotCapacity: 3, workingHours: JSON.parse(doctor.working_hours), slotMinutes: doctor.slot_minutes });
});

app.post('/api/appointments', async (req, res) => {
  const { patientId, doctorId, startsAt } = req.body;
  if (!patientId || !doctorId || !startsAt) return res.status(400).json({ message: 'Patient, doctor, date and time are required.' });
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ message: 'Invalid appointment date/time.' });
  if (when.getTime() < Date.now() - 60000) return res.status(400).json({ message: 'Please choose a future time slot.' });
  const date = String(startsAt).slice(0,10), time = String(startsAt).slice(11,16);
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
    const existing = db.prepare(`SELECT id FROM appointments_db WHERE patient_id=? AND status='booked'`).get(patientId) as any;
    if (existing) throw new Error('PATIENT_HAS_APPOINTMENT');
    const locked = db.prepare(`SELECT status, capacity, booked_count FROM appointment_slots WHERE id=?`).get(slot.id) as any;
    const capacity = Number(locked?.capacity || 3);
    const bookedCount = Number(locked?.booked_count || 0);
    if (!locked || bookedCount >= capacity || locked.status === 'full') throw new Error('SLOT_FULL');
    const tokenRow = db.prepare(`SELECT COALESCE(MAX(token),0)+1 AS token FROM appointments_db WHERE slot_id=? AND status='booked'`).get(slot.id) as any;
    token = Number(tokenRow.token);
    if (token > capacity) throw new Error('SLOT_FULL');
    db.prepare(`UPDATE appointment_slots SET booked_count=?, status=? WHERE id=?`).run(bookedCount + 1, bookedCount + 1 >= capacity ? 'full' : 'available', slot.id);
    db.prepare(`INSERT INTO appointments_db (id,patient_id,facility_id,doctor_id,slot_id,starts_at,token,status,facility_name,facility_latitude,facility_longitude,shared_document_ids) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,patientId,facilityId,doctorId,slot.id,startsAt,token,'booked',facilityName,Number.isFinite(Number(req.body.facilityLatitude))?Number(req.body.facilityLatitude):null,Number.isFinite(Number(req.body.facilityLongitude))?Number(req.body.facilityLongitude):null,JSON.stringify(sharedDocumentIds));
    db.exec('COMMIT');
  } catch (e:any) { try { db.exec('ROLLBACK'); } catch {} if (e.message === 'SLOT_FULL') return res.status(409).json({ message: 'This time slot is full. A maximum of 3 patients can be booked for this slot.' }); if (e.message === 'PATIENT_HAS_APPOINTMENT') return res.status(409).json({ message: 'You already have an upcoming appointment. Cancel it before booking another.' }); throw e; }
  log(patientId, 'Appointment booked');
  const bookedAppointment = hydrateAppointments().find((a:any)=>a.id===id) as any;
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
  const allowed = ['blood_report','lab_report','prescription','scan','discharge_summary','other'];
  const document: MedicalDocument = { id: uid('meddoc'), patientId, name: String(name), type: allowed.includes(String(type)) ? String(type) as MedicalDocument['type'] : 'other', mimeType: String(mimeType), size: Number(size) || 0, dataUrl: String(dataUrl), notes: notes ? String(notes) : undefined, uploadedAt: now(), sharedWithCareTeam: true };
  db.prepare(`INSERT INTO medical_documents (id,patient_id,name,type,mime_type,size,data_url,notes,uploaded_at,shared_with_care_team) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(document.id,document.patientId,document.name,document.type,document.mimeType,document.size,document.dataUrl,document.notes || null,document.uploadedAt,1);
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

app.get('/api/medical-documents/:patientId', (req, res) => {
  const activeConsent = consents.some(c => c.patientId === req.params.patientId && c.status === 'active');
  if (!activeConsent) return res.json([]);
  res.json(hydrateMedicalDocuments().filter(d => d.patientId === req.params.patientId && d.sharedWithCareTeam));
});

app.post('/api/intakes', (req, res) => {
  const symptoms: string[] = req.body.symptoms || [];
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
  intakes.unshift(i);
  
  log(i.patientId, 'AI intake submitted — pending clinical review');
  res.status(201).json(i);
});

app.patch('/api/intakes/:id/review', (req, res) => {
  const i = intakes.find(x => x.id === req.params.id);
  if (!i) {
    return res.sendStatus(404);
  }
  
  i.status = req.body.status === 'rejected' ? 'rejected' : 'verified';
  if (req.body.summary) {
    i.summary = req.body.summary;
  }
  
  log(i.patientId, `Intake ${i.status} by clinician`);
  res.json(i);
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
  consultations.unshift(c);
  
  if (req.body.medicines?.length) {
    prescriptions.unshift({
      id: uid('rx'),
      patientId: c.patientId,
      consultationId: c.id,
      medicines: req.body.medicines
    });
  }
  
  const a = db.prepare('SELECT * FROM appointments_db WHERE id=?').get(req.body.appointmentId) as any;
  if (a) { db.prepare(`UPDATE appointments_db SET status='completed' WHERE id=?`).run(a.id); db.prepare(`UPDATE appointment_slots SET booked_count=MAX(0, booked_count-1), status=CASE WHEN MAX(0, booked_count-1) >= capacity THEN 'full' ELSE 'available' END WHERE id=?`).run(a.slot_id); }
  
  log(c.patientId, 'Consultation completed and prescription issued');
  res.status(201).json({ consultation: c, prescription: prescriptions[0] });
});


app.patch('/api/patients/:id', (req, res) => {
  const p = patients.find(x => x.id === req.params.id);
  if (!p) return res.sendStatus(404);
  if (req.body.name !== undefined) p.name = String(req.body.name);
  if (req.body.village !== undefined) p.village = String(req.body.village);
  if (req.body.language !== undefined) p.language = String(req.body.language);
  if (req.body.medicalCondition !== undefined) p.medicalCondition = String(req.body.medicalCondition);
  if (req.body.medicalHistory !== undefined) p.medicalHistory = String(req.body.medicalHistory);
  if (req.body.allergies !== undefined) p.allergies = String(req.body.allergies);
  if (req.body.medications !== undefined) p.medications = String(req.body.medications);
  db.prepare(`INSERT INTO patient_health_profiles (patient_id, medical_condition, medical_history, allergies, medications, updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(patient_id) DO UPDATE SET medical_condition=excluded.medical_condition, medical_history=excluded.medical_history,
    allergies=excluded.allergies, medications=excluded.medications, updated_at=excluded.updated_at`)
    .run(p.id, p.medicalCondition || '', p.medicalHistory || '', p.allergies || '', p.medications || '', now());
  log(p.id, 'Patient medical information updated');
  res.json(p);
});

app.patch('/api/appointments/:id/cancel', async (req, res) => {
  const a = db.prepare('SELECT * FROM appointments_db WHERE id=?').get(req.params.id) as any;
  if (!a) return res.sendStatus(404);
  try { db.exec('BEGIN IMMEDIATE'); db.prepare(`UPDATE appointments_db SET status='cancelled' WHERE id=? AND status='booked'`).run(a.id); db.prepare(`UPDATE appointment_slots SET booked_count=MAX(0, booked_count-1), status=CASE WHEN MAX(0, booked_count-1) >= capacity THEN 'full' ELSE 'available' END WHERE id=?`).run(a.slot_id); db.exec('COMMIT'); } catch(e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
  log(a.patient_id, `Appointment cancelled by patient; token #${a.token} deleted and slot released`);
  const doctor = doctors.find((d:any) => d.id === a.doctor_id) as any;
  const cancellationMessage = `SwasthyaSetu: Your appointment with ${doctor?.name || 'your doctor'} on ${new Date(a.starts_at).toLocaleString('en-IN')} at ${a.facility_name || facility.name} has been cancelled. Token #${a.token} has been deleted and the slot is available again.`;
  const notifications = await sendPatientNotification(a.patient_id, a.id, 'appointment_cancelled', 'SwasthyaSetu appointment cancelled', cancellationMessage);
  res.json({ id:a.id, status:'cancelled', token:null, tokenDeleted:true, notifications });
});

app.patch('/api/consents/:id', (req, res) => {
  const c = consents.find(x => x.id === req.params.id);
  if (!c) return res.sendStatus(404);
  c.status = req.body.status === 'paused' ? 'paused' : 'active';
  log(c.patientId, `Care consent ${c.status}`);
  res.json(c);
});

app.post('/api/assistance', (req, res) => {
  log(req.body.patientId, 'Patient requested health-worker assistance');
  res.status(201).json({ id: uid('help'), patientId: req.body.patientId, status: 'requested' });
});

app.post('/api/referrals', (req, res) => {
  const r: Referral = {
    id: uid('ref'),
    patientId: req.body.patientId,
    fromFacilityId: 'fac-1',
    toFacilityId: req.body.toFacilityId || 'fac-2',
    reason: req.body.reason,
    status: 'pending'
  };
  referrals.unshift(r);
  
  log(r.patientId, 'Referral created');
  res.status(201).json(r);
});

app.listen(4000, () => {
  console.log('Swasthya Setu API: http://localhost:4000');
});
