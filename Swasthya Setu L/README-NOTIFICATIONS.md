# SwasthyaSetu notification setup

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Put your Gmail App Password in `SMTP_PASS` (spaces are accepted and stripped).
3. Set `DEMO_PATIENT_EMAIL` to the Gmail address that should receive demo patient notifications.
4. Run `npm install` then `npm run dev`.
5. Check `http://localhost:4000/api/notifications/config-status`.
6. To send a test email from PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/notifications/test-email -ContentType 'application/json' -Body '{"to":"your-email@gmail.com"}'
```

Booking and cancellation notifications are persisted in SQLite and delivery status is updated to `sent`, `failed`, or `not_configured`.
