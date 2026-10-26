import type { Activity, Chapter, Programme, ReadingContent, LectureContent, QuizContent, MatchingContent } from '../domain/types';
import { IDS } from './constants';

/* ------------------------------------------------------------------ */
/* Chapter 1 of the Office Administration Diploma has fully authored    */
/* content (mirrors the reference screenshots). Other chapters use a   */
/* templated generator so every activity in the sequence is functional. */
/* ------------------------------------------------------------------ */

const officeChapterTitles: { title: string; description: string; hours: number }[] = [
  { title: 'Modern Office Foundations', description: 'Roles, workflows, and professional standards in Canadian workplaces.', hours: 28 },
  { title: 'Business Communication & Records', description: 'Clear written communication and dependable record keeping.', hours: 26 },
  { title: 'Records & Information Management', description: 'Filing systems, retention schedules, and privacy obligations.', hours: 30 },
  { title: 'Digital Productivity Tools', description: 'Word processing, spreadsheets, and shared calendars.', hours: 32 },
  { title: 'Customer & Client Service', description: 'Front-desk service standards and de-escalation.', hours: 26 },
  { title: 'Meetings & Minute Taking', description: 'Agendas, minutes, and action tracking.', hours: 24 },
  { title: 'Scheduling & Travel Coordination', description: 'Calendars, bookings, and expense reconciliation.', hours: 30 },
  { title: 'Bookkeeping Essentials', description: 'Invoices, petty cash, and basic ledgers.', hours: 32 },
  { title: 'Human Resources Support', description: 'Onboarding paperwork and confidentiality.', hours: 28 },
  { title: 'Project & Event Support', description: 'Supporting projects, events, and vendors.', hours: 30 },
  { title: 'Workplace Health, Safety & Ethics', description: 'Safety procedures and ethical decision-making.', hours: 32 },
  { title: 'Capstone: Office Simulation', description: 'Integrated office simulation and final review.', hours: 32 },
];

const chapter1Reading1: ReadingContent = {
  intro:
    'Modern office administrators keep organisations running by owning workflows end to end. In this reading you will learn how professional standards shape day-to-day work in a busy Canadian office.',
  objectives: [
    'Workflow ownership — take responsibility for a task from request to completion.',
    'Professional tone — communicate clearly and respectfully across channels.',
    'Confidentiality — protect personal and business information under PIPEDA.',
    'Handoffs — document what was done so colleagues can continue without re-work.',
  ],
  whyItMatters:
    'Administrative professionals are often the first point of contact for clients and the connective tissue between departments. Reliable, well-documented work builds trust and reduces costly errors.',
  coreConcepts:
    'An office workflow has four parts: intake, action, record, and handoff. Standard Operating Procedures (SOPs) describe how routine processes are completed so results are consistent regardless of who performs them.',
  steps: [
    { title: 'Intake', body: 'Capture the request, who asked, and when it is needed. Confirm understanding before acting.' },
    { title: 'Action & record', body: 'Complete the task following the SOP and log the outcome in the shared system.' },
    { title: 'Handoff', body: 'Summarise status and next steps so the next person can pick up immediately.' },
  ],
  workedExample:
    'A visitor arrives for a 2:00 pm meeting. The receptionist logs the visitor in the reception log, confirms identification, notifies the host by the agreed channel, and records the departure time. The log is retained per the SOP for 90 days.',
};

const chapter1Reading2: ReadingContent = {
  intro:
    'This second reading applies the foundations to realistic scenarios. You will practise identifying the right procedure, tone, and record for common office situations.',
  objectives: [
    'Select the correct SOP for a routine request.',
    'Draft a short, professional response to a client email.',
    'Decide what information may be shared and with whom.',
    'Prepare a clean handoff note at the end of a shift.',
  ],
  whyItMatters: 'Applying standards consistently is what distinguishes a dependable administrator from an occasional helper.',
  coreConcepts:
    'Every situation can be mapped to a procedure, a communication, and a record. If one of the three is missing, the work is not finished.',
  steps: [
    { title: 'Match the SOP', body: 'Find the procedure that covers the request; if none exists, escalate rather than improvise.' },
    { title: 'Communicate', body: 'Use a neutral, courteous tone. Confirm deadlines in writing.' },
    { title: 'Close the loop', body: 'Update the tracker and leave a handoff note.' },
  ],
  workedExample:
    'A supplier emails asking for an invoice status. The administrator checks the ledger SOP, replies with the expected payment date, logs the enquiry in the vendor tracker, and flags it for the accounts team in the daily handoff.',
};

