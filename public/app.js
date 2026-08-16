const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
let boards = [], posts = [], activeBoard = 'all';
const api = async (url, options = {}) => {
  const res = await fetch(url, { headers: { 'Content-Type':'application/json' }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '요청을 처리하지 못했습니다.');
  return data;
};
const date = iso => new Intl.DateTimeFormat('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(iso));
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
function openModal(id){ $(id).classList.add('open'); $(id).setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
function closeModals(){ $$('.modal').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true')}); document.body.style.overflow=''; }

async function loadContent(){
  [boards, posts] = await Promise.all([api('/api/boards'), api('/api/posts')]);
  renderTabs(); renderCards();
}
function boardName(id){ return boards.find(b=>b.id===id)?.name || '소식'; }
function renderTabs(){
  $('#board-tabs').innerHTML = [{id:'all',name:'전체'},...boards].map(b=>`<button class="${activeBoard===b.id?'active':''}" data-board="${esc(b.id)}">${esc(b.name)}</button>`).join('');
  $$('#board-tabs button').forEach(btn=>btn.onclick=()=>{activeBoard=btn.dataset.board;renderTabs();renderCards()});
}
function renderCards(){
  const filtered=(activeBoard==='all'?posts:posts.filter(p=>p.boardId===activeBoard)).slice(0,6);
  $('#post-grid').innerHTML=filtered.length?filtered.map(p=>`<article class="post-card" data-post="${esc(p.id)}"><small>${esc(boardName(p.boardId))}</small><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><time>${date(p.createdAt)}</time></article>`).join(''):'<p class="empty">등록된 게시글이 없습니다.</p>';
  $$('.post-card').forEach(card=>card.onclick=()=>showPost(card.dataset.post));
}
function showPost(id){
  const p=posts.find(item=>item.id===id); if(!p)return;
  $('#board-view').innerHTML=`<button class="back-btn" id="back-list">← 목록으로</button><article class="post-detail"><small>${esc(boardName(p.boardId))}</small><h2>${esc(p.title)}</h2><p class="meta">${esc(p.author)} · ${date(p.createdAt)}</p><div class="post-content">${esc(p.content)}</div></article>`;
  $('#back-list').onclick=showBoardList; openModal('#board-modal');
}
function showBoardList(selected='all'){
  const selectedPosts=selected==='all'?posts:posts.filter(p=>p.boardId===selected);
  $('#board-view').innerHTML=`<h2 class="modal-title">쉴드 소식</h2><div class="board-layout"><aside class="board-menu">${[{id:'all',name:'전체'},...boards].map(b=>`<button class="${selected===b.id?'active':''}" data-b="${esc(b.id)}">${esc(b.name)}</button>`).join('')}</aside><div class="board-list">${selectedPosts.length?selectedPosts.map(p=>`<article data-p="${esc(p.id)}"><small>${esc(boardName(p.boardId))} · ${date(p.createdAt)}</small><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></article>`).join(''):'<p class="empty">등록된 게시글이 없습니다.</p>'}</div></div>`;
  $$('.board-menu button').forEach(b=>b.onclick=()=>showBoardList(b.dataset.b));
  $$('.board-list article').forEach(p=>p.onclick=()=>showPost(p.dataset.p));
}

async function admin(){
  openModal('#admin-modal'); const session=await api('/api/session');
  session.admin?renderAdmin():renderLogin();
}
function renderLogin(){
  $('#admin-view').innerHTML=`<div class="login-box"><span class="brand-mark">S</span><h2 class="modal-title">관리자 로그인</h2><p>이 페이지는 외부 메뉴에 노출되지 않는<br>운영자 전용 공간입니다.</p><form id="login-form"><input type="password" name="password" placeholder="관리자 비밀번호" autocomplete="current-password" required><button>로그인</button></form><small>초기 비밀번호는 README에서 확인해 주세요.</small></div>`;
  $('#login-form').onsubmit=async e=>{e.preventDefault();try{await api('/api/login',{method:'POST',body:JSON.stringify({password:e.target.password.value})});renderAdmin();toast('관리자로 로그인했습니다.')}catch(err){toast(err.message)}};
}
function renderAdmin(){
  $('#admin-view').innerHTML=`<button class="logout" id="logout">로그아웃</button><h2 class="modal-title">콘텐츠 관리</h2><div class="admin-grid"><section class="admin-box"><h3>게시판 관리</h3><form class="admin-form" id="board-form"><input name="name" placeholder="새 게시판 이름" required maxlength="40"><input name="description" placeholder="게시판 설명" maxlength="120"><button>게시판 생성</button></form><div id="admin-boards"></div></section><section class="admin-box"><h3>새 글 작성</h3><form class="admin-form" id="post-form"><select name="boardId" required><option value="">게시판 선택</option>${boards.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select><input name="title" placeholder="제목" required maxlength="100"><input name="excerpt" placeholder="목록에 보일 짧은 소개" maxlength="180"><textarea name="content" rows="9" placeholder="내용을 입력하세요" required></textarea><button>게시글 발행</button></form></section></div><section class="admin-box" style="margin-top:30px"><h3>게시글 관리</h3><div id="admin-posts"></div></section>`;
  renderAdminLists();
  $('#logout').onclick=async()=>{await api('/api/logout',{method:'POST'});renderLogin();toast('로그아웃했습니다.')};
  $('#board-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/api/boards',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});await loadContent();renderAdmin();toast('게시판을 만들었습니다.')}catch(err){toast(err.message)}};
  $('#post-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/api/posts',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});await loadContent();renderAdmin();toast('새 글을 발행했습니다.')}catch(err){toast(err.message)}};
}
function renderAdminLists(){
  $('#admin-boards').innerHTML=boards.map(b=>`<div class="admin-list-item"><span><b>${esc(b.name)}</b> · 글 ${b.postCount}개</span><button class="danger-btn" data-del-board="${esc(b.id)}">삭제</button></div>`).join('');
  $('#admin-posts').innerHTML=posts.map(p=>`<div class="admin-list-item"><span><small>${esc(boardName(p.boardId))}</small>　${esc(p.title)}</span><button class="danger-btn" data-del-post="${esc(p.id)}">삭제</button></div>`).join('')||'<p class="empty">게시글이 없습니다.</p>';
  $$('[data-del-board]').forEach(btn=>btn.onclick=async()=>{if(!confirm('게시판과 포함된 모든 글을 삭제할까요?'))return;await api('/api/boards/'+btn.dataset.delBoard,{method:'DELETE'});await loadContent();renderAdmin();toast('게시판을 삭제했습니다.')});
  $$('[data-del-post]').forEach(btn=>btn.onclick=async()=>{if(!confirm('이 게시글을 삭제할까요?'))return;await api('/api/posts/'+btn.dataset.delPost,{method:'DELETE'});await loadContent();renderAdmin();toast('게시글을 삭제했습니다.')});
}

