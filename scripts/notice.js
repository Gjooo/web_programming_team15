// 공지사항 탭: 전체는 목록, 나머지는 iframe
const tabs = document.querySelectorAll('.tab');
const list = document.getElementById('notice-list');
const frames = document.getElementById('notice-frames');
const search = document.querySelector('.search');
const status = document.getElementById('notice-status');

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(t => {
    t.classList.toggle('active', t === tab);
    t.setAttribute('aria-selected', t === tab);
  });
  const isAll = tab.dataset.tab === 'all';
  list.hidden = !isAll;
  status.hidden = !isAll;
  frames.hidden = isAll;
  // 검색은 전체 탭 목록에만 적용되므로 다른 탭에서는 숨긴다
  search.hidden = !isAll;
  frames.dataset.tab = tab.dataset.tab;
  if (isAll) return;

  // data-src 주소마다 iframe 하나씩 생성
  const urls = (tab.dataset.src || '').split(/\s+/).filter(Boolean);
  frames.replaceChildren(...urls.map(url => {
    const frame = document.createElement('iframe');
    frame.className = 'notice-frame';
    frame.title = tab.textContent + ' 공지 원본 페이지';
    frame.src = url;

    // 인스타 탭에서 스크롤 안 생기게
    if (tab.dataset.tab === 'insta') frame.scrolling = 'no';
    return frame;
  }));
  fitPrFrame();
}));

// 전체 탭: 서버(server.py)가 보관 중인 출처별 최신 공지로 각 항목을 채운다
function showNotices(data) {
  const time = data.checked &&
    new Date(data.checked * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  status.classList.toggle('loading', data.refreshing);
  status.textContent = data.refreshing
    ? '새로 가져오는 중' + (time ? ' · 마지막 조회 ' + time : '')
    : '마지막 조회 ' + time;

  list.querySelectorAll('.notice-item').forEach(item => {
    const notice = data.notices[item.dataset.source];
    const title = item.querySelector('.notice-title');
    // 이전 결과가 없는 항목만 가져오는 동안 로딩으로 둔다
    item.classList.toggle('loading', !notice && data.refreshing);
    if (!notice) {
      title.textContent = data.refreshing ? '불러오는 중' : '불러오지 못했습니다';
      return;
    }
    title.textContent = notice.title;
    title.href = notice.url;
    item.querySelector('.notice-date').textContent = notice.date;
    item.querySelector('.notice-desc').textContent = notice.desc;
  });
}

// 페이지를 열면 서버에 다시 가져오라고 하고, 끝날 때까지 2초마다 결과를 받아 온다
// 가져오는 동안에는 이전 결과가 보이고, 새로 받은 항목부터 바뀐다
async function loadNotices() {
  await fetch('/api/notices/refresh', { method: 'POST' }).catch(() => {});
  while (true) {
    const data = await fetch('/api/notices').then(res => res.json())
      .catch(() => ({ refreshing: false, notices: {} }));
    showNotices(data);
    if (!data.refreshing) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
loadNotices();

// 인스타 임베드가 보내 주는 높이에 맞춰 블록 높이 설정
window.addEventListener('message', e => {
  if (e.origin !== 'https://www.instagram.com' || typeof e.data !== 'string') return;
  const data = JSON.parse(e.data);
  const frame = [...frames.children].find(f => f.contentWindow === e.source);
  if (frame && data.type === 'MEASURE' && data.details.height) {
    frame.style.height = data.details.height + 'px';
  }
});

// 홍보센터 사이트는 레이아웃이 깨져서 그거 방지
function fitPrFrame() {
  const frame = frames.querySelector('.notice-frame');
  if (frames.dataset.tab !== 'pr' || !frame) return;
  const width = frames.clientWidth;
  const scale = width > 860 && width < 1300 ? width / 1300 : 1;
  frame.style.zoom = scale;
  frame.style.width = scale < 1 ? '1300px' : '';
  frame.style.height = scale < 1 ? `calc((100vh - 200px) / ${scale})` : '';
}
window.addEventListener('resize', fitPrFrame);

// 공지 검색
const searchInput = document.getElementById('search-input');

document.getElementById('search-btn').addEventListener('click', () => {
  searchInput.hidden = !searchInput.hidden;
  if (!searchInput.hidden) searchInput.focus();
});

searchInput.addEventListener('input', () => {
  const keyword = searchInput.value.trim().toLowerCase();
  list.querySelectorAll('.notice-item').forEach(item => {
    const title = item.querySelector('.notice-title').textContent.toLowerCase();
    item.hidden = !title.includes(keyword);
  });
});
