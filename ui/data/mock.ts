// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  displayName: string;
  handle: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  palette: number;
  desc: string;
  isPublic: boolean;
  superAdminId: string;
  adminIds: string[];
  memberIds: string[];
}

export interface Rsvp {
  userId: string;
  status: 'going' | 'maybe' | 'notGoing';
  memo: string;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  photos: string[];
  ts: Date;
}

export interface Event {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  subtitle?: string;
  description?: string;
  coverPhotos: string[];
  start: Date;
  end: Date;
  isAllDay?: boolean;
  location?: string;
  minAttendees?: number;
  deadline?: Date;
  allowMaybe?: boolean;
  rsvps: Rsvp[];
  comments: Comment[];
}

export interface Notification {
  id: string;
  type: string;
  read: boolean;
  ts: Date;
  icon: string;
  title: string;
  body: string;
  groupId?: string | null;
  eventId?: string;
  navigable: boolean;
  dest: 'event' | 'group' | null;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const USERS: User[] = [
  { id: 'u1', name: 'Jenny', displayName: 'Jenny · KTown · 92', handle: 'jenny.ktown.92' },
  { id: 'u2', name: '지훈', displayName: '지훈 · LA · 90', handle: 'jhoon.la.90' },
  { id: 'u3', name: 'Mike', displayName: 'Mike · KTown · 88', handle: 'mike.ktown.88' },
  { id: 'u4', name: '수연', displayName: '수연 · LA · 93', handle: 'sooyeon.la.93' },
  { id: 'u5', name: 'David', displayName: 'David · SGV · 89', handle: 'david.sgv.89' },
  { id: 'u6', name: 'Haru', displayName: 'Haru · Lamirada · 80', handle: 'haru.la.80' },
  { id: 'u7', name: 'Jay', displayName: 'Jay · LA · 83', handle: 'jay.la.83' },
  { id: 'u8', name: '가후', displayName: '가후 · OC · 88', handle: 'gahu.oc.88' },
  { id: 'u9', name: '민지', displayName: '민지 · SGV · 88', handle: 'minji.sgv.88' },
  { id: 'u10', name: 'Chris', displayName: 'Chris · LA · 90', handle: 'chris.la.90' },
  { id: 'u11', name: 'Amy', displayName: 'Amy · OC · 91', handle: 'amy.oc.91' },
  { id: 'u12', name: '상훈', displayName: '상훈 · SGV · 87', handle: 'sanghoon.sgv.87' },
  { id: 'u13', name: 'Hannah', displayName: 'Hannah · SGV · 92', handle: 'hannah.sgv.92' },
  { id: 'u14', name: '준혁', displayName: '준혁 · LA · 91', handle: 'junhyuk.la.91' },
  { id: 'u15', name: 'Lisa', displayName: 'Lisa · Glendale · 89', handle: 'lisa.glendale.89' },
  { id: 'u16', name: '태현', displayName: '태현 · LA · 88', handle: 'taehyun.la.88' },
  { id: 'u17', name: 'Brian', displayName: 'Brian · Burbank · 90', handle: 'brian.burbank.90' },
  { id: 'u18', name: 'Chloe', displayName: 'Chloe · LA · 93', handle: 'chloe.la.93' },
  { id: 'u19', name: '정민', displayName: '정민 · LA · 92', handle: 'jungmin.la.92' },
  { id: 'u20', name: 'Alex', displayName: 'Alex · KTown · 90', handle: 'alex.ktown.90' },
  { id: 'u21', name: 'Danny', displayName: 'Danny · SGV · 88', handle: 'danny.sgv.88' },
  { id: 'u22', name: '스티브', displayName: '스티브 · LA · 91', handle: 'steve.la.91' },
  { id: 'u23', name: '영호', displayName: '영호 · LA · 89', handle: 'youngho.la.89' },
  { id: 'u24', name: 'Cathy', displayName: 'Cathy · KTown · 88', handle: 'cathy.ktown.88' },
  { id: 'u25', name: '글즈', displayName: '글즈 · LA · 88', handle: 'glz.la.88' },
  { id: 'u26', name: 'Rachel', displayName: 'Rachel · OC · 91', handle: 'rachel.oc.91' },
  { id: 'u27', name: 'Tommy', displayName: 'Tommy · SGV · 89', handle: 'tommy.sgv.89' },
];

export function getUser(id: string): User {
  const u = USERS.find(x => x.id === id);
  if (!u) return { id, name: 'Unknown', displayName: 'Unknown', handle: '' };
  return u;
}

/** Member IDs of the event's group who have not submitted an RSVP. */
export function getNoResponseIds(event: Event): string[] {
  const group = GROUPS.find(g => g.id === event.groupId);
  if (!group) return [];
  const rsvpUserIds = new Set(event.rsvps.map(r => r.userId));
  return group.memberIds.filter(id => !rsvpUserIds.has(id));
}

export const ME_ID = 'u1';
export const ME = getUser(ME_ID);
export const MY_NAME = ME.displayName;

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateAt(y: number, mo: number, day: number, h = 19, min = 0): Date {
  return new Date(y, mo - 1, day, h, min, 0, 0);
}
export function uid(): string { return Math.random().toString(36).slice(2, 9); }
/** Returns a Date that is `minutesAgo` minutes before now (for mock comment timestamps). */
function postedAtMinutesAgo(minutesAgo: number): Date {
  return new Date(Date.now() - minutesAgo * 60000);
}
function cmt(userId: string, text: string, postedAt: Date): Comment {
  return { id: uid(), userId, text, photos: [], ts: postedAt };
}

// ── Groups ────────────────────────────────────────────────────────────────────
export const GROUPS: Group[] = [
  {
    id: 'g1', name: 'KTown Hangout', emoji: '🏙️', palette: 0,
    desc: 'Friday nights, pocha runs, random KTown adventures. Everyone welcome!',
    isPublic: false, superAdminId: 'u1', adminIds: ['u1'],
    memberIds: ['u1','u2','u3','u4','u5','u6','u7','u8'],
  },
  {
    id: 'g2', name: 'SGV Foodies', emoji: '🍜', palette: 1,
    desc: 'Exploring the best of SGV — dim sum, KBBQ, and everything in between.',
    isPublic: false, superAdminId: 'u9', adminIds: ['u9'],
    memberIds: ['u1','u9','u10','u11','u12','u7','u13'],
  },
  {
    id: 'g3', name: 'LA Korean Entrepreneurs', emoji: '💼', palette: 2,
    desc: 'Networking, mentorship, and startup support in LA.',
    isPublic: true, superAdminId: 'u5', adminIds: ['u5'],
    memberIds: ['u1','u5','u10','u11','u7'],
  },
  {
    id: 'g4', name: 'LA Hiking Crew', emoji: '⛰️', palette: 3,
    desc: 'Weekend hikes across LA — Griffith, Mt. Baldy, Runyon. All levels welcome.',
    isPublic: false, superAdminId: 'u1', adminIds: ['u1'],
    memberIds: ['u1','u14','u15','u16','u17','u18'],
  },
  {
    id: 'g5', name: 'KTown Hoops', emoji: '🏀', palette: 2,
    desc: 'Pick-up basketball and 3-on-3 at local courts.',
    isPublic: false, superAdminId: 'u19', adminIds: ['u19'],
    memberIds: ['u1','u19','u20','u21','u22','u23'],
  },
  {
    id: 'g6', name: 'Koreatown Running Club', emoji: '🏃', palette: 0,
    desc: 'Morning runs every Tuesday and Saturday.',
    isPublic: true, superAdminId: 'u2', adminIds: ['u2'],
    memberIds: ['u1','u2','u3','u6','u4'],
  },
  {
    id: 'g7', name: 'K-Drama Watch Party', emoji: '🎬', palette: 1,
    desc: 'Weekly watch parties — K-drama and variety.',
    isPublic: true, superAdminId: 'u9', adminIds: ['u9'],
    memberIds: ['u1','u9','u11','u12','u13'],
  },
  {
    id: 'g8', name: 'KTown Volleyball', emoji: '🏐', palette: 3,
    desc: 'Sunday volleyball at Koreatown Rec Center.',
    isPublic: true, superAdminId: 'u8', adminIds: ['u8'],
    memberIds: ['u1','u8','u7','u18','u17'],
  },
];

// ── Events ────────────────────────────────────────────────────────────────────
export const ALL_EVENTS: Event[] = ([
  // past
  { id:'p1', groupId:'g4', createdBy:'u14', title:'Mt. Baldy Day Hike 🏔️', subtitle:'발디산 당일 등산',
    description:'Sunrise hike at Griffith — meet at the Observatory parking lot.\n\n🥾 Difficulty: Easy-Moderate (3.5 miles)\n🧴 Bring water, sunscreen, layers\n⏰ We leave at 5:30 sharp!\n\nTrail map: https://www.laparks.org/griffithpark',
    coverPhotos:[], start:dateAt(2026,3,8,7,0), end:dateAt(2026,3,8,15,0), location:'Mt. Baldy Trailhead · Mt. Baldy Village',
    minAttendees:4, allowMaybe:true,
    rsvps:[{userId:'u14',status:'going',memo:''},{userId:'u15',status:'going',memo:''},{userId:'u16',status:'going',memo:''},{userId:'u17',status:'going',memo:''}],
    comments:[cmt('u17','that was epic!',postedAtMinutesAgo(5760))] },

  { id:'p2', groupId:'g1', createdBy:'u2', title:'아침 해장국 번개 🍲', subtitle:'Hangover cure Sunday',
    coverPhotos:[], start:dateAt(2026,3,11,10,0), end:dateAt(2026,3,11,12,0), location:'Chunju Han-il Kwan · Koreatown',
    minAttendees:3, allowMaybe:false,
    rsvps:[{userId:'u1',status:'going',memo:''},{userId:'u2',status:'going',memo:''},{userId:'u3',status:'going',memo:'needed this lol'}],
    comments:[] },

  // February 2026 — 10 past events
  { id:'f1', groupId:'g1', createdBy:'u2', title:'Feb Pocha Night 🍻', subtitle:'First Friday in KTown',
    coverPhotos:[], start:dateAt(2026,2,2,20,0), end:dateAt(2026,2,3,0,0), location:'Pocha 32 · Koreatown',
    minAttendees:4, allowMaybe:true,
    rsvps:[{userId:'u1',status:'going',memo:''},{userId:'u2',status:'going',memo:''},{userId:'u3',status:'maybe',memo:'depends on work'}],
    comments:[cmt('u2','that hit the spot',postedAtMinutesAgo(4320))] },

  { id:'f2', groupId:'g2', createdBy:'u9', title:'Lunar New Year Dim Sum 🧧', subtitle:'설날 brunch',
    coverPhotos:[], start:dateAt(2026,2,3,11,0), end:dateAt(2026,2,3,13,0), location:'Sea Harbour · Rosemead',
    minAttendees:6, allowMaybe:false,
    rsvps:[{userId:'u9',status:'going',memo:''},{userId:'u10',status:'going',memo:'brought my parents'},{userId:'u11',status:'going',memo:''},{userId:'u12',status:'going',memo:''}],
    comments:[cmt('u10','best turnip cake 🙌',postedAtMinutesAgo(4200))] },

  { id:'f3', groupId:'g4', createdBy:'u1', title:'Rainy Day Griffith Walk 🌧️', subtitle:'Short loop, light drizzle',
    coverPhotos:[], start:dateAt(2026,2,4,9,30), end:dateAt(2026,2,4,11,30), location:'Griffith Observatory · LA',
    minAttendees:3, allowMaybe:true,
    rsvps:[{userId:'u1',status:'going',memo:'got my rain jacket'},{userId:'u15',status:'going',memo:''},{userId:'u16',status:'maybe',memo:'ankle still weird'}],
    comments:[cmt('u15','foggy but so pretty',postedAtMinutesAgo(4000))] },

  { id:'f4', groupId:'g5', createdBy:'u19', title:'Sunday 5-on-5 🏀', subtitle:'Full court run',
    coverPhotos:[], start:dateAt(2026,2,5,17,0), end:dateAt(2026,2,5,19,0), location:'Wilson High · Hacienda Heights',
    minAttendees:10, allowMaybe:false,
    rsvps:[{userId:'u19',status:'going',memo:''},{userId:'u20',status:'going',memo:''},{userId:'u21',status:'going',memo:''},{userId:'u22',status:'going',memo:''},{userId:'u23',status:'going',memo:''}],
    comments:[cmt('u21','next time let’s book two courts',postedAtMinutesAgo(3840))] },

  { id:'f5', groupId:'g7', createdBy:'u9', title:'Crash Landing Finale Night 🎬', subtitle:'Series wrap party',
    coverPhotos:[], start:dateAt(2026,2,9,19,30), end:dateAt(2026,2,9,22,30), location:'민지\'s place · SGV',
    minAttendees:4, allowMaybe:true,
    rsvps:[{userId:'u9',status:'going',memo:''},{userId:'u11',status:'going',memo:''},{userId:'u12',status:'going',memo:''},{userId:'u13',status:'going',memo:'crying already'}],
    comments:[cmt('u13','i was NOT ready 😭',postedAtMinutesAgo(3360))] },

  { id:'f6', groupId:'g6', createdBy:'u2', title:'Tuesday Tempo Run 🏃‍♀️', subtitle:'4 miles at conversation pace',
    coverPhotos:[], start:dateAt(2026,2,13,7,0), end:dateAt(2026,2,13,8,0), location:'Koreatown · Normandie & 6th',
    minAttendees:3, allowMaybe:true,
    rsvps:[{userId:'u2',status:'going',memo:''},{userId:'u3',status:'going',memo:'trying new shoes'},{userId:'u6',status:'going',memo:''}],
    comments:[cmt('u3','pace was perfect 🙏',postedAtMinutesAgo(3000))] },

  { id:'f7', groupId:'g3', createdBy:'u5', title:'Founders Coffee Chat ☕', subtitle:'Early-stage Q&A',
    coverPhotos:[], start:dateAt(2026,2,15,10,0), end:dateAt(2026,2,15,11,30), location:'Alchemist Coffee · Koreatown',
    minAttendees:3, allowMaybe:true,
    rsvps:[{userId:'u1',status:'going',memo:''},{userId:'u5',status:'going',memo:'bring your deck'},{userId:'u10',status:'going',memo:''}],
    comments:[cmt('u5','let’s do this monthly',postedAtMinutesAgo(2880))] },

  { id:'f8', groupId:'g8', createdBy:'u8', title:'Valentine\'s Volley Mix 🏐', subtitle:'Couples & singles welcome',
    coverPhotos:[], start:dateAt(2026,2,14,18,0), end:dateAt(2026,2,14,20,0), location:'Koreatown Rec Center',
    minAttendees:8, allowMaybe:true,
    rsvps:[{userId:'u8',status:'going',memo:''},{userId:'u7',status:'going',memo:''},{userId:'u18',status:'going',memo:''},{userId:'u17',status:'maybe',memo:'might be late'}],
    comments:[cmt('u8','who knew volleyball could be this cute',postedAtMinutesAgo(2760))] },

  { id:'f9', groupId:'g2', createdBy:'u9', title:'Hot Pot Night 🔥', subtitle:'All-you-can-eat',
    coverPhotos:[], start:dateAt(2026,2,18,19,0), end:dateAt(2026,2,18,22,0), location:'Boiling Point · SGV',
    minAttendees:5, allowMaybe:true,
    rsvps:[{userId:'u9',status:'going',memo:''},{userId:'u10',status:'going',memo:''},{userId:'u11',status:'going',memo:''}],
    comments:[cmt('u11','ate way too much tofu skin',postedAtMinutesAgo(2520))] },

  { id:'f10', groupId:'g4', createdBy:'u1', title:'Sunset Runyon Hike 🌇', subtitle:'Golden hour photos',
    coverPhotos:[], start:dateAt(2026,2,24,16,30), end:dateAt(2026,2,24,19,0), location:'Runyon Canyon · LA',
    minAttendees:4, allowMaybe:true,
    rsvps:[{userId:'u1',status:'going',memo:''},{userId:'u14',status:'going',memo:''},{userId:'u15',status:'going',memo:''},{userId:'u16',status:'going',memo:''}],
    comments:[cmt('u14','city lights were insane',postedAtMinutesAgo(2040))] },

  // today / upcoming
  { id:'e1', groupId:'g1', createdBy:'u1', title:'금요일 포차 번개 🍻', subtitle:'Friday night @ Pocha 32',
    description:'이번주 금요일 포차 32에서 모여요!\n\n🍺 포차 특선 안주 세트 인당 15불 예정\n📍 주차는 건물 뒤 골목에 있어요\n\nMore info: https://pocha32.com',
    coverPhotos:[], start:dateAt(2026,3,16,20,0), end:dateAt(2026,3,16,23,0), location:'Pocha 32 · 3211 W 6th St, Koreatown',
    minAttendees:5, deadline:dateAt(2026,3,16,18,0), allowMaybe:true,
    rsvps:[
      {userId:'u1',status:'going',memo:''},
      {userId:'u2',status:'going',memo:'조금 늦을 수도'},
      {userId:'u3',status:'going',memo:''},
      {userId:'u4',status:'going',memo:'8시 반쯤'},
      {userId:'u5',status:'notGoing',memo:'이번엔 못 가요 ㅠ'},
    ],
    comments:[
      cmt('u2','이번주 드디어다 🔥',postedAtMinutesAgo(180)),
      cmt('u4','나 좀 늦을게',postedAtMinutesAgo(160)),
      cmt('u1','all good i\'ll grab a table',postedAtMinutesAgo(150)),
      cmt('u5','주차 어디가 좋아요?',postedAtMinutesAgo(80)),
      cmt('u1','side alley behind the restaurant',postedAtMinutesAgo(75)),
    ] },

  { id:'e2', groupId:'g2', createdBy:'u9', title:'SGV Dim Sum Run 🥟', subtitle:'딤섬 먹으러 가요',
    coverPhotos:[], start:dateAt(2026,3,16,11,0), end:dateAt(2026,3,16,13,0), location:'Sea Harbour Seafood · Rosemead',
    minAttendees:4, deadline:dateAt(2026,3,16,9,0), allowMaybe:false,
    rsvps:[{userId:'u9',status:'going',memo:''},{userId:'u10',status:'going',memo:'first time!'},{userId:'u11',status:'going',memo:''},{userId:'u12',status:'going',memo:''}],
    comments:[cmt('u10','what should i order?',postedAtMinutesAgo(60)),cmt('u9','하가우랑 창펀 꼭!',postedAtMinutesAgo(45))] },

  { id:'e4', groupId:'g4', createdBy:'u1', title:'그리피스 일출 하이킹 🌄', subtitle:'Griffith Park sunrise hike',
    description:'Sunrise hike at Griffith — meet at the Observatory parking lot.\n\n🥾 Difficulty: Easy-Moderate\n🧴 Bring water, sunscreen, layers\n\nTrail map: https://www.laparks.org/griffithpark',
    coverPhotos:[], start:dateAt(2026,3,18,5,30), end:dateAt(2026,3,18,9,0), location:'Griffith Observatory · Los Angeles',
    minAttendees:4, deadline:dateAt(2026,3,17,20,0), allowMaybe:true,
    rsvps:[{userId:'u1',status:'going',memo:'커피 사갈게요'},{userId:'u15',status:'going',memo:'so early but worth it'}],
    comments:[] },

  { id:'e5', groupId:'g5', createdBy:'u19', title:'3-on-3 농구 🏀', subtitle:'Sunday pick-up at Wilson courts',
    coverPhotos:[], start:dateAt(2026,3,19,18,0), end:dateAt(2026,3,19,20,0), location:'Wilson High School Courts · Hacienda Heights',
    minAttendees:6, deadline:dateAt(2026,3,18,18,0), allowMaybe:false,
    rsvps:[{userId:'u19',status:'going',memo:''},{userId:'u20',status:'going',memo:"i'll bring the ball"}],
    comments:[] },

  { id:'e6', groupId:'g1', createdBy:'u2', title:'Norebang Night 🎤', subtitle:'노래방 가자~ Pharaoh\'s',
    coverPhotos:[], start:dateAt(2026,3,20,21,30), end:dateAt(2026,3,21,0,0), location:"Pharaoh's Karaoke · 3680 Wilshire Blvd",
    minAttendees:4, deadline:dateAt(2026,3,19,20,0), allowMaybe:true,
    rsvps:[
      {userId:'u1',status:'going',memo:''},
      {userId:'u2',status:'going',memo:'18번 연습함 ㅋ'},
      {userId:'u4',status:'going',memo:''},
      {userId:'u24',status:'going',memo:'never done this lol'},
    ],
    comments:[cmt('u24','do i need to know korean songs?',postedAtMinutesAgo(300)),cmt('u1','nope! tons of english too',postedAtMinutesAgo(280))] },

  { id:'e7', groupId:'g2', createdBy:'u9', title:'KBBQ + 소주 한 잔 🥩', subtitle:'Team dinner — Genwa on Wilshire',
    coverPhotos:[], start:dateAt(2026,3,22,19,0), end:dateAt(2026,3,22,22,0), location:'Genwa Korean BBQ · 5115 Wilshire Blvd',
    minAttendees:6, allowMaybe:false,
    rsvps:[{userId:'u9',status:'going',memo:'삼겹살 무조건'},{userId:'u12',status:'going',memo:''}],
    comments:[] },

  // March 16, 2026 — 10 events
  { id:'m1', groupId:'g6', createdBy:'u2', title:'Morning Run 🌅', subtitle:'5K around KTown',
    coverPhotos:[], start:dateAt(2026,3,17,7,0), end:dateAt(2026,3,17,8,0), location:'Koreatown · meet at Normandie & 6th',
    minAttendees:0, allowMaybe:true, rsvps:[], comments:[] },
  { id:'m2', groupId:'g2', createdBy:'u9', title:'Dim Sum Brunch 🥟', subtitle:'Sunday dim sum',
    coverPhotos:[], start:dateAt(2026,3,17,9,0), end:dateAt(2026,3,17,11,0), location:'Sea Harbour · Rosemead',
    minAttendees:0, allowMaybe:false, rsvps:[], comments:[] },
  { id:'m3', groupId:'g1', createdBy:'u2', title:'KTown Coffee ☕', subtitle:'Casual catch-up',
    coverPhotos:[], start:dateAt(2026,3,17,10,30), end:dateAt(2026,3,17,12,0), location:'Cafe Mak · Koreatown',
    minAttendees:2, allowMaybe:true, rsvps:[], comments:[] },
  { id:'m4', groupId:'g4', createdBy:'u1', title:'Griffith Park Hike 🥾', subtitle:'Afternoon hike',
    coverPhotos:[], start:dateAt(2026,3,17,12,0), end:dateAt(2026,3,17,15,0), location:'Griffith Observatory · LA',
    minAttendees:3, allowMaybe:true, rsvps:[], comments:[] },
  { id:'m5', groupId:'g7', createdBy:'u9', title:'K-Drama Watch Party 📺', subtitle:'Episode 12',
    coverPhotos:[], start:dateAt(2026,3,17,14,0), end:dateAt(2026,3,17,17,0), location:'민지\'s place · SGV',
    minAttendees:3, allowMaybe:true, rsvps:[], comments:[] },
  { id:'m6', groupId:'g8', createdBy:'u8', title:'Volleyball Sunday 🏐', subtitle:'Rec center pickup',
    coverPhotos:[], start:dateAt(2026,3,17,16,0), end:dateAt(2026,3,17,18,0), location:'Koreatown Rec Center',
    minAttendees:4, allowMaybe:false, rsvps:[], comments:[] },
  { id:'m7', groupId:'g5', createdBy:'u19', title:'3-on-3 Pickup 🏀', subtitle:'Wilson courts',
    coverPhotos:[], start:dateAt(2026,3,17,18,0), end:dateAt(2026,3,17,20,0), location:'Wilson High · Hacienda Heights',
    minAttendees:6, allowMaybe:false, rsvps:[], comments:[] },
  { id:'m8', groupId:'g3', createdBy:'u5', title:'Founder Happy Hour 🍸', subtitle:'Networking',
    coverPhotos:[], start:dateAt(2026,3,17,19,0), end:dateAt(2026,3,17,21,0), location:'The Line Hotel · KTown',
    minAttendees:5, allowMaybe:true, rsvps:[], comments:[] },
  { id:'m9', groupId:'g1', createdBy:'u2', title:'Pocha Night 🍻', subtitle:'Friday vibes',
    coverPhotos:[], start:dateAt(2026,3,17,20,0), end:dateAt(2026,3,17,23,0), location:'Pocha 32 · Koreatown',
    minAttendees:4, allowMaybe:true, 
    rsvps:[
      {userId:'u1',status:'going',memo:''},
      {userId:'u2',status:'going',memo:''},
      {userId:'u3',status:'going',memo:''},
      {userId:'u4',status:'going',memo:''},
      {userId:'u5',status:'going',memo:''},
      {userId:'u6',status:'going',memo:''},
      {userId:'u7',status:'going',memo:''},
      {userId:'u8',status:'going',memo:''},
      {userId:'u9',status:'going',memo:''},
      {userId:'u10',status:'going',memo:''},
      {userId:'u11',status:'going',memo:''},
      {userId:'u12',status:'going',memo:''}
    ], 
    comments:[] },
  { id:'m10', groupId:'g2', createdBy:'u9', title:'Dessert & Chat 🍰', subtitle:'Sul & Beans',
    coverPhotos:[], start:dateAt(2026,3,17,21,30), end:dateAt(2026,3,17,23,0), location:'Sul & Beans · KTown',
    minAttendees:2, allowMaybe:true, rsvps:[], comments:[] },

  // 2025 — older past events
  { id:'o1', groupId:'g1', createdBy:'u2', title:'Summer Soju Night 2025 🍶', subtitle:'Rooftop hang',
    coverPhotos:[], start:dateAt(2025,7,18,20,0), end:dateAt(2025,7,18,23,30), location:'Rooftop · Koreatown',
    minAttendees:6, allowMaybe:true,
    rsvps:[
      {userId:'u1',status:'going',memo:''},
      {userId:'u2',status:'going',memo:''},
      {userId:'u3',status:'going',memo:''},
      {userId:'u4',status:'going',memo:''},
    ],
    comments:[cmt('u2','this started the whole group 😂',dateAt(2025,7,19,1,0))] },

  { id:'o2', groupId:'g2', createdBy:'u9', title:'SGV KBBQ Tour 2025 🥩', subtitle:'3 spots in one night',
    coverPhotos:[], start:dateAt(2025,9,5,18,0), end:dateAt(2025,9,6,0,0), location:'Various · SGV',
    minAttendees:5, allowMaybe:true,
    rsvps:[
      {userId:'u9',status:'going',memo:'planning the route'},
      {userId:'u10',status:'going',memo:''},
      {userId:'u11',status:'going',memo:''},
    ],
    comments:[cmt('u11','i still think about that galbi',dateAt(2025,9,6,10,0))] },

  { id:'o3', groupId:'g4', createdBy:'u1', title:'Mt. Wilson Sunrise 2025 🌄', subtitle:'Cloud inversion hunt',
    coverPhotos:[], start:dateAt(2025,10,12,4,30), end:dateAt(2025,10,12,11,30), location:'Mt. Wilson Trail · Sierra Madre',
    minAttendees:4, allowMaybe:true,
    rsvps:[
      {userId:'u1',status:'going',memo:'driving from KTown'},
      {userId:'u14',status:'going',memo:''},
      {userId:'u15',status:'going',memo:''},
    ],
    comments:[cmt('u14','sunrise above the clouds was unreal',dateAt(2025,10,12,13,0))] },

  { id:'o4', groupId:'g7', createdBy:'u9', title:'2025 K-Drama Kickoff 🎥', subtitle:'New season, new snacks',
    coverPhotos:[], start:dateAt(2025,1,7,19,30), end:dateAt(2025,1,7,22,0), location:'민지\'s place · SGV',
    minAttendees:3, allowMaybe:true,
    rsvps:[
      {userId:'u9',status:'going',memo:''},
      {userId:'u11',status:'going',memo:''},
      {userId:'u13',status:'maybe',memo:'depends on work'},
    ],
    comments:[cmt('u9','this is when we all got hooked 😅',dateAt(2025,1,8,9,0))] },

  { id:'o5', groupId:'g6', createdBy:'u2', title:'New Year Shakeout Run 2025 🏃', subtitle:'Easy 3K to start the year',
    coverPhotos:[], start:dateAt(2025,1,2,8,0), end:dateAt(2025,1,2,9,0), location:'Koreatown · Normandie & 6th',
    minAttendees:2, allowMaybe:true,
    rsvps:[
      {userId:'u2',status:'going',memo:'no resolutions, just vibes'},
      {userId:'u3',status:'going',memo:''},
    ],
    comments:[cmt('u2','first run of the crew 🥹',dateAt(2025,1,2,12,0))] },

  // 2027 — future event
  { id:'fut1', groupId:'g3', createdBy:'u5', title:'LA Founders Summit 2027 🚀', subtitle:'All-day mini conference',
    description:'A full day of talks, panels, and office hours for LA-based Korean founders.\n\n🗣 Speakers from YC, a16z, and local angels\n☕ Coffee + light breakfast\n🥡 Lunch + happy hour included',
    coverPhotos:[],
    start:dateAt(2027,4,21,9,0),
    end:dateAt(2027,4,21,18,0),
    location:'The LINE Hotel · Koreatown',
    minAttendees:30,
    allowMaybe:true,
    rsvps:[
      {userId:'u1',status:'going',memo:'boltup demo maybe?'},
      {userId:'u5',status:'going',memo:'bringing slides'},
    ],
    comments:[
      cmt('u5','save the date 🔔',postedAtMinutesAgo(30)),
    ] },
] as Event[]).sort((a, b) => a.start.getTime() - b.start.getTime());

export function addEvent(event: Event): void {
  ALL_EVENTS.push(event);
  ALL_EVENTS.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function updateEvent(id: string, updatedEvent: Event): void {
  const index = ALL_EVENTS.findIndex(e => e.id === id);
  if (index !== -1) {
    ALL_EVENTS[index] = updatedEvent;
    ALL_EVENTS.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const INIT_NOTIFICATIONS: Notification[] = [
  { id:'n1', type:'invite_approved', read:false, ts:new Date(Date.now()-1800000),
    icon:'✅', title:'Invite approved', body:"You've been added to KTown Hangout",
    groupId:'g1', navigable:true, dest:'group' },
  { id:'n2', type:'event_update', read:false, ts:new Date(Date.now()-3600000),
    icon:'📍', title:'Location updated', body:'그리피스 일출 하이킹 — location changed',
    groupId:'g4', eventId:'e4', navigable:true, dest:'event' },
  { id:'n3', type:'new_rsvp', read:false, ts:new Date(Date.now()-7200000),
    icon:'🙋', title:'New RSVP', body:'Lisa is going to 그리피스 일출 하이킹',
    groupId:'g4', eventId:'e4', navigable:true, dest:'event' },
  { id:'n4', type:'needs_more', read:true, ts:new Date(Date.now()-86400000),
    icon:'⚠️', title:'Need more people', body:'그리피스 일출 하이킹 still needs 2 more',
    groupId:'g4', eventId:'e4', navigable:true, dest:'event' },
  { id:'n5', type:'new_comment', read:true, ts:new Date(Date.now()-172800000),
    icon:'💬', title:'New comment', body:'지훈 commented on 금요일 포차 번개',
    groupId:'g1', eventId:'e1', navigable:true, dest:'event' },
  { id:'n6', type:'removed', read:true, ts:new Date(Date.now()-259200000),
    icon:'🚪', title:'Removed from group', body:'You were removed from Koreatown Sports',
    groupId:null, navigable:false, dest:null },
];
