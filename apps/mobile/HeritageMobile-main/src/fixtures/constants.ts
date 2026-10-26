/** Fixed demo "today". All fixture dates are coherent relative to this instant. */
export const DEMO_ANCHOR_ISO = '2026-09-25T15:44:17-07:00';
export const DEMO_PASSWORD = 'Heritage2026!';

export const IDS = {
  student: 'u_student_marcus',
  student2: 'u_student_priya',
  instructor: 'u_instr_monica',
  instructorPendelton: 'u_instr_pendelton',
  instructorSterling: 'u_instr_sterling',
  term2026F: 't_2026F',
  term2025F: 't_2025F',
  termTR1_2026: 't_TR1_2026',
  programmeOffice: 'prg_office_admin',
  programmePharmacy: 'prg_pharmacy',
  programmeElectrician: 'prg_rs_electrician',
  programmeCarpentry: 'prg_rs_carpentry',
  programmePlumberChef: 'prg_rs_plumber_chef',
  programmeMachinist: 'prg_rs_machinist',
  secACSW500: 'sec_acsw500',
  secACC201: 'sec_acc201',
  secBETH190: 'sec_beth190',
  secBMGT112: 'sec_bmgt112',
  secCOMP101: 'sec_comp101',
  secDAP101: 'sec_dap101',
  secEMPL111: 'sec_empl111',
  secMARK114: 'sec_mark114',
  secCS301: 'sec_cs301',
  secCS201: 'sec_cs201',
  secENG110: 'sec_eng110',
  wsWell: 'ws_well',
  wsResume: 'ws_resume',
  wsStudy: 'ws_study',
  wsLead: 'ws_lead',
  wsGis: 'ws_gis',
} as const;

export const ROSTER = [
  { id: 'u_student_marcus', first: 'Marcus', last: 'Vance', number: 'ST-2024-001', program: 'Computer Science', email: 'marcus.vance@heritage.edu' },
  { id: 'u_student_priya', first: 'Priya', last: 'Sandhu', number: 'ST-2024-014', program: 'Nursing', email: 'priya.sandhu@heritage.edu' },
  { id: 'u_student_daniel', first: 'Daniel', last: 'Okafor', number: 'ST-2023-088', program: 'Computer Science', email: 'daniel.okafor@heritage.edu' },
  { id: 'u_student_jordan', first: 'Jordan', last: 'Lee', number: 'ST-2025-022', program: 'Business', email: 'jordan.lee@heritage.edu' },
  { id: 'u_student_mei', first: 'Mei', last: 'Chen', number: 'ST-2025-031', program: 'Nursing', email: 'mei.chen@heritage.edu' },
  { id: 'u_student_lucas', first: 'Lucas', last: 'Moreau', number: 'ST-2024-055', program: 'Business', email: 'lucas.moreau@heritage.edu' },
  { id: 'u_student_aisha', first: 'Aisha', last: 'Khan', number: 'ST-2025-040', program: 'Business', email: 'aisha.khan@heritage.edu' },
] as const;

/** Section rosters (student ids). ACSW 500 matches the Class List reference exactly. */
export const SECTION_ROSTERS: Record<string, readonly string[]> = {
  sec_acsw500: ['u_student_marcus', 'u_student_priya', 'u_student_daniel', 'u_student_jordan', 'u_student_mei', 'u_student_lucas'],
  sec_beth190: ['u_student_marcus', 'u_student_priya', 'u_student_daniel', 'u_student_jordan', 'u_student_mei', 'u_student_lucas'],
  sec_bmgt112: ['u_student_marcus', 'u_student_priya', 'u_student_daniel', 'u_student_jordan', 'u_student_mei'],
  sec_comp101: ['u_student_priya', 'u_student_daniel', 'u_student_jordan', 'u_student_mei', 'u_student_lucas', 'u_student_aisha'],
  sec_dap101: ['u_student_priya', 'u_student_daniel', 'u_student_jordan', 'u_student_mei', 'u_student_lucas', 'u_student_aisha'],
  sec_empl111: ['u_student_priya', 'u_student_daniel', 'u_student_jordan', 'u_student_mei', 'u_student_lucas', 'u_student_aisha'],
  sec_mark114: ['u_student_priya', 'u_student_daniel', 'u_student_jordan', 'u_student_mei', 'u_student_lucas', 'u_student_aisha'],
};
