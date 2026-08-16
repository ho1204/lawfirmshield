const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shield2026!';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-development-secret-change-me';
const MAX_BODY = 1024 * 1024;

const seed = {
  boards: [
    { id: 'notice', name: '공지사항', description: '법률사무소 쉴드의 새로운 소식입니다.', createdAt: '2026-08-01T09:00:00.000Z' },
    { id: 'column', name: '법률 칼럼', description: '일상에 도움이 되는 법률 정보를 전합니다.', createdAt: '2026-08-01T09:10:00.000Z' }
  ],
  posts: [
    { id: 'welcome', boardId: 'notice', title: '법률사무소 쉴드 홈페이지에 오신 것을 환영합니다', excerpt: '의뢰인의 권리를 지키는 든든한 법률 파트너가 되겠습니다.', content: '법률사무소 쉴드는 사건의 시작부터 끝까지 의뢰인과 함께합니다.\n\n상담을 원하시면 홈페이지 하단의 상담 문의를 이용해 주세요.', author: '법률사무소 쉴드', createdAt: '2026-08-12T02:00:00.000Z' },
    { id: 'lease-guide', boardId: 'column', title: '임대차 분쟁이 생겼을 때 먼저 확인할 세 가지', excerpt: '계약서, 대화 기록, 보증금 반환 시점을 차분히 확인하세요.', content: '임대차 분쟁은 사실관계와 자료 정리가 중요합니다.\n\n1. 계약서의 특약사항\n2. 문자와 메신저 등 대화 기록\n3. 계약 종료 및 보증금 반환 약정일\n\n구체적인 대응은 개별 사안에 따라 달라질 수 있으므로 법률 전문가의 검토를 권합니다.', author: '법률사무소 쉴드', createdAt: '2026-08-10T04:30:00.000Z' }
  ]
};

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));

function readStore() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeStore(data) {
  const temp = DATA_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, DATA_FILE);
}
function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(payload));
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(value) { return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex'); }
function isAdmin(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => v.trim().split('=')));
  if (!cookies.shield_admin) return false;
  const [expires, signature] = decodeURIComponent(cookies.shield_admin).split('.');
  return Number(expires) > Date.now() && safeEqual(signature || '', sign(expires));
}
function sessionCookie() {
  const expires = String(Date.now() + 1000 * 60 * 60 * 8);
  return `shield_admin=${encodeURIComponent(expires + '.' + sign(expires))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`;
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > MAX_BODY) reject(new Error('too large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}
function slugId(prefix = '') { return prefix + crypto.randomBytes(7).toString('hex'); }
function clean(value, max = 5000) { return String(value || '').trim().slice(0, max); }

async function api(req, res, url) {
  if (url.pathname === '/api/session' && req.method === 'GET') return json(res, 200, { admin: isAdmin(req) });
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const data = await body(req);
    if (!safeEqual(data.password || '', ADMIN_PASSWORD)) return json(res, 401, { message: '비밀번호가 올바르지 않습니다.' });
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie() });
  }
  if (url.pathname === '/api/logout' && req.method === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': 'shield_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });

  const store = readStore();
  if (url.pathname === '/api/boards' && req.method === 'GET') {
    const boards = store.boards.map(board => ({ ...board, postCount: store.posts.filter(p => p.boardId === board.id).length }));
    return json(res, 200, boards);
  }
  if (url.pathname === '/api/posts' && req.method === 'GET') {
    const posts = store.posts.filter(p => !url.searchParams.get('board') || p.boardId === url.searchParams.get('board')).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    return json(res, 200, posts);
  }
  const postMatch = url.pathname.match(/^\/api\/posts\/([\w-]+)$/);
  if (postMatch && req.method === 'GET') {
    const post = store.posts.find(p => p.id === postMatch[1]);
    return post ? json(res, 200, post) : json(res, 404, { message: '글을 찾을 수 없습니다.' });
  }
  if (!isAdmin(req)) return json(res, 401, { message: '관리자 로그인이 필요합니다.' });

  if (url.pathname === '/api/boards' && req.method === 'POST') {
    const data = await body(req); const name = clean(data.name, 40);
    if (!name) return json(res, 400, { message: '게시판 이름을 입력해 주세요.' });
    const board = { id: slugId('b-'), name, description: clean(data.description, 120), createdAt: new Date().toISOString() };
    store.boards.push(board); writeStore(store); return json(res, 201, board);
  }
  const boardMatch = url.pathname.match(/^\/api\/boards\/([\w-]+)$/);
  if (boardMatch && req.method === 'DELETE') {
    if (!store.boards.some(b => b.id === boardMatch[1])) return json(res, 404, { message: '게시판을 찾을 수 없습니다.' });
    store.boards = store.boards.filter(b => b.id !== boardMatch[1]);
    store.posts = store.posts.filter(p => p.boardId !== boardMatch[1]);
    writeStore(store); return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/posts' && req.method === 'POST') {
    const data = await body(req); const title = clean(data.title, 100); const content = clean(data.content, 20000);
    if (!title || !content || !store.boards.some(b => b.id === data.boardId)) return json(res, 400, { message: '게시판, 제목, 내용을 확인해 주세요.' });
    const post = { id: slugId('p-'), boardId: data.boardId, title, excerpt: clean(data.excerpt, 180) || content.slice(0, 100), content, author: '법률사무소 쉴드', createdAt: new Date().toISOString() };
    store.posts.push(post); writeStore(store); return json(res, 201, post);
  }
  if (postMatch && req.method === 'DELETE') {
    store.posts = store.posts.filter(p => p.id !== postMatch[1]); writeStore(store); return json(res, 200, { ok: true });
  }
  json(res, 404, { message: '요청을 찾을 수 없습니다.' });
}

const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    let requested = url.pathname === '/' ? '/index.html' : url.pathname;
    let file = path.resolve(PUBLIC, '.' + requested);
    if (!file.startsWith(path.resolve(PUBLIC)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  } catch (error) { console.error(error); json(res, 500, { message: '서버 오류가 발생했습니다.' }); }
});
server.listen(PORT, () => console.log(`SHIELD running at http://localhost:${PORT}`));
