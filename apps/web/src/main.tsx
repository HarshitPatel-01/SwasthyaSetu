import { useEffect, useState } from 'react'; import { createRoot } from 'react-dom/client'; import { Activity, AlertTriangle, Bell, Calendar, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, ClipboardList, Clock, ExternalLink, FileText, Filter, FlaskConical, HeartPulse, Hospital, Languages, LogOut, MapPin, Menu, MessageSquare, Mic, MicOff, Navigation, Package, PackageCheck, Pencil, Phone, PhoneCall, Pill, Plus, Printer, RefreshCw, Send, ShieldAlert, Siren, Stethoscope, Trash2, Upload, User, UserCheck, UserCircle, Users, Video, VideoOff, X, Zap } from 'lucide-react';

// CSS is loaded as a bundler side-effect import; TypeScript has no declaration for it.
// @ts-ignore
import './styles.css';
const api = 'http://localhost:4000/api';
const formatBytes = (n:number) => n < 1024*1024 ? `${Math.max(1,Math.round(n/1024))} KB` : `${(n/(1024*1024)).toFixed(1)} MB`;
function openMedicalDocument(doc:any){ try { if(!doc?.id) throw new Error('Medical file is unavailable.'); const win=window.open(`${api}/medical-documents/${encodeURIComponent(doc.id)}/file`,'_blank','noopener,noreferrer'); if(!win) throw new Error('Popup blocked. Allow pop-ups to open this report.'); } catch(e:any){ alert(e.message||'Unable to open this report.'); } }
type Data = any; type Role = 'patient' | 'health_worker' | 'doctor'; const roles: Role[] = ['patient', 'health_worker', 'doctor']; const cn = (...a: (string | boolean | undefined)[]) => a.filter(Boolean).join(' '); const routeFromHash = () => { const [role = 'patient', tab = 'home'] = location.hash.replace(/^#\/?/, '').split('/'); return { role: roles.includes(role as Role) ? role as Role : 'patient', tab: tab || 'home' } }; const authFromHash = () => location.hash.replace(/^#\/?/, '').split('/')[0] as 'login' | 'register' | '';
const GLOBAL_TRANSLATIONS: Record<string, Record<string,string>> = {
  HI: {
'Connecting care, everywhere':'हर जगह स्वास्थ्य सेवा से जुड़ाव','Integrated rural healthcare':'एकीकृत ग्रामीण स्वास्थ्य सेवा','One connected path to ':'बेहतर स्वास्थ्य सेवा के लिए ','better care.':'एक बेहतर रास्ता।','Securely connect patients, community health workers, clinicians, and facilities around the same care record.':'मरीजों, स्वास्थ्य कार्यकर्ताओं, डॉक्टरों और स्वास्थ्य केंद्रों को एक ही स्वास्थ्य रिकॉर्ड से सुरक्षित रूप से जोड़ें।','Consent-led access':'सहमति आधारित पहुंच','Human-reviewed AI support':'मानव द्वारा समीक्षा की गई एआई सहायता','Care continuity across facilities':'विभिन्न स्वास्थ्य केंद्रों में देखभाल की निरंतरता','Welcome back':'वापसी पर स्वागत है','Create an account':'खाता बनाएं','Sign in to your care portal':'अपने स्वास्थ्य पोर्टल में साइन इन करें','Join the connected care network':'जुड़े हुए स्वास्थ्य नेटवर्क से जुड़ें','Choose your stakeholder role before signing in.':'साइन इन करने से पहले अपनी भूमिका चुनें।','Tell us how you will use Swasthya Setu.':'बताएं कि आप स्वास्थ्‍य सेतु का उपयोग कैसे करेंगे।','I am a':'मैं हूँ','Patient':'मरीज','Access your care and records':'अपनी देखभाल और रिकॉर्ड देखें','Health worker':'स्वास्थ्य कार्यकर्ता','Support community care':'सामुदायिक देखभाल में सहायता करें','Doctor / specialist':'डॉक्टर / विशेषज्ञ','Review and consult':'समीक्षा और परामर्श करें','Facility admin':'स्वास्थ्य केंद्र व्यवस्थापक','Coordinate local services':'स्थानीय सेवाओं का समन्वय करें','System admin':'सिस्टम व्यवस्थापक','Manage the care network':'स्वास्थ्य नेटवर्क प्रबंधित करें','Full name':'पूरा नाम','Your full name':'आपका पूरा नाम','Mobile number':'मोबाइल नंबर','10-digit mobile':'10 अंकों का मोबाइल','Village / locality':'गांव / क्षेत्र','Your village':'आपका गांव','Email address':'ईमेल पता','Password':'पासवर्ड','At least 6 characters':'कम से कम 6 अक्षर','Please wait…':'कृपया प्रतीक्षा करें…','Sign in securely':'सुरक्षित रूप से साइन इन करें','Create secure account':'सुरक्षित खाता बनाएं','Use demo account for selected role':'चयनित भूमिका के लिए डेमो खाता उपयोग करें','New to Swasthya Setu?':'स्वास्थ्य सेतु पर नए हैं?','Already have an account?':'पहले से खाता है?','Sign out':'साइन आउट','Go to authorised home':'अधिकृत होम पर जाएं','Open navigation':'नेविगेशन खोलें','Directions':'दिशा-निर्देश','Open':'खोलें','Shared':'साझा','Shared with care team':'देखभाल टीम के साथ साझा','Consent-led':'सहमति आधारित','Connected patient context':'जुड़ा हुआ मरीज संदर्भ','Reports shared by patients':'मरीजों द्वारा साझा रिपोर्ट','Medical conditions':'चिकित्सीय स्थितियां','Medical history':'चिकित्सीय इतिहास','Current medicines':'वर्तमान दवाएं','Current condition':'वर्तमान स्थिति','Appointments':'अपॉइंटमेंट','Referrals':'रेफरल','Consultations':'परामर्श','Prescriptions':'प्रिस्क्रिप्शन','History':'इतिहास','Referral':'रेफरल','No appointments recorded yet.':'अभी कोई अपॉइंटमेंट दर्ज नहीं है।','No referrals recorded yet.':'अभी कोई रेफरल दर्ज नहीं है।','No medical reports added yet':'अभी कोई मेडिकल रिपोर्ट नहीं जोड़ी गई है','Upload blood reports, lab results, prescriptions, scans or discharge documents. Shared records are available to your health worker and doctor.':'ब्लड रिपोर्ट, लैब परिणाम, प्रिस्क्रिप्शन, स्कैन या डिस्चार्ज दस्तावेज अपलोड करें। साझा रिकॉर्ड आपके स्वास्थ्य कार्यकर्ता और डॉक्टर को उपलब्ध होंगे।','My medical information':'मेरी चिकित्सीय जानकारी','Save medical information':'चिकित्सीय जानकारी सहेजें','Remove report':'रिपोर्ट हटाएं','AI Assistant':'एआई सहायक','What can I help with?':'मैं आपकी किस तरह मदद कर सकता हूं?','What should I take to my appointment?':'अपॉइंटमेंट पर मुझे क्या ले जाना चाहिए?','How do I read my report?':'मैं अपनी रिपोर्ट कैसे पढ़ूं?','What happens during a consultation?':'परामर्श के दौरान क्या होता है?','Your token':'आपका टोकन','Cancel appointment':'अपॉइंटमेंट रद्द करें','View visit details':'विज़िट विवरण देखें','Join assisted visit':'सहायता प्राप्त विज़िट में शामिल हों','Find care':'देखभाल खोजें','No appointment yet':'अभी कोई अपॉइंटमेंट नहीं','Start with a visit at your nearby health centre.':'अपने नजदीकी स्वास्थ्य केंद्र पर विज़िट से शुरुआत करें।','Live patient queue':'लाइव मरीज कतार','Patients waiting':'प्रतीक्षा कर रहे मरीज','Follow-ups complete':'पूर्ण फॉलो-अप','Teleconsults':'टेलीपरामर्श','Low stock alert':'कम स्टॉक अलर्ट','Review queue':'समीक्षा कतार','Your review queue is clear':'आपकी समीक्षा कतार खाली है','Verify & issue care plan':'सत्यापित करें और देखभाल योजना जारी करें','Return for clarification':'स्पष्टीकरण के लिए वापस भेजें','Contact':'संपर्क करें','View all':'सभी देखें','High-risk follow-up':'उच्च जोखिम फॉलो-अप','Needs outreach or clinical review':'संपर्क या चिकित्सीय समीक्षा आवश्यक','Medicine availability':'दवा उपलब्धता','Last synced just now':'अभी सिंक किया गया','Referral coordination':'रेफरल समन्वय','Across connected facilities':'जुड़े हुए स्वास्थ्य केंद्रों में','Waiting':'प्रतीक्षा','Loading rural care network…':'ग्रामीण स्वास्थ्य नेटवर्क लोड हो रहा है…','Opening your authorised workspace…':'आपका अधिकृत कार्यक्षेत्र खोला जा रहा है…','Redirecting to secure sign in…':'सुरक्षित साइन इन पर भेजा जा रहा है…','Patient record unavailable. Please sign in again.':'मरीज का रिकॉर्ड उपलब्ध नहीं है। कृपया फिर से साइन इन करें।','Precautions':'सावधानियां','Active precaution':'सक्रिय सावधानी','Resolve precaution':'सावधानी पूरी हुई','No precautions from your care team yet.':'आपकी देखभाल टीम से अभी कोई सावधानी नहीं है।','Send precaution':'सावधानी भेजें','Precaution message':'सावधानी संदेश','Write guidance for the patient…':'मरीज के लिए निर्देश लिखें…','Patient has resolved this precaution.':'मरीज ने इस सावधानी को पूरा कर दिया है।','Language':'भाषा','English':'अंग्रेज़ी','Hindi':'हिन्दी','Tamil':'तमिल'
},
  TA: {
'Connecting care, everywhere':'எங்கும் பராமரிப்பை இணைக்கிறது','Integrated rural healthcare':'ஒருங்கிணைந்த கிராமப்புற சுகாதாரம்','One connected path to ':'சிறந்த சுகாதாரத்திற்கான ','better care.':'ஒரே இணைந்த பாதை.','Securely connect patients, community health workers, clinicians, and facilities around the same care record.':'நோயாளிகள், சுகாதார பணியாளர்கள், மருத்துவர்கள் மற்றும் மையங்களை ஒரே சுகாதார பதிவுடன் பாதுகாப்பாக இணைக்கவும்.','Consent-led access':'ஒப்புதல் அடிப்படையிலான அணுகல்','Human-reviewed AI support':'மனிதர் மதிப்பாய்வு செய்யும் AI உதவி','Care continuity across facilities':'மையங்களுக்கிடையேயான தொடர்ச்சியான பராமரிப்பு','Welcome back':'மீண்டும் வரவேற்கிறோம்','Create an account':'கணக்கை உருவாக்கவும்','Sign in to your care portal':'உங்கள் பராமரிப்பு தளத்தில் உள்நுழையவும்','Join the connected care network':'இணைந்த பராமரிப்பு வலையமைப்பில் சேரவும்','Choose your stakeholder role before signing in.':'உள்நுழைவதற்கு முன் உங்கள் பங்கைத் தேர்ந்தெடுக்கவும்.','Tell us how you will use Swasthya Setu.':'Swasthya Setu-ஐ எவ்வாறு பயன்படுத்துவீர்கள் என்று சொல்லுங்கள்.','I am a':'நான்','Patient':'நோயாளர்','Access your care and records':'உங்கள் பராமரிப்பு மற்றும் பதிவுகளை அணுகவும்','Health worker':'சுகாதார பணியாளர்','Support community care':'சமூக பராமரிப்புக்கு உதவவும்','Doctor / specialist':'மருத்துவர் / நிபுணர்','Review and consult':'மதிப்பாய்வு மற்றும் ஆலோசனை','Facility admin':'மைய நிர்வாகி','Coordinate local services':'உள்ளூர் சேவைகளை ஒருங்கிணைக்கவும்','System admin':'கணினி நிர்வாகி','Manage the care network':'பராமரிப்பு வலையமைப்பை நிர்வகிக்கவும்','Full name':'முழுப் பெயர்','Your full name':'உங்கள் முழுப் பெயர்','Mobile number':'மொபைல் எண்','10-digit mobile':'10 இலக்க மொபைல்','Village / locality':'கிராமம் / பகுதி','Your village':'உங்கள் கிராமம்','Email address':'மின்னஞ்சல் முகவரி','Password':'கடவுச்சொல்','At least 6 characters':'குறைந்தது 6 எழுத்துகள்','Please wait…':'காத்திருக்கவும்…','Sign in securely':'பாதுகாப்பாக உள்நுழையவும்','Create secure account':'பாதுகாப்பான கணக்கை உருவாக்கவும்','Use demo account for selected role':'தேர்ந்தெடுத்த பங்கிற்கான டெமோ கணக்கைப் பயன்படுத்தவும்','New to Swasthya Setu?':'Swasthya Setu-க்கு புதியவரா?','Already have an account?':'ஏற்கனவே கணக்கு உள்ளதா?','Sign out':'வெளியேறு','Go to authorised home':'அங்கீகரிக்கப்பட்ட முகப்புக்குச் செல்லவும்','Open navigation':'வழிசெலுத்தலைத் திறக்கவும்','Directions':'வழிகள்','Open':'திற','Shared':'பகிரப்பட்டது','Shared with care team':'பராமரிப்பு குழுவுடன் பகிரப்பட்டது','Consent-led':'ஒப்புதல் அடிப்படையில்','Connected patient context':'இணைந்த நோயாளர் தகவல்','Reports shared by patients':'நோயாளிகள் பகிர்ந்த அறிக்கைகள்','Medical conditions':'மருத்துவ நிலைகள்','Medical history':'மருத்துவ வரலாறு','Current medicines':'தற்போதைய மருந்துகள்','Current condition':'தற்போதைய நிலை','Appointments':'சந்திப்புகள்','Referrals':'பரிந்துரைகள்','Consultations':'ஆலோசனைகள்','Prescriptions':'மருந்துச் சீட்டுகள்','History':'வரலாறு','Referral':'பரிந்துரை','No appointments recorded yet.':'இன்னும் சந்திப்புகள் பதிவு செய்யப்படவில்லை.','No referrals recorded yet.':'இன்னும் பரிந்துரைகள் இல்லை.','No medical reports added yet':'இன்னும் மருத்துவ அறிக்கைகள் சேர்க்கப்படவில்லை','Upload blood reports, lab results, prescriptions, scans or discharge documents. Shared records are available to your health worker and doctor.':'இரத்த அறிக்கைகள், ஆய்வக முடிவுகள், மருந்துச் சீட்டுகள், ஸ்கேன்கள் அல்லது வெளியேற்ற ஆவணங்களைப் பதிவேற்றவும். பகிரப்பட்ட பதிவுகள் உங்கள் சுகாதார பணியாளர் மற்றும் மருத்துவருக்கு கிடைக்கும்.','My medical information':'எனது மருத்துவ தகவல்','Save medical information':'மருத்துவ தகவலைச் சேமிக்கவும்','Remove report':'அறிக்கையை நீக்கு','AI Assistant':'AI உதவியாளர்','What can I help with?':'நான் எவ்வாறு உதவலாம்?','What should I take to my appointment?':'சந்திப்பிற்கு என்ன எடுத்துச் செல்ல வேண்டும்?','How do I read my report?':'எனது அறிக்கையை எப்படி படிப்பது?','What happens during a consultation?':'ஆலோசனையின் போது என்ன நடக்கும்?','Your token':'உங்கள் டோக்கன்','Cancel appointment':'சந்திப்பை ரத்து செய்','View visit details':'சந்திப்பு விவரங்களைக் காண்க','Join assisted visit':'உதவி சந்திப்பில் சேரவும்','Find care':'பராமரிப்பைக் கண்டறியவும்','No appointment yet':'இன்னும் சந்திப்பு இல்லை','Start with a visit at your nearby health centre.':'அருகிலுள்ள சுகாதார மையத்தில் சந்திப்புடன் தொடங்கவும்.','Live patient queue':'நேரடி நோயாளர் வரிசை','Patients waiting':'காத்திருக்கும் நோயாளிகள்','Follow-ups complete':'முடிந்த பின்தொடர்வுகள்','Teleconsults':'தொலை ஆலோசனைகள்','Low stock alert':'குறைந்த இருப்பு எச்சரிக்கை','Review queue':'மதிப்பாய்வு வரிசை','Your review queue is clear':'உங்கள் மதிப்பாய்வு வரிசை காலியாக உள்ளது','Verify & issue care plan':'சரிபார்த்து பராமரிப்பு திட்டத்தை வழங்கவும்','Return for clarification':'விளக்கத்திற்காக திருப்பவும்','Contact':'தொடர்பு','View all':'அனைத்தையும் காண்க','High-risk follow-up':'அதிக ஆபத்து பின்தொடர்வு','Needs outreach or clinical review':'தொடர்பு அல்லது மருத்துவ மதிப்பாய்வு தேவை','Medicine availability':'மருந்து கிடைப்புத் தன்மை','Last synced just now':'இப்போது ஒத்திசைக்கப்பட்டது','Referral coordination':'பரிந்துரை ஒருங்கிணைப்பு','Across connected facilities':'இணைந்த மையங்களில்','Waiting':'காத்திருக்கிறது','Loading rural care network…':'கிராமப்புற பராமரிப்பு வலையமைப்பு ஏற்றப்படுகிறது…','Opening your authorised workspace…':'உங்கள் அங்கீகரிக்கப்பட்ட பணியிடம் திறக்கப்படுகிறது…','Redirecting to secure sign in…':'பாதுகாப்பான உள்நுழைவுக்கு மாற்றப்படுகிறது…','Patient record unavailable. Please sign in again.':'நோயாளர் பதிவு கிடைக்கவில்லை. மீண்டும் உள்நுழையவும்.','Precautions':'முன்னெச்சரிக்கைகள்','Active precaution':'செயலில் உள்ள முன்னெச்சரிக்கை','Resolve precaution':'முன்னெச்சரிக்கையை முடித்ததாகக் குறிக்கவும்','No precautions from your care team yet.':'உங்கள் பராமரிப்பு குழுவிடமிருந்து முன்னெச்சரிக்கைகள் இல்லை.','Send precaution':'முன்னெச்சரிக்கை அனுப்பவும்','Precaution message':'முன்னெச்சரிக்கை செய்தி','Write guidance for the patient…':'நோயாளிக்கான வழிகாட்டுதலை எழுதவும்…','Patient has resolved this precaution.':'நோயாளர் இந்த முன்னெச்சரிக்கையை முடித்துள்ளார்.','Language':'மொழி','English':'ஆங்கிலம்','Hindi':'இந்தி','Tamil':'தமிழ்'
}
};

const EXTRA_TRANSLATIONS: Record<string, Record<string,string>> = {
  HI: {
'Profile':'प्रोफाइल','Edit profile':'प्रोफाइल संपादित करें','Update your personal details':'अपनी व्यक्तिगत जानकारी अपडेट करें','Choose your interface language':'इंटरफेस की भाषा चुनें','Account':'खाता','Signed-in account':'साइन इन किया हुआ खाता','Save profile':'प्रोफाइल सहेजें','Cancel editing':'संपादन रद्द करें','Saving…':'सहेजा जा रहा है…','Profile successfully updated.':'प्रोफाइल सफलतापूर्वक अपडेट हुई।','Profile updated successfully.':'प्रोफाइल सफलतापूर्वक अपडेट हुई।','Dashboard':'डैशबोर्ड','Today’s patient care':'आज के मरीजों की देखभाल','Connected care mode':'जुड़ी हुई देखभाल','Patient context, reports, referrals and precautions stay connected across the care journey.':'मरीज की जानकारी, रिपोर्ट, रेफरल और सावधानियां पूरी देखभाल यात्रा में जुड़ी रहती हैं।','Open patient workspace':'मरीज कार्यक्षेत्र खोलें','Open live queue':'लाइव कतार खोलें','Care continuity':'देखभाल की निरंतरता','Open requests':'खुले अनुरोध','Review medicines':'दवाओं की समीक्षा करें','Emergency response':'आपातकालीन प्रतिक्रिया','Patients calling for urgent help':'तत्काल सहायता के लिए कॉल करने वाले मरीज','Every emergency request is routed to the nearest available healthcare worker. Review the caller, location and assigned responder here.':'हर आपातकालीन अनुरोध निकटतम उपलब्ध स्वास्थ्य कार्यकर्ता को भेजा जाता है। यहां कॉल करने वाले, स्थान और नियुक्त स्वास्थ्य कार्यकर्ता की समीक्षा करें।','active calls':'सक्रिय कॉल','assigned/visible urgent requests':'नियुक्त/दिख रहे जरूरी अनुरोध','No active emergency calls right now.':'अभी कोई सक्रिय आपातकालीन कॉल नहीं है।','When a patient presses the emergency button, their request will appear here.':'जब मरीज आपातकालीन बटन दबाएगा, उसका अनुरोध यहां दिखाई देगा।','Refresh emergency calls':'आपातकालीन कॉल रीफ्रेश करें','Location':'स्थान','Call patient':'मरीज को कॉल करें','Handled':'निपटाया गया','No healthcare worker available · default emergency 112':'कोई स्वास्थ्य कार्यकर्ता उपलब्ध नहीं · डिफ़ॉल्ट आपातकालीन नंबर 112','No healthcare worker was available, so emergency services (112) will be called now.':'कोई स्वास्थ्य कार्यकर्ता उपलब्ध नहीं था, इसलिए अब आपातकालीन सेवा (112) को कॉल किया जाएगा।','Assisted care':'सहायता प्राप्त देखभाल','Teleconsult requests':'टेलीपरामर्श अनुरोध','Live requests created by patients from confirmed appointments.':'पुष्ट अपॉइंटमेंट से मरीजों द्वारा बनाए गए लाइव अनुरोध।','total':'कुल','Connect':'कनेक्ट करें','Complete':'पूरा करें','No teleconsult requests yet.':'अभी कोई टेलीपरामर्श अनुरोध नहीं है।','Frontline response':'फ्रंटलाइन प्रतिक्रिया','Live patient queue':'लाइव मरीज कतार','Patients currently waiting for care at Seva Rural Health Centre.':'सेवा ग्रामीण स्वास्थ्य केंद्र में देखभाल के लिए प्रतीक्षा कर रहे मरीज।','Show less':'कम दिखाएं','View all':'सभी देखें','No patients are waiting right now.':'अभी कोई मरीज प्रतीक्षा में नहीं है।','View patient':'मरीज देखें','Escalation':'एस्केलेशन','High-risk follow-up':'उच्च जोखिम फॉलो-अप','Cases that need outreach or clinical review.':'ऐसे मामले जिन्हें संपर्क या चिकित्सीय समीक्षा की जरूरत है।','No high-risk follow-up cases.':'कोई उच्च जोखिम फॉलो-अप मामला नहीं है।','Pharmacy coordination':'फार्मेसी समन्वय','Medicine availability':'दवा उपलब्धता','Review stock before advising a patient where to collect medicines.':'मरीज को दवा कहां से लेनी है बताने से पहले स्टॉक की समीक्षा करें।','Low stock':'कम स्टॉक','In stock':'स्टॉक में','units available':'यूनिट उपलब्ध','threshold':'सीमा','Hide stock':'स्टॉक छिपाएं','Review stock':'स्टॉक की समीक्षा करें','Referral coordination':'रेफरल समन्वय','Across connected facilities':'जुड़े हुए स्वास्थ्य केंद्रों में','No referrals recorded yet.':'अभी कोई रेफरल दर्ज नहीं है।','Create referral':'रेफरल बनाएं','Refer patient':'मरीज को रेफर करें','Select patient':'मरीज चुनें','Select a patient to review':'समीक्षा के लिए मरीज चुनें','Patient workspace':'मरीज कार्यक्षेत्र','Open a patient to review the information needed for assessment, escalation and handover.':'मूल्यांकन, एस्केलेशन और हैंडओवर के लिए जरूरी जानकारी देखने हेतु मरीज खोलें।','Contact patient':'मरीज से संपर्क करें','Select a patient to open their longitudinal care context.':'मरीज की दीर्घकालिक देखभाल जानकारी खोलने के लिए मरीज चुनें।','Relevant history, allergies, medicines and consent-shared reports appear here.':'प्रासंगिक इतिहास, एलर्जी, दवाएं और सहमति से साझा रिपोर्ट यहां दिखाई देंगी।','Patient contact':'मरीज का संपर्क','Phone number not saved':'फोन नंबर सहेजा नहीं गया','None recorded.':'कोई जानकारी दर्ज नहीं है।','Longitudinal record':'दीर्घकालिक रिकॉर्ड','Reports shared by patients':'मरीजों द्वारा साझा रिपोर्ट','Review previous documents before assessment, referral or escalation.':'मूल्यांकन, रेफरल या एस्केलेशन से पहले पिछली रिपोर्ट देखें।','Shared records':'साझा रिकॉर्ड','No consent-shared medical reports are available.':'सहमति से साझा की गई कोई मेडिकल रिपोर्ट उपलब्ध नहीं है।','Open report':'रिपोर्ट खोलें','Patient guidance':'मरीज के लिए निर्देश','Precautions sent to patients':'मरीजों को भेजी गई सावधानियां','Send clear instructions and see which precautions are still active.':'स्पष्ट निर्देश भेजें और देखें कि कौन सी सावधानियां अभी सक्रिय हैं।','Hide history':'इतिहास छिपाएं','View active':'सक्रिय देखें','Write guidance for the patient…':'मरीज के लिए निर्देश लिखें…','Select patient and write a precaution first.':'पहले मरीज चुनें और सावधानी लिखें।','No registered patients yet.':'अभी कोई पंजीकृत मरीज नहीं है।','Facility care desk':'स्वास्थ्य केंद्र देखभाल डेस्क','Patient contacts & care access':'मरीज संपर्क और देखभाल पहुंच','Patient contact details are saved permanently at registration. The facility manages care-access requests and makes verified contact details available to the assigned frontline team.':'मरीज की संपर्क जानकारी पंजीकरण के समय स्थायी रूप से सहेजी जाती है। स्वास्थ्य केंद्र देखभाल पहुंच अनुरोधों का प्रबंधन करता है और सत्यापित संपर्क जानकारी नियुक्त फ्रंटलाइन टीम को उपलब्ध कराता है।','Facility managed':'स्वास्थ्य केंद्र द्वारा प्रबंधित','Contact':'संपर्क','View record':'रिकॉर्ड देखें','Access management':'पहुंच प्रबंधन','Pending care-access requests':'लंबित देखभाल-पहुंच अनुरोध','These requests are managed by the facility, not the frontline worker.':'इन अनुरोधों का प्रबंधन स्वास्थ्य केंद्र करता है, फ्रंटलाइन कार्यकर्ता नहीं।','Approve access':'पहुंच स्वीकृत करें','Decline':'अस्वीकार करें','Doctor · Clinical review':'डॉक्टर · चिकित्सीय समीक्षा','Verify before it enters the record':'रिकॉर्ड में जोड़ने से पहले सत्यापित करें','Review queue':'समीक्षा कतार','AI intake · pending review':'एआई जांच · समीक्षा लंबित','AI-generated · pending review':'एआई द्वारा तैयार · समीक्षा लंबित','Clinical attention recommended':'चिकित्सीय ध्यान आवश्यक','Longitudinal patient record':'मरीज का दीर्घकालिक रिकॉर्ड','Medical history & reports':'चिकित्सीय इतिहास और रिपोर्ट','Reported symptoms':'बताए गए लक्षण','AI-prepared summary':'एआई द्वारा तैयार सारांश','Return for clarification':'स्पष्टीकरण के लिए वापस भेजें','Verify & issue care plan':'सत्यापित करें और देखभाल योजना जारी करें','Your review queue is clear':'आपकी समीक्षा कतार खाली है','All intakes are reviewed':'सभी जांच की समीक्षा हो चुकी है','Clinician workspace':'चिकित्सक कार्यक्षेत्र','No shared medical documents yet.':'अभी कोई साझा मेडिकल दस्तावेज नहीं है।','Patient shared':'मरीज द्वारा साझा','Facility administration':'स्वास्थ्य केंद्र प्रशासन','Network-wide care operations':'पूरे नेटवर्क की देखभाल संचालन','A clear view of care delivery':'देखभाल सेवाओं की स्पष्ट जानकारी','Refresh today':'आज रीफ्रेश करें','Care dashboard refreshed with the latest records.':'देखभाल डैशबोर्ड नवीनतम रिकॉर्ड के साथ रीफ्रेश किया गया।','Referral created. The patient can now see it in Health Records.':'रेफरल बनाया गया। मरीज अब इसे स्वास्थ्य रिकॉर्ड में देख सकता है।','Select a patient and enter a referral reason.':'मरीज चुनें और रेफरल का कारण दर्ज करें।','Unable to create referral.':'रेफरल बनाने में असमर्थ।','This patient does not have a phone number saved.':'इस मरीज का फोन नंबर सहेजा नहीं गया है।','No incoming referrals yet.':'अभी कोई आने वाला रेफरल नहीं है।','Incoming referrals':'आने वाले रेफरल','Patient referral token':'मरीज का रेफरल टोकन','From':'से','To':'को','Reason':'कारण','Created':'बनाया गया','Accept referral':'रेफरल स्वीकार करें','Mark completed':'पूरा हुआ चिह्नित करें','View token':'टोकन देखें','Pending':'लंबित','Accepted':'स्वीकृत','Completed':'पूरा','Referral token':'रेफरल टोकन','Medical file is unavailable.':'मेडिकल फाइल उपलब्ध नहीं है।','Popup blocked. Allow pop-ups to open this report.':'पॉप-अप ब्लॉक है। रिपोर्ट खोलने के लिए पॉप-अप की अनुमति दें।','Unable to open this report.':'रिपोर्ट खोलने में असमर्थ।','No medical reports added yet':'अभी कोई मेडिकल रिपोर्ट नहीं जोड़ी गई है','Medical records':'मेडिकल रिकॉर्ड','Upload medical report':'मेडिकल रिपोर्ट अपलोड करें','Optional note':'वैकल्पिक नोट','Blood report':'ब्लड रिपोर्ट','Lab report':'लैब रिपोर्ट','Prescription':'प्रिस्क्रिप्शन','Scan':'स्कैन','Discharge summary':'डिस्चार्ज सारांश','Other':'अन्य','Remove':'हटाएं','Private':'निजी','Shared with care team':'देखभाल टीम के साथ साझा','Edit health records':'स्वास्थ्य रिकॉर्ड संपादित करें','Save medical information':'चिकित्सीय जानकारी सहेजें','Medical information saved and shared with your care team.':'चिकित्सीय जानकारी सहेजी गई और आपकी देखभाल टीम के साथ साझा की गई।','Medical report removed from your record.':'मेडिकल रिपोर्ट आपके रिकॉर्ड से हटा दी गई।','No active condition recorded.':'कोई सक्रिय स्थिति दर्ज नहीं है।','No previous history recorded.':'कोई पिछला इतिहास दर्ज नहीं है।','No phone saved':'कोई फोन नंबर सहेजा नहीं गया','Not provided':'उपलब्ध नहीं कराया गया','Not recorded':'दर्ज नहीं है','Not fetched yet':'अभी प्राप्त नहीं किया गया','Live hospital data is temporarily unavailable. Please try again.':'लाइव अस्पताल डेटा अभी उपलब्ध नहीं है। कृपया फिर कोशिश करें।','Finding nearby hospitals…':'नजदीकी अस्पताल खोजे जा रहे हैं…','Refresh live hospitals':'लाइव अस्पताल रीफ्रेश करें','Allow location access and refresh to search within 10 km.':'10 किमी के भीतर खोजने के लिए स्थान की अनुमति दें और रीफ्रेश करें।','Live source: OpenStreetMap':'लाइव स्रोत: OpenStreetMap','Last fetched':'अंतिम बार प्राप्त','Results may vary as map data changes.':'मानचित्र डेटा बदलने पर परिणाम बदल सकते हैं।','Hospitals near you':'आपके पास के अस्पताल','Live results are fetched from OpenStreetMap using your device location. Location is used only for this search.':'लाइव परिणाम आपके डिवाइस के स्थान का उपयोग करके OpenStreetMap से प्राप्त किए जाते हैं। स्थान का उपयोग केवल इस खोज के लिए होता है।','Emergency':'आपातकाल','Hours':'समय','beds available':'बेड उपलब्ध','Book appointment':'अपॉइंटमेंट बुक करें','Choose a visit date':'विज़िट की तारीख चुनें','Choose a time slot':'समय स्लॉट चुनें','Available':'उपलब्ध','Full':'भर चुका है','Already booked':'पहले से बुक है','Confirm appointment':'अपॉइंटमेंट की पुष्टि करें','Booking notification':'बुकिंग सूचना','Cancellation notification':'रद्दीकरण सूचना','Appointment booked successfully. Your selected hospital, doctor, date and time are now connected to the appointment.':'अपॉइंटमेंट सफलतापूर्वक बुक हो गया। चुना गया अस्पताल, डॉक्टर, तारीख और समय अब अपॉइंटमेंट से जुड़े हैं।','Appointment cancelled successfully. The overview is updated now.':'अपॉइंटमेंट सफलतापूर्वक रद्द हो गया। सारांश अब अपडेट है।','Cancelling…':'रद्द किया जा रहा है…','View visit details':'विज़िट विवरण देखें','Join assisted visit':'सहायता प्राप्त विज़िट में शामिल हों','Teleconsult requested with':'टेलीपरामर्श का अनुरोध किया गया:','Request ID':'अनुरोध आईडी','Unable to request teleconsult.':'टेलीपरामर्श अनुरोध भेजने में असमर्थ।','Patient account created':'मरीज का खाता बनाया गया','Sign in':'साइन इन','Unable to continue.':'आगे बढ़ने में असमर्थ।','Unable to save':'सहेजने में असमर्थ','Saved securely. Your care team can now continue this journey.':'सुरक्षित रूप से सहेजा गया। आपकी देखभाल टीम अब इस यात्रा को आगे बढ़ा सकती है।','Care access approved by the facility.':'स्वास्थ्य केंद्र ने देखभाल पहुंच स्वीकृत की।','Care access request rejected.':'देखभाल पहुंच अनुरोध अस्वीकार किया गया।','Consent request sent to the health worker with your contact, location and shared medical reports.':'आपका संपर्क, स्थान और साझा मेडिकल रिपोर्ट स्वास्थ्य कार्यकर्ता को भेजकर अनुरोध किया गया।','Consent activated. Care-team sharing is enabled.':'सहमति सक्रिय है। देखभाल टीम के साथ साझा करना सक्षम है।','Consent paused. Care-team sharing is temporarily disabled.':'सहमति रोक दी गई है। देखभाल टीम के साथ साझा करना अस्थायी रूप से बंद है।','Emergency response marked as handled.':'आपातकालीन प्रतिक्रिया को निपटाया गया चिह्नित किया गया।','Teleconsult connected.':'टेलीपरामर्श कनेक्ट हो गया।','Teleconsult completed.':'टेलीपरामर्श पूरा हो गया।','Unable to send precaution.':'सावधानी भेजने में असमर्थ।','Precaution sent to the patient.':'सावधानी मरीज को भेज दी गई।','Precaution marked as resolved.':'सावधानी को पूरा चिह्नित किया गया।','Language set to':'भाषा सेट की गई:','English':'अंग्रेज़ी','Hindi':'हिन्दी','Tamil':'तमिल','Healthcare facility':'स्वास्थ्य केंद्र','Hospital':'अस्पताल','Doctor':'डॉक्टर','Assigned clinician':'नियुक्त चिकित्सक','Doctor availability is temporarily unavailable.':'डॉक्टर की उपलब्धता अभी अस्थायी रूप से उपलब्ध नहीं है।','Doctor appointment':'डॉक्टर अपॉइंटमेंट','Doctor visit':'डॉक्टर विज़िट','Follow-up':'फॉलो-अप','Next visit':'अगली विज़िट','Current medicines':'वर्तमान दवाएं','Medical conditions':'चिकित्सीय स्थितियां','Medical history':'चिकित्सीय इतिहास','Allergies':'एलर्जी','Patient':'मरीज','Years':'वर्ष','year':'वर्ष','years':'वर्ष','Risk':'जोखिम','normal':'सामान्य','high':'उच्च','moderate':'मध्यम','Review':'समीक्षा','Call':'कॉल करें','Refresh':'रीफ्रेश करें','Loading…':'लोड हो रहा है…','Creating…':'बनाया जा रहा है…','Connecting…':'कनेक्ट हो रहा है…','Live':'लाइव','Active':'सक्रिय','Cancelled':'रद्द','Confirmed':'पुष्ट','Failed':'विफल','Not configured':'कॉन्फ़िगर नहीं किया गया','Sent':'भेजा गया','Waiting':'प्रतीक्षा','Open AI assistant':'एआई सहायक खोलें','AI Assistant':'एआई सहायक','Get guidance and care information':'मार्गदर्शन और देखभाल की जानकारी पाएं','Help':'मदद','Need help connecting?':'कनेक्ट करने में मदद चाहिए?','Health check':'स्वास्थ्य जांच','Health record':'स्वास्थ्य रिकॉर्ड','Nearby care':'नजदीकी देखभाल','My care':'मेरी देखभाल','Overview':'सारांश','Quick access':'त्वरित पहुंच','What would you like to do?':'आप क्या करना चाहेंगे?','History, reports and care notes':'इतिहास, रिपोर्ट और देखभाल नोट्स','Find the right care today':'आज सही देखभाल पाएं','Choose a care professional':'देखभाल विशेषज्ञ चुनें','Start with a visit at your nearby health centre.':'अपने नजदीकी स्वास्थ्य केंद्र पर विज़िट से शुरुआत करें।','No appointment booked':'कोई अपॉइंटमेंट बुक नहीं है','No appointment yet':'अभी कोई अपॉइंटमेंट नहीं','No appointments recorded yet.':'अभी कोई अपॉइंटमेंट दर्ज नहीं है।','Your token':'आपका टोकन','Token':'टोकन','Care centre':'देखभाल केंद्र','Open':'खोलें','Close':'बंद करें','Directions':'दिशा-निर्देश','Notifications':'सूचनाएं','Notification history':'सूचना इतिहास','Show all':'सभी दिखाएं','Select a doctor to continue':'जारी रखने के लिए डॉक्टर चुनें','Selected':'चयनित','Not started':'शुरू नहीं हुआ','Latest clinical intake':'नवीनतम क्लिनिकल जांच','Clinical intakes':'क्लिनिकल जांच','Clinical intake submitted':'क्लिनिकल जांच जमा की गई','Clinical review completed':'क्लिनिकल समीक्षा पूरी हुई'
},
  TA: {
'Profile':'சுயவிவரம்','Edit profile':'சுயவிவரத்தைத் திருத்து','Update your personal details':'உங்கள் தனிப்பட்ட தகவல்களைப் புதுப்பிக்கவும்','Choose your interface language':'இடைமுக மொழியைத் தேர்வு செய்யவும்','Account':'கணக்கு','Signed-in account':'உள்நுழைந்த கணக்கு','Save profile':'சுயவிவரத்தை சேமி','Cancel editing':'திருத்தத்தை ரத்து செய்','Saving…':'சேமிக்கப்படுகிறது…','Profile successfully updated.':'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது.','Dashboard':'டாஷ்போர்டு','Today’s patient care':'இன்றைய நோயாளர் பராமரிப்பு','Connected care mode':'இணைந்த பராமரிப்பு முறை','Patient context, reports, referrals and precautions stay connected across the care journey.':'நோயாளர் தகவல், அறிக்கைகள், பரிந்துரைகள் மற்றும் முன்னெச்சரிக்கைகள் முழு பராமரிப்பு பயணத்திலும் இணைந்திருக்கும்.','Open patient workspace':'நோயாளர் பணியிடத்தைத் திறக்கவும்','Open live queue':'நேரடி வரிசையைத் திறக்கவும்','Care continuity':'தொடர்ச்சியான பராமரிப்பு','Open requests':'திறந்த கோரிக்கைகள்','Review medicines':'மருந்துகளை மதிப்பாய்வு செய்','Emergency response':'அவசரநிலை பதில்','Patients calling for urgent help':'அவசர உதவிக்காக அழைக்கும் நோயாளிகள்','Every emergency request is routed to the nearest available healthcare worker. Review the caller, location and assigned responder here.':'ஒவ்வொரு அவசர கோரிக்கையும் அருகிலுள்ள கிடைக்கும் சுகாதார பணியாளரிடம் அனுப்பப்படும். அழைப்பாளர், இடம் மற்றும் நியமிக்கப்பட்ட பணியாளரை இங்கே மதிப்பாய்வு செய்யவும்.','active calls':'செயலில் உள்ள அழைப்புகள்','assigned/visible urgent requests':'நியமிக்கப்பட்ட/காணக்கூடிய அவசர கோரிக்கைகள்','No active emergency calls right now.':'இப்போது செயலில் அவசர அழைப்புகள் இல்லை.','When a patient presses the emergency button, their request will appear here.':'நோயாளர் அவசர பொத்தானை அழுத்தும் போது அவர்களின் கோரிக்கை இங்கே தோன்றும்.','Refresh emergency calls':'அவசர அழைப்புகளை புதுப்பிக்கவும்','Location':'இடம்','Call patient':'நோயாளியை அழைக்கவும்','Handled':'கையாளப்பட்டது','No healthcare worker available · default emergency 112':'சுகாதார பணியாளர் இல்லை · இயல்புநிலை அவசர எண் 112','Assisted care':'உதவி பராமரிப்பு','Teleconsult requests':'தொலை ஆலோசனை கோரிக்கைகள்','Live requests created by patients from confirmed appointments.':'உறுதிசெய்யப்பட்ட சந்திப்புகளிலிருந்து நோயாளிகள் உருவாக்கிய நேரடி கோரிக்கைகள்.','total':'மொத்தம்','Connect':'இணைக்கவும்','Complete':'முடிக்கவும்','No teleconsult requests yet.':'இன்னும் தொலை ஆலோசனை கோரிக்கைகள் இல்லை.','Frontline response':'முன்னணி பதில்','Live patient queue':'நேரடி நோயாளர் வரிசை','Patients currently waiting for care at Seva Rural Health Centre.':'Seva கிராமப்புற சுகாதார மையத்தில் தற்போது பராமரிப்புக்காக காத்திருக்கும் நோயாளிகள்.','Show less':'குறைவாகக் காட்டு','View all':'அனைத்தையும் காண்க','No patients are waiting right now.':'இப்போது நோயாளிகள் யாரும் காத்திருக்கவில்லை.','View patient':'நோயாளியைப் பார்க்கவும்','Escalation':'மேல்மட்ட பரிந்துரை','High-risk follow-up':'அதிக ஆபத்து பின்தொடர்பு','Cases that need outreach or clinical review.':'தொடர்பு அல்லது மருத்துவ மதிப்பாய்வு தேவைப்படும் வழக்குகள்.','No high-risk follow-up cases.':'அதிக ஆபத்து பின்தொடர்பு வழக்குகள் இல்லை.','Pharmacy coordination':'மருந்தக ஒருங்கிணைப்பு','Medicine availability':'மருந்து கிடைப்புத் தன்மை','Review stock before advising a patient where to collect medicines.':'நோயாளி மருந்தை எங்கு பெற வேண்டும் என்று கூறுவதற்கு முன் இருப்பை மதிப்பாய்வு செய்யவும்.','Low stock':'குறைந்த இருப்பு','In stock':'இருப்பில் உள்ளது','units available':'அலகுகள் உள்ளன','threshold':'வரம்பு','Hide stock':'இருப்பை மறை','Review stock':'இருப்பை மதிப்பாய்வு செய்','Referral coordination':'பரிந்துரை ஒருங்கிணைப்பு','Across connected facilities':'இணைந்த மையங்களுக்கிடையில்','No referrals recorded yet.':'இன்னும் பரிந்துரைகள் பதிவு செய்யப்படவில்லை.','Create referral':'பரிந்துரையை உருவாக்கவும்','Refer patient':'நோயாளியை பரிந்துரைக்கவும்','Select patient':'நோயாளியைத் தேர்வு செய்க','Select a patient to review':'மதிப்பாய்வுக்கு நோயாளியைத் தேர்வு செய்க','Patient workspace':'நோயாளர் பணியிடம்','Open a patient to review the information needed for assessment, escalation and handover.':'மதிப்பீடு, மேல்மட்ட பரிந்துரை மற்றும் ஒப்படைப்புக்குத் தேவையான தகவலைப் பார்க்க நோயாளியைத் திறக்கவும்.','Contact patient':'நோயாளியைத் தொடர்பு கொள்ளவும்','Select a patient to open their longitudinal care context.':'நீண்டகால பராமரிப்பு தகவலைத் திறக்க நோயாளியைத் தேர்வு செய்க.','Relevant history, allergies, medicines and consent-shared reports appear here.':'தொடர்புடைய வரலாறு, ஒவ்வாமைகள், மருந்துகள் மற்றும் ஒப்புதலுடன் பகிரப்பட்ட அறிக்கைகள் இங்கே தோன்றும்.','Patient contact':'நோயாளர் தொடர்பு','Phone number not saved':'தொலைபேசி எண் சேமிக்கப்படவில்லை','None recorded.':'எதுவும் பதிவு செய்யப்படவில்லை.','Longitudinal record':'நீண்டகால பதிவு','Reports shared by patients':'நோயாளிகள் பகிர்ந்த அறிக்கைகள்','Review previous documents before assessment, referral or escalation.':'மதிப்பீடு, பரிந்துரை அல்லது மேல்மட்ட பரிந்துரைக்கு முன் முந்தைய ஆவணங்களை மதிப்பாய்வு செய்யவும்.','Shared records':'பகிரப்பட்ட பதிவுகள்','No consent-shared medical reports are available.':'ஒப்புதலுடன் பகிரப்பட்ட மருத்துவ அறிக்கைகள் எதுவும் இல்லை.','Open report':'அறிக்கையைத் திறக்கவும்','Patient guidance':'நோயாளர் வழிகாட்டுதல்','Precautions sent to patients':'நோயாளிகளுக்கு அனுப்பப்பட்ட முன்னெச்சரிக்கைகள்','Send clear instructions and see which precautions are still active.':'தெளிவான வழிமுறைகளை அனுப்பி எந்த முன்னெச்சரிக்கைகள் இன்னும் செயலில் உள்ளன என்பதைப் பார்க்கவும்.','Hide history':'வரலாற்றை மறை','View active':'செயலில் உள்ளவற்றைக் காண்க','Write guidance for the patient…':'நோயாளிக்கான வழிகாட்டுதலை எழுதவும்…','No registered patients yet.':'இன்னும் பதிவு செய்யப்பட்ட நோயாளிகள் இல்லை.','Facility care desk':'சுகாதார மைய பராமரிப்பு மேசை','Patient contacts & care access':'நோயாளர் தொடர்புகள் மற்றும் பராமரிப்பு அணுகல்','Patient contact details are saved permanently at registration. The facility manages care-access requests and makes verified contact details available to the assigned frontline team.':'நோயாளர் தொடர்பு விவரங்கள் பதிவு செய்யும் போது நிரந்தரமாக சேமிக்கப்படும். மையம் பராமரிப்பு அணுகல் கோரிக்கைகளை நிர்வகித்து சரிபார்க்கப்பட்ட தொடர்பு விவரங்களை நியமிக்கப்பட்ட முன்னணி குழுவிற்கு வழங்கும்.','Facility managed':'மையத்தால் நிர்வகிக்கப்படுகிறது','View record':'பதிவைக் காண்க','Access management':'அணுகல் மேலாண்மை','Pending care-access requests':'நிலுவையில் உள்ள பராமரிப்பு அணுகல் கோரிக்கைகள்','These requests are managed by the facility, not the frontline worker.':'இந்த கோரிக்கைகள் முன்னணி பணியாளரால் அல்ல, மையத்தால் நிர்வகிக்கப்படுகின்றன.','Approve access':'அணுகலை அங்கீகரிக்கவும்','Decline':'நிராகரிக்கவும்','Doctor · Clinical review':'மருத்துவர் · மருத்துவ மதிப்பாய்வு','Verify before it enters the record':'பதிவில் சேர்ப்பதற்கு முன் சரிபார்க்கவும்','Review queue':'மதிப்பாய்வு வரிசை','AI intake · pending review':'AI பதிவு · மதிப்பாய்வு நிலுவையில்','AI-generated · pending review':'AI உருவாக்கியது · மதிப்பாய்வு நிலுவையில்','Clinical attention recommended':'மருத்துவ கவனம் பரிந்துரைக்கப்படுகிறது','Longitudinal patient record':'நோயாளியின் நீண்டகால பதிவு','Medical history & reports':'மருத்துவ வரலாறு மற்றும் அறிக்கைகள்','Reported symptoms':'தெரிவிக்கப்பட்ட அறிகுறிகள்','AI-prepared summary':'AI தயாரித்த சுருக்கம்','Return for clarification':'விளக்கத்திற்காக திருப்பி அனுப்பவும்','Verify & issue care plan':'சரிபார்த்து பராமரிப்பு திட்டத்தை வழங்கவும்','Your review queue is clear':'உங்கள் மதிப்பாய்வு வரிசை காலியாக உள்ளது','All intakes are reviewed':'அனைத்து பதிவுகளும் மதிப்பாய்வு செய்யப்பட்டுள்ளன','Clinician workspace':'மருத்துவ பணியிடம்','No shared medical documents yet.':'இன்னும் பகிரப்பட்ட மருத்துவ ஆவணங்கள் இல்லை.','Patient shared':'நோயாளர் பகிர்ந்தது','Facility administration':'மைய நிர்வாகம்','Network-wide care operations':'முழு வலையமைப்பு பராமரிப்பு செயல்பாடுகள்','A clear view of care delivery':'பராமரிப்பு வழங்கலின் தெளிவான பார்வை','Refresh today':'இன்றைய பதிவுகளைப் புதுப்பிக்கவும்','Care dashboard refreshed with the latest records.':'சமீபத்திய பதிவுகளுடன் பராமரிப்பு டாஷ்போர்டு புதுப்பிக்கப்பட்டது.','Referral created. The patient can now see it in Health Records.':'பரிந்துரை உருவாக்கப்பட்டது. நோயாளர் இப்போது அதை சுகாதார பதிவுகளில் பார்க்கலாம்.','Select a patient and enter a referral reason.':'நோயாளியைத் தேர்ந்தெடுத்து பரிந்துரை காரணத்தை உள்ளிடவும்.','Unable to create referral.':'பரிந்துரையை உருவாக்க முடியவில்லை.','This patient does not have a phone number saved.':'இந்த நோயாளியின் தொலைபேசி எண் சேமிக்கப்படவில்லை.','No incoming referrals yet.':'இன்னும் வரும் பரிந்துரைகள் இல்லை.','Incoming referrals':'வரும் பரிந்துரைகள்','Patient referral token':'நோயாளர் பரிந்துரை டோக்கன்','From':'இருந்து','To':'க்கு','Reason':'காரணம்','Created':'உருவாக்கப்பட்டது','Accept referral':'பரிந்துரையை ஏற்கவும்','Mark completed':'முடிந்ததாகக் குறிக்கவும்','View token':'டோக்கனைப் பார்க்கவும்','Pending':'நிலுவையில்','Accepted':'ஏற்றுக்கொள்ளப்பட்டது','Completed':'முடிந்தது','Referral token':'பரிந்துரை டோக்கன்','Medical records':'மருத்துவ பதிவுகள்','Upload medical report':'மருத்துவ அறிக்கையைப் பதிவேற்றவும்','Optional note':'விருப்ப குறிப்பு','Blood report':'இரத்த அறிக்கை','Lab report':'ஆய்வக அறிக்கை','Prescription':'மருந்துச் சீட்டு','Scan':'ஸ்கேன்','Discharge summary':'விடுவிப்பு சுருக்கம்','Other':'மற்றவை','Remove':'அகற்று','Private':'தனிப்பட்டது','Shared with care team':'பராமரிப்பு குழுவுடன் பகிரப்பட்டது','Edit health records':'சுகாதார பதிவுகளைத் திருத்தவும்','Save medical information':'மருத்துவ தகவலைச் சேமிக்கவும்','Medical information saved and shared with your care team.':'மருத்துவ தகவல் சேமிக்கப்பட்டு உங்கள் பராமரிப்பு குழுவுடன் பகிரப்பட்டது.','Medical report removed from your record.':'மருத்துவ அறிக்கை உங்கள் பதிவிலிருந்து அகற்றப்பட்டது.','No active condition recorded.':'செயலில் உள்ள நிலை எதுவும் பதிவு செய்யப்படவில்லை.','No previous history recorded.':'முந்தைய வரலாறு எதுவும் பதிவு செய்யப்படவில்லை.','No phone saved':'தொலைபேசி சேமிக்கப்படவில்லை','Not provided':'வழங்கப்படவில்லை','Not fetched yet':'இன்னும் பெறப்படவில்லை','Live hospital data is temporarily unavailable. Please try again.':'நேரடி மருத்துவமனை தரவு தற்காலிகமாக கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.','Finding nearby hospitals…':'அருகிலுள்ள மருத்துவமனைகள் தேடப்படுகின்றன…','Refresh live hospitals':'நேரடி மருத்துவமனைகளைப் புதுப்பிக்கவும்','Allow location access and refresh to search within 10 km.':'10 கிமீக்குள் தேட இட அனுமதியை வழங்கி புதுப்பிக்கவும்.','Live source: OpenStreetMap':'நேரடி மூலம்: OpenStreetMap','Last fetched':'கடைசியாக பெறப்பட்டது','Results may vary as map data changes.':'வரைபடத் தரவு மாறுவதால் முடிவுகள் மாறலாம்.','Hospitals near you':'உங்களுக்கு அருகிலுள்ள மருத்துவமனைகள்','Emergency':'அவசரநிலை','Hours':'நேரங்கள்','Book appointment':'சந்திப்பை பதிவு செய்','Choose a visit date':'சந்திப்பு தேதியைத் தேர்வு செய்க','Choose a time slot':'நேர இடைவெளியைத் தேர்வு செய்க','Available':'கிடைக்கிறது','Full':'நிரம்பியுள்ளது','Already booked':'ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது','Confirm appointment':'சந்திப்பை உறுதிசெய்','Appointment booked successfully. Your selected hospital, doctor, date and time are now connected to the appointment.':'சந்திப்பு வெற்றிகரமாக பதிவு செய்யப்பட்டது. நீங்கள் தேர்ந்தெடுத்த மருத்துவமனை, மருத்துவர், தேதி மற்றும் நேரம் இப்போது சந்திப்புடன் இணைக்கப்பட்டுள்ளன.','Appointment cancelled successfully. The overview is updated now.':'சந்திப்பு வெற்றிகரமாக ரத்து செய்யப்பட்டது. மேலோட்டம் இப்போது புதுப்பிக்கப்பட்டது.','Cancelling…':'ரத்து செய்யப்படுகிறது…','View visit details':'சந்திப்பு விவரங்களைப் பார்க்கவும்','Join assisted visit':'உதவி சந்திப்பில் சேரவும்','Unable to request teleconsult.':'தொலை ஆலோசனை கோர முடியவில்லை.','Patient account created':'நோயாளர் கணக்கு உருவாக்கப்பட்டது','Sign in':'உள்நுழைக','Unable to continue.':'தொடர முடியவில்லை.','Unable to save':'சேமிக்க முடியவில்லை','Care access approved by the facility.':'மையம் பராமரிப்பு அணுகலை அங்கீகரித்தது.','Care access request rejected.':'பராமரிப்பு அணுகல் கோரிக்கை நிராகரிக்கப்பட்டது.','Consent request sent to the health worker with your contact, location and shared medical reports.':'உங்கள் தொடர்பு, இடம் மற்றும் பகிரப்பட்ட மருத்துவ அறிக்கைகளுடன் ஒப்புதல் கோரிக்கை சுகாதார பணியாளருக்கு அனுப்பப்பட்டது.','Consent activated. Care-team sharing is enabled.':'ஒப்புதல் செயலில் உள்ளது. பராமரிப்பு குழு பகிர்வு இயக்கப்பட்டுள்ளது.','Consent paused. Care-team sharing is temporarily disabled.':'ஒப்புதல் இடைநிறுத்தப்பட்டுள்ளது. பராமரிப்பு குழு பகிர்வு தற்காலிகமாக முடக்கப்பட்டுள்ளது.','Emergency response marked as handled.':'அவசரநிலை பதில் கையாளப்பட்டதாகக் குறிக்கப்பட்டது.','Teleconsult connected.':'தொலை ஆலோசனை இணைக்கப்பட்டது.','Teleconsult completed.':'தொலை ஆலோசனை முடிந்தது.','Unable to send precaution.':'முன்னெச்சரிக்கையை அனுப்ப முடியவில்லை.','Precaution sent to the patient.':'முன்னெச்சரிக்கை நோயாளிக்கு அனுப்பப்பட்டது.','Precaution marked as resolved.':'முன்னெச்சரிக்கை தீர்க்கப்பட்டதாகக் குறிக்கப்பட்டது.','Language set to':'மொழி அமைக்கப்பட்டது:','English':'ஆங்கிலம்','Hindi':'இந்தி','Tamil':'தமிழ்','Healthcare facility':'சுகாதார மையம்','Hospital':'மருத்துவமனை','Doctor':'மருத்துவர்','Assigned clinician':'நியமிக்கப்பட்ட மருத்துவர்','Doctor availability is temporarily unavailable.':'மருத்துவர் கிடைப்புத் தன்மை தற்காலிகமாக கிடைக்கவில்லை.','Doctor appointment':'மருத்துவர் சந்திப்பு','Doctor visit':'மருத்துவர் சந்திப்பு','Follow-up':'பின்தொடர்பு','Next visit':'அடுத்த சந்திப்பு','Current medicines':'தற்போதைய மருந்துகள்','Medical conditions':'மருத்துவ நிலைகள்','Medical history':'மருத்துவ வரலாறு','Allergies':'ஒவ்வாமைகள்','Patient':'நோயாளர்','Years':'ஆண்டுகள்','year':'ஆண்டு','years':'ஆண்டுகள்','Risk':'ஆபத்து','normal':'சாதாரண','high':'அதிக','moderate':'மிதமான','Review':'மதிப்பாய்வு','Call':'அழைக்கவும்','Refresh':'புதுப்பிக்கவும்','Loading…':'ஏற்றப்படுகிறது…','Creating…':'உருவாக்கப்படுகிறது…','Connecting…':'இணைக்கப்படுகிறது…','Live':'நேரடி','Active':'செயலில்','Cancelled':'ரத்து செய்யப்பட்டது','Confirmed':'உறுதிசெய்யப்பட்டது','Failed':'தோல்வி','Not configured':'கட்டமைக்கப்படவில்லை','Sent':'அனுப்பப்பட்டது','Waiting':'காத்திருக்கிறது','Open AI assistant':'AI உதவியாளரைத் திறக்கவும்','AI Assistant':'AI உதவியாளர்','Get guidance and care information':'வழிகாட்டுதல் மற்றும் பராமரிப்பு தகவலைப் பெறவும்','Help':'உதவி','Need help connecting?':'இணைக்க உதவி வேண்டுமா?','Health check':'சுகாதார பரிசோதனை','Health record':'சுகாதார பதிவு','Nearby care':'அருகிலுள்ள பராமரிப்பு','My care':'என் பராமரிப்பு','Overview':'மேலோட்டம்','Quick access':'விரைவு அணுகல்','What would you like to do?':'நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?','History, reports and care notes':'வரலாறு, அறிக்கைகள் மற்றும் பராமரிப்பு குறிப்புகள்','Find the right care today':'இன்றே சரியான பராமரிப்பைப் பெறுங்கள்','Choose a care professional':'பராமரிப்பு நிபுணரைத் தேர்வு செய்க','Start with a visit at your nearby health centre.':'உங்கள் அருகிலுள்ள சுகாதார மையத்தில் சந்திப்புடன் தொடங்குங்கள்.','No appointment booked':'சந்திப்பு பதிவு செய்யப்படவில்லை','No appointment yet':'இன்னும் சந்திப்பு இல்லை','No appointments recorded yet.':'இன்னும் சந்திப்புகள் பதிவு செய்யப்படவில்லை.','Your token':'உங்கள் டோக்கன்','Token':'டோக்கன்','Care centre':'பராமரிப்பு மையம்','Open':'திற','Close':'மூடு','Notifications':'அறிவிப்புகள்','Notification history':'அறிவிப்பு வரலாறு','Show all':'அனைத்தையும் காட்டு','Select a doctor to continue':'தொடர மருத்துவரைத் தேர்வு செய்க','Selected':'தேர்ந்தெடுக்கப்பட்டது','Not started':'தொடங்கவில்லை','Latest clinical intake':'சமீபத்திய மருத்துவ பதிவு','Clinical intakes':'மருத்துவ பதிவுகள்','Clinical intake submitted':'மருத்துவ பதிவு சமர்ப்பிக்கப்பட்டது','Clinical review completed':'மருத்துவ மதிப்பாய்வு முடிந்தது'
}
};
Object.assign(EXTRA_TRANSLATIONS.HI, {
  'Simple communication':'सरल संवाद','Care Team':'देखभाल टीम','Patient ↔ Health Worker ↔ Doctor · one shared conversation.':'मरीज ↔ स्वास्थ्य कार्यकर्ता ↔ डॉक्टर · एक साझा बातचीत।','Connected':'जुड़ा हुआ','Send to':'को भेजें','Write a message to the patient…':'मरीज के लिए संदेश लिखें…','Write a message to the health worker…':'स्वास्थ्य कार्यकर्ता के लिए संदेश लिखें…','Write a message to the doctor…':'डॉक्टर के लिए संदेश लिखें…','Sending…':'भेजा जा रहा है…','Send':'भेजें','No messages yet':'अभी कोई संदेश नहीं','Send a simple update to the care team.':'देखभाल टीम को एक सरल अपडेट भेजें।'
});
Object.assign(EXTRA_TRANSLATIONS.TA, {
  'Simple communication':'எளிய தொடர்பு','Care Team':'பராமரிப்பு குழு','Patient ↔ Health Worker ↔ Doctor · one shared conversation.':'நோயாளர் ↔ சுகாதார பணியாளர் ↔ மருத்துவர் · ஒரே பகிரப்பட்ட உரையாடல்.','Connected':'இணைக்கப்பட்டுள்ளது','Send to':'அனுப்பவும்','Write a message to the patient…':'நோயாளருக்கு செய்தி எழுதவும்…','Write a message to the health worker…':'சுகாதார பணியாளருக்கு செய்தி எழுதவும்…','Write a message to the doctor…':'மருத்துவருக்கு செய்தி எழுதவும்…','Sending…':'அனுப்பப்படுகிறது…','Send':'அனுப்பவும்','No messages yet':'இன்னும் செய்திகள் இல்லை','Send a simple update to the care team.':'பராமரிப்பு குழுவிற்கு எளிய புதுப்பிப்பை அனுப்பவும்.'
});
Object.keys(EXTRA_TRANSLATIONS).forEach(lang => Object.assign(GLOBAL_TRANSLATIONS[lang], EXTRA_TRANSLATIONS[lang]));

function applyGlobalLanguage(language: string) {
  if (language === 'EN') return;
  const map = GLOBAL_TRANSLATIONS[language] || {};
  const entries = Object.entries(map).sort((a,b) => b[0].length - a[0].length);
  const translate = (value: string) => { let out = value; for (const [from,to] of entries) { if (out.includes(from)) out = out.split(from).join(to); } return out; };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = []; let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  nodes.forEach(node => { const parent=node.parentElement; if (!parent || ['SCRIPT','STYLE','INPUT','TEXTAREA'].includes(parent.tagName)) return; const text=node.textContent || ''; const next=translate(text); if(next!==text) node.textContent=next; });
  document.querySelectorAll('input[placeholder], textarea[placeholder], [aria-label], [title]').forEach((el: Element) => { ['placeholder','aria-label','title'].forEach(attr => { const value=el.getAttribute(attr); if(value){ const next=translate(value); if(next!==value) el.setAttribute(attr,next); } }); });
}
function App() {
    const initial = routeFromHash(); const [data, setData] = useState<Data>(); const [role, setRole] = useState<Role>(initial.role); const [tab, setTab] = useState(initial.tab); const [authPage, setAuthPage] = useState(authFromHash()); const [session, setSession] = useState<any>(() => { try { return JSON.parse(localStorage.getItem('swasthya-session') || 'null') } catch { return null } }); const [notice, setNotice] = useState(''); useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 10000); return () => window.clearTimeout(timer); }, [notice]); const [profileMenuOpen, setProfileMenuOpen] = useState(false); const [profileEditOpen, setProfileEditOpen] = useState(false); const [profileSaving, setProfileSaving] = useState(false); const [language, setLanguage] = useState(() => localStorage.getItem('swasthya-language') || 'EN'); const [profileDraft, setProfileDraft] = useState<any>({ name:'', email:'', phone:'', village:'', language:localStorage.getItem('swasthya-language') || 'EN' }); const [languageOpen, setLanguageOpen] = useState(false); const [menuOpen, setMenuOpen] = useState(false); useEffect(() => { const run = () => applyGlobalLanguage(language); const id = window.setTimeout(run, 0); const observer = new MutationObserver(run); if (language !== 'EN') observer.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['placeholder','aria-label','title'] }); return () => { window.clearTimeout(id); observer.disconnect(); }; }, [language, tab, role, data]); const cacheKey = session?.patientId ? `swasthya-patient-cache-${session.patientId}` : '';
    const readPatientCache = () => { if (!cacheKey) return null; try { const cached=JSON.parse(localStorage.getItem(cacheKey)||'null'); return cached?.data || null; } catch { return null; } };
    const cachePatientData = (payload:any) => { if (!cacheKey || !payload) return; try { const copy = JSON.parse(JSON.stringify(payload)); if (Array.isArray(copy.medicalDocuments)) copy.medicalDocuments = copy.medicalDocuments.map((d:any)=>({...d, dataUrl: undefined})); localStorage.setItem(cacheKey, JSON.stringify({version:2, savedAt:new Date().toISOString(), data:copy})); } catch {} };
    const mergeCachedPatient = (payload:any) => { const cached=readPatientCache(); if (!cached || !Array.isArray(payload?.patients)) return payload; const cachedPatient=(cached.patients||[]).find((x:any)=>x.id===session?.patientId); if (!cachedPatient) return payload; const next={...payload}; next.patients=payload.patients.map((p:any)=>p.id===cachedPatient.id ? {...p, ...cachedPatient} : p); return next; };
    const [apiError, setApiError] = useState(''); const refresh = async () => { try { const r = await fetch(`${api}/bootstrap`, { headers: session?.id ? { 'x-demo-user-id': session.id } : {}, cache:'no-store' }); if (!r.ok) throw new Error(`API returned ${r.status}`); const payload = await r.json(); const merged = mergeCachedPatient(payload); setData(merged); cachePatientData(merged); setApiError(''); return merged; } catch (e:any) { const message = e?.message === 'Failed to fetch' ? 'Cannot connect to the API server on port 4000. Start the API with: cd apps/api && npm run dev' : (e?.message || 'Unable to connect to the API server.'); setApiError(message); return null; } }; useEffect(() => { if (!location.hash) location.hash = '/login'; if (session) { if (session.patientId) { try { const cached=JSON.parse(localStorage.getItem(`swasthya-patient-cache-${session.patientId}`)||'null'); if (cached?.data) setData(cached.data); } catch {} } void refresh(); } const onHash = () => { setAuthPage(authFromHash()); const next = routeFromHash(); setRole(next.role); setTab(next.tab) }; addEventListener('hashchange', onHash); return () => removeEventListener('hashchange', onHash) }, [session]); useEffect(() => { if (session?.role !== 'health_worker') return; const timer = window.setInterval(() => { void refresh(); }, 5000); return () => window.clearInterval(timer); }, [session?.role]); if (authPage === 'login' || authPage === 'register') return <AuthPage mode={authPage} onSuccess={(next: any) => { localStorage.setItem('swasthya-session', JSON.stringify(next)); setSession(next); location.hash = `/${next.role}/home`; setAuthPage('') }} />; if (!session) { location.hash = '/login'; return <main className="loading"><HeartPulse /> Redirecting to secure sign in…</main> } if (role !== session.role) { location.hash = `/${session.role}/home`; return <main className="loading"><HeartPulse /> Opening your authorised workspace…</main> } if (!data) return <main className="loading"><HeartPulse /><strong>Unable to load the care network</strong><p>{apiError || 'Connecting to the API server…'}</p><button className="primary small" onClick={() => void refresh()}>Retry connection</button><small className="muted">API: http://localhost:4000/api/health</small></main>;
    const patient = session.role === 'patient' ? (data.patients || []).find((x: any) => x.id === session.patientId) : null; if (session.role === 'patient' && !patient) return <main className="loading"><HeartPulse /> Patient record unavailable. Please sign in again.</main>; const navigate = (nextRole: Role, nextTab = 'home') => { if (nextRole !== session.role) { setNotice('Your account does not have permission to open that workspace.'); return } location.hash = `/${nextRole}/${nextTab}`; setRole(nextRole); setTab(nextTab); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }; const action = async (path: string, body: any, message = 'Saved securely. Your care team can now continue this journey.') => { const response = await fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'Unable to save'); } setNotice(message); await refresh() }; const chooseRole = (value: Role) => navigate(value); const signOut = () => { localStorage.removeItem('swasthya-session'); setSession(null); setProfileMenuOpen(false); setProfileEditOpen(false); location.hash = '/login'; setAuthPage('login') }; const profilePatient = session.role === 'patient' ? patient : null; const saveProfile = async () => { setProfileSaving(true); try { const userRes = await fetch(`${api}/users/${encodeURIComponent(session.id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:profileDraft.name, email:profileDraft.email }) }); const userResult = await userRes.json().catch(()=>({})); if (!userRes.ok) throw new Error(userResult.message || 'Unable to update profile.'); if (session.role === 'patient' && profilePatient) { const patientRes = await fetch(`${api}/patients/${encodeURIComponent(profilePatient.id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:profileDraft.name, village:profileDraft.village, phone:profileDraft.phone, language:profileDraft.language }) }); const patientResult = await patientRes.json().catch(()=>({})); if (!patientRes.ok) throw new Error(patientResult.message || 'Unable to update patient profile.'); } const nextSession = { ...session, name:profileDraft.name, email:profileDraft.email }; localStorage.setItem('swasthya-session', JSON.stringify(nextSession)); setSession(nextSession); if (profileDraft.language !== language) { setLanguage(profileDraft.language); localStorage.setItem('swasthya-language', profileDraft.language); } await refresh(); setProfileEditOpen(false); setProfileMenuOpen(false); setNotice('Profile successfully updated.'); } catch (e:any) { setNotice(e.message || 'Unable to update profile.'); } finally { setProfileSaving(false); } };
    return <div className="app"><header><button className="brand" onClick={() => chooseRole(session.role)} aria-label="Go to authorised home"><span><HeartPulse /></span><div>Swasthya <b>Setu</b><small>Connecting care, everywhere</small></div></button><div className="header-actions"><div className="profile-menu-wrap"><button className="header-profile-button" onClick={()=>setProfileMenuOpen(x=>!x)} aria-expanded={profileMenuOpen}><span className="header-avatar">{session.name?.[0] || 'A'}</span><span className="header-profile-copy"><b>{session.name || 'Account'}</b><small>{session.role.replaceAll('_',' ')}</small></span><ChevronRight className={cn('profile-chevron',profileMenuOpen&&'open')}/></button>{profileMenuOpen&&<div className="profile-dropdown"><div className="profile-dropdown-head"><span className="profile-dropdown-avatar">{session.name?.[0] || 'A'}</span><div><b>{session.name || 'Account'}</b><small>{session.email || 'Signed-in account'}</small></div></div><button className="profile-dropdown-action" onClick={()=>{const currentPatient=session.role==='patient'?(data?.patients||[]).find((x:any)=>x.id===session.patientId):null;setProfileDraft({name:session.name||'',email:session.email||'',phone:currentPatient?.phone||'',village:currentPatient?.village||'',language});setProfileEditOpen(true);setProfileMenuOpen(false)}}><Pencil/><span><b>Edit profile</b><small>Update your personal details</small></span></button><div className="profile-language"><div><Languages/><span><b>Language</b><small>Choose your interface language</small></span></div><select value={language} onChange={e=>{const v=e.target.value;setLanguage(v);localStorage.setItem('swasthya-language',v);setNotice(`Language set to ${v==='HI'?'हिन्दी':v==='TA'?'தமிழ்':'English'}`)}}><option value="EN">English</option><option value="HI">हिन्दी</option><option value="TA">தமிழ்</option></select></div><div className="profile-dropdown-divider"/><button className="profile-signout" onClick={signOut}><LogOut/><span>Sign out</span></button></div>}</div><button className="mobile" onClick={() => setMenuOpen(x => !x)} aria-label="Open navigation"><Menu /></button></div></header>{notice && <div className="notice"><CheckCircle2 /> {notice}<button onClick={() => setNotice('')}>×</button></div>}
        {profileEditOpen && <div className="modal-backdrop" onClick={()=>!profileSaving&&setProfileEditOpen(false)}><section className="profile-modal" onClick={e=>e.stopPropagation()}><div className="card-heading"><div><p className="eyebrow">Profile</p><h3>Edit your profile</h3><p className="form-intro">Keep your account and care-contact details up to date.</p></div><button className="icon-close" onClick={()=>!profileSaving&&setProfileEditOpen(false)}>×</button></div><div className="profile-fields"><label>Full name<input value={profileDraft.name} onChange={e=>setProfileDraft({...profileDraft,name:e.target.value})}/></label><label>Email address<input type="email" value={profileDraft.email} onChange={e=>setProfileDraft({...profileDraft,email:e.target.value})}/></label>{session.role==='patient'&&<><label>Mobile number<input value={profileDraft.phone} onChange={e=>setProfileDraft({...profileDraft,phone:e.target.value})}/></label><label>Age<input value={profilePatient?.age ?? ''} readOnly/></label><label>Village / locality<input value={profileDraft.village} onChange={e=>setProfileDraft({...profileDraft,village:e.target.value})}/></label></>}<label>Language<select value={profileDraft.language} onChange={e=>{setProfileDraft({...profileDraft,language:e.target.value});setLanguage(e.target.value);localStorage.setItem('swasthya-language',e.target.value)}}><option value="EN">English</option><option value="HI">हिन्दी</option><option value="TA">தமிழ்</option></select></label></div><button className="primary" disabled={profileSaving} onClick={()=>void saveProfile()}>{profileSaving?'Saving…':'Save profile'}</button></section></div>} {role === 'patient' ? <PatientView p={patient} data={data} tab={tab} setTab={(next: string) => navigate('patient', next)} action={action} setNotice={setNotice} refresh={refresh} language={language} setLanguage={(v:string)=>{setLanguage(v);localStorage.setItem('swasthya-language',v)}} profileOpen={profileEditOpen} setProfileOpen={setProfileEditOpen} /> : role === 'doctor' ? <DoctorView data={data} action={action} setNotice={setNotice} refresh={refresh} language={language} /> : <AdminView data={data} role={role} facilityId={session.facilityId} setNotice={setNotice} refresh={refresh} />}</div>
}
function AuthPage({ mode, onSuccess }: { mode: 'login' | 'register'; onSuccess: (user: any) => void }) { const [role, setRole] = useState<Role>('patient'); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [phone, setPhone] = useState(''); const [village, setVillage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const labels: { role: Role; label: string; detail: string }[] = [{ role: 'patient', label: 'Patient', detail: 'Access your care and records' }, { role: 'health_worker', label: 'Health worker', detail: 'Support community care' }, { role: 'doctor', label: 'Doctor / specialist', detail: 'Review and consult' }]; const demo: any = { patient: ['meera@example.com', 'demo123'], health_worker: ['worker@example.com', 'demo123'], doctor: ['doctor@example.com', 'demo123'] }; const submit = async (e: any) => { e.preventDefault(); setError(''); setLoading(true); try { const response = await fetch(`${api}/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, name, email, password, phone, village }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to continue.'); onSuccess(result.user) } catch (err: any) { setError(err.message) } finally { setLoading(false) } }; const useDemo = () => { setEmail(demo[role][0]); setPassword(demo[role][1]); setName('') }; return <main className="auth-shell"><section className="auth-aside"><div className="auth-brand"><HeartPulse /> Swasthya <b>Setu</b></div><p className="eyebrow">Integrated rural healthcare</p><h1>One connected path to <i>better care.</i></h1><p>Securely connect patients, community health workers, clinicians, and facilities around the same care record.</p><div className="auth-steps"><span><CheckCircle2 /> Consent-led access</span><span><CheckCircle2 /> Human-reviewed AI support</span><span><CheckCircle2 /> Care continuity across facilities</span></div></section><section className="auth-card"><div className="auth-card-head"><p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create an account'}</p><h2>{mode === 'login' ? 'Sign in to your care portal' : 'Join the connected care network'}</h2><p>{mode === 'login' ? 'Choose your stakeholder role before signing in.' : 'Tell us how you will use Swasthya Setu.'}</p></div><form onSubmit={submit}><label>I am a</label><div className="role-picker">{labels.map(x => <button type="button" className={cn(role === x.role && 'active')} onClick={() => setRole(x.role)} key={x.role}><b>{x.label}</b><small>{x.detail}</small></button>)}</div>{mode === 'register' && <><label>Full name</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />{role === 'patient' && <div className="form-row"><div><label>Mobile number</label><input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile" /></div><div><label>Village / locality</label><input required value={village} onChange={e => setVillage(e.target.value)} placeholder="Your village" /></div></div>}</>}<label>Email address</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /><label>Password</label><input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />{error && <p className="auth-error"><AlertTriangle /> {error}</p>}<button className="primary auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create secure account'} <ChevronRight /></button></form>{mode === 'login' && <button className="demo-link" onClick={useDemo}>Use demo account for selected role</button>}<p className="auth-switch">{mode === 'login' ? 'New to Swasthya Setu?' : 'Already have an account?'} <button onClick={() => location.hash = mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p></section></main> }
function CareTeamMessages({ patientId, data, setNotice, refresh, actorRole, actorId, actorName, compact = false }: any) {
  const patients = Array.isArray(data.patients) ? data.patients : [];
  const [conversationPatientId, setConversationPatientId] = useState(patientId);
  const activePatientId = actorRole === 'health_worker' ? conversationPatientId : patientId;
  const messages: any[] = (data.careTeamMessages || []).filter((m:any) => m.patientId === activePatientId);
  const [recipientRole, setRecipientRole] = useState<'care_team'|'patient'|'health_worker'|'doctor'>('care_team');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  useEffect(() => setConversationPatientId(patientId), [patientId]);
  const patient = patients.find((p:any) => p.id === activePatientId);
  const worker = { id: 'user-worker', name: 'Sita ASHA' };
  const doctor = { id: 'user-doctor', name: 'Dr. Ananya Sharma' };
  if (!activePatientId || !patient) return null;
  const people:any = { patient: { id:`user-${activePatientId}`, name:patient.name }, health_worker:worker, doctor };
  const roleLabel = (role:string) => role === 'health_worker' ? 'Health Worker' : role === 'doctor' ? 'Doctor' : role === 'patient' ? 'Patient' : 'Entire Care Team';
  const send = async () => {
    const text = message.trim();
    if (!text) { setNotice('Write a short message first.'); return; }
    setBusy(true);
    try {
      const target = recipientRole === 'care_team' ? { id:null, name:'Entire Care Team' } : people[recipientRole];
      const r = await fetch(`${api}/care-team/messages`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ patientId:activePatientId, senderRole:actorRole, senderId:actorId, senderName:actorName, recipientRole, recipientId:target?.id, recipientName:target?.name, message:text }) });
      const result = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(result.message || 'Unable to send message.');
      setMessage(''); await refresh?.(); setNotice(recipientRole === 'care_team' ? 'Message delivered to both members of the care team.' : `Message sent to ${target.name}.`);
    } catch (e:any) { setNotice(e.message || 'Unable to send message.'); } finally { setBusy(false); }
  };
  const callRoom = `https://meet.jit.si/SwasthyaSetu-Care-${encodeURIComponent(activePatientId)}`;
  const openCareCall = () => {
    setCallOpen(true);
    window.open(callRoom, '_blank', 'noopener,noreferrer');
    setNotice('Care-team video/audio room opened. Patient, health worker and doctor can join the same room.');
  };
  const documents = (data.medicalDocuments || []).filter((d:any)=>d.patientId===activePatientId && d.sharedWithCareTeam);
  return <section className={cn('care-team-card', compact && 'care-team-card-compact')}>
    <div className="care-team-head"><div><p className="eyebrow">Three-way communication</p><h3><MessageSquare/> Care Team</h3><p>One patient record · Patient ↔ Health Worker ↔ Doctor.</p></div><span className="care-team-status"><span></span>Connected</span></div>
    {actorRole !== 'patient' && <label className="care-team-patient"><span>Patient</span>{actorRole === 'health_worker' ? <select value={activePatientId} onChange={e=>setConversationPatientId(e.target.value)}>{patients.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {p.age} years</option>)}</select> : <select value={activePatientId} disabled><option>{patient.name}</option></select>}</label>}
    <div className="care-shared-context"><div><b>Shared patient data</b><span>Visible to the patient, assigned health worker and doctor.</span></div><div className="care-shared-pills"><span>{patient.medicalCondition || 'Condition not recorded'}</span><span>{patient.medications ? 'Medicines available' : 'No medicines recorded'}</span><span>{documents.length} shared report{documents.length===1?'':'s'}</span></div></div>
    <div className="care-shared-documents" style={{margin:'12px 0',padding:12,border:'1px solid #dbeafe',borderRadius:12,background:'#f8fbff'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:8}}><div><b style={{fontSize:13}}>Shared medical reports</b><span style={{display:'block',fontSize:11,color:'#64748b'}}>The same patient-uploaded PDF/report can be opened from all three care-team sides.</span></div><span className="tag">{documents.length} shared</span></div>
      {documents.length ? documents.map((doc:any)=><div key={doc.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:'1px solid #e2e8f0'}}><FileText style={{width:16,color:'#2563eb'}}/><div style={{flex:1,minWidth:0}}><b style={{fontSize:12,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.name}</b><small style={{color:'#64748b'}}>{doc.type.replaceAll('_',' ')} · {formatBytes(doc.size)}</small></div><button className="outline small" onClick={()=>openMedicalDocument(doc)}>Open PDF / report</button></div>) : <small style={{color:'#64748b'}}>No shared medical reports uploaded yet.</small>}
    </div>
    <div className="care-call-bar"><div><b><Video/> Telecommunication</b><span>Audio/video call for all three care participants.</span></div><button className="primary" onClick={openCareCall}><Video/> {callOpen?'Join care call':'Start 3-way call'}</button></div>
    <div className="care-team-thread">
      {messages.length ? messages.slice(-12).map((m:any) => <article key={m.id} className={cn('care-message', m.senderRole === actorRole && 'mine')}><div className="care-message-meta"><b>{m.senderName}</b><span>{roleLabel(m.senderRole)}</span><small>{new Date(m.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div><p>{m.message}</p><small className="care-message-to">To {roleLabel(m.recipientRole)}</small></article>) : <div className="empty-inline compact"><MessageSquare/><div><b>No messages yet</b><p>Send one update to the entire care team.</p></div></div>}
    </div>
    <div className="care-team-compose"><div className="care-team-recipient"><span>Send to</span><div className="care-recipient-buttons"><button type="button" className={cn(recipientRole==='care_team'&&'active')} onClick={()=>setRecipientRole('care_team')}>Entire Care Team</button>{(['patient','health_worker','doctor'] as const).filter(x=>x!==actorRole).map(x => <button type="button" key={x} className={cn(recipientRole===x && 'active')} onClick={()=>setRecipientRole(x)}>{roleLabel(x)}</button>)}</div></div><div className="care-compose-row"><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={500} placeholder={`Write a message to ${recipientRole==='care_team'?'the entire care team':`the ${roleLabel(recipientRole).toLowerCase()}`}…`} /><button className="primary" disabled={busy || !message.trim()} onClick={()=>void send()}><Send/> {busy?'Sending…':'Send'}</button></div><small className="care-character-count">{message.length}/500</small></div>
  </section>;
}

function PatientView({ p, data, tab, setTab, action, setNotice, language, setLanguage, refresh, profileOpen, setProfileOpen }: any) {
    const [symptoms, setSymptoms] = useState('');
    const [nearbyHospitals, setNearbyHospitals] = useState<any[]>([]);
    const [locationState, setLocationState] = useState<'idle'|'locating'|'ready'|'error'>('idle');
    const [locationMessage, setLocationMessage] = useState('');
    const [patientLocation, setPatientLocation] = useState<any>(() => { try { return JSON.parse(localStorage.getItem(`swasthya_patient_location_${p.id}`) || 'null'); } catch { return null; } });
    const [consentRequestBusy, setConsentRequestBusy] = useState(false);
    const [nearbyLoading, setNearbyLoading] = useState(false);
    const [lastFetchedAt, setLastFetchedAt] = useState('');
    const [listening, setListening] = useState(false);
    const [selectedHospital, setSelectedHospital] = useState<any>(null);
    const [hospitalDoctors, setHospitalDoctors] = useState<any[]>([]);
    const [hospitalDoctorsLoading, setHospitalDoctorsLoading] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [availableSlots, setAvailableSlots] = useState<any[]>([]);
    const [reportType, setReportType] = useState('blood_report');
    const [editingHealth, setEditingHealth] = useState(false);
    const [reportNotes, setReportNotes] = useState(''); const [medicalConditionDraft, setMedicalConditionDraft] = useState(p.medicalCondition || ''); const [medicalHistoryDraft, setMedicalHistoryDraft] = useState(p.medicalHistory || ''); const [allergiesDraft, setAllergiesDraft] = useState(p.allergies || ''); const [medicationsDraft, setMedicationsDraft] = useState(p.medications || ''); const [healthSaving, setHealthSaving] = useState(false);
    const [reportUploading, setReportUploading] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [helpRequested, setHelpRequested] = useState(false);
    const [emergencyBusy, setEmergencyBusy] = useState(false);

    const booked = (data.appointments || []).filter((a: any) => a.patientId === p.id && a.status === 'booked' && new Date(a.startsAt).getTime() > Date.now()).sort((a:any,b:any)=>new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime())[0]; const patientNotifications = (data.notifications || []).filter((n:any) => n.patientId === p.id).slice(0, 6);
    const patientIntakes = (data.intakes || []).filter((x: any) => x.patientId === p.id);
    const latestIntake = patientIntakes[0];
    const consent = (data.consents || []).find((c: any) => c.patientId === p.id);
    const lang = language === 'HI' ? 'hi' : language === 'TA' ? 'ta' : 'en';
    const dict: any = {
        en: { portal:'Patient portal', welcome:'Welcome back', hero:'Your care,', hero2:'all in one place.', heroText:'Access your health record, connect with the right care, and keep every step of your journey connected.', book:'Book appointment', check:'Open AI assistant', protected:'Your care record is protected', protectedText:'Information is shared with your care team with your consent.', consent:'Consent active', care:'My care', overview:'Overview', appointments:'Appointments', healthCheck:'AI Assistant', record:'Health record', nearby:'Nearby care', help:'Need help connecting?', helpText:'A health worker can help you reach a doctor remotely.', today:'Today', glance:'Your health at a glance', nextVisit:'Next visit', token:'Token', confirmed:'Appointment confirmed', notBooked:'Not booked', choose:'Choose a care professional', checkStatus:'Health check', notStarted:'Not started', latest:'Latest clinical intake', share:'Share symptoms with your care team', centre:'Care centre', open:'Open', nextStep:'Your next step', confirmedVisit:'Your visit is confirmed', findRight:'Find the right care today', noAppointment:'No appointment booked', findCare:'Find care', connected:'Connected care', journey:'Your care journey', viewRecord:'View record', register:'Register', registered:'Patient account created', doctorVisit:'Doctor visit', followUp:'Follow-up', quick:'Quick access', what:'What would you like to do?', healthRecord:'History, reports and care notes', tellFeeling:'Tell us what you are feeling', nearbyDesc:'Find available services nearby', chooseProfessional:'Choose a care professional', appointmentIntro:'Start your next step with a connected visit at your nearby care centre.', confirm:'Confirm appointment', selected:'Selected', chooseDoctor:'Select a doctor to continue', intakeTitle:'Tell us how you’re feeling', intakeIntro:'Share your symptoms in your own words. The system prepares information for clinician review.', human:'Human review required.', notDiagnosis:'This is not a diagnosis. High-risk decisions remain governed by clinician-approved protocols.', bothering:'What is bothering you today?', speak:'Speak instead', listening:'Listening…', review:'Continue to review', recordTitle:"'s care history", recordIntro:'Your appointments, medical reports, referrals and care information stay connected in one place.', intakes:'Clinical intakes', refs:'Referrals', noRecord:'Your record will appear here', recordEmpty:'Complete a health check or visit to start building your connected care history.', services:'Find available healthcare services', servicesIntro:'Use the connected facility information to decide where to continue your care.', directions:'Directions', beds:'beds available', profile:'Profile', close:'Close', save:'Save profile', saved:'Profile updated successfully.', language:'Language', notifications:'Notification history', bookedNotice:'Booking notification', cancelledNotice:'Cancellation notification', sent:'Sent', pending:'Pending', failed:'Failed', notConfigured:'Not configured' },
        hi: { portal:'मरीज पोर्टल', welcome:'वापसी पर स्वागत है', hero:'आपकी देखभाल,', hero2:'एक ही जगह।', heroText:'अपना स्वास्थ्य रिकॉर्ड देखें, सही देखभाल से जुड़ें और अपनी पूरी स्वास्थ्य यात्रा को जोड़े रखें।', book:'अपॉइंटमेंट बुक करें', check:'एआई सहायक खोलें', protected:'आपका स्वास्थ्य रिकॉर्ड सुरक्षित है', protectedText:'आपकी सहमति से जानकारी आपकी देखभाल टीम के साथ साझा की जाती है।', consent:'सहमति सक्रिय', care:'मेरी देखभाल', overview:'सारांश', appointments:'अपॉइंटमेंट', healthCheck:'एआई सहायक', record:'स्वास्थ्य रिकॉर्ड', nearby:'नजदीकी देखभाल', help:'कनेक्ट करने में मदद चाहिए?', helpText:'स्वास्थ्य कार्यकर्ता आपको डॉक्टर से दूरस्थ रूप से जोड़ने में मदद कर सकता है।', today:'आज', glance:'आपके स्वास्थ्य की झलक', nextVisit:'अगली विज़िट', token:'टोकन', confirmed:'अपॉइंटमेंट की पुष्टि', notBooked:'बुक नहीं है', choose:'देखभाल विशेषज्ञ चुनें', checkStatus:'स्वास्थ्य जांच', notStarted:'शुरू नहीं हुई', latest:'नवीनतम क्लिनिकल जांच', share:'अपनी तकलीफ अपनी देखभाल टीम से साझा करें', centre:'स्वास्थ्य केंद्र', open:'खुला', nextStep:'आपका अगला कदम', confirmedVisit:'आपकी विज़िट की पुष्टि हो गई है', findRight:'आज सही देखभाल पाएं', noAppointment:'कोई अपॉइंटमेंट बुक नहीं है', findCare:'देखभाल खोजें', connected:'जुड़ी हुई देखभाल', journey:'आपकी स्वास्थ्य यात्रा', viewRecord:'रिकॉर्ड देखें', register:'पंजीकरण', registered:'मरीज का खाता बनाया गया', doctorVisit:'डॉक्टर की विज़िट', followUp:'फॉलो-अप', quick:'त्वरित पहुंच', what:'आप क्या करना चाहेंगे?', healthRecord:'इतिहास, रिपोर्ट और देखभाल नोट्स', tellFeeling:'बताएं आपको कैसा महसूस हो रहा है', nearbyDesc:'पास की उपलब्ध सेवाएं खोजें', chooseProfessional:'देखभाल विशेषज्ञ चुनें', appointmentIntro:'अपने नजदीकी केंद्र पर जुड़ी हुई विज़िट से अगला कदम शुरू करें।', confirm:'अपॉइंटमेंट की पुष्टि करें', selected:'चयनित', chooseDoctor:'जारी रखने के लिए डॉक्टर चुनें', intakeTitle:'बताएं आपको कैसा महसूस हो रहा है', intakeIntro:'अपने लक्षण अपने शब्दों में बताएं। सिस्टम डॉक्टर की समीक्षा के लिए जानकारी तैयार करता है।', human:'मानवीय समीक्षा आवश्यक है।', notDiagnosis:'यह निदान नहीं है। उच्च जोखिम वाले निर्णय डॉक्टर द्वारा अनुमोदित प्रोटोकॉल से नियंत्रित होते हैं।', bothering:'आज आपको क्या परेशानी है?', speak:'बोलकर बताएं', listening:'सुन रहे हैं…', review:'समीक्षा के लिए जारी रखें', recordTitle:'का स्वास्थ्य इतिहास', recordIntro:'आपकी जांच, परामर्श और स्वास्थ्य दस्तावेज पूरी यात्रा में जुड़े रहते हैं।', intakes:'क्लिनिकल जांच', refs:'रेफरल', noRecord:'आपका रिकॉर्ड यहां दिखाई देगा', recordEmpty:'अपनी जुड़ी हुई स्वास्थ्य यात्रा शुरू करने के लिए स्वास्थ्य जांच या विज़िट पूरी करें।', services:'उपलब्ध स्वास्थ्य सेवाएं खोजें', servicesIntro:'अपनी देखभाल जारी रखने के लिए उपलब्ध केंद्र की जानकारी देखें।', directions:'दिशा', beds:'बेड उपलब्ध', profile:'प्रोफाइल', close:'बंद करें', save:'प्रोफाइल सहेजें', saved:'प्रोफाइल सफलतापूर्वक अपडेट हुई।', language:'भाषा' },
        ta: { portal:'நோயாளர் தளம்', welcome:'மீண்டும் வரவேற்கிறோம்', hero:'உங்கள் பராமரிப்பு,', hero2:'ஒரே இடத்தில்.', heroText:'உங்கள் சுகாதார பதிவைப் பார்க்கவும், சரியான பராமரிப்புடன் இணைக்கவும், முழு பராமரிப்பு பயணத்தையும் இணைக்கவும்.', book:'சந்திப்பை பதிவு செய்', check:'AI உதவியாளரை திறக்கவும்', protected:'உங்கள் சுகாதார பதிவு பாதுகாப்பானது', protectedText:'உங்கள் ஒப்புதலுடன் தகவல் பராமரிப்பு குழுவுடன் பகிரப்படுகிறது.', consent:'ஒப்புதல் செயலில்', care:'என் பராமரிப்பு', overview:'மேலோட்டம்', appointments:'சந்திப்புகள்', healthCheck:'AI உதவியாளர்', record:'சுகாதார பதிவு', nearby:'அருகிலுள்ள பராமரிப்பு', help:'இணைக்க உதவி வேண்டுமா?', helpText:'சுகாதார பணியாளர் உங்களை மருத்துவருடன் தொலைநிலையாக இணைக்க உதவுவார்.', today:'இன்று', glance:'உங்கள் சுகாதார நிலை', nextVisit:'அடுத்த சந்திப்பு', token:'டோக்கன்', confirmed:'சந்திப்பு உறுதி', notBooked:'பதிவு செய்யவில்லை', choose:'பராமரிப்பு நிபுணரை தேர்வு செய்', checkStatus:'சுகாதார பரிசோதனை', notStarted:'தொடங்கவில்லை', latest:'சமீபத்திய மருத்துவ பதிவு', share:'உங்கள் அறிகுறிகளை பராமரிப்பு குழுவுடன் பகிரவும்', centre:'பராமரிப்பு மையம்', open:'திறந்திருக்கும்', nextStep:'உங்கள் அடுத்த படி', confirmedVisit:'உங்கள் சந்திப்பு உறுதி செய்யப்பட்டது', findRight:'இன்றே சரியான பராமரிப்பைப் பெறுங்கள்', noAppointment:'சந்திப்பு பதிவு செய்யப்படவில்லை', findCare:'பராமரிப்பை தேடு', connected:'இணைந்த பராமரிப்பு', journey:'உங்கள் பராமரிப்பு பயணம்', viewRecord:'பதிவைக் காண்க', register:'பதிவு', registered:'நோயாளர் கணக்கு உருவாக்கப்பட்டது', doctorVisit:'மருத்துவர் சந்திப்பு', followUp:'பின்தொடர்பு', quick:'விரைவு அணுகல்', what:'நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?', healthRecord:'வரலாறு, அறிக்கைகள் மற்றும் குறிப்புகள்', tellFeeling:'உங்களுக்கு எப்படி இருக்கிறது என்று சொல்லுங்கள்', nearbyDesc:'அருகிலுள்ள சேவைகளை கண்டறியவும்', chooseProfessional:'பராமரிப்பு நிபுணரை தேர்வு செய்', appointmentIntro:'உங்கள் அருகிலுள்ள மையத்தில் இணைந்த சந்திப்புடன் அடுத்த படியை தொடங்குங்கள்.', confirm:'சந்திப்பை உறுதிசெய்', selected:'தேர்ந்தெடுக்கப்பட்டது', chooseDoctor:'தொடர மருத்துவரை தேர்வு செய்யவும்', intakeTitle:'உங்களுக்கு எப்படி இருக்கிறது என்று சொல்லுங்கள்', intakeIntro:'உங்கள் அறிகுறிகளை உங்கள் சொந்த வார்த்தைகளில் பகிரவும். மருத்துவர் பரிசீலனைக்காக தகவல் தயாரிக்கப்படும்.', human:'மனித பரிசீலனை அவசியம்.', notDiagnosis:'இது நோயறிதல் அல்ல. அதிக ஆபத்து முடிவுகள் மருத்துவர் அங்கீகரித்த நடைமுறைகளால் கட்டுப்படுத்தப்படும்.', bothering:'இன்று உங்களுக்கு என்ன பிரச்சனை?', speak:'பேசுங்கள்', listening:'கேட்கிறோம்…', review:'பரிசீலனைக்கு தொடரவும்', recordTitle:'இன் பராமரிப்பு வரலாறு', recordIntro:'உங்கள் மருத்துவ பதிவுகள் மற்றும் ஆவணங்கள் முழு பயணத்திலும் இணைந்திருக்கும்.', intakes:'மருத்துவ பதிவுகள்', refs:'பரிந்துரைகள்', noRecord:'உங்கள் பதிவு இங்கே தோன்றும்', recordEmpty:'இணைந்த பராமரிப்பு வரலாற்றை உருவாக்க சுகாதார பரிசோதனை அல்லது சந்திப்பை முடிக்கவும்.', services:'கிடைக்கும் சுகாதார சேவைகள்', servicesIntro:'உங்கள் பராமரிப்பை தொடர கிடைக்கும் மையத் தகவலைப் பயன்படுத்தவும்.', directions:'வழிகள்', beds:'படுக்கைகள் உள்ளன', profile:'சுயவிவரம்', close:'மூடு', save:'சுயவிவரத்தை சேமி', saved:'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது.', language:'மொழி' }
    };
    const t = (key: string) => dict[lang][key] || dict.en[key] || key;
    useEffect(() => { setSelectedHospital(nearbyHospitals[0] || null); setHospitalDoctors([]); setSelectedDoctor(booked?.doctorId || ''); setSelectedDate(''); setSelectedSlot(''); setAvailableSlots([]);; }, [booked?.id, nearbyHospitals.length]);
    const localIsoDate = (d: Date) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }; const nextWorkingDate = () => { const d=new Date(); d.setDate(d.getDate()+1); while(d.getDay()===0) d.setDate(d.getDate()+1); return d; }; const minDate = nextWorkingDate(); const maxDate = new Date(minDate); maxDate.setDate(maxDate.getDate()+30); const isoDate = localIsoDate;
    const bookingFacilityId = selectedHospital?.id || data.facility.id; const bookingFacilityQuery = selectedHospital ? `&facilityName=${encodeURIComponent(selectedHospital.name || '')}&facilityLatitude=${encodeURIComponent(selectedHospital.latitude || '')}&facilityLongitude=${encodeURIComponent(selectedHospital.longitude || '')}` : ''; const fetchAvailability = async (doctorId: string, date: string) => { if (!doctorId || !date) { setAvailableSlots([]);; return; } setAvailabilityLoading(true); try { const r=await fetch(`${api}/availability?doctorId=${encodeURIComponent(doctorId)}&facilityId=${encodeURIComponent(bookingFacilityId)}${bookingFacilityQuery}&date=${encodeURIComponent(date)}`); const result=await r.json(); if(!r.ok) throw new Error(result.message||'Unable to load slots'); setAvailableSlots(Array.isArray(result.slots)?result.slots:[]);  setSelectedSlot(current => result.slots?.some((slot:any) => slot.startTime === current && slot.status !== 'full') ? current : ''); } catch(e:any) { setAvailableSlots([]);; setNotice(e.message||'Unable to load available slots. Make sure the API server is running on port 4000.'); } finally { setAvailabilityLoading(false); } }; useEffect(() => { if (selectedDoctor && selectedDate) void fetchAvailability(selectedDoctor, selectedDate); }, [selectedDoctor, selectedDate]);
    const speak = () => { const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!Recognition) { setNotice('Voice input is unavailable in this browser; you can still type your symptoms.'); return; } const recognition = new Recognition(); recognition.lang = language === 'HI' ? 'hi-IN' : language === 'TA' ? 'ta-IN' : 'en-IN'; recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false); recognition.onresult = (event: any) => setSymptoms(x => [x, event.results[0][0].transcript].filter(Boolean).join(', ')); recognition.start(); };
    const toggleConsent = async () => { try { await fetch(`${api}/consents/${consent?.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status: consent?.status === 'active' ? 'paused' : 'active' }) }); await refresh(); setNotice(consent?.status === 'active' ? 'Consent paused. Care-team sharing is temporarily disabled.' : 'Consent activated. Care-team sharing is enabled.'); } catch { setNotice('Unable to update consent right now.'); } };
    const requestCareConsent = async () => {
      setConsentRequestBusy(true);
      try {
        let location = patientLocation;
        if (!location && navigator.geolocation) {
          location = await new Promise<any>((resolve, reject) => navigator.geolocation.getCurrentPosition(pos => resolve({latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:pos.coords.accuracy || null, capturedAt:new Date().toISOString()}), reject, {enableHighAccuracy:true, timeout:15000, maximumAge:0}));
          setPatientLocation(location); localStorage.setItem(`swasthya_patient_location_${p.id}`, JSON.stringify(location));
        }
        const documentsToShare = (data.medicalDocuments || []).filter((d:any)=>d.patientId===p.id && d.sharedWithCareTeam).map((d:any)=>d.id);
        const r = await fetch(`${api}/care-consent-requests`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({patientId:p.id, phone:p.phone, latitude:location?.latitude, longitude:location?.longitude, locationAccuracy:location?.accuracy, documentIds:documentsToShare})});
        const result = await r.json().catch(()=>({}));
        if (!r.ok) throw new Error(result.message || 'Unable to send consent request.');
        await refresh(); setNotice(result.message || 'Consent request sent to the health worker with your contact, location and shared medical reports.');
      } catch (e:any) { setNotice(e?.message || 'Unable to send consent request. Please allow location access and try again.'); } finally { setConsentRequestBusy(false); }
    };
    const callEmergency = async () => {
      if (emergencyBusy) return;
      setEmergencyBusy(true);
      try {
        let location = patientLocation;
        if (!location && navigator.geolocation) {
          location = await new Promise<any>((resolve, reject) => navigator.geolocation.getCurrentPosition(pos => resolve({latitude:pos.coords.latitude, longitude:pos.coords.longitude, accuracy:pos.coords.accuracy || null, capturedAt:new Date().toISOString()}), reject, {enableHighAccuracy:true, timeout:10000, maximumAge:0}));
          setPatientLocation(location);
          localStorage.setItem(`swasthya_patient_location_${p.id}`, JSON.stringify(location));
        }
        const r = await fetch(`${api}/emergency/alerts`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({patientId:p.id, latitude:location?.latitude, longitude:location?.longitude, locationAccuracy:location?.accuracy}) });
        const result = await r.json().catch(()=>({}));
        if (!r.ok) throw new Error(result.message || 'Unable to connect to emergency support.');
        const number = result.callNumber || '112';
        const message = result.callTarget === 'health_worker'
          ? `Emergency alert sent to ${result.assignedWorkerName || 'the nearest healthcare worker'} (${number}). Connecting your call now.`
          : 'No healthcare worker was available, so emergency services (112) will be called now.';
        setNotice(message);
        window.location.href = `tel:${number}`;
        await refresh();
      } catch (e:any) {
        // If location permission is denied, still give the patient a safe default emergency route.
        if (e?.code === 1 || /permission|location/i.test(String(e?.message || ''))) {
          try {
            const r = await fetch(`${api}/emergency/alerts`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({patientId:p.id}) });
            const result = await r.json().catch(()=>({}));
            if (r.ok) { setNotice('Location was unavailable, so the default emergency number 112 will be called.'); window.location.href = `tel:${result.callNumber || '112'}`; await refresh(); return; }
          } catch {}
        }
        setNotice(e?.message || 'Unable to connect to emergency support.');
      } finally { setEmergencyBusy(false); }
    };
    useEffect(() => {
      if (!p?.id || !('geolocation' in navigator)) return;
      const active = (data.emergencyAlerts || []).find((a:any) => a.patientId === p.id && a.status === 'active');
      if (!active) return;
      const watchId = navigator.geolocation.watchPosition(async pos => {
        try {
          await fetch(`${api}/emergency/alerts/${encodeURIComponent(active.id)}/location`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ latitude:pos.coords.latitude, longitude:pos.coords.longitude, locationAccuracy:pos.coords.accuracy }) });
        } catch {}
      }, () => {}, { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
      return () => navigator.geolocation.clearWatch(watchId);
    }, [p?.id, (data.emergencyAlerts || []).find((a:any)=>a.patientId===p?.id && a.status==='active')?.id]);
    const requestHelp = async () => { try { await action('/assistance', { patientId:p.id, reason:'Patient requested help connecting to a doctor.' }, 'Health worker assistance requested. A connected worker will help you reach a doctor.'); setHelpRequested(true); } catch { setNotice('Unable to request assistance right now.'); } };
    useEffect(() => { setMedicalConditionDraft(p.medicalCondition || ''); setMedicalHistoryDraft(p.medicalHistory || ''); setAllergiesDraft(p.allergies || ''); setMedicationsDraft(p.medications || ''); }, [p.id, p.medicalCondition, p.medicalHistory, p.allergies, p.medications]); const saveHealthContext = async () => { setHealthSaving(true); try { const r = await fetch(`${api}/patients/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medicalCondition: medicalConditionDraft, medicalHistory: medicalHistoryDraft, allergies: allergiesDraft, medications: medicationsDraft }) }); const result = await r.json().catch(() => ({})); if (!r.ok) throw new Error(result.message || 'Unable to save medical information'); setNotice('Medical information saved and shared with your care team.'); await refresh(); } catch (e:any) { setNotice(e.message || 'Unable to save medical information'); } finally { setHealthSaving(false); } }; const uploadMedicalReport = async (file: File | undefined) => {
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) { setNotice('Please choose a file smaller than 6 MB.'); return; }
      setReportUploading(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
        const r = await fetch(`${api}/medical-documents`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ patientId:p.id, name:file.name, type:reportType, mimeType:file.type || 'application/octet-stream', size:file.size, dataUrl, notes:reportNotes }) });
        const result = await r.json().catch(()=>({}));
        if (!r.ok) throw new Error(result.message || 'Unable to upload report');
        setReportNotes('');
        setNotice('Report added to your medical history and shared with your consent with the health worker and doctor.');
        await refresh();
      } catch (e:any) { setNotice(e.message || 'Unable to upload report.'); } finally { setReportUploading(false); }
    };
    const documents = Array.isArray(data.medicalDocuments) ? data.medicalDocuments.filter((d:any) => d && d.patientId === p.id) : [];
    const openDocument = (doc:any) => { try { if(!doc?.id) throw new Error('Medical file is unavailable.'); const win=window.open(`${api}/medical-documents/${encodeURIComponent(doc.id)}/file`, '_blank', 'noopener,noreferrer'); if(!win) throw new Error('Popup blocked. Allow pop-ups to open this report.'); } catch (e:any) { setNotice(e.message || 'This medical file could not be opened.'); } }; const removeDocument = async (doc:any) => { if (!window.confirm(`Remove ${doc.name} from your Health Records? This will also remove it from care-team sharing.`)) return; try { const r = await fetch(`${api}/medical-documents/${encodeURIComponent(doc.id)}`, { method:'DELETE' }); const result = await r.json().catch(()=>({})); if (!r.ok) throw new Error(result.message || 'Unable to remove report'); setNotice('Medical report removed from your record.'); await refresh(); } catch (e:any) { setNotice(e.message || 'Unable to remove report.'); } };
    const fetchHospitalDoctors = async (hospital:any) => {
      if (!hospital) { setHospitalDoctors([]); return; }
      setHospitalDoctorsLoading(true);
      try {
        const qs = `facilityId=${encodeURIComponent(hospital.id)}&facilityName=${encodeURIComponent(hospital.name || '')}&facilityLatitude=${encodeURIComponent(hospital.latitude)}&facilityLongitude=${encodeURIComponent(hospital.longitude)}&facilityPhone=${encodeURIComponent(hospital.phone || '')}`;
        const r = await fetch(`${api}/hospital-doctors?${qs}`);
        const result = await r.json().catch(()=>({}));
        if (!r.ok) throw new Error(result.message || 'Unable to load doctors for this hospital.');
        setHospitalDoctors(result.doctors || []);
      } catch (e:any) { setHospitalDoctors([]); setNotice(e.message || 'Doctor availability is temporarily unavailable.'); }
      finally { setHospitalDoctorsLoading(false); }
    };

    useEffect(() => { if (selectedHospital) void fetchHospitalDoctors(selectedHospital); }, [selectedHospital?.id]);

    const fetchNearbyHospitals = () => {
      if (!navigator.geolocation) { setLocationState('error'); setLocationMessage('Live location is not supported by this browser.'); return; }
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        setLocationState('error'); setLocationMessage('Live location requires HTTPS (or localhost). Open the app using http://localhost:5173 or enable HTTPS.'); return;
      }
      setLocationState('locating'); setNearbyLoading(true); setLocationMessage('Getting your live location…');
      const requestHospitals = async (latitude:number, longitude:number) => {
        const response = await fetch(`${api}/nearby-hospitals?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&radius=10000`, { cache: 'no-store' });
        const result = await response.json().catch(()=>({}));
        if (response.ok) return result;
        const q = `[out:json][timeout:20];(nwr[amenity=hospital](around:10000,${latitude},${longitude});nwr[healthcare=hospital](around:10000,${latitude},${longitude});nwr[amenity=clinic](around:10000,${latitude},${longitude}););out center tags;`;
        const endpoints = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
        let last:any = null;
        for (const endpoint of endpoints) {
          try {
            const direct = await fetch(`${endpoint}?data=${encodeURIComponent(q)}`, { cache: 'no-store' });
            if (!direct.ok) { last = new Error(`Map provider returned ${direct.status}`); continue; }
            const raw = await direct.json(); const toRad=(v:number)=>v*Math.PI/180;
            const hospitals=(raw.elements||[]).map((item:any)=>{const la=Number(item.lat??item.center?.lat),lo=Number(item.lon??item.center?.lon),tags=item.tags||{};const dLat=toRad(la-latitude),dLng=toRad(lo-longitude);const a=Math.sin(dLat/2)**2+Math.cos(toRad(latitude))*Math.cos(toRad(la))*Math.sin(dLng/2)**2;const km=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));return {id:`osm-${item.type}-${item.id}`,name:tags.name||tags['name:en']||'Healthcare facility',type:tags.amenity==='clinic'?'Clinic':'Hospital',distanceKm:Number(km.toFixed(1)),distance:km<1?`${Math.round(km*1000)} m`:`${km.toFixed(1)} km`,latitude:la,longitude:lo,phone:tags.phone||tags['contact:phone']||'',openingHours:tags.opening_hours||'',emergency:tags.emergency==='yes',address:[tags['addr:housenumber'],tags['addr:street'],tags['addr:city']].filter(Boolean).join(', ')}}).filter((h:any)=>Number.isFinite(h.latitude)&&Number.isFinite(h.longitude)).sort((a:any,b:any)=>a.distanceKm-b.distanceKm).slice(0,20);
            return { hospitals, fetchedAt: new Date().toISOString() };
          } catch (e) { last = e; }
        }
        throw new Error(result.message || last?.message || 'Unable to fetch nearby hospitals.');
      };
      const success = async ({ coords }: GeolocationPosition) => {
        try {
          const result = await requestHospitals(coords.latitude, coords.longitude);
          setNearbyHospitals(result.hospitals || []);
          const location = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy || null, capturedAt: new Date().toISOString() };
          setPatientLocation(location);
          localStorage.setItem(`swasthya_patient_location_${p.id}`, JSON.stringify(location));
          setLastFetchedAt(result.fetchedAt || new Date().toISOString());
          setLocationState('ready');
          setLocationMessage(result.hospitals?.length ? `Showing hospitals near your live location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}).` : 'No hospitals were found within 10 km.');
        } catch (error:any) { setLocationState('error'); setLocationMessage(error.message || 'Live hospital data is temporarily unavailable. Please try again.'); }
        finally { setNearbyLoading(false); }
      };
      const failure = (error: GeolocationPositionError) => {
        setNearbyLoading(false); setLocationState('error');
        const messages:any = { 1: 'Location permission was denied. Allow location access for this site in your browser settings, then press Refresh live hospitals.', 2: 'Your device could not determine its location. Turn on GPS/location services and try again.', 3: 'Location request timed out. Turn on GPS/location services and try again.' };
        setLocationMessage(messages[error.code] || 'Unable to read your live location. Please try again.');
      };
      navigator.geolocation.getCurrentPosition(success, failure, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    };
    useEffect(() => { if ((tab === 'facilities' || tab === 'home' || tab === 'book') && locationState === 'idle') fetchNearbyHospitals(); }, [tab]);
    const quick = [['book','Book care',Calendar,'Find a doctor and reserve your visit'],['assistant','AI Assistant',ClipboardList,'Get guidance and care information'],['records','Health record',HeartPulse,t('healthRecord')],['facilities','Nearby care',MapPin,t('nearbyDesc')]];
    return <>
      <section className="patient-hero"><div className="patient-hero-copy"><div className="patient-welcome"><span className="patient-avatar">{p.name?.[0]||'P'}</span><div><p className="eyebrow">{t('portal')}</p><b>{t('welcome')}, {p.name.split(' ')[0]}</b></div></div><h1>{t('hero')} <i>{t('hero2')}</i></h1><p>{t('heroText')}</p><div className="actions"><button className="primary" onClick={()=>setTab('book')}><Calendar/> {t('book')}</button><button className="outline" onClick={()=>setTab('assistant')}><Mic/> {t('check')}</button></div></div>{tab==='home'&&<div className="patient-emergency-card"><div className="emergency-card-icon"><Siren/></div><div className="emergency-card-copy"><p className="eyebrow">Emergency support</p><b>Need urgent help?</b><span>Your location is used to route the call to the nearest available healthcare worker.</span></div><button className="emergency-call-button" disabled={emergencyBusy} onClick={()=>void callEmergency()}><PhoneCall/> {emergencyBusy?'Connecting…':'Call emergency'}</button><small className="emergency-fallback-note">If no healthcare worker can be assigned, the call is routed to <b>112</b>.</small></div>}</section>
      <main className="patient-content"><div className="patient-layout"><aside className="patient-sidebar"><button className="sidebar-profile profile-button" onClick={()=>setProfileOpen(true)}><span className="profile-large">{p.name?.[0]||'P'}</span><div><b>{p.name}</b><small>{p.age} years · {p.sex}</small></div></button><div className="patient-nav-label">{t('care')}</div>{[['home',t('overview'),HeartPulse],['book',t('appointments'),Calendar],['assistant',t('healthCheck'),ClipboardList],['records',t('record'),Activity],['care-team','Care Team',MessageSquare],['facilities',t('nearby'),MapPin]].map(([id,label,Icon]:any)=><button className={cn('patient-nav',tab===id&&'active')} onClick={()=>setTab(id)} key={id}><Icon/><span>{label}</span><ChevronRight/></button>)}<div className="sidebar-help"><Video/><div><b>{t('help')}</b><small>{t('helpText')}</small></div><button className="help-button" onClick={requestHelp} disabled={helpRequested}>{helpRequested?'Requested':'Help'}</button></div></aside>
      <div className="patient-main">
      {tab==='home'&&<><div className="section-title patient-section-title"><div><p className="eyebrow">{t('today')}</p><h2>{t('glance')}</h2></div><span className="record-id">{p.abhaId?`ABHA ${p.abhaId}`:'Secure patient record'}</span></div>{data.dispatchedWorker&&<div className="patient-dispatched-worker-banner"><div className="worker-banner-icon"><UserCheck/></div><div className="worker-banner-info"><p className="eyebrow" style={{color:'#0369a1',fontWeight:700,margin:0}}>Frontline Care Outreach</p><h4 style={{margin:'4px 0',fontSize:16}}>Home Visit Dispatched by Doctor</h4><p style={{margin:0,fontSize:13,color:'#334155'}}>Dr. Ananya Sharma has dispatched frontline worker <b>{data.dispatchedWorker.name} ({data.dispatchedWorker.role})</b> to your location for vitals monitoring and urgent care support. Status: <b style={{textTransform:'capitalize'}}>{data.dispatchedWorker.status}</b> · Est. distance: {data.dispatchedWorker.distance||'1.5 km'}.</p></div>{data.dispatchedWorker.phone&&<button className="primary small" style={{minWidth:105,height:38}} onClick={()=>window.location.href=`tel:${data.dispatchedWorker.phone}`}><PhoneCall style={{width:14}}/> Call Worker</button>}</div>}<div className="patient-stats"><article><span><Calendar/></span><div><small>{t('nextVisit')}</small><b>{booked ? new Date(booked.startsAt).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' }) : t('notBooked')}</b><p>{booked ? `${t('token')} #${booked.token} · ${t('confirmed')}` : t('choose')}</p></div></article><article><span><ClipboardList/></span><div><small>{t('checkStatus')}</small><b>{latestIntake ? (latestIntake.status==='verified'?'Verified by Doctor':latestIntake.status.replace('_',' ')) : t('notStarted')}</b><p>{latestIntake ? (latestIntake.status==='verified'?'Clinical review completed':t('latest')) : t('share')}</p></div></article><article><span><Hospital/></span><div><small>{t('centre')}</small><b>{nearbyHospitals[0]?.name || data.facility.name}</b><p>{nearbyHospitals[0] ? `${nearbyHospitals[0].distance} away · live` : `${data.facility.distance} away · default care centre`}</p></div></article></div><div className="patient-grid-main"><section className="patient-card appointment-card-large"><div className="card-heading"><div><p className="eyebrow">{booked?t('appointments'):t('nextStep')}</p><h3>{booked?t('confirmedVisit'):t('findRight')}</h3></div>{booked&&<span className="success-pill"><CheckCircle2/> {t('confirmed')}</span>}</div>{booked?<AppointmentCard appointment={booked} data={data} setNotice={setNotice} refresh={refresh}/>:<div className="empty-inline"><div className="empty-icon"><Calendar/></div><div><b>{t('noAppointment')}</b><p>{t('findRight')}</p></div><button className="primary" onClick={()=>setTab('book')}>{t('findCare')} <ChevronRight/></button></div>}</section><section className="patient-card journey-card"><div className="card-heading"><div><p className="eyebrow">{t('connected')}</p><h3>{t('journey')}</h3></div><button className="link" onClick={()=>setTab('records')}>{t('viewRecord')} <ChevronRight/></button></div><div className="journey-vertical"><div className="journey-step done"><span>1</span><div><b>{t('register')}</b><small>{t('registered')}</small></div></div><div className="journey-line"/><div className={cn('journey-step',latestIntake&&'done')}><span>2</span><div><b>{t('healthCheck')}</b><small>{latestIntake ? (latestIntake.status==='verified'?'Verified by Clinician':'Clinical intake submitted · Pending review') : 'Static assistant available'}</small></div></div><div className="journey-line"/><div className={cn('journey-step',booked&&'done')}><span>3</span><div><b>{t('doctorVisit')}</b><small>{booked?t('confirmed'):t('chooseProfessional')}</small></div></div><div className="journey-line"/><div className="journey-step"><span>4</span><div><b>{t('followUp')}</b><small>Continue care after your visit</small></div></div></div></section></div>{(data.notifications||[]).length>0&&<section className="patient-card notifications-card" style={{marginTop:16}}><div className="card-heading"><div><p className="eyebrow">Care Network</p><h3>Care Team Messages & Updates ({(data.notifications||[]).length})</h3></div><Bell style={{color:'#0284c7'}}/></div><div className="patient-notification-list">{(data.notifications||[]).slice(0,4).map((n:any)=><article key={n.id} className={cn('patient-notification-item',n.type)}><div className="notif-header"><span className="notif-badge">{(n.type||'Message').replaceAll('_',' ')}</span><small>{new Date(n.createdAt).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div><p className="notif-msg">{n.message}</p></article>)}</div></section>}<section className="patient-card quick-actions-card"><div className="card-heading"><div><p className="eyebrow">{t('quick')}</p><h3>{t('what')}</h3></div></div><div className="patient-quick-grid">{quick.map(([id,label,Icon,desc]:any)=><button onClick={()=>setTab(id)} key={id}><span><Icon/></span><div><b>{label}</b><small>{desc}</small></div><ChevronRight/></button>)}</div></section></>}
      {tab==='book'&&<section className="patient-card form-card patient-form-card"><p className="eyebrow">{t('appointments')}</p><h2>{t('chooseProfessional')}</h2><p className="form-intro">Choose a doctor, date and a time slot. Each doctor works exactly 8 hours per day, and every slot accepts a maximum of 3 patients.</p><div className="facility patient-facility"><span className="facility-icon"><Hospital/></span><div><b>{selectedHospital?.name || data.facility.name}</b><span>{selectedHospital ? `${selectedHospital.distance} away · live location` : `${data.facility.distance} away · default care centre`}</span></div><span className="tag">{selectedHospital ? 'Live' : t('open')}</span></div><p className="form-intro">Select the hospital where you want to visit. Doctors and slots are then booked for that care location.</p>{nearbyHospitals.length>0&&<div className="hospital-radio-list">{nearbyHospitals.slice(0,5).map((h:any)=><label className={cn('hospital-radio-card',selectedHospital?.id===h.id&&'selected')} key={h.id}><input type="radio" name="hospital" checked={selectedHospital?.id===h.id} onChange={()=>{setSelectedHospital(h);setSelectedDoctor('');setSelectedDate('');setSelectedSlot('');setAvailableSlots([]);}}/><span className="radio-dot"/><span className="hospital-radio-info"><b>{h.name}</b><small>{h.distance} away{h.address?` · ${h.address}`:''}{h.emergency?' · Emergency':''}</small></span>{selectedHospital?.id===h.id&&<span className="book-label">{t('selected')} <CheckCircle2/></span>}</label>)}</div>}<div className="doctor-list">{hospitalDoctorsLoading?<p className="form-intro">Loading doctors available at this hospital…</p>:hospitalDoctors.length?hospitalDoctors.map((d:any)=><label className={cn('doctor-radio-card',selectedDoctor===d.id&&'selected')} key={d.id}><input type="radio" name="doctor" value={d.id} checked={selectedDoctor===d.id} onChange={()=>{setSelectedDoctor(d.id);setSelectedDate('');setSelectedSlot('');setAvailableSlots([]);}}/><span className="radio-dot"/><span className="avatar">{d.name.replace(/^Dr\.\s*/,'').slice(0,1)}</span><span className="doctor-radio-info"><b>{d.name}</b><small>{d.specialty} · {d.availability} · 8-hour shift · {Array.isArray(d.workingHours)?d.workingHours.map((r:any)=>`${r[0]}–${r[1]}`).join(' + '):'8 hours'}</small>{(d.phone||selectedHospital?.phone)&&<small>Contact: {d.phone||selectedHospital?.phone}</small>}</span>{selectedDoctor===d.id&&<span className="book-label">{t('selected')} <CheckCircle2/></span>}</label>):<div className="empty-inline compact"><div><b>No doctor roster is available for this hospital yet.</b><p>For this live hospital, use the hospital number to ask for doctor availability or appointment booking.</p>{selectedHospital?.phone&&<button className="link" onClick={()=>window.location.href=`tel:${selectedHospital.phone}`}>Call {selectedHospital.phone}</button>}</div></div>}</div>{selectedDoctor&&<div className="appointment-scheduler"><div><label>Visit date</label><input type="date" min={isoDate(minDate)} max={isoDate(maxDate)} value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);setSelectedSlot('')}}/></div><div><label>Select a time slot</label>{availabilityLoading?<p className="form-intro">Loading live slots…</p>:selectedDate?(availableSlots.length?<div className="time-slot-grid">{availableSlots.map((slot:any)=>{ const full=slot.status==='full'||slot.remaining<=0; return <label key={slot.startTime} className={cn('time-slot',selectedSlot===slot.startTime&&'selected',full&&'full')}><input type="radio" name="slot" disabled={full} checked={selectedSlot===slot.startTime} onChange={()=>setSelectedSlot(slot.startTime)}/><span>{new Date(`1970-01-01T${slot.startTime}:00`).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span><small>{full?'Full':'Available'}</small></label>})} </div>:<p className="form-intro">No slots available on this date. Choose another date.</p>):<p className="form-intro">Select a date to see available slots.</p>}</div></div>}<div className="appointment-confirm-bar"><span>{selectedSlot?`Selected: ${selectedDate} · ${selectedSlot}`:selectedDoctor?(selectedDate?'Choose a time slot':'Choose a visit date'):t('chooseDoctor')}</span><button className="primary" disabled={!selectedDoctor||!selectedDate||!selectedSlot||!!booked} onClick={async()=>{try{await action('/appointments',{patientId:p.id,doctorId:selectedDoctor,startsAt:`${selectedDate}T${selectedSlot}:00+05:30`,facilityId:bookingFacilityId,facilityName:selectedHospital?.name||data.facility.name,facilityLatitude:selectedHospital?.latitude,facilityLongitude:selectedHospital?.longitude},'Appointment booked successfully. Your selected hospital, doctor, date and time are now connected to the appointment.')}catch(e:any){setNotice(e.message||'Unable to book this slot.')}}}>{booked?'Already booked':t('confirm')}</button></div></section>}
      {tab==='assistant'&&<section className="patient-card form-card patient-form-card intake"><p className="eyebrow">SwasthyaSetu AI</p><h2>AI Assistant</h2><p className="form-intro">Your care companion for understanding your health journey. This assistant is currently a static demo and does not provide a diagnosis.</p><div className="ai-safe"><AlertTriangle/><span><b>For guidance only.</b> Medical decisions, diagnosis and emergency care must be handled by a qualified clinician.</span></div><div className="assistant-static-grid"><article><h3>What can I help with?</h3><ul><li>Understand your health records and reports</li><li>Prepare questions for your doctor</li><li>Explain common healthcare terms</li><li>Help you understand your upcoming visit</li></ul></article><article><h3>Quick questions</h3><div className="chips static"><span>What should I take to my appointment?</span><span>How do I read my report?</span><span>What happens during a consultation?</span></div></article></div><div className="actions"><button className="outline" onClick={()=>setNotice('AI Assistant is currently a static demo. Interactive AI will be enabled in a future release.')}>Ask AI Assistant <ChevronRight/></button><button className="primary" onClick={()=>setTab('records')}>View my health record <ChevronRight/></button></div></section>}
      {tab==='records'&&<section className="patient-card form-card patient-form-card"><div className="record-header"><div><p className="eyebrow">{t('record')}</p><h2>{p.name}{t('recordTitle')}</h2><p className="form-intro">{t('recordIntro')}</p></div><span className="record-shield"><HeartPulse/></span></div><div className="record-summary record-summary-clean"><div><b>{documents.length}</b><small>Medical reports</small></div><div><b>{(data.prescriptions || []).filter((r:any)=>r.patientId===p.id).length}</b><small>E-Prescriptions</small></div><div><b>{(data.consultations || []).filter((c:any)=>c.patientId===p.id).length}</b><small>Consultations</small></div><div><b>{(data.referrals || []).filter((r:any)=>r.patientId===p.id).length}</b><small>{t('refs')}</small></div></div><div className="patient-health-editor"><div className="record-upload-head"><div><h3>My medical information</h3><p>Write your current condition, history, allergies and medicines. Saved information is stored permanently with your patient record and is available to your assigned care team.</p></div><span className="record-shared-badge"><CheckCircle2/> Care team access</span></div><div className="clinical-context-grid"><label><b>Medical conditions</b><textarea value={medicalConditionDraft} disabled={!editingHealth} onChange={e=>setMedicalConditionDraft(e.target.value)} placeholder="Example: Diabetes, asthma, pregnancy, hypertension…" /></label><label><b>Medical history</b><textarea value={medicalHistoryDraft} disabled={!editingHealth} onChange={e=>setMedicalHistoryDraft(e.target.value)} placeholder="Previous illnesses, surgeries or important events…" /></label><label><b>Allergies</b><textarea value={allergiesDraft} disabled={!editingHealth} onChange={e=>setAllergiesDraft(e.target.value)} placeholder="Medicines, food or other allergies…" /></label><label><b>Current medicines</b><textarea value={medicationsDraft} disabled={!editingHealth} onChange={e=>setMedicationsDraft(e.target.value)} placeholder="Medicine name, dose or frequency…" /></label></div><div className="actions"><button className="outline" type="button" onClick={()=>setEditingHealth(x=>!x)}>{editingHealth?'Cancel editing':'Edit health records'}</button><button className="primary" disabled={healthSaving||!editingHealth} onClick={()=>void saveHealthContext()}>{healthSaving?'Saving…':'Save medical information'} <CheckCircle2/></button></div></div><div className="medical-record-upload"><div className="record-upload-head"><div><h3>Medical records</h3><p>Upload your medical report. Shared records are available to your assigned health worker and doctor.</p></div><span className="record-shared-badge"><CheckCircle2/> Shared with care team</span></div><div className="report-upload-grid"><select value={reportType} onChange={e=>setReportType(e.target.value)}><option value="blood_report">Blood report</option><option value="lab_report">Lab / diagnostic report</option><option value="prescription">Prescription</option><option value="scan">Scan / imaging</option><option value="discharge_summary">Discharge summary</option><option value="other">Other medical document</option></select><input placeholder="Optional note" value={reportNotes} onChange={e=>setReportNotes(e.target.value)}/><label className="primary upload-report-button"><Upload/> {reportUploading?'Uploading…':'Upload medical report'}<input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={reportUploading} onChange={e=>{void uploadMedicalReport(e.target.files?.[0]);e.currentTarget.value=''}} hidden/></label></div>{documents.length?<div className="medical-document-list">{documents.map((doc:any)=><article className="medical-document" key={doc.id}><span className="medical-document-icon"><FileText/></span><div><b>{doc.name}</b><small>{doc.type.replaceAll('_',' ')} · {formatBytes(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}</small>{doc.notes&&<p>{doc.notes}</p>}</div><span className="tag">{doc.sharedWithCareTeam?'Shared':'Private'}</span><div className="medical-document-actions"><button className="outline small" onClick={()=>openDocument(doc)}>Open</button><button className="outline small danger-button" onClick={()=>void removeDocument(doc)}>Remove</button></div></article>)}</div>:<div className="empty-inline compact"><FileText/><div><b>No medical reports added yet</b><p>Add your previous blood reports, prescriptions or other clinical documents so the care team has the full context.</p></div></div>}</div><div className="record-history-sections"><div className="record-history-card prescription-history-card"><div className="card-heading"><div><h3>E-Prescriptions</h3><p>Official prescriptions issued by your doctor with medicines and instructions.</p></div><Pill style={{color:'#059669'}}/></div>{((data.prescriptions||[]).filter((x:any)=>x.patientId===p.id)).length ? (data.prescriptions||[]).filter((x:any)=>x.patientId===p.id).map((rx:any)=><article className="patient-prescription-card" key={rx.id}><div className="rx-card-head"><div><b>{rx.doctorName||'Dr. Ananya Sharma'}</b><small>{new Date(rx.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</small></div><button className="outline small" onClick={()=>window.print()}><Printer style={{width:13}}/> Print</button></div>{rx.doctorNotes&&<div className="rx-doctor-note"><b>Instructions:</b> {rx.doctorNotes}</div>}<div className="rx-medicine-table">{(rx.medicines||[]).map((m:any,idx:number)=><div className="rx-medicine-item" key={idx}><div className="med-name"><b>{m.name}</b></div><div className="med-dosage">{m.dosage||'As advised'}</div>{m.days>0&&<span className="med-duration">{m.days} days</span>}</div>)}</div></article>) : <p className="form-intro">No prescriptions issued yet.</p>}</div><div className="record-history-card consultation-history-card"><div className="card-heading"><div><h3>Doctor Consultations &amp; Notes</h3><p>Clinical observations, vitals and counsel recorded by your doctor.</p></div><Stethoscope style={{color:'#0284c7'}}/></div>{((data.consultations||[]).filter((x:any)=>x.patientId===p.id)).length ? (data.consultations||[]).filter((x:any)=>x.patientId===p.id).map((c:any)=><article className="patient-consult-card" key={c.id}><div className="consult-card-head"><div><b>{c.doctorName||'Dr. Ananya Sharma'}</b><small>{new Date(c.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div><span className="tag consult-tag">Verified</span></div><div className="consult-card-body">{c.notes?<p style={{whiteSpace:'pre-line',margin:0}}>{c.notes}</p>:<p style={{color:'#64748b',margin:0,fontStyle:'italic'}}>Consultation recorded.</p>}</div></article>) : <p className="form-intro">No doctor consultations recorded yet.</p>}</div><div className="record-history-card diagnostic-history-card"><div className="card-heading"><div><h3>Diagnostic &amp; Lab Orders</h3><p>Tests and lab investigations ordered for you.</p></div><FlaskConical style={{color:'#7c3aed'}}/></div>{((data.diagnosticOrders||[]).filter((x:any)=>x.patientId===p.id)).length ? (data.diagnosticOrders||[]).filter((x:any)=>x.patientId===p.id).map((d:any)=><div className="timeline" key={d.id}><div className="timeline-icon" style={{background:'#f5f3ff',color:'#7c3aed'}}><FlaskConical/></div><div><div className="timeline-title"><b>{d.testName}</b><span className={cn('status',d.status)}>{d.status}</span></div><p>Facility: <b>{d.facilityName||'Diagnostic Centre'}</b></p><small>Ordered on {new Date(d.orderedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</small></div></div>) : <p className="form-intro">No diagnostic tests ordered yet.</p>}</div><div className="record-history-card"><div className="card-heading"><div><h3>Appointments</h3><p>Visits booked by you are added here automatically.</p></div></div>{(data.appointments||[]).filter((a:any)=>a.patientId===p.id).length?(data.appointments||[]).filter((a:any)=>a.patientId===p.id).sort((a:any,b:any)=>new Date(b.startsAt).getTime()-new Date(a.startsAt).getTime()).map((a:any)=>{const d=(data.doctors||[]).find((x:any)=>x.id===a.doctorId)||hospitalDoctors.find((x:any)=>x.id===a.doctorId);return <div className="timeline" key={a.id}><div className="timeline-icon"><Calendar/></div><div><div className="timeline-title"><b>{d?.name||'Doctor appointment'}</b><span className={cn('status',a.status)}>{a.status}</span></div><p>{new Date(a.startsAt).toLocaleString('en-IN')} · Token #{a.token}</p><small>{a.facilityName||data.facility.name}</small></div></div>}):<p className="form-intro">No appointments recorded yet.</p>}</div><div className="record-history-card"><div className="card-heading"><div><h3>Referrals</h3><p>Referrals made during your care journey appear here.</p></div></div>{(data.referrals||[]).filter((r:any)=>r.patientId===p.id).length?(data.referrals||[]).filter((r:any)=>r.patientId===p.id).map((r:any)=><div className="timeline" key={r.id}><div className="timeline-icon"><Hospital/></div><div><div className="timeline-title"><b>Referral · {r.referralToken || r.id}</b><span className="status">{r.status}</span></div><p>{r.reason}</p><small>To {r.toFacilityName || r.toFacilityId} · Special referral token: <b>{r.referralToken || 'Pending'}</b></small></div></div>):<p className="form-intro">No referrals recorded yet.</p>}</div></div></section>}
<section className="patient-card precaution-card" style={{marginTop:'18px'}}><div className="card-heading"><div><p className="eyebrow">{t('Precautions')}</p><h3>Care team precautions</h3><p>Important guidance sent to you by your healthcare worker.</p></div><AlertTriangle/></div>{(data.precautions||[]).filter((x:any)=>x.patientId===p.id).length?(data.precautions||[]).filter((x:any)=>x.patientId===p.id).map((x:any)=><article className="precaution-row" key={x.id}><div><b>{x.message}</b><small>{new Date(x.createdAt).toLocaleString('en-IN')} · {x.sentBy.replace('_',' ')}</small></div><span className={cn('status',x.status)}>{x.status==='active'?'Active':'Resolved'}</span>{x.status==='active'&&<button className="primary small" onClick={async()=>{const r=await fetch(`${api}/precautions/${x.id}/resolve`,{method:'PATCH'});if(r.ok){await refresh();setNotice('Precaution marked as resolved.')}}}>{t('Resolve precaution')}</button>}</article>):<p className="form-intro">{t('No precautions from your care team yet.')}</p>}</section>
      {tab==='care-team'&&<CareTeamMessages patientId={p.id} data={data} setNotice={setNotice} refresh={refresh} actorRole="patient" actorId="user-patient" actorName={p.name} />}
      {tab==='facilities'&&<section className="patient-card form-card patient-form-card"><div className="record-header"><div><p className="eyebrow">{t('nearby')}</p><h2>Hospitals near you</h2><p className="form-intro">Live results are fetched from OpenStreetMap using your device location. Location is used only for this search.</p></div><button className="primary" onClick={fetchNearbyHospitals} disabled={nearbyLoading}>{nearbyLoading?'Locating…':'Refresh live hospitals'} <MapPin/></button></div>{locationMessage&&<div className={cn('ai-safe',locationState==='error'&&'error')}><MapPin/><span>{locationMessage}</span></div>}{nearbyHospitals.length>0?<div className="live-hospital-list">{nearbyHospitals.map((h:any)=><article className="facility facility-detail live-hospital" key={h.id}><span className="facility-icon"><Hospital/></span><div className="live-hospital-info"><div><b>{h.name}</b>{h.emergency&&<span className="tag">Emergency</span>}</div><span>{h.distance} away{h.address?` · ${h.address}`:''}</span>{h.openingHours&&<small>Hours: {h.openingHours}</small>}{h.phone&&<small>Phone: {h.phone}</small>}</div><div className="live-hospital-actions"><button className="outline" onClick={()=>window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${h.latitude},${h.longitude}`)}`,'_blank','noopener,noreferrer')}><MapPin/> Directions</button>{h.phone&&<button className="link" onClick={()=>window.location.href=`tel:${h.phone}`} >Call</button>}</div></article>)}</div>:<div className="empty-inline"><div className="empty-icon"><Hospital/></div><div><b>{nearbyLoading?'Finding nearby hospitals…':'No live hospitals to show yet'}</b><p>Allow location access and refresh to search within 10 km.</p></div></div>}<div className="live-source-note">Live source: OpenStreetMap · {lastFetchedAt?`Last fetched ${new Date(lastFetchedAt).toLocaleTimeString()}`:'Not fetched yet'} · Results may vary as map data changes.</div></section>}
      </div></div></main>
    </>
}

function Empty({ onClick }: any) { return <article className="empty"><div><Calendar /></div><h3>No appointment yet</h3><p>Start with a visit at your nearby health centre.</p><button className="primary" onClick={onClick}>Find care <ChevronRight /></button></article> }; function AppointmentCard({ appointment, data, setNotice, refresh }: any) {
  const d = data.doctors.find((x: any) => x.id === appointment.doctorId);
  const existing = (data.teleconsults || []).find((x: any) => x.appointmentId === appointment.id && ['requested','connected'].includes(x.status));
  const [busy,setBusy]=useState(false);
  const [joining,setJoining]=useState(false);
  const when=new Date(appointment.startsAt);
  const cancel=async()=>{if(!window.confirm(`Cancel appointment with ${d?.name || 'the doctor'} at ${when.toLocaleString()}? Your token #${appointment.token} will be deleted and the slot will become available again.`)) return; setBusy(true);try{const r=await fetch(`${api}/appointments/${appointment.id}/cancel`,{method:'PATCH'});const result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(result.message||'Unable to cancel');await refresh();setNotice('Appointment cancelled successfully. The overview is updated now.');}catch(e:any){setNotice(e.message||'Unable to cancel the appointment right now.')}finally{setBusy(false)}};
  const requestTeleconsult=async()=>{setJoining(true);const popup=window.open('about:blank','_blank');try{let tele=existing;if(!tele){const r=await fetch(`${api}/teleconsults`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:appointment.patientId,appointmentId:appointment.id,doctorId:appointment.doctorId})});const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.message||'Unable to request teleconsult.');tele=x.teleconsult;}const room=`https://meet.jit.si/SwasthyaSetu-${tele.id}`;if(popup){popup.location.href=room;}else{window.location.href=room;}setNotice(tele.status==='connected'?'Opening your live teleconsultation room.':'Teleconsult requested. The care team can connect you in the same room.');await refresh();}catch(e:any){if(popup)popup.close();setNotice(e.message||'Unable to start teleconsultation.')}finally{setJoining(false)}};
  return <article className="appointment"><div className="token"><small>Your token</small><b>#{appointment.token}</b><span>{appointment.status==='booked'?'Confirmed':'Cancelled'}</span></div><div><p className="eyebrow">{when.toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'})} · {when.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</p><h3>{d?.name}</h3><p>{d?.specialty} · {(appointment as any).facilityName || data.facility.name}</p><div className="appointment-actions"><button className="link" onClick={()=>setNotice(`Visit details: Token #${appointment.token}, ${d?.name}, ${when.toLocaleString()}.`)}>View visit details <ChevronRight/></button><button className="link danger-link" disabled={busy} onClick={cancel}>{busy?'Cancelling…':'Cancel appointment'}</button></div></div><button className="video" disabled={joining} onClick={requestTeleconsult}><Video/> {joining?'Opening…':existing?(existing.status==='connected'?'Join teleconsultation':'Open requested visit'):'Start teleconsultation'}</button></article>
}

// ── Language translations for DoctorView UI labels ──────────────────────────
const DT: Record<string, Record<string, string>> = {
  EN: { triageQueue: 'Triage Queue', severityFilter: 'Severity Filter:', statusFilter: 'Status Filter:', liveFeed: 'Live Feed', simulateCritical: 'Simulate Critical Case', refreshQueue: 'Refresh Queue', frontlineAssigned: 'Frontline Worker Assigned', noWorkerAssigned: 'No Frontline Worker Assigned', dispatchWorker: 'Dispatch', teleconsult: 'Teleconsult', writePrescription: 'Write E-Prescription', orderDiagnostics: 'Order Diagnostics', referSpecialist: 'Refer Specialist', updateStatus: 'Update Status', clinicianActions: 'Clinician Actions for', saveConsultation: 'Save Consultation Notes', savingConsultation: 'Saving\u2026' },
  HI: { triageQueue: '\u091f\u094d\u0930\u093e\u092f\u0091 \u0915\u0924\u093e\u0930', severityFilter: '\u0917\u0902\u092d\u0940\u0930\u0924\u093e \u092b\u093c\u093f\u0932\u094d\u091f\u0930:', statusFilter: '\u0938\u094d\u0925\u093f\u0924\u093f \u092b\u093c\u093f\u0932\u094d\u091f\u0930:', liveFeed: '\u0932\u093e\u0907\u0935 \u092b\u093c\u0940\u0921', simulateCritical: '\u0917\u0902\u092d\u0940\u0930 \u0915\u0947\u0938 \u0938\u093f\u092e\u0941\u0932\u0947\u091f \u0915\u0930\u0947\u0902', refreshQueue: '\u0915\u0924\u093e\u0930 \u0930\u093f\u092b\u094d\u0930\u0947\u0936 \u0915\u0930\u0947\u0902', frontlineAssigned: '\u092b\u094d\u0930\u0902\u091f\u0932\u093e\u0907\u0928 \u0915\u093e\u0930\u094d\u092f\u0915\u0930\u094d\u0924\u093e \u0928\u093f\u092f\u0941\u0915\u094d\u0924', noWorkerAssigned: '\u0915\u094b\u0908 \u0915\u093e\u0930\u094d\u092f\u0915\u0930\u094d\u0924\u093e \u0928\u093f\u092f\u0941\u0915\u094d\u0924 \u0928\u0939\u0940\u0902', dispatchWorker: '\u092d\u0947\u091c\u0947\u0902', teleconsult: '\u091f\u0947\u0932\u0940\u0915\u0902\u0938\u0932\u094d\u091f', writePrescription: '\u0908-\u092a\u094d\u0930\u093f\u0938\u094d\u0915\u094d\u0930\u093f\u092a\u094d\u0936\u0928', orderDiagnostics: '\u091c\u093e\u0902\u091a \u0911\u0930\u094d\u0921\u0930', referSpecialist: '\u0935\u093f\u0936\u0947\u0937\u091c\u094d\u091e \u0930\u0947\u092b\u0930', updateStatus: '\u0938\u094d\u0925\u093f\u0924\u093f \u0905\u092a\u0921\u0947\u091f', clinicianActions: '\u091a\u093f\u0915\u093f\u0924\u094d\u0938\u0915 \u0915\u094d\u0930\u093f\u092f\u093e\u090f\u0902 \u2014', saveConsultation: '\u092a\u0930\u093e\u092e\u0930\u094d\u0936 \u0928\u094b\u091f\u094d\u0938 \u0938\u0939\u0947\u091c\u0947\u0902', savingConsultation: '\u0938\u0939\u0947\u091c\u093e \u091c\u093e \u0930\u0939\u093e \u0939\u0948\u2026' },
  TA: { triageQueue: 'Triage Queue', severityFilter: 'Severity Filter:', statusFilter: 'Status Filter:', liveFeed: 'Live Feed', simulateCritical: 'Simulate Critical Case', refreshQueue: 'Refresh Queue', frontlineAssigned: 'Frontline Worker Assigned', noWorkerAssigned: 'No Frontline Worker Assigned', dispatchWorker: 'Dispatch', teleconsult: 'Teleconsult', writePrescription: 'Write E-Prescription', orderDiagnostics: 'Order Diagnostics', referSpecialist: 'Refer Specialist', updateStatus: 'Update Status', clinicianActions: 'Clinician Actions for', saveConsultation: 'Save Consultation Notes', savingConsultation: 'Saving...' }
};

function DoctorView({ data, action, setNotice, refresh, language }: any) {
  const lang = language || 'EN';
  const t = (key: string) => (DT[lang] ?? DT['EN'])[key] ?? (DT['EN'][key] ?? key);
  const cases: any[] = data.cases || [];
  const medicines: any[] = data.dashboard?.medicines || [];
  const workers: any[] = data.dashboard?.resourceOverview?.frontlineWorkers || [];

  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [dispatchingWorker, setDispatchingWorker] = useState(false);
  const [activeModal, setActiveModal] = useState<'consult' | 'prescription' | 'diagnostic' | 'referral' | 'resolve' | null>(null);

  const getDefaultMeds = (c: any) => {
    const complaint = (c.summary?.chiefComplaint || '').toLowerCase();
    const conditions = (c.summary?.history?.conditions || []).join(' ').toLowerCase();
    if (complaint.includes('pregnant') || complaint.includes('gestation') || conditions.includes('gestation') || complaint.includes('weeks')) return [{ name: 'Tab. Labetalol 100mg', dosage: '1 tablet twice daily (with BP monitoring)', days: 7 }, { name: 'Tab. Paracetamol 500mg', dosage: '1 tablet as needed for severe headache', days: 3 }, { name: 'Inj. Magnesium Sulphate (stat dose)', dosage: 'Under clinical supervision only', days: 1 }];
    if (complaint.includes('chest') || complaint.includes('crushing') || complaint.includes('cardiac')) return [{ name: 'Tab. Aspirin 325mg', dosage: '1 tablet stat (chew immediately)', days: 1 }, { name: 'Tab. Clopidogrel 300mg', dosage: '1 tablet stat loading dose', days: 1 }, { name: 'Sublingual Nitroglycerin 0.5mg', dosage: '1 tab under tongue, repeat \u00d72 at 5 min intervals', days: 1 }];
    if (complaint.includes('stroke') || complaint.includes('slurring')) return [{ name: 'Tab. Aspirin 300mg', dosage: '1 tablet stat (ONLY if CT rules out haemorrhage)', days: 1 }, { name: 'IV Access + Emergency Transport STAT', dosage: 'Thrombolysis door-to-needle priority within golden hour', days: 0 }];
    if (c.patientAge <= 12) return [{ name: 'Paracetamol Syrup 250mg/5ml', dosage: '10 ml every 6 hrs if temp > 38.5\u00b0C', days: 3 }, { name: 'ORS (Oral Rehydration Solution)', dosage: 'After every loose stool / vomiting episode', days: 3 }, { name: 'Zinc Dispersible Tab 20mg', dosage: '1 tablet daily for 14 days', days: 14 }];
    if (complaint.includes('cough') || complaint.includes('sputum') || complaint.includes('tb')) return [{ name: 'Refer to NTEP (National TB Elimination Programme)', dosage: 'Do NOT initiate empiric ATT — sputum confirmation required first', days: 0 }, { name: 'Tab. Vitamin B6 (Pyridoxine) 10mg', dosage: '1 tablet daily (supportive therapy)', days: 30 }];
    if (complaint.includes('abdomen') || complaint.includes('appendic') || complaint.includes('right lower')) return [{ name: 'Tab. Paracetamol 500mg', dosage: '1 tablet every 6 hrs for mild pain', days: 2 }, { name: 'NPO (Nil Per Oral) — Pending Surgical Review', dosage: 'Withhold all oral intake pending USG and surgical opinion', days: 0 }];
    if (complaint.includes('bp') || complaint.includes('hypertension') || complaint.includes('refill')) return [{ name: 'Tab. Amlodipine 5mg', dosage: '1 tablet once daily in the morning', days: 30 }];
    if (complaint.includes('rash') || complaint.includes('skin') || complaint.includes('itch')) return [{ name: 'Tab. Cetirizine 10mg', dosage: '1 tablet at bedtime for 5 days', days: 5 }, { name: 'Calamine Lotion (topical)', dosage: 'Apply on affected area 3 times daily', days: 5 }];
    if (complaint.includes('knee') || complaint.includes('joint') || complaint.includes('stiffness')) return [{ name: 'Tab. Paracetamol 500mg', dosage: '1 tablet twice daily after food', days: 7 }, { name: 'Tab. Diclofenac 50mg', dosage: '1 tablet after food twice daily', days: 5 }];
    return [{ name: 'Tab. Paracetamol 500mg', dosage: '1 tablet every 8 hours as needed', days: 3 }];
  };
  const getDefaultDiagTest = (c: any) => {
    const complaint = (c.summary?.chiefComplaint || '').toLowerCase();
    if (complaint.includes('pregnant') || complaint.includes('gestation') || complaint.includes('weeks')) return 'Complete Blood Count (CBC) + Urinalysis (Proteinuria)';
    if (complaint.includes('chest') || complaint.includes('crushing') || complaint.includes('cardiac')) return '12-Lead Electrocardiogram (ECG) Stat';
    if (complaint.includes('cough') || complaint.includes('sputum') || complaint.includes('tb')) return 'Sputum Smear Microscopy for AFB';
    if (complaint.includes('abdomen') || complaint.includes('appendic')) return 'Obstetric Sonography (USG) Scan';
    return 'Complete Blood Count (CBC) + Urinalysis (Proteinuria)';
  };
  const getDefaultRefFacility = (c: any) => {
    const complaint = (c.summary?.chiefComplaint || '').toLowerCase();
    if (complaint.includes('pregnant') || complaint.includes('gestation') || complaint.includes('weeks')) return 'District Civil Hospital - Obstetrics & High Risk Pregnancy Unit';
    if (complaint.includes('chest') || complaint.includes('crushing') || complaint.includes('cardiac')) return 'Sub-District Hospital - Cardiology Unit';
    if (complaint.includes('stroke') || complaint.includes('slurring')) return 'Regional Tertiary Medical College - Stroke & Neurology Center';
    if (complaint.includes('cough') || complaint.includes('sputum') || complaint.includes('tb')) return 'District Tuberculosis & Respiratory Care Center';
    if (c.patientAge <= 12) return 'District Hospital - Paediatrics & Child Health Unit';
    if (complaint.includes('abdomen') || complaint.includes('appendic')) return 'Sub-District Hospital - General Surgery Unit';
    return 'District Civil Hospital - Obstetrics & High Risk Pregnancy Unit';
  };
  const getDefaultRefPriority = (c: any) => { if (c.severity?.level === 'critical') return 'Critical / Immediate Transfer'; if (c.severity?.level === 'urgent') return 'Urgent (within 24 hours)'; return 'Routine Consultation'; };
  const getDefaultRefReason = (c: any) => { const flags = (c.summary?.redFlags || []).length > 0 ? ` Red Flags: ${(c.summary?.redFlags || []).join(', ')}.` : ''; return `${(c.severity?.level || 'routine').toUpperCase()} referral: ${c.summary?.chiefComplaint || 'Patient referral'}.${flags} Specialist evaluation required.`; };
  const getStockStatus = (medName: string) => { const name = medName.toLowerCase(); const found = medicines.find((m: any) => { const mname = (m.name || '').toLowerCase(); const key = mname.split(' ')[0]; return key.length > 2 && (name.includes(key) || key.includes(name.split(' ')[0])); }); if (!found) return { label: 'Check stock', color: '#64748b', bg: '#f1f5f9' }; if (found.status === 'Low stock') return { label: `Low stock (${found.quantity})`, color: '#b45309', bg: '#fef3c7' }; return { label: `In stock (${found.quantity})`, color: '#166534', bg: '#dcfce7' }; };

  const [rxMedicines, setRxMedicines] = useState([{ name: 'Tab. Labetalol 100mg', dosage: '1 tablet twice daily', days: 7 }, { name: 'Tab. Paracetamol 500mg', dosage: '1 tablet as needed for severe headache', days: 3 }]);
  const [rxNotes, setRxNotes] = useState('');
  const [diagTest, setDiagTest] = useState('Complete Blood Count (CBC) + Urinalysis (Proteinuria)');
  const [diagFacility, setDiagFacility] = useState('Seva PHC Sonography & Diagnostic Unit');
  const [refFacility, setRefFacility] = useState('District Civil Hospital - Obstetrics & High Risk Pregnancy Unit');
  const [refReason, setRefReason] = useState('Urgent maternal evaluation for severe pre-eclampsia');
  const [refPriority, setRefPriority] = useState('Critical / Immediate');
  const [resolveType, setResolveType] = useState<'resolve' | 'followup'>('followup');
  const [followUpDate, setFollowUpDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
  const [resolveNotes, setResolveNotes] = useState('Patient stabilized; scheduled for PHC clinical follow-up.');
  const [teleconsultNotes, setTeleconsultNotes] = useState('');
  const [teleconsultVitals, setTeleconsultVitals] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [savingConsult, setSavingConsult] = useState(false);

  useEffect(() => { if (cases.length > 0 && !cases.some(c => c.id === selectedCaseId)) { setSelectedCaseId(cases[0].id); } }, [cases]);
  useEffect(() => {
    const c = cases.find(x => x.id === selectedCaseId) || cases[0];
    if (!c) return;
    setRxMedicines(getDefaultMeds(c)); setRxNotes(''); setDiagTest(getDefaultDiagTest(c)); setDiagFacility('Seva PHC Sonography & Diagnostic Unit');
    setRefFacility(getDefaultRefFacility(c)); setRefReason(getDefaultRefReason(c)); setRefPriority(getDefaultRefPriority(c));
    setResolveNotes('Patient stabilized; scheduled for PHC clinical follow-up.'); setTeleconsultNotes(''); setTeleconsultVitals(''); setMicMuted(false); setCameraOff(false);
  }, [selectedCaseId]);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  const filteredCases = cases.filter(c => { if (severityFilter !== 'all' && c.severity?.level !== severityFilter) return false; if (statusFilter !== 'all' && c.status !== statusFilter) return false; return true; });
  const severityRank: Record<string, number> = { critical: 1, urgent: 2, concerning: 3, routine: 4 };
  const sortedCases = [...filteredCases].sort((a, b) => (severityRank[a.severity?.level] || 4) - (severityRank[b.severity?.level] || 4));
  const criticalCases = cases.filter(c => c.severity?.level === 'critical' && c.status !== 'resolved');
  const availableWorkers = workers.filter((w: any) => w.status === 'available' || w.status === 'on_site');

  const handleSimulateIncoming = async (type: 'critical' | 'urgent') => {
    setSimulating(true);
    try {
      const res = await fetch(`${api}/cases/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
      const newCase = await res.json();
      await refresh();
      setSelectedCaseId(newCase.id);
      setNotice(`ALERT: New ${type.toUpperCase()} patient case ${newCase.id} arrived in triage queue!`);
    } catch (e) { setNotice('Unable to simulate incoming case.'); } finally { setSimulating(false); }
  };
  const handleSaveConsultation = async () => {
    if (!selectedCase) return; setSavingConsult(true);
    try {
      await fetch(`${api}/cases/${selectedCase.id}/consultation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorNotes: teleconsultNotes, vitals: teleconsultVitals, nextSteps: '' }) });
      await refresh(); setActiveModal(null); setNotice(`Teleconsultation notes saved for ${selectedCase.patientName}. Timeline updated.`);
    } catch (e) { setNotice('Error saving consultation notes.'); } finally { setSavingConsult(false); }
  };
  const handleIssuePrescription = async () => {
    if (!selectedCase) return;
    try {
      await fetch(`${api}/cases/${selectedCase.id}/prescription`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medicines: rxMedicines, doctorNotes: rxNotes }) });
      await refresh(); setActiveModal(null); setNotice(`E-Prescription issued for ${selectedCase.patientName}. Timeline updated.`);
    } catch (e) { setNotice('Error issuing prescription.'); }
  };
  const handleOrderDiagnostics = async () => {
    if (!selectedCase) return;
    try {
      await fetch(`${api}/cases/${selectedCase.id}/diagnostics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testName: diagTest, facilityName: diagFacility }) });
      await refresh(); setActiveModal(null); setNotice(`Diagnostic test '${diagTest}' ordered for ${selectedCase.patientName}.`);
    } catch (e) { setNotice('Error ordering diagnostics.'); }
  };
  const handleCreateReferral = async () => {
    if (!selectedCase) return;
    try {
      await fetch(`${api}/cases/${selectedCase.id}/referral`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toFacilityName: refFacility, reason: refReason, priority: refPriority }) });
      await refresh(); setActiveModal(null); setNotice(`CLOSED-LOOP REFERRAL CREATED to ${refFacility}. Updated patient longitudinal history.`);
    } catch (e) { setNotice('Error creating referral.'); }
  };
  const handleResolveCase = async () => {
    if (!selectedCase) return;
    try {
      await fetch(`${api}/cases/${selectedCase.id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: resolveType, followUpDate, notes: resolveNotes }) });
      await refresh(); setActiveModal(null); setNotice(resolveType === 'followup' ? `Follow-up flagged for ${followUpDate}.` : `Case ${selectedCase.id} marked as resolved.`);
    } catch (e) { setNotice('Error updating case status.'); }
  };
  const handleDispatchWorker = async (worker: any) => {
    if (!selectedCase) return; setDispatchingWorker(true);
    try {
      await fetch(`${api}/cases/${selectedCase.id}/dispatch-worker`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerName: worker.name, role: worker.role, phone: worker.phone || '+91 98765 00000', distance: '1.5 km' }) });
      await refresh(); setNotice(`${worker.name} (${worker.role}) dispatched to ${selectedCase.patientName}'s location.`);
    } catch (e) { setNotice('Error dispatching frontline worker.'); } finally { setDispatchingWorker(false); }
  };

  return (
    <main className="dashboard" style={{ paddingTop: 16 }}>
      <section className="dash-title" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow">Clinician Workspace \u00b7 SwasthyaSetu</p>
          <h1>AI-Triaged Patient Care Dashboard</h1>
        </div>
        <div className="actions" style={{ margin: 0 }}>
          <button className="primary" style={{ background: '#b91c1c', boxShadow: '0 4px 12px rgba(185,28,28,0.3)' }} disabled={simulating} onClick={() => handleSimulateIncoming('critical')}>
            <Zap className="pulse-icon" /> {simulating ? 'Simulating\u2026' : t('simulateCritical')}
          </button>
          <button className="outline" onClick={() => refresh()}><RefreshCw /> {t('refreshQueue')}</button>
        </div>
      </section>

      {selectedCase && <CareTeamMessages patientId={selectedCase.patientId} data={data} setNotice={setNotice} refresh={refresh} actorRole="doctor" actorId="user-doctor" actorName="Dr. Ananya Sharma" compact />}

      {selectedCase && (() => { const patientRecord = (data.patients || []).find((p:any) => p.id === selectedCase.patientId); const reports = (data.medicalDocuments || []).filter((d:any) => d.patientId === selectedCase.patientId && d.sharedWithCareTeam); return <section className="panel clinical-context-card" style={{marginBottom:16}}>
        <div className="card-heading"><div><p className="eyebrow">Shared patient record</p><h3>{patientRecord?.name || selectedCase.patientName} · Medical information &amp; reports</h3><p>The doctor sees the same patient context and consent-shared reports that are available to the care team.</p></div><span className="record-shared-badge"><CheckCircle2/> Shared</span></div>
        <div className="clinical-context-grid">
          <div><b>Medical conditions</b><p>{patientRecord?.medicalCondition || 'None recorded.'}</p></div>
          <div><b>Medical history</b><p>{patientRecord?.medicalHistory || 'None recorded.'}</p></div>
          <div><b>Allergies</b><p>{patientRecord?.allergies || 'None recorded.'}</p></div>
          <div><b>Current medicines</b><p>{patientRecord?.medications || 'None recorded.'}</p></div>
        </div>
        <div style={{marginTop:14}}><b style={{fontSize:13}}>Patient-uploaded reports</b>{reports.length ? <div className="medical-document-list" style={{marginTop:8}}>{reports.map((doc:any)=><article className="medical-document" key={doc.id}><span className="medical-document-icon"><FileText/></span><div><b>{doc.name}</b><small>{doc.type.replaceAll('_',' ')} · {formatBytes(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}</small>{doc.notes&&<p>{doc.notes}</p>}</div><span className="tag">Shared</span><button className="outline small" onClick={()=>openMedicalDocument(doc)}>Open PDF / report</button></article>)}</div> : <p className="form-intro">No shared medical reports uploaded yet.</p>}</div>
      </section>; })()}

      {criticalCases.length > 0 && (
        <div className="critical-pinned-banner">
          <div>
            <h4><ShieldAlert /> CRITICAL ALERT: {criticalCases.length} High-Severity Case(s) Pending Review</h4>
            <p>Top Priority: <b>{criticalCases[0].patientName}</b> ({criticalCases[0].summary?.chiefComplaint}) \u2014 Frontline worker {criticalCases[0].frontlineWorker?.name || 'Alerted'}</p>
          </div>
          <button className="primary" style={{ background: '#fff', color: '#b91c1c', border: '0', fontSize: 12 }} onClick={() => setSelectedCaseId(criticalCases[0].id)}>Open Critical Case <ChevronRight /></button>
        </div>
      )}

      <div className="careline-workspace">
        {/* COLUMN 1: TRIAGE QUEUE */}
        <aside className="queue-column">
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <b style={{ fontSize: 15, color: '#163e37' }}>{t('triageQueue')} ({sortedCases.length})</b>
              <span className="tag" style={{ background: '#e0f2fe', color: '#0369a1' }}>{t('liveFeed')}</span>
            </div>
            <div className="queue-filter-bar">
              <div>
                <small style={{ color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('severityFilter')}</small>
                <div className="filter-group">
                  {['all', 'critical', 'urgent', 'concerning', 'routine'].map(s => (
                    <button key={s} className={cn('filter-btn', severityFilter === s && 'active')} onClick={() => setSeverityFilter(s)}>{s.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <small style={{ color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('statusFilter')}</small>
                <div className="filter-group">
                  {['all', 'new', 'in_review', 'action_taken', 'resolved'].map(st => (
                    <button key={st} className={cn('filter-btn', statusFilter === st && 'active')} onClick={() => setStatusFilter(st)}>{st.replace('_', ' ').toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: 4 }}>
              {sortedCases.map(c => (
                <div key={c.id} className={cn('case-card-item', selectedCaseId === c.id && 'selected', c.severity?.level === 'critical' && 'is-critical')} onClick={() => setSelectedCaseId(c.id)}>
                  <div className="case-card-header">
                    <span className="case-patient-name">{c.patientName}, {c.patientAge}{c.patientGender?.[0]}</span>
                    <span className={cn('severity-badge', c.severity?.level)}>{c.severity?.level}</span>
                  </div>
                  <div className="case-chief-complaint">{c.summary?.chiefComplaint}</div>
                  {c.severity?.override?.overridden && (
                    <div style={{ fontSize: 10, color: '#be123c', background: '#ffe4e6', padding: '2px 6px', borderRadius: 4, marginBottom: 6, fontWeight: 700 }}>\u26a1 Rule Override Escalation</div>
                  )}
                  <div className="case-meta-row">
                    <span><Clock style={{ width: 12, verticalAlign: 'middle' }} /> {c.timeAgo}</span>
                    <span className={cn('status-pill', c.status)}>{c.status?.replace('_', ' ')}</span>
                  </div>
                  {c.frontlineWorker && (
                    <div style={{ fontSize: 10, color: '#0369a1', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><UserCheck style={{ width: 12 }} /> Worker: {c.frontlineWorker.name} ({c.frontlineWorker.status})</div>
                  )}
                </div>
              ))}
              {sortedCases.length === 0 && <div className="empty" style={{ padding: 20 }}><p>No cases match selected filters.</p></div>}
            </div>
          </div>
        </aside>

        {/* COLUMN 2: PATIENT CASE DETAIL */}
        <section className="detail-column">
          {selectedCase ? (
            <div className="case-detail-container">
              <div className="detail-header-card">
                <div className="detail-patient-title-row">
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CASE #{selectedCase.id} \u00b7 SUBMITTED {selectedCase.timeAgo}</span>
                    <h2>{selectedCase.patientName}, {selectedCase.patientAge} years ({selectedCase.patientGender})</h2>
                    <div className="patient-tags-list">
                      <span>Village: <b>{selectedCase.patientVillage}</b></span><span>\u00b7</span>
                      <span>Language: <b>{selectedCase.patientLanguage}</b></span>
                      {selectedCase.patientAbha && <span className="abha-badge">ABHA: {selectedCase.patientAbha}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={cn('severity-badge', selectedCase.severity?.level)} style={{ fontSize: 13, padding: '6px 14px' }}>{selectedCase.severity?.level} Urgency</span>
                    <div style={{ marginTop: 8 }}><span className={cn('status-pill', selectedCase.status)} style={{ fontSize: 11, padding: '4px 10px' }}>Status: {selectedCase.status?.replace('_', ' ')}</span></div>
                  </div>
                </div>
              </div>

              <div className="ai-triage-card">
                <div className="ai-triage-card-header">
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1b7562', display: 'flex', alignItems: 'center', gap: 6 }}><Activity style={{ width: 16 }} /> AI Triage Assessment &amp; Reasoning</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Assigned Level: <b>{selectedCase.severity?.level?.toUpperCase()}</b></span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{selectedCase.severity?.reasoning}</p>
                {selectedCase.severity?.override?.overridden && (
                  <div className="override-callout-box">
                    <h5><ShieldAlert style={{ width: 16 }} /> Clinical Governance Override: Triage Level Upgraded</h5>
                    <p><b>Protocol Fired:</b> {selectedCase.severity.override.ruleName}<br /><b>Reason:</b> {selectedCase.severity.override.reason}</p>
                  </div>
                )}
              </div>

              <div className="intake-summary-section">
                <div className="summary-box-card"><h4>Chief Complaint &amp; Onset</h4><p><b>{selectedCase.summary?.chiefComplaint}</b></p><small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>Duration: {selectedCase.summary?.duration}</small></div>
                <div className="summary-box-card"><h4>Associated Symptoms</h4><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#1f2937' }}>{(selectedCase.summary?.symptoms || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                <div className="summary-box-card"><h4>Relevant History &amp; Meds</h4><p style={{ fontSize: 12 }}><b>Conditions:</b> {selectedCase.summary?.history?.conditions?.join(', ') || 'None reported'}<br /><b>Meds:</b> {selectedCase.summary?.history?.medications?.join(', ') || 'None'}<br /><b>Allergies:</b> {selectedCase.summary?.history?.allergies?.join(', ') || 'NKDA'}</p></div>
                <div className="summary-box-card"><h4>Red Flags Detected</h4><div className="red-flags-list">{(selectedCase.summary?.redFlags || []).map((rf: string, i: number) => <div key={i} className="red-flag-item"><AlertTriangle style={{ width: 14 }} /> {rf}</div>)}{(!selectedCase.summary?.redFlags?.length) && <span style={{ fontSize: 12, color: '#16a34a' }}>No immediate red flags</span>}</div></div>
              </div>

              <div className="collapsible-section">
                <button className="collapsible-header" onClick={() => setTranscriptOpen(!transcriptOpen)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare style={{ width: 16 }} /> Original Patient Intake Transcript ({(selectedCase.transcript || []).length} turns)</span>
                  {transcriptOpen ? <ChevronUp style={{ width: 16 }} /> : <ChevronDown style={{ width: 16 }} />}
                </button>
                {transcriptOpen && (
                  <div className="transcript-body">
                    {(selectedCase.transcript || []).map((entry: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="chat-bubble question"><small style={{ fontWeight: 700, display: 'block', marginBottom: 2, color: '#475569' }}>AI Clinical Assistant:</small>{entry.question}</div>
                        <div className="chat-bubble answer"><small style={{ fontWeight: 700, display: 'block', marginBottom: 2, color: '#065f46' }}>Patient ({selectedCase.patientName}):</small>{entry.answer}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#163e37', display: 'flex', alignItems: 'center', gap: 6 }}><HeartPulse style={{ width: 18 }} /> Longitudinal Health Record &amp; Care Timeline ({(selectedCase.longitudinalHistory || []).length} entries)</h4>
                <div className="longitudinal-timeline-list">
                  {(selectedCase.longitudinalHistory || []).map((h: any) => (
                    <div key={h.id} className={cn('timeline-entry-card', h.type)}>
                      <div className="timeline-entry-header"><span>{h.date} \u00b7 <b>{h.facility}</b></span><span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: 10 }}>{h.type}</span></div>
                      <div className="timeline-entry-title">{h.title}</div>
                      <div className="timeline-entry-detail">{h.detail}</div>
                      {h.doctorName && <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>Clinician: {h.doctorName}</small>}
                    </div>
                  ))}
                  {!(selectedCase.longitudinalHistory?.length) && <div className="empty" style={{ padding: 14 }}><p style={{ margin: 0, fontSize: 12 }}>First encounter recorded for this patient.</p></div>}
                </div>
              </div>

              <div className="doctor-action-toolbar">
                <h3><Stethoscope /> {t('clinicianActions')} {selectedCase.patientName}</h3>
                <div className="action-buttons-grid">
                  <button className="clinical-action-btn btn-consult" onClick={() => setActiveModal('consult')}><Video style={{ width: 16 }} /> {t('teleconsult')}</button>
                  <button className="clinical-action-btn btn-prescription" onClick={() => setActiveModal('prescription')}><FileText style={{ width: 16 }} /> {t('writePrescription')}</button>
                  <button className="clinical-action-btn btn-diagnostic" onClick={() => setActiveModal('diagnostic')}><FlaskConical style={{ width: 16 }} /> {t('orderDiagnostics')}</button>
                  <button className="clinical-action-btn btn-referral" onClick={() => setActiveModal('referral')}><ExternalLink style={{ width: 16 }} /> {t('referSpecialist')}</button>
                  <button className="clinical-action-btn btn-resolve" onClick={() => setActiveModal('resolve')}><CheckCircle2 style={{ width: 16 }} /> {t('updateStatus')}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty"><p>Select a case from the queue to view details.</p></div>
          )}
        </section>

        {/* COLUMN 3: RESOURCE PANEL */}
        <aside className="resource-panel-col">
          {selectedCase?.frontlineWorker ? (
            <div className="resource-card" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
              <h4 style={{ color: '#0369a1' }}><Phone style={{ width: 15 }} /> {t('frontlineAssigned')}</h4>
              <div style={{ fontSize: 13, color: '#0f172a' }}>
                <b style={{ fontSize: 14 }}>{selectedCase.frontlineWorker.name}</b> ({selectedCase.frontlineWorker.role})
                <div style={{ marginTop: 4, color: '#334155', fontSize: 12 }}>
                  Status: <span className={cn('worker-status-tag', selectedCase.frontlineWorker.status)}>{selectedCase.frontlineWorker.status}</span><br />
                  Distance: <b>{selectedCase.frontlineWorker.distance}</b> from patient<br />
                  Phone: <a href={`tel:${selectedCase.frontlineWorker.phone}`} style={{ color: '#0284c7', fontWeight: 700 }}>{selectedCase.frontlineWorker.phone}</a>
                </div>
              </div>
            </div>
          ) : (
            <div className="resource-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
              <h4 style={{ color: '#b45309' }}><Navigation style={{ width: 15 }} /> {t('noWorkerAssigned')}</h4>
              {availableWorkers.length > 0 ? (
                <div>
                  <p style={{ fontSize: 12, color: '#78350f', margin: '0 0 10px' }}>Available workers nearby. Tap to dispatch:</p>
                  {availableWorkers.map((w: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < availableWorkers.length - 1 ? '1px solid #fde68a' : 'none' }}>
                      <div>
                        <b style={{ fontSize: 12, color: '#1e293b' }}>{w.name}</b>
                        <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>{w.role} \u00b7 {w.location}</small>
                        <span className={cn('worker-status-tag', w.status)} style={{ marginTop: 2, display: 'inline-block' }}>{w.status}</span>
                      </div>
                      <button className="primary" style={{ fontSize: 11, padding: '6px 12px', background: '#d97706', minWidth: 68 }} disabled={dispatchingWorker} onClick={() => handleDispatchWorker(w)}>
                        {dispatchingWorker ? '\u2026' : t('dispatchWorker')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#78350f', margin: 0 }}>No available workers at this time.</p>
              )}
            </div>
          )}
          <DoctorFacilityOverview data={data} />
        </aside>
      </div>

      {/* MODAL: TELECONSULT */}
      {activeModal === 'consult' && selectedCase && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3><Video style={{ color: '#0284c7', verticalAlign: 'middle' }} /> Assisted Teleconsult Room: {selectedCase.patientName}</h3><button onClick={() => setActiveModal(null)} style={{ border: 0, fontSize: 18 }}>\u00d7</button></div>
            <div className="modal-body">
              <div className="video-mock-container">
                <div className="video-patient-avatar">
                  {cameraOff ? <VideoOff style={{ width: 54, height: 54, color: '#ef4444', marginBottom: 8 }} /> : <User style={{ width: 54, height: 54 }} />}
                  <div><b>{selectedCase.patientName}</b> ({selectedCase.patientAge}y {selectedCase.patientGender})</div>
                  <small style={{ color: '#94a3b8' }}>Connected via {selectedCase.frontlineWorker?.name || 'Frontline Health Worker Tablet'}</small>
                  {micMuted && <small style={{ color: '#ef4444', display: 'block', marginTop: 4 }}>\ud83d\udd07 Microphone Muted</small>}
                </div>
                <div className="video-controls-bar">
                  <button className="video-control-btn" style={{ background: micMuted ? 'rgba(239,68,68,0.65)' : 'rgba(255,255,255,0.2)' }} onClick={() => setMicMuted(m => !m)}>{micMuted ? <MicOff style={{ width: 16 }} /> : <Mic style={{ width: 16 }} />}</button>
                  <button className="video-control-btn" style={{ background: cameraOff ? 'rgba(239,68,68,0.65)' : 'rgba(255,255,255,0.2)' }} onClick={() => setCameraOff(v => !v)}>{cameraOff ? <VideoOff style={{ width: 16 }} /> : <Video style={{ width: 16 }} />}</button>
                  <button className="video-control-btn end-call" onClick={() => setActiveModal(null)}><Phone style={{ width: 16 }} /></button>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Vitals Observed (BP, SpO\u2082, HR, Temp):</label>
                <input value={teleconsultVitals} onChange={e => setTeleconsultVitals(e.target.value)} placeholder="e.g. BP 160/100 mmHg, SpO\u2082 96%, HR 92 bpm" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, marginBottom: 10 }} />
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Live Teleconsult Clinical Notes:</label>
                <textarea value={teleconsultNotes} onChange={e => setTeleconsultNotes(e.target.value)} placeholder="Enter clinical observations, assessment and management plan\u2026" style={{ minHeight: 80, width: '100%' }} />
              </div>
            </div>
            <div className="modal-footer"><button className="outline" onClick={() => setActiveModal(null)}>Close Room</button><button className="primary" disabled={savingConsult} onClick={handleSaveConsultation}>{savingConsult ? t('savingConsultation') : t('saveConsultation')}</button></div>
          </div>
        </div>
      )}

      {/* MODAL: E-PRESCRIPTION */}
      {activeModal === 'prescription' && selectedCase && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3><FileText style={{ color: '#16a34a', verticalAlign: 'middle' }} /> Issue Digital E-Prescription</h3><button onClick={() => setActiveModal(null)} style={{ border: 0, fontSize: 18 }}>\u00d7</button></div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Prescribing for <b>{selectedCase.patientName}</b> ({selectedCase.patientAge}y {selectedCase.patientGender}, {selectedCase.patientVillage})</p>
              {rxMedicines.map((m, idx) => { const stock = getStockStatus(m.name); return (
                <div key={idx} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 80px 36px', gap: 8, alignItems: 'start' }}>
                    <div>
                      <input value={m.name} onChange={e => { const copy = rxMedicines.map((x, i) => i === idx ? { ...x, name: e.target.value } : x); setRxMedicines(copy); }} placeholder="Medication name" />
                      {m.name.trim() && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: stock.bg, color: stock.color }}><Package style={{ width: 10 }} /> {stock.label}</span>}
                    </div>
                    <input value={m.dosage} onChange={e => { const copy = rxMedicines.map((x, i) => i === idx ? { ...x, dosage: e.target.value } : x); setRxMedicines(copy); }} placeholder="Dosage & Frequency" />
                    <input type="number" value={m.days} min={0} onChange={e => { const copy = rxMedicines.map((x, i) => i === idx ? { ...x, days: Number(e.target.value) } : x); setRxMedicines(copy); }} placeholder="Days" />
                    <button type="button" style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 36 }} onClick={() => setRxMedicines(rxMedicines.filter((_, i) => i !== idx))}><Trash2 style={{ width: 13 }} /></button>
                  </div>
                </div>
              ); })}
              <button type="button" className="outline" style={{ fontSize: 11, padding: '4px 8px', marginTop: 4 }} onClick={() => setRxMedicines([...rxMedicines, { name: '', dosage: '', days: 3 }])}>+ Add Medication</button>
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Doctor Advice / Instructions:</label>
                <textarea value={rxNotes} onChange={e => setRxNotes(e.target.value)} placeholder="e.g. Bed rest, check blood pressure twice daily, report if severe headache returns." style={{ minHeight: 60 }} />
              </div>
            </div>
            <div className="modal-footer"><button className="outline" onClick={() => setActiveModal(null)}>Cancel</button><button className="primary" style={{ background: '#16a34a' }} onClick={handleIssuePrescription}>Save &amp; Sign E-Prescription</button></div>
          </div>
        </div>
      )}

      {/* MODAL: ORDER DIAGNOSTICS */}
      {activeModal === 'diagnostic' && selectedCase && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3><FlaskConical style={{ color: '#d97706', verticalAlign: 'middle' }} /> Order Diagnostic Investigations</h3><button onClick={() => setActiveModal(null)} style={{ border: 0, fontSize: 18 }}>\u00d7</button></div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Ordering for <b>{selectedCase.patientName}</b> \u00b7 Severity: <b>{selectedCase.severity?.level?.toUpperCase()}</b></p>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Select Diagnostic Investigation:</label>
              <select value={diagTest} onChange={e => setDiagTest(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}>
                <option value="Complete Blood Count (CBC) + Urinalysis (Proteinuria)">Complete Blood Count (CBC) + Urinalysis (Proteinuria)</option>
                <option value="Obstetric Sonography (USG) Scan">Obstetric Sonography (USG) Scan</option>
                <option value="12-Lead Electrocardiogram (ECG) Stat">12-Lead Electrocardiogram (ECG) Stat</option>
                <option value="Sputum Smear Microscopy for AFB">Sputum Smear Microscopy for AFB</option>
                <option value="Random Blood Sugar & HbA1c">Random Blood Sugar &amp; HbA1c</option>
                <option value="Chest X-Ray (PA view)">Chest X-Ray (PA view)</option>
                <option value="Liver Function Test (LFT) + Renal Profile">Liver Function Test (LFT) + Renal Profile</option>
              </select>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Facility Unit:</label>
              <input value={diagFacility} onChange={e => setDiagFacility(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
            </div>
            <div className="modal-footer"><button className="outline" onClick={() => setActiveModal(null)}>Cancel</button><button className="primary" style={{ background: '#d97706' }} onClick={handleOrderDiagnostics}>Place Stat Order</button></div>
          </div>
        </div>
      )}

      {/* MODAL: SPECIALIST REFERRAL */}
      {activeModal === 'referral' && selectedCase && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3><ExternalLink style={{ color: '#7c3aed', verticalAlign: 'middle' }} /> Create Closed-Loop Specialist Referral</h3><button onClick={() => setActiveModal(null)} style={{ border: 0, fontSize: 18 }}>\u00d7</button></div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Referral will generate a unique tracking token and append an entry to <b>{selectedCase.patientName}'s</b> longitudinal care record.</p>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Destination Specialty / Facility:</label>
              <select value={refFacility} onChange={e => setRefFacility(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}>
                <option value="District Civil Hospital - Obstetrics & High Risk Pregnancy Unit">District Civil Hospital - Obstetrics &amp; High Risk Pregnancy Unit</option>
                <option value="Sub-District Hospital - Cardiology Unit">Sub-District Hospital - Cardiology Unit</option>
                <option value="Regional Tertiary Medical College - Stroke & Neurology Center">Regional Tertiary Medical College - Stroke &amp; Neurology Center</option>
                <option value="District Tuberculosis & Respiratory Care Center">District Tuberculosis &amp; Respiratory Care Center</option>
                <option value="District Hospital - Paediatrics & Child Health Unit">District Hospital - Paediatrics &amp; Child Health Unit</option>
                <option value="Sub-District Hospital - General Surgery Unit">Sub-District Hospital - General Surgery Unit</option>
              </select>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Referral Priority:</label>
              <select value={refPriority} onChange={e => setRefPriority(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12 }}>
                <option value="Critical / Immediate Transfer">Critical / Immediate Transfer</option>
                <option value="Urgent (within 24 hours)">Urgent (within 24 hours)</option>
                <option value="Routine Consultation">Routine Consultation</option>
              </select>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Reason for Referral &amp; Transfer Notes:</label>
              <textarea value={refReason} onChange={e => setRefReason(e.target.value)} style={{ minHeight: 70 }} />
            </div>
            <div className="modal-footer"><button className="outline" onClick={() => setActiveModal(null)}>Cancel</button><button className="primary" style={{ background: '#7c3aed' }} onClick={handleCreateReferral}>Dispatch Referral &amp; Update Record</button></div>
          </div>
        </div>
      )}

      {/* MODAL: RESOLVE / FOLLOW-UP */}
      {activeModal === 'resolve' && selectedCase && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3><CheckCircle2 style={{ color: '#475569', verticalAlign: 'middle' }} /> Case Outcome &amp; Follow-up Governance</h3><button onClick={() => setActiveModal(null)} style={{ border: 0, fontSize: 18 }}>\u00d7</button></div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Updating outcome for <b>{selectedCase.patientName}</b> \u00b7 Current status: <span className={cn('status-pill', selectedCase.status)}>{selectedCase.status?.replace('_', ' ')}</span></p>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <button type="button" className={cn('filter-btn', resolveType === 'followup' && 'active')} onClick={() => setResolveType('followup')} style={{ flex: 1, padding: 10, fontSize: 12 }}>Flag for Scheduled Follow-Up</button>
                <button type="button" className={cn('filter-btn', resolveType === 'resolve' && 'active')} onClick={() => setResolveType('resolve')} style={{ flex: 1, padding: 10, fontSize: 12 }}>Mark Case as Resolved</button>
              </div>
              {resolveType === 'followup' && <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Follow-Up Date:</label><input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} /></div>}
              <div><label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Clinical Outcome Notes:</label><textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} style={{ minHeight: 70 }} /></div>
            </div>
            <div className="modal-footer"><button className="outline" onClick={() => setActiveModal(null)}>Cancel</button><button className="primary" style={{ background: '#475569' }} onClick={handleResolveCase}>Confirm &amp; Save Status</button></div>
          </div>
        </div>
      )}
    </main>
  );
}

function DoctorFacilityOverview({ data }: { data: any }) {
  const resource = data.dashboard?.resourceOverview || { facilityBeds: { total: 12, available: 8, emergencyFree: 2 }, nearbyLabs: [{ name: 'District Hospital Central Lab', distance: '1.8 km', status: 'Open', turnsTime: '2 hrs' }, { name: 'Seva Sonography & X-Ray Unit', distance: '0.4 km', status: 'Open', turnsTime: '30 mins' }], frontlineWorkers: [] };
  return (
    <div className="facility-resource-overview">
      <div className="resource-card">
        <h4><Hospital style={{ width: 16 }} /> Facility Context &amp; Beds</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'center' }}>
          <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 8 }}><b style={{ fontSize: 20, color: '#047857' }}>{resource.facilityBeds?.available ?? 8} / {resource.facilityBeds?.total ?? 12}</b><small style={{ display: 'block', fontSize: 10, color: '#065f46' }}>Regular Beds Free</small></div>
          <div style={{ background: '#fef2f2', padding: 10, borderRadius: 8 }}><b style={{ fontSize: 20, color: '#b91c1c' }}>{resource.facilityBeds?.emergencyFree ?? 2}</b><small style={{ display: 'block', fontSize: 10, color: '#7f1d1d' }}>Emergency Beds Free</small></div>
        </div>
      </div>
      {(resource.nearbyLabs || []).length > 0 && (
        <div className="resource-card">
          <h4><FlaskConical style={{ width: 16 }} /> Nearby Diagnostic Labs</h4>
          {(resource.nearbyLabs || []).map((lab: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < resource.nearbyLabs.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
              <b style={{ fontSize: 12, color: '#1e293b' }}>{lab.name}</b>
              <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>{lab.distance} \u00b7 {lab.status} \u00b7 Results in {lab.turnsTime}</small>
            </div>
          ))}
        </div>
      )}
      <div className="resource-card">
        <h4><Users style={{ width: 16 }} /> Frontline Worker Status</h4>
        {(resource.frontlineWorkers || []).length > 0 ? (
          (resource.frontlineWorkers || []).map((w: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < resource.frontlineWorkers.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
              <div><b style={{ fontSize: 12 }}>{w.name}</b><small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>{w.role} \u00b7 {w.location}</small></div>
              <span className={cn('worker-status-tag', w.status)}>{w.status}</span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Worker status unavailable.</p>
        )}
      </div>
    </div>
  );
}

function Title({ eyebrow, title, setNotice, onRefresh }: any) { return <section className="dash-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="dashboard-subtitle">Coordinate assessment, escalation, referral and follow-up from one connected care workspace.</p></div><button className="outline dashboard-date-button" onClick={() => { onRefresh?.(); setNotice?.('Care dashboard refreshed with the latest records.'); }}><Calendar /> Refresh today</button></section> }
function AdminView({ data, role, facilityId, setNotice, refresh }: any) {
  const d = data.dashboard || { kpis:{waiting:0,followUpRate:0,teleconsults:0}, queue:[], highRisk:[], medicines:[], referrals:[] };
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [refPatient, setRefPatient] = useState('');
  const [refFacility, setRefFacility] = useState('fac-2');
  const [refReason, setRefReason] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [sendingReview, setSendingReview] = useState(false);
  const [sendingReferral, setSendingReferral] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showPrecautions, setShowPrecautions] = useState(false);
  const [activeVisitModal, setActiveVisitModal] = useState<any>(null);
  const [visitVitals, setVisitVitals] = useState({ bp: '', spo2: '', temp: '', pulse: '' });
  const [visitNotes, setVisitNotes] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);
  const titles = role === 'health_worker' ? ['Frontline health worker', 'Today’s patient care'] : role === 'system_admin' ? ['System administration', 'Network-wide care operations'] : ['Facility administration', 'A clear view of care delivery'];
  const patients = Array.isArray(data.patients) ? data.patients : [];
  const selectedPatient = patients.find((p:any) => p.id === selectedPatientId);
  const activePrecautions = (data.precautions || []).filter((x:any) => x.status === 'active');
  const sharedDocs = (data.medicalDocuments || []).filter((doc:any) => doc.sharedWithCareTeam);
  const consentRequests = (data.consentRequests || []).filter((r:any) => r.status === 'pending');
  const queue = showAllQueue ? d.queue : d.queue.slice(0, 5);
  const openPatient = (id:string) => { setSelectedPatientId(id); window.setTimeout(() => document.getElementById('health-worker-patient-context')?.scrollIntoView({behavior:'smooth', block:'start'}), 50); };
  const submitReferral = async () => {
    if (!refPatient || !refReason.trim()) { setNotice('Select a patient and enter a referral reason.'); return; }
    setSendingReferral(true);
    try {
      const r = await fetch(`${api}/referrals`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ patientId:refPatient, toFacilityId:refFacility, reason:refReason.trim() }) });
      const result = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(result.message || 'Unable to create referral.');
      setRefReason(''); setRefPatient(''); setShowReferralForm(false); setNotice('Referral created. The patient can now see it in Health Records.'); await refresh?.();
    } catch (e:any) { setNotice(e.message || 'Unable to create referral.'); } finally { setSendingReferral(false); }
  };
  const sendClinicalReview = async () => {
    if (!selectedPatientId || !reviewReason.trim()) { setNotice('Select a patient and enter why a clinical review is required.'); return; }
    setSendingReview(true);
    try {
      const r = await fetch(`${api}/care-review-requests`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({patientId:selectedPatientId, sentBy:'health_worker', reason:reviewReason.trim()})});
      const result = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(result.message || 'Unable to send clinical review request.');
      setReviewReason(''); await refresh?.(); setNotice(result.message || 'Clinical review request sent to the doctor.');
    } catch(e:any) { setNotice(e.message || 'Unable to send clinical review request.'); } finally { setSendingReview(false); }
  };

  const completeWorkerVisit = async () => {
    if (!activeVisitModal?.caseId) return;
    setSavingVisit(true);
    try {
      const vitalsText = [
        visitVitals.bp ? `BP: ${visitVitals.bp}` : '',
        visitVitals.spo2 ? `SpO2: ${visitVitals.spo2}%` : '',
        visitVitals.temp ? `Temp: ${visitVitals.temp}°F` : '',
        visitVitals.pulse ? `Pulse: ${visitVitals.pulse} bpm` : ''
      ].filter(Boolean).join(' | ');
      const r = await fetch(`${api}/cases/${activeVisitModal.caseId}/worker-visit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: visitNotes.trim() || 'Home visit completed by frontline worker. Vitals evaluated.',
          vitals: vitalsText,
          status: 'completed'
        })
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(res.message || 'Failed to update visit status.');
      setActiveVisitModal(null);
      setVisitVitals({ bp: '', spo2: '', temp: '', pulse: '' });
      setVisitNotes('');
      await refresh?.();
      setNotice('Home visit completed. Vitals & field notes recorded for the patient and doctor.');
    } catch (e: any) {
      setNotice(e.message || 'Failed to submit home visit.');
    } finally {
      setSavingVisit(false);
    }
  };

  const contactPatient = (p:any) => { if (!p?.phone) { setNotice('This patient does not have a phone number saved.'); return; } window.location.href = `tel:${p.phone}`; };
  return <main className="dashboard health-worker-dashboard">
    <Title eyebrow={titles[0]} title={titles[1]} setNotice={setNotice} onRefresh={() => void refresh?.()} />
    {role==='health_worker' && <CareTeamMessages patientId={selectedPatientId || patients[0]?.id} data={data} setNotice={setNotice} refresh={refresh} actorRole="health_worker" actorId="user-worker" actorName="Sita ASHA" compact />}
    <section className="hw-hero-strip"><div><span className="hw-live-dot"></span><b>Connected care mode</b><small>Patient context, reports, referrals and precautions stay connected across the care journey.</small></div><button className="primary" onClick={() => document.getElementById('health-worker-patient-context')?.scrollIntoView({behavior:'smooth'})}><Users/> Open patient workspace</button></section>
    <section className="metrics">
      <article className="metric metric-action" onClick={() => { setShowAllQueue(true); document.getElementById('hw-queue')?.scrollIntoView({behavior:'smooth'}); }}><span><Users /></span><div><b>{d.kpis.waiting}</b><p>Patients waiting</p><small>Open live queue</small></div><ChevronRight/></article>
      <article className="metric"><span><Activity /></span><div><b>{d.kpis.followUpRate}%</b><p>Follow-ups complete</p><small>Care continuity</small></div></article>
      <article className="metric metric-action" onClick={() => document.getElementById('hw-teleconsults')?.scrollIntoView({behavior:'smooth'})}><span><Video /></span><div><b>{d.kpis.teleconsults}</b><p>Teleconsults</p><small>Open requests</small></div><ChevronRight/></article>
      <article className="metric metric-action warn" onClick={() => { setShowStock(true); document.getElementById('hw-stock')?.scrollIntoView({behavior:'smooth'}); }}><span><PackageCheck /></span><div><b>{d.medicines.filter((m:any)=>m.status==='Low stock').length}</b><p>Low stock alerts</p><small>Review medicines</small></div><ChevronRight/></article>
    </section>
    {role==='health_worker' && (() => { const emergencyAlerts=(data.emergencyAlerts||[]).filter((x:any)=>x.status==='active' && x.assignedWorkerId==='user-worker'); const myAlerts=emergencyAlerts; return <section className="panel emergency-worker-panel" id="hw-emergency"><div className="emergency-worker-head"><div><p className="eyebrow">Emergency response</p><h3>Patients calling for urgent help</h3><p>Every emergency request is routed to the nearest available healthcare worker. Review the caller, location and assigned responder here.</p></div><div className="emergency-count"><Siren/><b>{emergencyAlerts.length}</b><span>active calls</span></div></div>{emergencyAlerts.length ? <div className="emergency-alert-list">{emergencyAlerts.slice(0,12).map((a:any)=><article className="emergency-alert-row" key={a.id}><span className="emergency-alert-icon"><PhoneCall/></span><div className="emergency-alert-main"><b>{a.patientName}</b><small>{a.patientPhone || 'No phone saved'} · {new Date(a.createdAt).toLocaleString()}</small><span>{a.assignedWorkerName ? `Assigned to ${a.assignedWorkerName} · ${a.assignedWorkerPhone}` : 'No healthcare worker available · default emergency 112'}</span></div><div className="emergency-alert-actions">{a.latitude!=null&&a.longitude!=null&&<a className="outline small" href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer"><MapPin/> Live location</a>}{a.patientPhone&&<button className="outline small" onClick={()=>contactPatient({phone:a.patientPhone})}><PhoneCall/> Call patient</button>}<button className="primary small" onClick={async()=>{const r=await fetch(`${api}/emergency/alerts/${a.id}/resolve`,{method:'PATCH'});if(r.ok){await refresh();setNotice('Emergency response marked as handled.')}}}><CheckCircle2/> Handled</button></div></article>)}</div> : <div className="empty compact"><p>No active emergency calls right now.</p><small>When a patient presses the emergency button, their request will appear here.</small></div>}<div className="emergency-worker-footer"><span><b>{myAlerts.length}</b> assigned/visible urgent requests</span><button className="outline small" onClick={()=>void refresh?.()}>Refresh emergency calls</button></div></section>; })()}
    <section className="panel hw-panel teleconsult-panel" id="hw-teleconsults"><div className="panel-head"><div><p className="eyebrow">Assisted care</p><h3>Teleconsult requests</h3><p>Live requests created by patients from confirmed appointments.</p></div><span className="record-shared-badge"><Video/> {d.kpis.teleconsults} total</span></div>{(d.teleconsultList||[]).length ? (d.teleconsultList||[]).slice(0,8).map((t:any)=><div className="queue-row hw-queue-row" key={t.id}><span className="avatar"><Video/></span><div><b>{t.patientName}</b><small>{t.doctorName} · {new Date(t.requested_at).toLocaleString()}</small></div><span className="tag">{t.status}</span><div className="actions">{t.status==='requested'&&<button className="outline small" onClick={async()=>{const r=await fetch(`${api}/teleconsults/${t.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'connected'})});if(r.ok){window.open(`https://meet.jit.si/SwasthyaSetu-${t.id}`,'_blank','noopener,noreferrer');await refresh();setNotice('Teleconsult connected. The shared video room is open.')}}}>Connect & open</button>}{t.status==='connected'&&<button className="primary small" onClick={async()=>{const r=await fetch(`${api}/teleconsults/${t.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'completed'})});if(r.ok){await refresh();setNotice('Teleconsult completed.')}}}>Complete</button>}</div></div>) : <div className="empty compact"><p>No teleconsult requests yet.</p></div>}</section>
    <div className="admin-grid health-worker-grid">
      <section className="panel hw-panel hw-queue-panel" id="hw-queue">
        <div className="panel-head"><div><p className="eyebrow">Frontline response</p><h3>Live patient queue</h3><p>Patients currently waiting for care at Seva Rural Health Centre.</p></div><button className="outline small" onClick={() => setShowAllQueue(x=>!x)}>{showAllQueue ? 'Show less' : `View all (${d.queue.length})`}</button></div>
        {queue.length ? queue.map((q:any) => { const patient=patients.find((p:any)=>p.id===q.patientId); return <div className="queue-row hw-queue-row" key={q.id}><b className="token-mini">#{q.token}</b><div><b>{q.patient || patient?.name || 'Patient'}</b><small>{q.doctor || 'Assigned clinician'} · {q.status || 'Waiting'}</small></div><span className="tag">Waiting</span><button className="outline small" onClick={()=>openPatient(q.patientId)}>View patient</button></div> }) : <div className="empty compact"><p>No patients are waiting right now.</p></div>}
      </section>
      <section className="panel hw-panel">
        <div className="panel-head"><div><p className="eyebrow">Escalation</p><h3>High-risk follow-up</h3><p>Cases that need outreach or clinical review.</p></div><AlertTriangle className="amber"/></div>
        {d.highRisk.length ? d.highRisk.map((p:any)=><div className="queue-row hw-queue-row" key={p.id}><span className="avatar">{p.name?.[0]}</span><div><b>{p.name}</b><small>{p.age} years · {p.village || 'Locality not recorded'}</small></div><button className="outline small" onClick={()=>contactPatient(p)}>Contact</button><button className="primary small" onClick={()=>openPatient(p.id)}>Review</button></div>) : <div className="empty compact"><p>No high-risk follow-up cases.</p></div>}
      </section>
      <section className="panel hw-panel" id="hw-stock">
        <div className="panel-head"><div><p className="eyebrow">Pharmacy coordination</p><h3>Medicine availability</h3><p>Review stock before advising a patient where to collect medicines.</p></div><button className="outline small" onClick={()=>setShowStock(x=>!x)}>{showStock?'Hide stock':'Review stock'}</button></div>
        {(showStock ? d.medicines : d.medicines.slice(0,3)).map((m:any)=><div className="stock hw-stock-row" key={m.id||m.name}><div><b>{m.name}</b><small>{m.quantity} units available · threshold {m.lowStockThreshold}</small></div><span className={m.status==='Low stock'?'low':'ok'}>{m.status}</span>{role!=='health_worker'&&<div className="stock-actions"><button className="outline small" onClick={async()=>{const r=await fetch(`${api}/medicine-inventory/${m.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:Math.max(0,Number(m.quantity)-1)})});if(r.ok){await refresh();setNotice(`${m.name} stock updated.`)}}}>−</button><button className="outline small" onClick={async()=>{const r=await fetch(`${api}/medicine-inventory/${m.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:Number(m.quantity)+1})});if(r.ok){await refresh();setNotice(`${m.name} stock updated.`)}}}>+</button></div>}</div>)}
      </section>
      <section className="panel hw-panel" id="hw-referral">
        <div className="panel-head"><div><p className="eyebrow">Continuity of care</p><h3>Referral coordination</h3><p>Move patients to the appropriate facility and keep the referral visible.</p></div><button className="primary small" onClick={()=>setShowReferralForm(x=>!x)}><Plus/> New referral</button></div>
        {showReferralForm && <div className="hw-form-card"><label>Patient<select value={refPatient} onChange={e=>setRefPatient(e.target.value)}><option value="">Select patient</option>{patients.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Receiving facility<select value={refFacility} onChange={e=>setRefFacility(e.target.value)}><option value="fac-2">District Hospital</option><option value="fac-3">Referral Hospital</option></select></label><label>Reason<textarea value={refReason} onChange={e=>setRefReason(e.target.value)} placeholder="Why does the patient need referral?"/></label><div className="actions"><button className="outline" onClick={()=>setShowReferralForm(false)}>Cancel</button><button className="primary" disabled={sendingReferral} onClick={()=>void submitReferral()}>{sendingReferral?'Creating…':'Create referral'} <ChevronRight/></button></div></div>}
        {d.referrals.length ? d.referrals.slice(0,showReferralForm?10:5).map((r:any)=><div className="queue-row hw-queue-row" key={r.id}><span className="ref-icon"><Stethoscope/></span><div><b>{r.patientName || patients.find((p:any)=>p.id===r.patientId)?.name || 'Patient'}</b><small>{r.reason} · To {r.toFacilityName || r.toFacilityId}</small><small>Referral token: <strong>{r.referralToken || r.id}</strong></small></div><span className="tag">{r.status}</span></div>) : <div className="empty compact"><p>No referrals have been created yet.</p></div>}
      </section>
    </div>
    {role==='facility_admin' && <section className="panel hw-panel hw-wide-panel hospital-referral-panel" id="hospital-referrals"><div className="panel-head"><div><p className="eyebrow">Receiving hospital</p><h3>Incoming referrals</h3><p>Referral requests sent by healthcare workers arrive here with a unique patient token. Use the token to identify and continue the patient's care.</p></div><span className="record-shared-badge"><Hospital/> Referral desk</span></div>{((data.referrals||[]).filter((r:any)=>role==='system_admin' || !facilityId || r.toFacilityId===facilityId)).length ? <div className="hospital-referral-list">{(data.referrals||[]).filter((r:any)=>role==='system_admin' || !facilityId || r.toFacilityId===facilityId).map((r:any)=><article className="hospital-referral-card" key={r.id}><div className="hospital-referral-token"><small>Patient referral token</small><b>{r.referralToken || r.id}</b></div><div className="hospital-referral-details"><div><b>Patient</b><p>{r.patientName || patients.find((p:any)=>p.id===r.patientId)?.name || 'Patient'}</p></div><div><b>From</b><p>{r.fromFacilityName || r.fromFacilityId}</p></div><div><b>To</b><p>{r.toFacilityName || r.toFacilityId}</p></div><div><b>Reason</b><p>{r.reason}</p></div><div><b>Created</b><p>{new Date(r.createdAt).toLocaleString()}</p></div></div><div className="actions"><span className="tag">{r.status}</span>{r.status==='pending'&&<button className="primary small" onClick={async()=>{const x=await fetch(`${api}/referrals/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'accepted'})});if(x.ok){await refresh?.();setNotice(`Referral ${r.referralToken || r.id} accepted by the hospital.`)}}}>Accept referral</button>}{r.status==='accepted'&&<button className="outline small" onClick={async()=>{const x=await fetch(`${api}/referrals/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'completed'})});if(x.ok){await refresh?.();setNotice(`Referral ${r.referralToken || r.id} marked completed.`)}}}>Mark completed</button>}<button className="outline small" onClick={()=>setNotice(`Referral token ${r.referralToken || r.id} belongs to ${r.patientName || 'the patient'}.`)}>View token</button></div></article>)}</div> : <div className="empty compact"><p>No incoming referrals yet.</p></div>}</section>}
    {role==='facility_admin' && <section className="panel hw-panel hw-wide-panel facility-access-panel" id="facility-access"><div className="panel-head"><div><p className="eyebrow">Facility care desk</p><h3>Patient contacts & care access</h3><p>Patient contact details are saved permanently at registration. The facility manages care-access requests and makes verified contact details available to the assigned frontline team.</p></div><span className="record-shared-badge"><Users/> Facility managed</span></div><div className="facility-patient-directory">{patients.length ? patients.map((p:any)=><article className="queue-row hw-queue-row" key={p.id}><span className="profile-large">{p.name?.[0]||'P'}</span><div><b>{p.name}</b><small>{p.age} years · {p.village || 'Locality not recorded'}</small></div><div><b>Contact</b><small>{p.phone || 'Not provided'}</small></div>{p.phone&&<button className="outline small" onClick={()=>contactPatient(p)}><PhoneCall/> Call</button>}<button className="primary small" onClick={()=>setSelectedPatientId(p.id)}>View record</button></article>) : <div className="empty compact"><p>No registered patients yet.</p></div>}</div>{consentRequests.length>0&&<div className="facility-legacy-requests"><div className="card-heading"><div><p className="eyebrow">Access management</p><h3>Pending care-access requests</h3><p>These requests are managed by the facility, not the frontline worker.</p></div></div>{consentRequests.map((r:any)=>{const snap=r.patientSnapshot||{};return <article className="consent-request-row" key={r.id}><div className="hw-patient-summary"><span className="profile-large">{snap.name?.[0]||'P'}</span><div><h3>{snap.name||'Patient'}</h3><small>Phone: <b>{r.phone||snap.phone||'Not provided'}</b></small></div></div><div className="actions"><button className="primary small" onClick={async()=>{const x=await fetch(`${api}/care-consent-requests/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'approved'})});if(x.ok){await refresh();setNotice('Care access approved by the facility.')}}}>Approve access</button><button className="outline small" onClick={async()=>{const x=await fetch(`${api}/care-consent-requests/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'rejected'})});if(x.ok){await refresh();setNotice('Care access request rejected.')}}}>Decline</button></div></article>})}</div>}</section>}
    {role==='health_worker' && <>
      <section className="panel hw-panel hw-wide-panel dispatched-tasks-panel" id="hw-dispatched-tasks">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Doctor Directives</p>
            <h3>Doctor Dispatched Field Tasks &amp; Urgent Home Visits</h3>
            <p>Immediate home visits and vitals checks assigned to you by attending physicians.</p>
          </div>
          <span className="record-shared-badge"><UserCheck/> {(data.dispatchedTasks||[]).length} active</span>
        </div>
        {(data.dispatchedTasks||[]).length > 0 ? (
          <div className="dispatched-tasks-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16,marginTop:12}}>
            {(data.dispatchedTasks||[]).map((task:any) => (
              <article className="hw-dispatched-card" key={task.caseId} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <span className={cn('tag',task.status==='dispatched'?'warn':'tag')} style={{textTransform:'capitalize'}}>{task.status}</span>
                  <small style={{color:'#64748b'}}>{new Date(task.dispatchedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small>
                </div>
                <h4 style={{margin:'0 0 4px',fontSize:16}}>{task.patientName}</h4>
                <p style={{margin:'0 0 6px',fontSize:13,color:'#475569'}}>{task.patientAge}y · {task.patientSex} · {task.locality}</p>
                <div style={{fontSize:12,color:'#334155',background:'#fff',padding:'8px 10px',borderRadius:8,border:'1px solid #cbd5e1',marginBottom:12}}>
                  <b>Reason:</b> {task.reason}
                  {task.patientVitals && <div style={{marginTop:4,color:'#0369a1'}}><b>Doctor Vitals:</b> {task.patientVitals}</div>}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <button className="primary small" onClick={() => { setActiveVisitModal(task); setSelectedPatientId(task.patientId); }}>
                    <CheckCircle2 style={{width:14}}/> Record Vitals &amp; Complete
                  </button>
                  {task.patientPhone && (
                    <button className="outline small" onClick={() => contactPatient({phone:task.patientPhone})}>
                      <PhoneCall style={{width:13}}/> Call
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty compact">
            <p>No active field dispatch tasks assigned right now.</p>
            <small>When a doctor dispatches a frontline worker for triage or home vitals, it will appear here instantly.</small>
          </div>
        )}
      </section>

      {activeVisitModal && (
        <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:999,display:'grid',placeItems:'center'}}>
          <div className="modal-content" style={{background:'#fff',padding:24,borderRadius:16,maxWidth:480,width:'92%',boxShadow:'0 20px 40px rgba(0,0,0,0.2)'}}>
            <h3 style={{margin:'0 0 8px'}}>Complete Home Visit: {activeVisitModal.patientName}</h3>
            <p style={{margin:'0 0 16px',fontSize:13,color:'#64748b'}}>Record vitals and clinical observations collected during the visit. These will be added directly to the patient's record and shared with the doctor.</p>
            
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,display:'flex',flexDirection:'column',gap:4}}>
                Blood Pressure (BP)
                <input placeholder="e.g. 120/80" value={visitVitals.bp} onChange={e=>setVisitVitals({...visitVitals, bp:e.target.value})} style={{padding:8,borderRadius:8,border:'1px solid #cbd5e1'}} />
              </label>
              <label style={{fontSize:12,fontWeight:600,display:'flex',flexDirection:'column',gap:4}}>
                SpO2 (%)
                <input placeholder="e.g. 98" value={visitVitals.spo2} onChange={e=>setVisitVitals({...visitVitals, spo2:e.target.value})} style={{padding:8,borderRadius:8,border:'1px solid #cbd5e1'}} />
              </label>
              <label style={{fontSize:12,fontWeight:600,display:'flex',flexDirection:'column',gap:4}}>
                Temperature (°F)
                <input placeholder="e.g. 98.6" value={visitVitals.temp} onChange={e=>setVisitVitals({...visitVitals, temp:e.target.value})} style={{padding:8,borderRadius:8,border:'1px solid #cbd5e1'}} />
              </label>
              <label style={{fontSize:12,fontWeight:600,display:'flex',flexDirection:'column',gap:4}}>
                Pulse (bpm)
                <input placeholder="e.g. 74" value={visitVitals.pulse} onChange={e=>setVisitVitals({...visitVitals, pulse:e.target.value})} style={{padding:8,borderRadius:8,border:'1px solid #cbd5e1'}} />
              </label>
            </div>

            <label style={{fontSize:12,fontWeight:600,display:'flex',flexDirection:'column',gap:4,marginBottom:16}}>
              Field Observations / Notes
              <textarea placeholder="Observations, patient condition, advice given..." value={visitNotes} onChange={e=>setVisitNotes(e.target.value)} style={{padding:8,borderRadius:8,border:'1px solid #cbd5e1',minHeight:80,resize:'vertical'}} />
            </label>

            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="outline" onClick={() => setActiveVisitModal(null)} disabled={savingVisit}>Cancel</button>
              <button className="primary" onClick={() => void completeWorkerVisit()} disabled={savingVisit}>
                {savingVisit ? 'Saving...' : 'Save & Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="panel clinical-context-card hw-wide-panel" id="health-worker-patient-context">
        <div className="card-heading"><div><p className="eyebrow">Patient workspace</p><h3>Connected patient context</h3><p>Open a patient to review the information needed for assessment, escalation and handover.</p></div><span className="record-shared-badge"><CheckCircle2/> Consent-led</span></div>
        <div className="hw-patient-picker"><select value={selectedPatientId} onChange={e=>setSelectedPatientId(e.target.value)}><option value="">Select a patient to review</option>{patients.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {p.age} years</option>)}</select>{selectedPatient && <><button className="outline" onClick={()=>contactPatient(selectedPatient)}>Contact patient</button><button className="primary" onClick={()=>{setRefPatient(selectedPatient.id);setShowReferralForm(true);document.getElementById('hw-referral')?.scrollIntoView({behavior:'smooth',block:'center'});}}><Stethoscope/> Refer patient</button></>}</div>
        {selectedPatient ? <div className="hw-patient-detail">
          <div className="hw-patient-summary">
            <span className="profile-large">{selectedPatient.name?.[0]}</span>
            <div>
              <h3>{selectedPatient.name}</h3>
              <p>{selectedPatient.age} years · {selectedPatient.sex} · {selectedPatient.village || 'Locality not recorded'}</p>
              <span className="tag">{selectedPatient.risk || 'normal'} risk</span>
            </div>
          </div>
          <div className="clinical-context-grid">
            <div><b>Patient contact</b><p>{selectedPatient.phone || 'Phone number not saved'} {selectedPatient.phone&&<button className="link small" type="button" onClick={()=>contactPatient(selectedPatient)}>Call</button>}</p></div>
            <div><b>Medical conditions</b><p>{selectedPatient.medicalCondition || 'None recorded.'}</p></div>
            <div><b>Medical history</b><p>{selectedPatient.medicalHistory || 'None recorded.'}</p></div>
            <div><b>Allergies</b><p>{selectedPatient.allergies || 'None recorded.'}</p></div>
            <div><b>Current medicines</b><p>{selectedPatient.medications || 'None recorded.'}</p></div>
          </div>

          <div className="hw-patient-connected-sections" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16,marginTop:20}}>
            <div className="hw-subcard" style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:14}}>
              <h4 style={{margin:'0 0 10px',fontSize:13,display:'flex',alignItems:'center',gap:6,color:'#0f172a'}}>
                <Pill style={{width:15,color:'#059669'}}/> Active E-Prescriptions ({((data.prescriptions||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length})
              </h4>
              {((data.prescriptions||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length ? (
                ((data.prescriptions||[]).filter((x:any)=>x.patientId===selectedPatient.id)).slice(0,3).map((rx:any)=>(
                  <div key={rx.id} style={{borderBottom:'1px solid #e2e8f0',paddingBottom:8,marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{rx.doctorName||'Attending Doctor'} · {new Date(rx.createdAt).toLocaleDateString()}</div>
                    {rx.doctorNotes && <div style={{fontSize:11,color:'#475569',margin:'2px 0'}}>Note: {rx.doctorNotes}</div>}
                    <div style={{fontSize:11,color:'#0369a1'}}>
                      {(rx.medicines||[]).map((m:any)=>`${m.name} (${m.dosage||'advised'})`).join(', ')}
                    </div>
                  </div>
                ))
              ) : <small style={{color:'#64748b'}}>No doctor prescriptions recorded.</small>}
            </div>

            <div className="hw-subcard" style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:14}}>
              <h4 style={{margin:'0 0 10px',fontSize:13,display:'flex',alignItems:'center',gap:6,color:'#0f172a'}}>
                <Stethoscope style={{width:15,color:'#0284c7'}}/> Clinical Consultations ({((data.consultations||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length})
              </h4>
              {((data.consultations||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length ? (
                ((data.consultations||[]).filter((x:any)=>x.patientId===selectedPatient.id)).slice(0,3).map((c:any)=>(
                  <div key={c.id} style={{borderBottom:'1px solid #e2e8f0',paddingBottom:8,marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{c.doctorName||'Clinician'} · {new Date(c.createdAt).toLocaleDateString()}</div>
                    <div style={{fontSize:11,color:'#334155',marginTop:2}}>{c.notes}</div>
                  </div>
                ))
              ) : <small style={{color:'#64748b'}}>No consultations recorded.</small>}
            </div>

            <div className="hw-subcard" style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:14}}>
              <h4 style={{margin:'0 0 10px',fontSize:13,display:'flex',alignItems:'center',gap:6,color:'#0f172a'}}>
                <FlaskConical style={{width:15,color:'#7c3aed'}}/> Diagnostic Orders ({((data.diagnosticOrders||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length})
              </h4>
              {((data.diagnosticOrders||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length ? (
                ((data.diagnosticOrders||[]).filter((x:any)=>x.patientId===selectedPatient.id)).slice(0,3).map((d:any)=>(
                  <div key={d.id} style={{borderBottom:'1px solid #e2e8f0',paddingBottom:8,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{d.testName}</div>
                      <small style={{color:'#64748b'}}>{d.facilityName||'Diagnostic Lab'}</small>
                    </div>
                    <span className="tag small" style={{textTransform:'capitalize'}}>{d.status}</span>
                  </div>
                ))
              ) : <small style={{color:'#64748b'}}>No diagnostic tests ordered.</small>}
            </div>

            <div className="hw-subcard" style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:14}}>
              <h4 style={{margin:'0 0 10px',fontSize:13,display:'flex',alignItems:'center',gap:6,color:'#0f172a'}}>
                <Hospital style={{width:15,color:'#d97706'}}/> Hospital Referrals ({((data.referrals||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length})
              </h4>
              {((data.referrals||[]).filter((x:any)=>x.patientId===selectedPatient.id)).length ? (
                ((data.referrals||[]).filter((x:any)=>x.patientId===selectedPatient.id)).slice(0,3).map((r:any)=>(
                  <div key={r.id} style={{borderBottom:'1px solid #e2e8f0',paddingBottom:8,marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>To: {r.toFacilityName||r.toFacilityId} · <span className="tag small">{r.status}</span></div>
                    <div style={{fontSize:11,color:'#475569',marginTop:2}}>Reason: {r.reason}</div>
                    <small style={{color:'#0284c7',fontWeight:600}}>Token: {r.referralToken||r.id}</small>
                  </div>
                ))
              ) : <small style={{color:'#64748b'}}>No referrals active.</small>}
            </div>
          </div>
        </div> : <div className="hw-empty-workspace"><Users/><b>Select a patient to open their longitudinal care context.</b><small>Relevant history, allergies, medicines, prescriptions, and consult records appear here.</small></div>}
      </section>
      
      <section className="panel hw-panel hw-wide-panel care-review-panel" id="health-worker-review">
        <div className="card-heading"><div><p className="eyebrow">Care review</p><h3>Send patient for clinical review</h3><p>If a patient needs a doctor's review, send the reason here. The doctor will receive it in their review queue.</p></div><span className="record-shared-badge"><Stethoscope/> Doctor review</span></div>
        <div className="review-request-form">
          <select value={selectedPatientId} onChange={e=>setSelectedPatientId(e.target.value)}><option value="">Select patient</option>{patients.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {p.age} years</option>)}</select>
          <textarea value={reviewReason} onChange={e=>setReviewReason(e.target.value)} placeholder="Why does this patient need clinical review?" />
          <button className="primary" disabled={sendingReview} onClick={()=>void sendClinicalReview()}><Stethoscope/> {sendingReview?'Sending…':'Send for clinical review'}</button>
        </div>
        <div className="review-request-list">{(data.careReviewRequests||[]).filter((r:any)=>r.status==='pending').slice(0,6).map((r:any)=><article className="queue-row hw-queue-row" key={r.id}><div><b>{patients.find((p:any)=>p.id===r.patientId)?.name || 'Patient'}</b><small>{r.reason}</small></div><span className="tag">Pending doctor review</span></article>)}{!(data.careReviewRequests||[]).some((r:any)=>r.status==='pending')&&<p className="form-intro">No clinical review requests are pending.</p>}</div>
      </section>
    <section className="panel clinical-context-card hw-wide-panel">
        <div className="card-heading"><div><p className="eyebrow">Longitudinal record</p><h3>Reports shared by patients</h3><p>Review previous documents before assessment, referral or escalation.</p></div><span className="record-shared-badge"><CheckCircle2/> Shared records</span></div>
        <div className="medical-document-list">{sharedDocs.length ? sharedDocs.slice(0,12).map((doc:any)=>{const patient=patients.find((x:any)=>x.id===doc.patientId); return <article className="medical-document hw-document" key={doc.id}><span className="medical-document-icon"><FileText/></span><div><b>{doc.name}</b><small>{patient?.name || 'Patient'} · {doc.type.replaceAll('_',' ')} · {new Date(doc.uploadedAt).toLocaleDateString()}</small>{doc.notes&&<p>{doc.notes}</p>}</div><span className="tag">Shared</span><button className="outline small" onClick={()=>openMedicalDocument(doc)}>Open report</button></article>}) : <div className="empty compact"><p>No consent-shared medical reports are available.</p></div>}</div>
      </section>
      <section className="panel precaution-admin-card hw-wide-panel">
        <div className="card-heading"><div><p className="eyebrow">Patient guidance</p><h3>Precautions sent to patients</h3><p>Send clear instructions and see which precautions are still active.</p></div><button className="outline small" onClick={()=>setShowPrecautions(x=>!x)}>{showPrecautions?'Hide history':`View active (${activePrecautions.length})`}</button></div>
        <div className="precaution-compose"><select id="precaution-patient"><option value="">Select patient</option>{patients.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><textarea id="precaution-message" placeholder="Write guidance for the patient…"></textarea><button className="primary" onClick={async()=>{const patientId=(document.getElementById('precaution-patient') as HTMLSelectElement).value;const message=(document.getElementById('precaution-message') as HTMLTextAreaElement).value.trim();if(!patientId||!message){setNotice('Select a patient and write a precaution first.');return;}const r=await fetch(`${api}/precautions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId,sentBy:'health_worker',message})});if(r.ok){(document.getElementById('precaution-message') as HTMLTextAreaElement).value='';await refresh?.();setNotice('Precaution sent to the patient.');}else{setNotice('Unable to send precaution.');}}}><AlertTriangle/> Send precaution</button></div>
        {(showPrecautions ? (data.precautions||[]) : activePrecautions).slice(0,12).map((x:any)=><article className="hw-precaution-row" key={x.id}><div><b>{patients.find((p:any)=>p.id===x.patientId)?.name || 'Patient'}</b><p>{x.message}</p><small>{new Date(x.createdAt).toLocaleString()}</small></div><span className={cn('tag', x.status==='resolved'&&'resolved-tag')}>{x.status}</span></article>)}
      </section>
    </>}
    {selectedPatient && <div className="hw-floating-action"><span>Reviewing <b>{selectedPatient.name}</b></span><button className="primary small" onClick={()=>setShowReferralForm(true)}><Stethoscope/> Create referral</button><button className="outline small" onClick={()=>contactPatient(selectedPatient)}>Contact</button></div>}
  </main>
}
 function Metric({ icon: Icon, number, label, trend, warn }: any) { return <article className={cn('metric', warn && 'warn')}><span><Icon /></span><div><b>{number}</b><p>{label}</p><small>{trend}</small></div></article> }; createRoot(document.getElementById('root')!).render(<App />);
