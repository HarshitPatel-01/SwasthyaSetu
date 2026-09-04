# SwasthyaSetu Unified Merge

This version uses the latest SwasthyaSetu codebase as the working base and unifies the primary care journey around three simple roles:

- Patient
- Frontline Health Worker
- Doctor / Specialist

## Communication added

A shared **Care Team** conversation is now available to all three roles for each patient.

- Patient can message the health worker or doctor.
- Health worker can select a patient and message the patient or doctor.
- Doctor can message the patient or health worker for the currently selected case.
- Messages are stored in SQLite and returned through `/api/care-team/messages`.
- The patient-centered thread keeps communication attached to the same care journey rather than creating separate chat applications.

## PDF alignment

The workflow follows the supplied project brief: one connected patient journey, frontline workers as active response nodes, severity-based escalation, continuous patient context, and closed-loop follow-up. The UI keeps the three primary care roles easy to understand while the existing backend retains the broader ecosystem capabilities described in the brief.

## Run

```bash
npm install
npm run dev
```

Web: http://localhost:5173
API: http://localhost:4000

Demo password: `demo123`

## Updated communication model
- Patient medical context and consent-shared reports are presented as one shared care record for Patient, Health Worker and Doctor.
- Care Team messages now support **Entire Care Team** delivery. A message from any one of the three roles is delivered to the other two roles.
- Added a shared 3-way audio/video room using a stable patient-specific Jitsi room URL; all three roles can join the same room.
- Emergency SOS calls the assigned frontline worker (or 112 fallback) and starts browser live-location updates.
- Emergency live coordinates are restricted to the assigned health worker; doctor views receive emergency status without coordinates.