const chapter1Lecture: LectureContent = {
  presenter: 'Heritage instructor',
  slides: [
    { title: 'Welcome · Modern Office Foundations', bullets: ['What an office administrator owns', 'Four-part workflow model', 'Standards that build trust'], transcript: 'Welcome to the first lecture. We will walk through what it means to own an office workflow and how professional standards keep teams aligned.' },
    { title: 'Intake done right', bullets: ['Capture who, what, when', 'Confirm understanding', 'Set expectations early'], transcript: 'Good intake prevents most downstream errors. Repeat the request back and confirm the deadline before you start.' },
    { title: 'SOPs and consistency', bullets: ['Why SOPs exist', 'Following versus improvising', 'When to escalate'], transcript: 'Standard operating procedures make results consistent. If a situation has no SOP, escalate to a supervisor instead of guessing.' },
    { title: 'Confidentiality in practice', bullets: ['PIPEDA basics', 'Need-to-know sharing', 'Secure storage'], transcript: 'Personal information must only be shared on a need-to-know basis and stored securely. When in doubt, do not share.' },
    { title: 'Handoffs and records', bullets: ['Log outcomes', 'Write a handoff note', 'Keep retention schedules'], transcript: 'A task is complete when the record is updated and a clear handoff exists. That is how we close the loop.' },
  ],
};

const chapter1Quiz: QuizContent = {
  questions: [
    { id: 'q1', prompt: 'What are the four parts of an office workflow described in the reading?', options: ['Plan, do, check, act', 'Intake, action, record, handoff', 'Request, reply, archive, delete', 'Greet, log, notify, close'], correctIndex: 1, explanation: 'The reading defines intake, action, record, and handoff.' },
    { id: 'q2', prompt: 'If a request has no matching SOP, the administrator should…', options: ['Improvise a solution', 'Ignore the request', 'Escalate to a supervisor', 'Ask the client to resubmit'], correctIndex: 2, explanation: 'Escalation keeps outcomes consistent and safe.' },
    { id: 'q3', prompt: 'Which law governs personal information handling in Canadian private-sector workplaces?', options: ['PIPEDA', 'GDPR', 'HIPAA', 'FOIA'], correctIndex: 0, explanation: 'PIPEDA is the Canadian federal private-sector privacy law.' },
    { id: 'q4', prompt: 'A reception log primarily records…', options: ['Meeting agendas', 'Visitor identification and check-in/out', 'Payroll hours', 'Supplier invoices'], correctIndex: 1, explanation: 'The reception log is a front-desk security record.' },
    { id: 'q5', prompt: 'A handoff note should include…', options: ['Only your opinion of the task', 'Status and next steps', 'The full email thread', 'Nothing — verbal is enough'], correctIndex: 1, explanation: 'Status plus next steps lets a colleague continue without re-work.' },
  ],
};

const chapter1Matching: MatchingContent = {
  pairs: [
    { id: 'm1', term: 'PIPEDA', definition: 'Canadian federal privacy law governing personal information in the private sector' },
    { id: 'm2', term: 'SOP', definition: 'Documented step-by-step instructions for routine office processes' },
    { id: 'm3', term: 'Agenda', definition: 'Meeting purpose and timed discussion points' },
    { id: 'm4', term: 'Reception log', definition: 'Visitor identification and front-desk security check log' },
    { id: 'm5', term: 'Workflow practice', definition: 'Owning a task from intake through action, record, and handoff' },
    { id: 'm6', term: 'Professional practice', definition: 'Workplace ethical standards, confidentiality guidelines, and professional communication habits' },
  ],
};

const chapter1Assessment: QuizContent = {
  questions: [
    { id: 'a1', prompt: 'Which step confirms the deadline before work begins?', options: ['Handoff', 'Intake', 'Record', 'Archive'], correctIndex: 1, explanation: 'Deadlines are confirmed at intake.' },
    { id: 'a2', prompt: 'Sharing a client phone number with a colleague who does not need it violates…', options: ['Need-to-know confidentiality', 'The reception log SOP', 'The meeting agenda', 'Nothing'], correctIndex: 0, explanation: 'Personal information is shared on a need-to-know basis.' },
    { id: 'a3', prompt: 'The purpose of an SOP is to…', options: ['Replace supervisors', 'Make outcomes consistent', 'Shorten meetings', 'Track visitors'], correctIndex: 1, explanation: 'SOPs standardise routine work.' },
    { id: 'a4', prompt: 'A task is complete when…', options: ['The email is sent', 'The record is updated and a handoff exists', 'The supervisor is told verbally', 'The file is printed'], correctIndex: 1, explanation: 'Record plus handoff closes the loop.' },
    { id: 'a5', prompt: 'How long is the reception log retained in the worked example?', options: ['7 days', '30 days', '90 days', '1 year'], correctIndex: 2, explanation: 'The SOP specified 90 days.' },
    { id: 'a6', prompt: 'A supplier asks for invoice status. The first thing to check is…', options: ['The ledger SOP', 'The visitor log', 'The holiday calendar', 'Social media'], correctIndex: 0, explanation: 'Match the request to the relevant SOP.' },
  ],
};

