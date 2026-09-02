export type Role = 'patient' | 'health_worker' | 'doctor' | 'facility_admin' | 'system_admin';
export type ReviewStatus = 'pending_review' | 'verified' | 'rejected';
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
  status: 'active' | 'revoked';
  grantedAt: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  facilityId: string;
  doctorId: string;
  startsAt: string;
  token: number;
  status: 'booked' | 'completed';
  medicalHistory?: string;
  attachments?: Attachment[];
  isEmergency?: boolean;
  emergencyReason?: string;
  precautions?: string;
  verifiedByWorker?: boolean;
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
