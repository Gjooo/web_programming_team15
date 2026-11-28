const calendar = document.querySelector('.planner').dataset.page === 'calendar';
const key = 'team15.planner.v1';
const byId = id => document.getElementById(id);
const dateKey = date => [date.getFullYear(), date.getMonth()+1, date.getDate()].map(n => String(n).padStart(2,'0')).join('-');
let selected = new Date();
let entries = JSON.parse(localStorage.getItem(key) || '[]');

function save(next) {
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    alert('브라우저에 저장하지 못했습니다. 저장 공간을 확인해 주세요.');
    return false;
  }
  entries = next;
  render();
  return true;
}

function renderCalendar() {
  const year = selected.getFullYear();
  const month = selected.getMonth();
  byId('month').textContent = year + '년 ' + (month+1) + '월';
  byId('selection').textContent = (month+1) + '월 ' + selected.getDate() + '일 일정';
  const days = byId('days');
  days.replaceChildren();
  for (let day = 1; day <= new Date(year,month+1,0).getDate(); day++) {
    const date = new Date(year,month,day);
    const stamp = dateKey(date);
    const button = document.createElement('button');
    if (day === 1) button.style.gridColumnStart = date.getDay()+1;
    button.textContent = day;
    button.classList.toggle('selected', day === selected.getDate());
    button.setAttribute('aria-pressed', String(day === selected.getDate()));
    const count = entries.filter(item => item.date === stamp).length;
    if (count) {
      const badge = document.createElement('small');
      badge.textContent = count + '건';
      button.append(badge);
    }
    button.onclick = () => { selected = date; render(); };
    days.append(button);
  }
}

function render() {
  if (calendar) renderCalendar();
  const visible = entries.filter(item => calendar ? item.date === dateKey(selected)
    : item.type === 'task' && (byId('filter').value === 'all' || item.done === (byId('filter').value === 'done')));
  const list = byId('items');
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('li');
    empty.textContent = calendar ? '이 날짜에 등록된 일정이 없습니다.' : '표시할 할 일이 없습니다.';
    list.append(empty);
  }
  for (const item of visible) {
    const row = document.createElement('li');
    if (item.type === 'task') {
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = item.done;
      check.setAttribute('aria-label', item.title + ' 완료');
      check.onchange = () => { if (!save(entries.map(e => e.id === item.id ? {...e, done:check.checked} : e))) render(); };
      row.append(check);
    }
    const title = document.createElement('span');
    title.textContent = item.title;
    title.classList.toggle('done', item.done);
    const detail = document.createElement('small');
    detail.textContent = calendar ? (item.type === 'task' ? '할 일 마감' : '일정') : item.date;
    const remove = document.createElement('button');
    remove.textContent = '삭제';
    remove.onclick = () => { if (confirm(item.title + ' 항목을 삭제할까요?')) save(entries.filter(e => e.id !== item.id)); };
    row.append(title, detail, remove);
    list.append(row);
  }
}

byId('entry').onsubmit = event => {
  event.preventDefault();
  const title = byId('title').value.trim();
  if (!title) { byId('title').value = ''; byId('title').reportValidity(); return; }
  const entry = {id:crypto.randomUUID(), title, type:calendar ? 'event' : 'task', date:calendar ? dateKey(selected) : byId('due').value, done:false};
  if (save([...entries, entry])) {
    event.target.reset();
    if (!calendar && byId('filter').value === 'done') { byId('filter').value = 'all'; render(); }
    byId('title').focus();
  }
};
if (calendar) {
  function moveMonth(offset) { selected = new Date(selected.getFullYear(), selected.getMonth()+offset, 1); render(); }
  byId('prev').onclick = () => moveMonth(-1);
  byId('next').onclick = () => moveMonth(1);
  byId('today').onclick = () => { selected = new Date(); render(); };
} else {
  byId('filter').onchange = render;
}
function reload() { entries = JSON.parse(localStorage.getItem(key) || '[]'); render(); }
window.addEventListener('storage', reload);
window.addEventListener('pageshow', reload);
render();