function genReading(chapter: string, n: number, topic: string): ReadingContent {
  return {
    intro: `${chapter} — Reading ${n}. This reading introduces ${topic.toLowerCase()} and how it applies in a Canadian office setting.`,
    objectives: [
      `Explain the purpose of ${topic.toLowerCase()}.`,
      'Identify the records and tools involved.',
      'Apply the procedure to a realistic scenario.',
      'Recognise common errors and how to avoid them.',
    ],
    whyItMatters: `${topic} affects accuracy, compliance, and the experience of clients and colleagues. Getting it right saves time and protects the organisation.`,
    coreConcepts: `${topic} follows the same workflow model used throughout the diploma: intake, action, record, and handoff. Each step has a standard that can be checked.`,
    steps: [
      { title: 'Prepare', body: 'Gather the inputs, confirm the deadline, and open the relevant SOP.' },
      { title: 'Execute', body: 'Complete the task carefully, checking each standard as you go.' },
      { title: 'Record and hand off', body: 'Update the tracker and write a short handoff note.' },
    ],
    workedExample: `An administrator applies ${topic.toLowerCase()} to a routine request, documents the outcome, and leaves a handoff note so the afternoon shift can continue without interruption.`,
  };
}

function genLecture(chapter: string, topic: string): LectureContent {
  return {
    presenter: 'Heritage instructor',
    slides: [
      { title: `Welcome · ${chapter}`, bullets: ['Chapter goals', `Where ${topic.toLowerCase()} fits`, 'What you will practise'], transcript: `Welcome to the lecture for ${chapter}. We will cover the goals of this chapter and where ${topic.toLowerCase()} fits in daily office work.` },
      { title: 'Key procedure', bullets: ['Inputs and checks', 'Common pitfalls', 'Escalation points'], transcript: 'Every procedure has inputs, checks, and escalation points. Knowing them keeps your work consistent.' },
      { title: 'Records', bullets: ['What to log', 'Where it lives', 'Retention'], transcript: 'Records make the work auditable. Log the outcome in the shared system and respect the retention schedule.' },
      { title: 'Scenario walkthrough', bullets: ['Realistic request', 'Applying the standard', 'Closing the loop'], transcript: 'Let us walk through a realistic request and apply the standard end to end.' },
      { title: 'Summary', bullets: ['Recap', 'Practice next', 'Assessment tips'], transcript: 'That is the summary. Complete the practice quiz and matching drill before attempting the chapter assessment.' },
    ],
  };
}

function genQuiz(prefix: string, topic: string, count: number): QuizContent {
  const bank = [
    { prompt: `Which workflow step comes first when handling ${topic.toLowerCase()}?`, options: ['Handoff', 'Intake', 'Archive', 'Review'], correctIndex: 1, explanation: 'Intake always comes first.' },
    { prompt: `Where should the outcome of a ${topic.toLowerCase()} task be logged?`, options: ['Personal notebook', 'Shared tracker or system', 'Nowhere', 'Sticky note'], correctIndex: 1, explanation: 'Shared systems keep records auditable.' },
    { prompt: 'When a procedure is unclear you should…', options: ['Guess', 'Escalate to a supervisor', 'Skip the task', 'Ask the client to decide'], correctIndex: 1, explanation: 'Escalate rather than improvise.' },
    { prompt: 'A good handoff note contains…', options: ['Status and next steps', 'Only a greeting', 'Your personal opinions', 'The full history'], correctIndex: 0, explanation: 'Status and next steps.' },
    { prompt: 'Confidential information should be shared…', options: ['With everyone', 'On a need-to-know basis', 'On social media', 'Never, even internally'], correctIndex: 1, explanation: 'Need-to-know.' },
    { prompt: `The main benefit of a standard for ${topic.toLowerCase()} is…`, options: ['Consistency', 'Speed only', 'Fewer meetings', 'More paperwork'], correctIndex: 0, explanation: 'Standards produce consistent results.' },
  ];
  return {
    questions: bank.slice(0, count).map((q, i) => ({ id: `${prefix}${i + 1}`, ...q })),
  };
}

