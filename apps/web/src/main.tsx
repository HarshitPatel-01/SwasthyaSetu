import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, Bell, Calendar, CheckCircle2, ChevronRight, ClipboardList, Download, Edit3, FileText, HeartPulse, Hospital, Languages, LogOut, MapPin, Menu, Mic, PackageCheck, Plus, ShieldAlert, Stethoscope, Upload, User, Users, Video } from 'lucide-react';
// CSS is loaded as a bundler side-effect import; TypeScript has no declaration for it.
// @ts-ignore
import './styles.css';

const api = 'http://localhost:4000/api';
type Data = any;
type Role = 'patient' | 'health_worker' | 'doctor' | 'facility_admin' | 'system_admin';
const roles: Role[] = ['patient', 'health_worker', 'doctor', 'facility_admin', 'system_admin'];

const cn = (...a: (string | boolean | undefined)[]) => a.filter(Boolean).join(' ');

const routeFromHash = () => {
  const [role = 'patient', tab = 'home'] = location.hash.replace(/^#\/?/, '').split('/');
  return { role: roles.includes(role as Role) ? role as Role : 'patient', tab: tab || 'home' };
};

const authFromHash = () => location.hash.replace(/^#\/?/, '').split('/')[0] as 'login' | 'register' | '';

// Helper function to trigger browser downloads for files and text descriptions
function triggerDownload(contentOrDataUrl: string, filename: string, isText = false) {
  if (isText) {
    const blob = new Blob([contentOrDataUrl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  if (contentOrDataUrl && contentOrDataUrl.startsWith('data:')) {
    try {
      const parts = contentOrDataUrl.split(';base64,');
      const contentType = parts[0].replace('data:', '');
      const base64Data = parts[1] || '';
      const raw = window.atob(base64Data);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      const blob = new Blob([uInt8Array], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    } catch {
      // Fallback
    }
  }

  // Fallback blob generation
  const blob = new Blob([contentOrDataUrl || 'Swasthya Setu Medical Document'], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function App() {
  const initial = routeFromHash();
  const [data, setData] = useState<Data>();
  const [role, setRole] = useState<Role>(initial.role);
  const [tab, setTab] = useState(initial.tab);
  const [authPage, setAuthPage] = useState(authFromHash());
  const [session, setSession] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('swasthya-session') || 'null');
    } catch {
      return null;
    }
  });
  const [notice, setNotice] = useState('');
  const [language, setLanguage] = useState('EN');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const refresh = () => fetch(`${api}/bootstrap`, {
    headers: session?.id ? { 'x-demo-user-id': session.id } : {}
  }).then(r => r.json()).then(setData);

  useEffect(() => {
    if (!location.hash) location.hash = '/login';
    if (session) void refresh();
    const onHash = () => {
      setAuthPage(authFromHash());
      const next = routeFromHash();
      setRole(next.role);
      setTab(next.tab);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [session]);

  if (authPage === 'login' || authPage === 'register') {
    return <AuthPage mode={authPage} onSuccess={(next: any) => {
      localStorage.setItem('swasthya-session', JSON.stringify(next));
      setSession(next);
      location.hash = `/${next.role}/home`;
      setAuthPage('');
    }} />;
  }

  if (!session) {
    location.hash = '/login';
    return <main className="loading"><HeartPulse /> Redirecting to secure sign in…</main>;
  }

  if (role !== session.role) {
    location.hash = `/${session.role}/home`;
    return <main className="loading"><HeartPulse /> Opening your authorised workspace…</main>;
  }

  if (!data) {
    return <main className="loading"><HeartPulse /> Loading rural care network…</main>;
  }

  const patient = data.patients?.find((x: any) => x.id === session.patientId) || data.patients[0];
  
  const navigate = (nextRole: Role, nextTab = 'home') => {
    if (nextRole !== session.role) {
      setNotice('Your account does not have permission to open that workspace.');
      return;
    }
    location.hash = `/${nextRole}/${nextTab}`;
    setRole(nextRole);
    setTab(nextTab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const action = async (path: string, body: any, message = 'Saved securely. Your care team can now continue this journey.') => {
    const response = await fetch(api + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Unable to save');
    setNotice(message);
    await refresh();
  };

  const updatePatientProfile = async (updatedData: any) => {
    const response = await fetch(`${api}/patients/${patient.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    if (!response.ok) throw new Error('Unable to update patient profile');
    
    // Update local session if name changed
    if (updatedData.name && session) {
      const updatedSession = { ...session, name: updatedData.name };
      localStorage.setItem('swasthya-session', JSON.stringify(updatedSession));
      setSession(updatedSession);
    }

    setNotice('Profile & health history updated successfully! All changes synchronized across your care record.');
    await refresh();
  };

  const chooseRole = (value: Role) => navigate(value);
  const signOut = () => {
    localStorage.removeItem('swasthya-session');
    setSession(null);
    location.hash = '/login';
    setAuthPage('login');
  };

  return (
    <div className="app">
      <header>
        <button className="brand" onClick={() => chooseRole(session.role)} aria-label="Go to authorised home">
          <span><HeartPulse /></span>
          <div>Swasthya <b>Setu</b><small>Connecting care, everywhere</small></div>
        </button>
        <div className="header-actions">
          {/* Header Profile Button for Patient or Staff */}
          <button className="profile-btn" onClick={() => setProfileOpen(true)}>
            <User /> {role === 'patient' ? (patient?.name || 'Patient Profile') : (session.name || 'Staff Profile')}
          </button>
          <button className="mobile" onClick={() => setMenuOpen(x => !x)} aria-label="Open navigation"><Menu /></button>
        </div>
      </header>

      {notice && (
        <div className="notice">
          <CheckCircle2 /> {notice}
          <button onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {role === 'patient' ? (
        <PatientView p={patient} data={data} tab={tab} setTab={(next: string) => navigate('patient', next)} action={action} setNotice={setNotice} />
      ) : role === 'doctor' ? (
        <DoctorView data={data} action={action} setNotice={setNotice} refresh={refresh} />
      ) : (
        <AdminView data={data} role={role} setNotice={setNotice} refresh={refresh} />
      )}

      {profileOpen && (
        <ProfileModal 
          patient={patient} 
          session={session}
          role={role}
          language={language}
          setLanguage={setLanguage}
          signOut={signOut}
          onClose={() => setProfileOpen(false)} 
          onSave={updatePatientProfile} 
        />
      )}
    </div>
  );
}

function ProfileModal({ patient, session, role, language, setLanguage, signOut, onClose, onSave }: any) {
  const [loading, setLoading] = useState(false);

  const isPatientRole = role === 'patient';

  // State fields
  const [name, setName] = useState(isPatientRole ? (patient?.name || session?.name || '') : (session?.name || ''));
  const [age, setAge] = useState(patient?.age || 28);
  const [sex, setSex] = useState(patient?.sex || 'Female');
  const [phone, setPhone] = useState(patient?.phone || '•••• 4812');
  const [village, setVillage] = useState(patient?.village || 'Kheriya');
  const [selectedLanguage, setSelectedLanguage] = useState(patient?.language || language || 'EN');
  const [medicalCondition, setMedicalCondition] = useState(patient?.medicalCondition || '');
  const [medicalHistory, setMedicalHistory] = useState(patient?.medicalHistory || '');
  const [allergies, setAllergies] = useState(patient?.allergies || '');
  const [medications, setMedications] = useState(patient?.medications || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (setLanguage) setLanguage(selectedLanguage);
      if (isPatientRole && patient?.id) {
        await onSave({
          name,
          age: Number(age),
          sex,
          phone,
          village,
          language: selectedLanguage,
          medicalCondition,
          medicalHistory,
          allergies,
          medications
        });
      }
      onClose();
    } catch {
      alert('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2><User /> {name || (isPatientRole ? 'Patient Profile' : 'Staff Profile')}</h2>
          <button type="button" className="close-modal" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSave}>
          <div className="profile-modal-body">
            {isPatientRole ? (
              <>
                {/* Patient Profile Content */}
                <div className="profile-section-title">Personal Information & Language</div>
                <div className="profile-grid-2">
                  <div className="profile-field">
                    <label>Full Patient Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} required placeholder="Enter full name" />
                  </div>

                  <div className="profile-field">
                    <label>ABHA ID (Health ID)</label>
                    <input disabled value={patient?.abhaId || '91-2345-6789-0123'} />
                  </div>

                  <div className="profile-field">
                    <label>Age (Years)</label>
                    <input type="number" value={age} onChange={e => setAge(Number(e.target.value))} required placeholder="Age" />
                  </div>

                  <div className="profile-field">
                    <label>Gender / Sex</label>
                    <select value={sex} onChange={e => setSex(e.target.value)}>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="profile-field">
                    <label>Mobile Phone Number</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number" />
                  </div>

                  <div className="profile-field">
                    <label>Village / Locality</label>
                    <input value={village} onChange={e => setVillage(e.target.value)} placeholder="Village name" />
                  </div>

                  <div className="profile-field" style={{ gridColumn: 'span 2' }}>
                    <label>Preferred Interface Language</label>
                    <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}>
                      <option value="EN">English (EN)</option>
                      <option value="हिं">हिन्दी (Hindi)</option>
                      <option value="ತಮ">தமிழ் (Tamil)</option>
                    </select>
                  </div>
                </div>

                {/* Current Medical Condition */}
                <div className="profile-section-title" style={{ marginTop: '10px' }}>Active Health Condition</div>
                <div className="profile-field">
                  <label>Description of Active Medical Condition</label>
                  <textarea 
                    value={medicalCondition} 
                    onChange={e => setMedicalCondition(e.target.value)} 
                    placeholder="E.g., 7 months pregnant with severe headache, dizziness, or high fever..." 
                    style={{ minHeight: '70px' }}
                  />
                </div>

                {/* Pre-existing Medical History */}
                <div className="profile-section-title" style={{ marginTop: '10px' }}>Pre-existing Medical History</div>
                <div className="profile-field">
                  <label>Past Diagnoses, Chronic Illnesses & Surgeries</label>
                  <textarea 
                    value={medicalHistory} 
                    onChange={e => setMedicalHistory(e.target.value)} 
                    placeholder="E.g., Mild gestational hypertension in 2024, asthma, previous surgeries..." 
                    style={{ minHeight: '70px' }}
                  />
                </div>

                {/* Allergies & Current Medications */}
                <div className="profile-grid-2" style={{ marginTop: '5px' }}>
                  <div className="profile-field">
                    <label>Known Allergies</label>
                    <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="E.g., Penicillin, Sulfa drugs" />
                  </div>

                  <div className="profile-field">
                    <label>Ongoing Medications</label>
                    <input value={medications} onChange={e => setMedications(e.target.value)} placeholder="E.g., Paracetamol, Folic acid" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Healthcare Worker / Staff Profile Content */}
                <div className="profile-section-title">Healthcare Worker Staff Profile</div>
                <div className="profile-grid-2">
                  <div className="profile-field">
                    <label>Staff Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} required />
                  </div>

                  <div className="profile-field">
                    <label>Role / Designation</label>
                    <input disabled value={
                      role === 'health_worker' ? 'Frontline Health Worker (ASHA)' :
                      role === 'doctor' ? 'Doctor / Specialist Clinician' :
                      role === 'facility_admin' ? 'Facility Administrator' : 'System Administrator'
                    } />
                  </div>

                  <div className="profile-field">
                    <label>Assigned Care Facility</label>
                    <input disabled value="Seva Rural Health Centre" />
                  </div>

                  <div className="profile-field">
                    <label>Staff Account Email</label>
                    <input disabled value={session?.email || 'worker@example.com'} />
                  </div>

                  <div className="profile-field" style={{ gridColumn: 'span 2' }}>
                    <label>Interface Language</label>
                    <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}>
                      <option value="EN">English (EN)</option>
                      <option value="हिं">हिन्दी (Hindi)</option>
                      <option value="ತಮ">தமிழ் (Tamil)</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="profile-modal-footer">
            <button type="button" className="signout-modal-btn" onClick={signOut}>
              <LogOut style={{ width: '15px', height: '15px' }} /> Sign out
            </button>

            <button type="button" className="outline" onClick={onClose}>Cancel</button>

            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Saving Changes…' : 'Save & Update Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuthPage({ mode, onSuccess }: { mode: 'login' | 'register'; onSuccess: (user: any) => void }) {
  const [role, setRole] = useState<Role>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const labels: { role: Role; label: string; detail: string }[] = [
    { role: 'patient', label: 'Patient', detail: 'Access your care and records' },
    { role: 'health_worker', label: 'Health worker', detail: 'Support community care' },
    { role: 'doctor', label: 'Doctor / specialist', detail: 'Review and consult' },
    { role: 'facility_admin', label: 'Facility admin', detail: 'Coordinate local services' },
    { role: 'system_admin', label: 'System admin', detail: 'Manage the care network' }
  ];

  const demo: any = {
    patient: ['meera@example.com', 'demo123'],
    health_worker: ['worker@example.com', 'demo123'],
    doctor: ['doctor@example.com', 'demo123'],
    facility_admin: ['admin@example.com', 'demo123'],
    system_admin: ['system@example.com', 'demo123']
  };

  const submit = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${api}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, name, email, password, phone, village })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to continue.');
      onSuccess(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const useDemo = () => {
    setEmail(demo[role][0]);
    setPassword(demo[role][1]);
    setName('');
  };

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <div className="auth-brand"><HeartPulse /> Swasthya <b>Setu</b></div>
        <p className="eyebrow">Integrated rural healthcare</p>
        <h1>One connected path to <i>better care.</i></h1>
        <p>Securely connect patients, community health workers, clinicians, and facilities around the same care record.</p>
        <div className="auth-steps">
          <span><CheckCircle2 /> Consent-led access</span>
          <span><CheckCircle2 /> Human-reviewed AI support</span>
          <span><CheckCircle2 /> Care continuity across facilities</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card-head">
          <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create an account'}</p>
          <h2>{mode === 'login' ? 'Sign in to your care portal' : 'Join the connected care network'}</h2>
          <p>{mode === 'login' ? 'Choose your stakeholder role before signing in.' : 'Tell us how you will use Swasthya Setu.'}</p>
        </div>

        <form onSubmit={submit}>
          <label>I am a</label>
          <div className="role-picker">
            {labels.map(x => (
              <button type="button" className={cn(role === x.role && 'active')} onClick={() => setRole(x.role)} key={x.role}>
                <b>{x.label}</b>
                <small>{x.detail}</small>
              </button>
            ))}
          </div>

          {mode === 'register' && (
            <>
              <label>Full name</label>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
              {role === 'patient' && (
                <div className="form-row">
                  <div>
                    <label>Mobile number</label>
                    <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile" />
                  </div>
                  <div>
                    <label>Village / locality</label>
                    <input required value={village} onChange={e => setVillage(e.target.value)} placeholder="Your village" />
                  </div>
                </div>
              )}
            </>
          )}

          <label>Email address</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />

          <label>Password</label>
          <input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />

          {error && <p className="auth-error"><AlertTriangle /> {error}</p>}

          <button className="primary auth-submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create secure account'}
          </button>
        </form>

        {mode === 'login' && (
          <button className="demo-link" onClick={useDemo}>Use demo account for selected role</button>
        )}

        <p className="auth-switch">
          {mode === 'login' ? 'New to Swasthya Setu?' : 'Already have an account?'} {' '}
          <button onClick={() => location.hash = mode === 'login' ? '/register' : '/login'}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  );
}

function PatientView({ p, data, tab, setTab, action, setNotice }: any) {
  const [symptoms, setSymptoms] = useState('');
  const [listening, setListening] = useState(false);
  
  // Appointment form state
  const [selectedDoctorId, setSelectedDoctorId] = useState(data.doctors[0]?.id || 'doc-1');
  const [medicalHistory, setMedicalHistory] = useState(p.medicalHistory || '');
  const [isEmergency, setIsEmergency] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string; size: number; dataUrl?: string }[]>([]);

  useEffect(() => {
    if (p?.medicalHistory && !medicalHistory) {
      setMedicalHistory(p.medicalHistory);
    }
  }, [p]);

  const booked = data.appointments.find((a: any) => a.patientId === p.id && a.status === 'booked');

  const speak = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setSymptoms(x => x || 'Voice input is not supported here. Please type your symptoms.');
      setNotice('Voice input is unavailable in this browser; you can still type your symptoms.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => setSymptoms(x => [x, event.results[0][0].transcript].filter(Boolean).join(', '));
    recognition.start();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type || 'application/pdf',
            size: file.size,
            dataUrl: event.target?.result as string
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleBookAppointment = async () => {
    await action('/appointments', {
      patientId: p.id,
      doctorId: selectedDoctorId,
      medicalHistory,
      attachments,
      isEmergency
    }, isEmergency 
      ? 'EMERGENCY appointment booked successfully! Notification sent to healthcare worker and doctor.' 
      : 'Appointment booked successfully! Notification sent to healthcare worker and doctor.');
    
    // Redirect directly to Home page upon booking appointment
    setTab('home');
  };

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Your health, closer to home</p>
          <h1>Care that travels<br /><i>the last mile.</i></h1>
          <p>Book care, share your story in your language, and stay connected with your health team.</p>
          <div className="actions">
            <button className="primary" onClick={() => setTab('book')}><Calendar /> Book an appointment</button>
            <button className="outline" onClick={() => setTab('intake')}><Mic /> Start health check</button>
          </div>
        </div>
        <div className="hero-card">
          <div className="pulse"><HeartPulse /></div>
          <b>Good morning, {p.name.split(' ')[0]}</b>
          <span>Age: {p.age} · {p.sex} · {p.village}</span>
          {p.medicalCondition && (
            <small style={{ color: '#1b7562', background: '#ecf7f2', padding: '4px 6px', borderRadius: '4px', marginTop: '4px' }}>
              Condition: {p.medicalCondition}
            </small>
          )}
          <button className="consent" onClick={() => setNotice('Care, referral and reminder consent is active. You can revoke it through your care facility.')}>
            <CheckCircle2 /> Care consent active
          </button>
        </div>
      </section>

      <main className="content">
        <div className="quick">
          {[
            ['book', 'Book care', Calendar],
            ['intake', 'Health check', ClipboardList],
            ['records', 'My health record', HeartPulse],
            ['facilities', 'Nearby care', MapPin]
          ].map(([id, label, Icon]: any) => (
            <button className={cn(tab === id && 'active')} onClick={() => setTab(id)} key={id}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {tab === 'home' && (
          <>
            <section className="section-title">
              <div>
                <p className="eyebrow">Your next step</p>
                <h2>{booked ? 'Your visit is confirmed' : 'Find the right care today'}</h2>
              </div>
            </section>
            {booked ? <AppointmentCard appointment={booked} data={data} /> : <Empty onClick={() => setTab('book')} />}
            <section className="split">
              <article className="card">
                <p className="eyebrow">Care journey</p>
                <h3>Everything in one place</h3>
                <div className="journey">
                  <span className="done">1</span><b>Register</b><ChevronRight />
                  <span className="done">2</span><b>Health check</b><ChevronRight />
                  <span>3</span><b>Doctor visit</b><ChevronRight />
                  <span>4</span><b>Follow-up</b>
                </div>
              </article>
              <article className="support">
                <Video />
                <div>
                  <b>Need specialist care?</b>
                  <p>Our health worker can help you connect to a doctor remotely.</p>
                </div>
                <ChevronRight />
              </article>
            </section>
          </>
        )}

        {tab === 'book' && (
          <section className="form-card">
            <p className="eyebrow">Appointment booking</p>
            <h2>Book care with your health centre</h2>
            
            <div className="facility">
              <Hospital />
              <div>
                <b>{data.facility.name}</b>
                <span>{data.facility.distance} away · {data.facility.services.join(' · ')}</span>
              </div>
              <span className="tag">Open</span>
            </div>

            {/* Medical Emergency Toggle */}
            <div className="emergency-card">
              <label className="emergency-card-head">
                <input 
                  type="checkbox" 
                  checked={isEmergency} 
                  onChange={e => setIsEmergency(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                />
                <div>
                  <b>Is this a Medical Emergency?</b>
                  <span>Select doctor directly & receive high-priority queue token #1 for immediate clinician review.</span>
                </div>
              </label>
              {isEmergency && (
                <div className="tag-emergency">
                  <AlertTriangle style={{ width: '14px', height: '14px' }} /> Urgent Emergency Priority Selected
                </div>
              )}
            </div>

            {/* Doctor Selection */}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, margin: '20px 0 8px' }}>
              Select Care Professional / Doctor:
            </label>
            <div className="doctor-list">
              {data.doctors.map((d: any) => (
                <button 
                  type="button"
                  className={cn(selectedDoctorId === d.id && 'active')} 
                  onClick={() => setSelectedDoctorId(d.id)} 
                  key={d.id}
                  style={selectedDoctorId === d.id ? { border: '2px solid #1b7562', background: '#eff8f4' } : {}}
                >
                  <span className="avatar">{d.name.slice(4, 5)}</span>
                  <div>
                    <b>{d.name}</b>
                    <small>{d.specialty} · {d.availability}</small>
                  </div>
                  {selectedDoctorId === d.id && <CheckCircle2 style={{ color: '#1b7562' }} />}
                </button>
              ))}
            </div>

            {/* Medical History Section */}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, margin: '22px 0 8px' }}>
              1. Patient Medical History (Pre-existing Conditions, Allergies, Surgeries):
            </label>
            <textarea 
              value={medicalHistory} 
              onChange={e => setMedicalHistory(e.target.value)} 
              placeholder="E.g., Hypertension for 3 years, allergic to Penicillin, asthma, previous pregnancy complications..."
              style={{ minHeight: '90px' }}
            />

            {/* Document / PDF Attachment Section */}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, margin: '22px 0 8px' }}>
              2. Attach Medical Reports & Documents (PDF, Images, Diagnostic Files):
            </label>
            <label className="file-dropzone">
              <Upload />
              <p>Click to browse & attach PDF, Lab Reports, or Prescriptions</p>
              <small>Supports PDF, PNG, JPG, DOC up to 10MB (Passed to Health Worker & Doctor)</small>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileUpload} />
            </label>

            {attachments.length > 0 && (
              <div className="file-chip-list">
                {attachments.map((att, idx) => (
                  <div className="file-chip" key={idx}>
                    <FileText />
                    <span><b>{att.name}</b> ({(att.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" className="remove-file" onClick={() => removeAttachment(idx)}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="actions" style={{ marginTop: '24px' }}>
              <button className="primary" onClick={handleBookAppointment} style={{ width: '100%', padding: '14px', justifyContent: 'center' }}>
                {isEmergency ? 'Submit Emergency Appointment' : 'Submit Appointment & Notify Healthcare Worker'}
              </button>
            </div>
          </section>
        )}

        {tab === 'intake' && (
          <section className="form-card intake">
            <p className="eyebrow">Guided health check</p>
            <h2>Tell us how you’re feeling</h2>
            <div className="ai-safe">
              <AlertTriangle />
              <span>AI prepares this for your doctor. It is <b>not a diagnosis</b> and stays pending until a clinician verifies it.</span>
            </div>
            <label>What is bothering you today?</label>
            <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="For example: fever for two days, coughing, headache…" />
            <div className="chips">
              {['Fever', 'Pain', 'Cough / breathing', 'Pregnancy', 'Medicine refill'].map(s => (
                <button onClick={() => setSymptoms(x => x ? `${x}, ${s}` : s)} key={s}>{s}</button>
              ))}
            </div>
            <div className="actions">
              <button className="voice" onClick={speak}><Mic /> {listening ? 'Listening…' : 'Speak instead'}</button>
              <button className="primary" disabled={!symptoms.trim()} onClick={() => action('/intakes', { patientId: p.id, appointmentId: booked?.id, symptoms: symptoms.split(',').map((s: string) => s.trim()).filter(Boolean) }, 'Health check submitted for clinician review.')}>
                Continue to review <ChevronRight />
              </button>
            </div>
          </section>
        )}

        {tab === 'records' && (
          <section className="form-card">
            <p className="eyebrow">Longitudinal health record</p>
            <h2>{p.name}'s health timeline</h2>
            {data.appointments.filter((x: any) => x.patientId === p.id).map((x: any) => (
              <div className="timeline" key={x.id}>
                <div className="timeline-icon"><Calendar /></div>
                <div>
                  <b>Appointment booked {x.isEmergency && <span className="tag-emergency">Emergency</span>}</b>
                  <p>Doctor: {data.doctors.find((d: any) => d.id === x.doctorId)?.name || 'General Specialist'}</p>
                  {x.medicalHistory && <p><b>History:</b> {x.medicalHistory}</p>}
                  {x.precautions && (
                    <div className="precaution-box" style={{ marginTop: '8px' }}>
                      <b><CheckCircle2 style={{ width: '15px', height: '15px' }} /> Health Worker Verified Instructions:</b>
                      <p>{x.precautions}</p>
                    </div>
                  )}
                  {x.attachments?.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      {x.attachments.map((att: any, i: number) => (
                        <button key={i} type="button" className="download-btn" onClick={() => triggerDownload(att.dataUrl || '', att.name)}>
                          <Download /> Download {att.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {data.intakes.filter((x: any) => x.patientId === p.id).map((x: any) => (
              <div className="timeline" key={x.id}>
                <div className="timeline-icon"><ClipboardList /></div>
                <div>
                  <b>AI clinical intake <span className={cn('status', x.status)}>{x.status.replace('_', ' ')}</span></b>
                  <p>{x.summary}</p>
                  {x.redFlags.length > 0 && <small className="danger"><AlertTriangle /> {x.redFlags.join(', ')}</small>}
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === 'facilities' && (
          <section className="form-card">
            <p className="eyebrow">Nearby services</p>
            <h2>Care near Kheriya</h2>
            <div className="facility">
              <Hospital />
              <div>
                <b>{data.facility.name}</b>
                <span>{data.facility.distance} · {data.facility.bedsAvailable} beds available</span>
              </div>
              <button className="outline" onClick={() => window.open('https://www.google.com/maps/search/?api=1&query=primary+health+centre+near+Kheriya', '_blank', 'noopener,noreferrer')}>Directions</button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Empty({ onClick }: any) {
  return (
    <article className="empty">
      <div><Calendar /></div>
      <h3>No appointment yet</h3>
      <p>Start with a visit at your nearby health centre.</p>
      <button className="primary" onClick={onClick}>Find care <ChevronRight /></button>
    </article>
  );
}

function AppointmentCard({ appointment, data }: any) {
  const d = data.doctors.find((x: any) => x.id === appointment.doctorId);
  return (
    <article className="appointment">
      <div className="token">
        <small>Your token</small>
        <b>#{appointment.token}</b>
        <span>{appointment.isEmergency ? 'URGENT Emergency' : 'In queue'}</span>
      </div>
      <div>
        <p className="eyebrow">Today · 10:30 AM {appointment.isEmergency && <span className="tag-emergency">Medical Emergency</span>}</p>
        <h3>{d?.name || 'General Doctor'}</h3>
        <p>{d?.specialty || 'General Medicine'} · {data.facility.name}</p>
        {appointment.medicalHistory && (
          <p style={{ fontSize: '12px', color: '#315c52', marginTop: '6px' }}>
            <b>Shared Medical History:</b> {appointment.medicalHistory}
          </p>
        )}

        {/* Display Healthcare Worker Verified Precautions Card on Patient Home Page */}
        {appointment.precautions && (
          <div className="precaution-box">
            <b><CheckCircle2 style={{ width: '15px', height: '15px' }} /> Healthcare Worker Verified Instructions:</b>
            <p>{appointment.precautions}</p>
          </div>
        )}

        {appointment.attachments?.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            {appointment.attachments.map((att: any, idx: number) => (
              <button key={idx} type="button" className="download-btn" onClick={() => triggerDownload(att.dataUrl || '', att.name)}>
                <Download /> Download {att.name}
              </button>
            ))}
          </div>
        )}
        <button className="link" onClick={() => alert(`Visit details\nToken #${appointment.token}\nDoctor: ${d?.name}\nFacility: ${data.facility.name}\nEmergency: ${appointment.isEmergency ? 'YES' : 'NO'}\nWorker Precautions: ${appointment.precautions || 'Pending health worker review'}`)}>
          View visit details <ChevronRight />
        </button>
      </div>
      <button className="video" onClick={() => alert('Assisted teleconsult room requested. A health worker will help connect you when the doctor is ready.')}>
        <Video /> Join assisted visit
      </button>
    </article>
  );
}

function DoctorView({ data, action, setNotice, refresh }: any) {
  const pending = data.intakes.filter((x: any) => x.status === 'pending_review');
  const [selected, setSelected] = useState(pending[0]);
  const [summary, setSummary] = useState(selected?.summary || '');

  useEffect(() => {
    const next = data.intakes.find((x: any) => x.status === 'pending_review');
    setSelected(next);
    setSummary(next?.summary || '');
  }, [data.intakes]);

  if (!selected) {
    return (
      <main className="dashboard">
        <Title eyebrow="Clinician workspace" title="All intakes are reviewed" setNotice={setNotice} />
        <div className="empty">
          <CheckCircle2 />
          <h3>Your review queue is clear</h3>
        </div>
      </main>
    );
  }

  const p = data.patients.find((x: any) => x.id === selected.patientId);
  const appointment = data.appointments?.find((a: any) => a.id === selected.appointmentId || a.patientId === selected.patientId);

  const review = async (status: string) => {
    await fetch(`${api}/intakes/${selected.id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, summary })
    });
    await refresh();
    setNotice(status === 'rejected' ? 'Intake returned for clarification.' : 'Intake verified and recorded.');
  };

  return (
    <main className="dashboard">
      <Title eyebrow="Doctor · Clinical review" title="Verify before it enters the record" setNotice={setNotice} />
      
      {/* Appointment Notification Alert Banner */}
      {data.appointments?.some((a: any) => a.isEmergency) && (
        <div className="notification-alert-banner">
          <Bell />
          <div>
            <b>New Urgent Notification:</b> Emergency patient appointments received in queue. High priority review required.
          </div>
        </div>
      )}

      <div className="doctor-grid">
        <aside className="queue">
          <b>Review queue <span>{pending.length}</span></b>
          {pending.map((x: any) => (
            <button className={selected.id === x.id ? 'active' : ''} onClick={() => { setSelected(x); setSummary(x.summary); }} key={x.id}>
              <span className="avatar">{data.patients.find((p: any) => p.id === x.patientId)?.name[0]}</span>
              <div>
                <b>{data.patients.find((p: any) => p.id === x.patientId)?.name}</b>
                <small>AI intake · pending review</small>
              </div>
            </button>
          ))}
        </aside>

        <section className="review">
          <div className="review-head">
            <div>
              <p className="eyebrow">Patient {p.abhaId && `· ABHA ${p.abhaId}`}</p>
              <h2>{p.name}, {p.age} ({p.sex})</h2>
              <span>Village: {p.village} · Phone: {p.phone}</span>
              {p.medicalCondition && (
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#1b7562' }}>
                  <b>Active Condition:</b> {p.medicalCondition}
                </p>
              )}
            </div>
            <span className="status pending_review">AI-generated · pending review</span>
          </div>

          {selected.redFlags.length > 0 && (
            <div className="redflag">
              <AlertTriangle />
              <div>
                <b>Clinical attention recommended</b>
                <span>{selected.redFlags.join(' · ')}</span>
              </div>
            </div>
          )}

          {/* Health Worker Precautions Display if set */}
          {appointment?.precautions && (
            <div className="precaution-box" style={{ marginTop: '12px' }}>
              <b><ShieldAlert style={{ width: '15px', height: '15px' }} /> Health Worker Issued Precautions:</b>
              <p>{appointment.precautions}</p>
            </div>
          )}

          {/* Submitted Medical History & Documents */}
          {(p.medicalHistory || appointment?.medicalHistory || appointment?.attachments?.length > 0) && (
            <div className="queue-history-box" style={{ marginTop: '16px', background: '#eef8f4' }}>
              <b>Patient Medical History & Profile Data:</b>
              {(p.medicalHistory || appointment?.medicalHistory) && (
                <div style={{ marginTop: '4px' }}>
                  <p style={{ margin: '4px 0' }}>{p.medicalHistory || appointment?.medicalHistory}</p>
                  <button 
                    type="button" 
                    className="download-btn" 
                    onClick={() => triggerDownload(`PATIENT PROFILE & MEDICAL HISTORY\n\nName: ${p.name}\nAge: ${p.age}\nSex: ${p.sex}\nVillage: ${p.village}\nPhone: ${p.phone}\nActive Condition: ${p.medicalCondition || 'N/A'}\nAllergies: ${p.allergies || 'N/A'}\nMedications: ${p.medications || 'N/A'}\n\nMEDICAL HISTORY:\n${p.medicalHistory || appointment?.medicalHistory}\n\nHEALTH WORKER PRECAUTIONS:\n${appointment?.precautions || 'N/A'}`, `Patient_Profile_${p.name.replace(/\s+/g, '_')}.txt`, true)}
                  >
                    <Download /> Download Patient Profile & Description (.txt)
                  </button>
                </div>
              )}
              {appointment?.attachments?.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <b>Attached Reports:</b>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {appointment.attachments.map((att: any, idx: number) => (
                      <button 
                        key={idx} 
                        type="button" 
                        className="download-btn" 
                        onClick={() => triggerDownload(att.dataUrl || '', att.name)}
                      >
                        <Download /> Download {att.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <h3>Reported symptoms</h3>
          <div className="chips static">
            {selected.symptoms.map((s: string) => (
              <span key={s}>{s}</span>
            ))}
          </div>

          <h3>AI-prepared summary</h3>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} />

          <div className="actions">
            <button className="outline" onClick={() => void review('rejected')}>Return for clarification</button>
            <button className="primary" onClick={async () => {
              await review('verified');
              await action('/consultations', {
                patientId: p.id,
                appointmentId: selected.appointmentId,
                diagnosis: ['Clinical review completed'],
                notes: summary,
                medicines: [{ name: 'Paracetamol 500mg', dosage: '1 tablet as needed', days: 3 }]
              }, 'Verified, recorded, and prescription issued.');
            }}>
              <CheckCircle2 /> Verify & issue care plan
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Title({ eyebrow, title, setNotice }: any) {
  return (
    <section className="dash-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <button className="outline" onClick={() => setNotice?.('Dashboard is showing today’s live care data: 24 Aug 2026.')}>
        <Calendar /> 24 Aug 2026
      </button>
    </section>
  );
}

function AdminView({ data, role, setNotice, refresh }: any) {
  const d = data.dashboard;
  const titles = role === 'health_worker' 
    ? ['Frontline health worker', 'Today’s patient care'] 
    : role === 'system_admin' 
    ? ['System administration', 'Network-wide care operations'] 
    : ['Facility administration', 'A clear view of care delivery'];

  const hasNewAppointments = d.queue?.length > 0;
  const [editingPrecautionId, setEditingPrecautionId] = useState<string | null>(null);
  const [precautionText, setPrecautionText] = useState('');
  const [savingPrecaution, setSavingPrecaution] = useState(false);

  const savePrecaution = async (appointmentId: string) => {
    setSavingPrecaution(true);
    try {
      const res = await fetch(`${api}/appointments/${appointmentId}/precaution`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precautions: precautionText })
      });
      if (!res.ok) throw new Error('Failed to save precautions');
      setNotice('Patient condition verified and medical precautions recorded successfully!');
      setEditingPrecautionId(null);
      setPrecautionText('');
      if (refresh) await refresh();
    } catch {
      alert('Error saving precautions');
    } finally {
      setSavingPrecaution(false);
    }
  };

  return (
    <main className="dashboard">
      <Title eyebrow={titles[0]} title={titles[1]} setNotice={setNotice} />

      {/* Appointment Received Notification Banner */}
      {hasNewAppointments && (
        <div className="notification-alert-banner">
          <Bell />
          <div>
            <b>Appointment Notification Received:</b> {d.queue.length} active patient appointment(s) transferred from the patient app. Verify condition & write health precautions below.
          </div>
        </div>
      )}

      <section className="metrics">
        <Metric icon={Users} number={d.kpis.waiting} label="Patients waiting" trend="Live queue" />
        <Metric icon={Activity} number={`${d.kpis.followUpRate}%`} label="Follow-ups complete" trend="This month" />
        <Metric icon={Video} number={d.kpis.teleconsults} label="Teleconsults" trend="This month" />
        <Metric icon={PackageCheck} number="1" label="Low stock alert" trend="Review needed" warn />
      </section>

      <div className="admin-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Live patient queue & Transfers</h3>
              <p>Seva Rural Health Centre · Verify patient condition & set precautions</p>
            </div>
            <button className="link" onClick={() => setNotice(`There are ${d.queue.length} patients in the live queue.`)}>View all</button>
          </div>

          {d.queue.map((q: any) => {
            const p = data.patients?.find((pat: any) => pat.id === q.patientId) || {};
            const isEditingThis = editingPrecautionId === q.id;

            return (
              <div className="queue-row" key={q.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <b className="token-mini">#{q.token}</b>
                  <div style={{ flex: 1 }}>
                    <b>
                      {q.patient} {p.age ? `(${p.age}y)` : ''}{' '}
                      {q.isEmergency && <span className="tag-emergency">Emergency Priority</span>}{' '}
                      {q.verifiedByWorker && <span className="tag-verified"><CheckCircle2 style={{ width: '12px', height: '12px' }} /> Verified</span>}
                    </b>
                    <small>Attending doctor: {q.doctor || 'General Medicine'} · Village: {p.village || 'Kheriya'}</small>
                  </div>
                  <span className="tag" style={q.isEmergency ? { background: '#ffe3db', color: '#c93d16' } : {}}>
                    {q.isEmergency ? 'URGENT' : 'Waiting'}
                  </span>
                </div>

                {/* Display Patient Medical History & File Attachments */}
                {(q.medicalHistory || p.medicalHistory || p.medicalCondition || q.attachments?.length > 0) && (
                  <div className="queue-history-box">
                    {(p.medicalCondition || q.medicalHistory || p.medicalHistory) && (
                      <div style={{ marginBottom: '8px' }}>
                        {p.medicalCondition && <p style={{ margin: '2px 0 4px', fontWeight: 600, color: '#165b4c' }}>Condition: {p.medicalCondition}</p>}
                        {(q.medicalHistory || p.medicalHistory) && (
                          <p style={{ margin: '3px 0 6px 0', lineHeight: 1.45 }}>
                            <b>History:</b> {q.medicalHistory || p.medicalHistory}
                          </p>
                        )}
                        <button 
                          type="button" 
                          className="download-btn" 
                          onClick={() => triggerDownload(`PATIENT MEDICAL PROFILE & HISTORY DESCRIPTION\n\nPatient Name: ${q.patient}\nAge: ${p.age || 'N/A'}\nGender: ${p.sex || 'N/A'}\nVillage: ${p.village || 'N/A'}\nPhone: ${p.phone || 'N/A'}\nAssigned Doctor: ${q.doctor || 'General Medicine'}\nPriority: ${q.isEmergency ? 'URGENT EMERGENCY' : 'STANDARD'}\n\nACTIVE MEDICAL CONDITION:\n${p.medicalCondition || 'N/A'}\n\nMEDICAL HISTORY & PRE-EXISTING CONDITIONS:\n${q.medicalHistory || p.medicalHistory || 'N/A'}\n\nALLERGIES: ${p.allergies || 'N/A'}\nMEDICATIONS: ${p.medications || 'N/A'}`, `Patient_Medical_Profile_${q.patient.replace(/\s+/g, '_')}.txt`, true)}
                        >
                          <Download /> Download Patient Profile (.txt)
                        </button>
                      </div>
                    )}

                    {q.attachments?.length > 0 && (
                      <div>
                        <b>Attached Reports & Documents ({q.attachments.length}):</b>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {q.attachments.map((att: any, idx: number) => (
                            <button 
                              key={idx} 
                              type="button" 
                              className="download-btn" 
                              onClick={() => triggerDownload(att.dataUrl || '', att.name)}
                            >
                              <Download /> Download {att.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Health Worker Precaution Display & Verification Form */}
                {q.precautions && (
                  <div className="precaution-box">
                    <b><CheckCircle2 style={{ width: '14px', height: '14px' }} /> Verified Health Worker Instructions & Precautions:</b>
                    <p>{q.precautions}</p>
                  </div>
                )}

                {!isEditingThis ? (
                  <div style={{ marginTop: '8px' }}>
                    <button 
                      type="button" 
                      className="outline small"
                      onClick={() => {
                        setEditingPrecautionId(q.id);
                        setPrecautionText(q.precautions || '');
                      }}
                    >
                      <ShieldAlert style={{ width: '13px', height: '13px' }} /> {q.precautions ? 'Edit Precautions' : 'Verify Condition & Add Precaution'}
                    </button>
                  </div>
                ) : (
                  <div className="verify-form-box">
                    <b style={{ fontSize: '12px', color: '#165b4c' }}>Write Health Care Precautions for {q.patient}:</b>
                    <textarea 
                      value={precautionText} 
                      onChange={e => setPrecautionText(e.target.value)} 
                      placeholder="E.g., Rest in a cool room, drink ORS fluids, monitor BP every 4 hours, take prescribed meds..."
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button type="button" className="outline small" onClick={() => setEditingPrecautionId(null)}>Cancel</button>
                      <button 
                        type="button" 
                        className="primary small" 
                        disabled={savingPrecaution || !precautionText.trim()} 
                        onClick={() => savePrecaution(q.id)}
                      >
                        {savingPrecaution ? 'Saving…' : 'Save & Issue Precaution'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>High-risk follow-up</h3>
              <p>Needs outreach or clinical review</p>
            </div>
            <AlertTriangle className="amber" />
          </div>
          {d.highRisk.map((p: any) => (
            <div className="queue-row" key={p.id}>
              <span className="avatar">{p.name[0]}</span>
              <div>
                <b>{p.name}</b>
                <small>{p.age} years · {p.village}</small>
              </div>
              <button className="outline small" onClick={() => setNotice(`Outreach reminder queued for ${p.name} at ${p.phone}.`)}>Contact</button>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Medicine availability</h3>
              <p>Last synced just now</p>
            </div>
            <PackageCheck />
          </div>
          {d.medicines.map((m: any) => (
            <div className="stock" key={m.name}>
              <div>
                <b>{m.name}</b>
                <small>{m.quantity} units</small>
              </div>
              <span className={m.status === 'Low stock' ? 'low' : 'ok'}>{m.status}</span>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Referral coordination</h3>
              <p>Across connected facilities</p>
            </div>
            <Hospital />
          </div>
          {d.referrals.map((r: any) => (
            <div className="queue-row" key={r.id}>
              <span className="ref-icon"><Stethoscope /></span>
              <div>
                <b>{data.patients.find((p: any) => p.id === r.patientId)?.name}</b>
                <small>{r.reason}</small>
              </div>
              <span className="tag">{r.status}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, number, label, trend, warn }: any) {
  return (
    <article className={cn('metric', warn && 'warn')}>
      <span><Icon /></span>
      <div>
        <b>{number}</b>
        <p>{label}</p>
        <small>{trend}</small>
      </div>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
