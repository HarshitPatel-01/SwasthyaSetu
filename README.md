# SwasthyaSetu

SwasthyaSetu is a connected healthcare platform designed to simplify patient care by bringing appointments, medical records, healthcare facilities, doctors, emergency support, and care-team information into one system.

> This is a demonstration application. It is not approved for clinical use and must not be used to make, delay, or replace medical decisions.

## Highlights

### Patient Portal

The Patient Portal provides a centralized healthcare dashboard with:

- Patient profile and personal healthcare information
- Appointment booking with nearby healthcare facilities
- Hospital and doctor selection
- Doctor-specific appointment slots
- Digital appointment tokens
- Appointment cancellation and slot release
- Upcoming visit and appointment details
- Medical history and health information
- Medical conditions, allergies, and current medications
- Medical reports and document uploads
- Prescriptions, consultations, and referrals
- AI Assistant / Health Check for health-related guidance and understanding medical information
- Emergency SOS assistance
- Nearby hospitals based on the patient's live location
- Hospital directions and contact information
- Appointment and system notifications
- Multilingual interface support

### Doctor Portal

The Doctor Portal provides access to patient information required for continuity of care, including:

- Patient medical history
- Medical conditions
- Allergies and medications
- Shared medical reports
- Patient intake information
- Consultation information
- Prescriptions
- Referrals
- Patient care information

### Health Worker Portal

The Health Worker Portal supports frontline healthcare operations by providing access to relevant patient information shared through the care network.

### System Admin Portal

SwasthyaSetu uses a **single administration entry point: System Admin**.

The System Admin portal provides centralized administration for:

- Patients
- Doctors
- Health workers
- Healthcare facilities
- System-level operations
- Care-network administration

There is **no separate Facility Admin login or registration role**. Facility-management capabilities are handled through the System Admin portal.

---

## Patient Healthcare Features

### Appointment Booking

Patients can:

1. Select a nearby healthcare facility.
2. View available doctors.
3. Select a doctor using the available options.
4. Select an available date and time slot.
5. Book an appointment.
6. Receive a digital queue token.

Each doctor follows a defined working schedule, with a maximum of 8 working hours per day in the demo system.

Appointment capacity is maintained through the database, and a full slot is automatically removed from the available options.

### Appointment Cancellation

Patients can cancel an existing appointment after confirmation.

When an appointment is cancelled:

- The appointment is marked as cancelled.
- The active token is released.
- The appointment slot becomes available again.
- The cancellation is recorded in the system.
- A notification can be sent through configured notification providers.

### Health Records

The Patient Health Records section provides a longitudinal view of the patient's healthcare information.

It includes:

- Medical condition
- Medical history
- Allergies
- Medications
- Blood reports
- Laboratory reports
- Prescriptions
- Scans
- Discharge summaries
- Other medical documents
- Consultations
- Referrals
- Previous appointments

Patients can upload supported medical documents and remove documents when required.

### AI Assistant / Health Check

The Patient Portal includes an AI Assistant designed to help patients understand their healthcare information and prepare for medical consultations.

It can provide assistance related to:

- Understanding health records
- Understanding healthcare terminology
- Reviewing available report information
- Preparing questions for a doctor
- Upcoming visits
- General health-related guidance

AI assistance is presented as supportive information and does not replace professional medical evaluation.

### Nearby Hospitals

The application can use the patient's browser location to find nearby healthcare facilities.

The nearby hospital feature provides information such as:

- Hospital/facility name
- Distance from the patient
- Emergency availability when available
- Contact information
- Directions

The application uses live location and map data to identify nearby facilities.

### Emergency SOS

The Patient Portal provides an Emergency SOS option for quickly accessing emergency assistance and nearby healthcare facilities.

The feature is intended to reduce the time required to find appropriate emergency care.

### Notifications

The system maintains appointment-related notifications.

When configured, patients can receive:

- Appointment confirmation
- Appointment cancellation notification

Notifications can be delivered through:

- Gmail/email
- SMS using Twilio

Notification delivery status is also stored by the system.

---

## Technology

| Area | Choice |
| --- | --- |
| Web Client | React, TypeScript, Vite |
| API | Node.js, Express, TypeScript |
| UI | Custom responsive CSS, Lucide Icons |
| Database | SQLite |
| Shared Contracts | TypeScript |
| Maps / Nearby Facilities | OpenStreetMap / Overpass API |
| Email Notifications | Gmail SMTP / Nodemailer |
| SMS Notifications | Twilio |
| AI Boundary | Provider-neutral architecture |

---

## Prerequisites

- Node.js 22.5+ recommended
- npm 10 or newer

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/HarshitPatel-01/SwasthyaSetu.git
cd SwasthyaSetu