function genMatching(topic: string): MatchingContent {
  return {
    pairs: [
      { id: 'p1', term: 'Intake', definition: 'Capturing a request, who asked, and when it is needed' },
      { id: 'p2', term: 'SOP', definition: 'Documented step-by-step instructions for routine office processes' },
      { id: 'p3', term: 'Handoff note', definition: 'Short summary of status and next steps for the next person' },
      { id: 'p4', term: 'Retention schedule', definition: 'How long a record is kept before secure disposal' },
      { id: 'p5', term: topic, definition: `The chapter procedure applied to ${topic.toLowerCase()} tasks` },
      { id: 'p6', term: 'Escalation', definition: 'Referring an unclear situation to a supervisor instead of improvising' },
    ],
  };
}

function buildChapters(programmeId: string, defs: { title: string; description: string; hours: number }[], activityCount: number, authored?: boolean): Chapter[] {
  const chapters: Chapter[] = [];
  let remaining = activityCount;
  defs.forEach((def, ci) => {
    const chapterId = `${programmeId}_ch${ci + 1}`;
    // 6 items per chapter until the total is reached; last chapters may have 5.
    const chaptersLeft = defs.length - ci;
    const perChapter = Math.min(6, Math.ceil(remaining / chaptersLeft));
    const types: Activity['type'][] = perChapter >= 6
      ? ['reading', 'reading', 'lecture', 'practiceQuiz', 'matching', 'assessment']
      : ['reading', 'lecture', 'practiceQuiz', 'matching', 'assessment'];
    remaining -= types.length;
    const isCh1 = authored && ci === 0;
    let readingN = 0;
    const activities: Activity[] = types.map((type, ai) => {
      const id = `${chapterId}_a${ai + 1}`;
      const base = { id, chapterId, index: ai + 1, type } as Activity;
      switch (type) {
        case 'reading': {
          readingN += 1;
          const label = readingN === 1 ? 'Foundations' : 'Application';
          return {
            ...base,
            title: `${def.title} — Reading ${readingN} · ${label}`,
            minutes: readingN === 1 ? 18 : 16,
            reading: isCh1 ? (readingN === 1 ? chapter1Reading1 : chapter1Reading2) : genReading(def.title, readingN, def.title),
          };
        }
        case 'lecture':
          return { ...base, title: `${def.title} — Instructor Lecture`, minutes: 8, lecture: isCh1 ? chapter1Lecture : genLecture(def.title, def.title) };
        case 'practiceQuiz':
          return { ...base, title: `${def.title} — Practice Quiz`, minutes: 15, quiz: isCh1 ? chapter1Quiz : genQuiz(`pq${ci + 1}_`, def.title, 5) };
        case 'matching':
          return { ...base, title: `${def.title} — Matching Drill`, minutes: 12, matching: isCh1 ? chapter1Matching : genMatching(def.title) };
        case 'assessment':
        default:
          return { ...base, title: `${def.title} — Chapter Assessment`, minutes: 35, quiz: isCh1 ? chapter1Assessment : genQuiz(`as${ci + 1}_`, def.title, 6) };
      }
    });
    chapters.push({ id: chapterId, programmeId, index: ci + 1, title: def.title, description: def.description, hours: def.hours, activities });
  });
  return chapters;
}

function genericChapters(n: number, subject: string): { title: string; description: string; hours: number }[] {
  const topics = ['Foundations', 'Safety & Regulation', 'Core Skills I', 'Core Skills II', 'Tools & Equipment', 'Documentation', 'Applied Practice', 'Quality & Inspection', 'Advanced Techniques', 'Exam Strategies', 'Mock Exam', 'Final Review'];
  return Array.from({ length: n }, (_, i) => ({
    title: `${subject}: ${topics[i % topics.length]}`,
    description: `${topics[i % topics.length]} for ${subject.toLowerCase()} learners.`,
    hours: 28 + (i % 4) * 4,
  }));
}

