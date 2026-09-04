export type Role = 'patient' | 'health_worker' | 'doctor' | 'facility_admin' | 'system_admin';
export type ReviewStatus = 'pending_review' | 'verified' | 'rejected';
export type MedicalDocumentType = 'blood_report' | 'lab_report' | 'prescription' | 'scan' | 'discharge_summary' | 'other';
export type ReferralStatus = 'pending' | 'accepted' | 'completed';

export interface Patient {
  id: string;
  name: string;
  abhaId?: string;
  age: number;
  sex: string;
  phone: string;
  language: string;
  village: string;
  risk?: 'high' | 'normal';
  medicalCondition?: string;
  medicalHistory?: string;
  allergies?: string;
  medications?: string;
}

export interface Consent {
  id: string;
  patientId: string;
  scopes: string[];
  status: 'active' | 'paused' | 'revoked';
  grantedAt: string;
}

export interface MedicalDocument {
  id: string;
  patientId: string;
  name: string;
  type: MedicalDocumentType;
  mimeType: string;
  size: number;
  dataUrl: string;
  notes?: string;
  uploadedAt: string;
  sharedWithCareTeam: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  facilityId: string;
  doctorId: string;
  startsAt: string;
  token: number;
  status: 'booked' | 'completed' | 'cancelled';
  facilityName?: string;
  facilityLatitude?: number;
  facilityLongitude?: number;
  sharedDocumentIds?: string[];
}

export interface IntakeSummary {
  id: string;
  patientId: string;
  appointmentId?: string;
  symptoms: string[];
  summary: string;
  redFlags: string[];
  status: ReviewStatus;
  createdAt: string;
}

export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string[];
  notes: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  consultationId: string;
  medicines: {
    name: string;
    dosage: string;
    days: number;
  }[];
}

export interface Referral {
  id: string;
  patientId: string;
  fromFacilityId: string;
  toFacilityId: string;
  reason: string;
  status: ReferralStatus;
  referralToken?: string;
  patientName?: string;
  toFacilityName?: string;
  fromFacilityName?: string;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  distance: string;
  services: string[];
  bedsAvailable: number;
}

export interface AuditLog {
  id: string;
  patientId?: string;
  action: string;
  createdAt: string;
}

// ── Doctor Triage Workspace Types (merged from doc-side) ──────────────────────
// These types power the CareLine Doctor triage queue, case detail,
// longitudinal history, and clinical action modals.

export type SeverityLevel = 'critical' | 'urgent' | 'concerning' | 'routine';
export type CaseStatus = 'new' | 'in_review' | 'action_taken' | 'resolved';

/** Deterministic governance rule that overrode the AI-assigned severity level. */
export interface RedFlagOverride {
  overridden: boolean;
  ruleName?: string;
  originalLevel?: SeverityLevel;
  reason: string;
}

/** One turn of the patient intake conversation transcript. */
export interface TranscriptEntry {
  question: string;
  answer: string;
  timestamp?: string;
}

/** Frontline health worker assigned or available for dispatch to a case. */
export interface FrontlineWorkerInfo {
  name: string;
  role: string;
  phone: string;
  status: 'dispatched' | 'on_site' | 'available' | 'busy';
  distance: string;
}

/** One entry in a patient's longitudinal health record timeline. */
export interface PastVisit {
  id: string;
  date: string;
  facility: string;
  type: 'visit' | 'prescription' | 'diagnostic' | 'referral' | 'followup';
  title: string;
  detail: string;
  doctorName?: string;
  status?: string;
}

/** Structured clinical intake summary produced by the AI triage assistant. */
export interface StructuredIntakeSummary {
  chiefComplaint: string;
  duration: string;
  symptoms: string[];
  history: {
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
  };
  redFlags: string[];
}

/** A diagnostic test order placed by the doctor for a triage case. */
export interface DiagnosticOrder {
  id: string;
  patientId: string;
  caseId: string;
  testName: string;
  facilityName: string;
  status: 'ordered' | 'completed';
  orderedAt: string;
}

/**
 * A full triage case as seen in the CareLine Doctor workspace.
 * Created from a patient intake and enriched with severity assessment,
 * longitudinal history (computed from DB joins), and frontline worker context.
 */
export interface TriageCase {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientLanguage: string;
  patientAbha?: string;
  patientVillage: string;
  submittedAt: string;
  timeAgo: string;
  status: CaseStatus;
  severity: {
    level: SeverityLevel;
    reasoning: string;
    override?: RedFlagOverride;
  };
  summary: StructuredIntakeSummary;
  transcript: TranscriptEntry[];
  longitudinalHistory: PastVisit[];
  frontlineWorker: FrontlineWorkerInfo | null;
  followUpDate?: string;
  notes?: string;
}