window.addEventListener('scroll',()=>$('#header').classList.toggle('scrolled',scrollY>30));
$('.menu-btn').onclick=()=>{const nav=$('.nav');nav.style.display=nav.style.display==='flex'?'none':'flex'};
$('#open-board').onclick=()=>{showBoardList();openModal('#board-modal')};
$('#consult-open').onclick=()=>openModal('#consult-modal');
$('#consult-form').onsubmit=e=>{
  e.preventDefault();
  const form=new FormData(e.target);
  const name=String(form.get('name')||'').trim();
  const phone=String(form.get('phone')||'').trim();
  const issue=String(form.get('issue')||'').trim();
  const subject=`[홈페이지 상담 요청] ${name}님`;
  const body=`법률사무소 쉴드 상담 요청\n\n이름: ${name}\n연락처: ${phone}\n\n법률적인 문제 상황\n${issue}`;
  window.location.href=`mailto:bigolo1@naver.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
$$('[data-close]').forEach(b=>b.onclick=closeModals);
$$('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)closeModals()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModals()});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.1});
$$('.reveal').forEach(el=>observer.observe(el));
loadContent().catch(()=>$('#post-grid').innerHTML='<p class="empty">소식을 불러오지 못했습니다.</p>');
if(location.pathname==='/admin' || location.pathname==='/admin/') admin();
