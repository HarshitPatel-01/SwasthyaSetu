-- PostgreSQL schema; JSONB fields retain FHIR-compatible extensibility.
CREATE TYPE user_role AS ENUM ('patient','health_worker','doctor','facility_admin','system_admin');

CREATE TYPE consent_status AS ENUM ('active','revoked','expired');

CREATE TYPE review_status AS ENUM ('pending_review','verified','rejected');

CREATE TYPE referral_status AS ENUM ('pending','accepted','completed','cancelled');

CREATE TABLE facilities (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    services JSONB DEFAULT '[]',
    beds_available INT DEFAULT 0
);

CREATE TABLE staff_users (
    id UUID PRIMARY KEY,
    facility_id UUID REFERENCES facilities,
    name TEXT NOT NULL,
    role user_role NOT NULL,
    specialties JSONB DEFAULT '[]'
);

CREATE TABLE patients (
    id UUID PRIMARY KEY,
    abha_id TEXT UNIQUE,
    name TEXT NOT NULL,
    date_of_birth DATE,
    sex TEXT,
    phone TEXT,
    language TEXT DEFAULT 'en',
    address JSONB DEFAULT '{}',
    fhir_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE consents (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    scope TEXT[] NOT NULL,
    status consent_status NOT NULL DEFAULT 'active',
    granted_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    facility_id UUID REFERENCES facilities NOT NULL,
    clinician_id UUID REFERENCES staff_users,
    starts_at TIMESTAMPTZ NOT NULL,
    token_number INT,
    status TEXT NOT NULL DEFAULT 'booked',
    is_emergency BOOLEAN DEFAULT false,
    medical_history TEXT,
    attachments JSONB DEFAULT '[]'
);

CREATE TABLE intake_summaries (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    appointment_id UUID REFERENCES appointments,
    symptoms JSONB NOT NULL,
    summary TEXT NOT NULL,
    red_flags JSONB DEFAULT '[]',
    status review_status DEFAULT 'pending_review',
    ai_provider TEXT,
    clinician_id UUID REFERENCES staff_users,
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE consultations (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    clinician_id UUID REFERENCES staff_users NOT NULL,
    appointment_id UUID REFERENCES appointments,
    notes TEXT,
    diagnosis JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY,
    consultation_id UUID REFERENCES consultations NOT NULL,
    patient_id UUID REFERENCES patients NOT NULL,
    medicines JSONB NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referrals (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    from_facility_id UUID REFERENCES facilities,
    to_facility_id UUID REFERENCES facilities,
    reason TEXT NOT NULL,
    status referral_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE diagnostic_results (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    facility_id UUID REFERENCES facilities,
    test_name TEXT NOT NULL,
    result JSONB,
    observed_at TIMESTAMPTZ
);

CREATE TABLE medicine_availability (
    id UUID PRIMARY KEY,
    facility_id UUID REFERENCES facilities NOT NULL,
    medicine TEXT NOT NULL,
    quantity INT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE follow_up_reminders (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    channel TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled'
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    actor_id UUID,
    patient_id UUID REFERENCES patients,
    action TEXT NOT NULL,
    consent_id UUID REFERENCES consents,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
