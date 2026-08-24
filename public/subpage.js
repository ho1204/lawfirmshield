const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('.sub-nav');
if(toggle&&nav)toggle.addEventListener('click',()=>nav.classList.toggle('open'));
const form=document.querySelector('#page-consult-form');
if(form)form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form);
  const name=String(data.get('name')||'').trim();
  const phone=String(data.get('phone')||'').trim();
  const issue=String(data.get('issue')||'').trim();
  const subject=encodeURIComponent(`[홈페이지 상담 요청] ${name}님`);
  const body=encodeURIComponent(`법률사무소 쉴드 상담 요청\n\n이름: ${name}\n연락처: ${phone}\n\n법률적인 문제 상황\n${issue}`);
  location.href=`mailto:bigolo1@naver.com?subject=${subject}&body=${body}`;
});