export const programmes: Programme[] = [
  {
    id: IDS.programmeOffice,
    title: 'Office Administration Diploma',
    subject: 'Business',
    category: 'Business',
    level: 'Intermediate',
    description:
      'Build the practical skills that keep Canadian workplaces running: professional communication, records management, bookkeeping support, scheduling, and client service. Twelve sequenced chapters combine readings, instructor lectures, practice drills, and graded assessments.',
    hours: 350,
    chapterCount: 12,
    activityCount: 70,
    priceCad: 9500,
    residency: 'domestic',
    featured: true,
    heroImage: 'office',
    highlights: ['12 structured chapters with sequenced milestones', '1 focused chapter unlocks each day', 'Instructor lectures & hands-on matching drills', 'Sample certificate on completion (DEMO — not an official credential)'],
    chapters: buildChapters(IDS.programmeOffice, officeChapterTitles, 70, true),
  },
  {
    id: IDS.programmePharmacy,
    title: 'Pharmacy Assistant',
    subject: 'Health',
    category: 'Pharmacy Assistant',
    level: 'Beginner',
    description: 'Prepare for a pharmacy assistant role: dispensary workflows, inventory, customer service, and regulatory basics.',
    hours: 278,
    chapterCount: 10,
    activityCount: 58,
    priceCad: 7200,
    residency: 'domestic',
    featured: false,
    heroImage: 'pharmacy',
    highlights: ['10 chapters', 'Dispensary workflow drills', 'Regulatory basics'],
    chapters: buildChapters(IDS.programmePharmacy, genericChapters(10, 'Pharmacy Assistant'), 58),
  },
  {
    id: IDS.programmeElectrician,
    title: 'Red Seal Exam Preparation Electrician (Construction)',
    subject: 'Red Seal Trades',
    category: 'Red Seal Exam Prep',
    level: 'Advanced',
    description: 'Targeted preparation for the Construction Electrician Red Seal exam: code, safety, circuits, and exam strategy.',
    hours: 344,
    chapterCount: 9,
    activityCount: 52,
    priceCad: 3990,
    residency: 'domestic',
    featured: false,
    heroImage: 'trades',
    highlights: ['9 chapters', 'Timed practice exams', 'Exam strategy coaching'],
    chapters: buildChapters(IDS.programmeElectrician, genericChapters(9, 'Electrician'), 52),
  },
  {
    id: IDS.programmeCarpentry,
    title: 'Red Seal Exam Preparation Carpentry',
    subject: 'Red Seal Trades',
    category: 'Red Seal Exam Prep',
    level: 'Advanced',
    description: 'Structured review of carpentry theory, layout, framing, and finishing for the Red Seal exam.',
    hours: 344,
    chapterCount: 6,
    activityCount: 36,
    priceCad: 3990,
    residency: 'domestic',
    featured: false,
    heroImage: 'trades',
    highlights: ['6 chapters', 'Layout and framing drills'],
    chapters: buildChapters(IDS.programmeCarpentry, genericChapters(6, 'Carpentry'), 36),
  },
  {
    id: IDS.programmePlumberChef,
    title: 'Red Seal Exam Preparation Plumber & Chef',
    subject: 'Red Seal Trades',
    category: 'Trades Exam Prep',
    level: 'Advanced',
    description: 'Two focused exam-preparation tracks delivered in the same self-paced format.',
    hours: 320,
    chapterCount: 6,
    activityCount: 36,
    priceCad: 3990,
    residency: 'domestic',
    featured: false,
    heroImage: 'trades',
    highlights: ['Choose Plumber or Chef track', '6 chapters each'],
    chapters: buildChapters(IDS.programmePlumberChef, genericChapters(6, 'Plumber'), 36),
    subPrograms: [
      { title: 'Plumber Prep', hours: 320, chapters: 6, priceCad: 3990 },
      { title: 'Chef Prep', hours: 300, chapters: 6, priceCad: 3990 },
    ],
  },
  {
    id: IDS.programmeMachinist,
    title: 'Red Seal Exam Preparation Machinist',
    subject: 'Red Seal Trades',
    category: 'Trades & Technical',
    level: 'Advanced',
    description: 'Machining theory, metrology, CNC fundamentals, and exam practice for the Machinist Red Seal.',
    hours: 310,
    chapterCount: 6,
    activityCount: 36,
    priceCad: 3990,
    residency: 'domestic',
    featured: false,
    heroImage: 'trades',
    highlights: ['6 chapters', 'Metrology drills', 'Registration & exam materials included'],
    chapters: buildChapters(IDS.programmeMachinist, genericChapters(6, 'Machinist'), 36),
  },
];
