# 로컬 실행용 작은 서버: 정적 파일 제공 + 출처별 최신 공지 수집(/api/notices/<출처>)
# 실행: pip install -r requirements.txt → python server.py → http://localhost:5500/notice.html
import re
import time
from functools import partial
from itertools import islice
from urllib.parse import urljoin
from urllib.request import urlopen

import instaloader
from bs4 import BeautifulSoup
from flask import Flask, jsonify

app = Flask(__name__, static_folder='.', static_url_path='')

# 인스타그램 조회용 (로그인 없이 공개 계정만). 막히면 재시도하며 기다리지 않고 바로 실패 처리
insta = instaloader.Instaloader(max_connection_attempts=1, request_timeout=10)


def fetch_page(url):
    with urlopen(url, timeout=10) as res:
        return BeautifulSoup(res.read(), 'html.parser')


def summary(node):
    """본문을 한 줄로 줄인 앞부분"""
    return re.sub(r'\s+', ' ', node.get_text(' ')).strip()[:200]


def latest_pr():
    """홍보센터(SSU:catch) 공지 목록의 맨 위 글"""
    row = fetch_page('https://scatch.ssu.ac.kr/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/') \
        .select_one('.notice-lists li:not(.notice_head)')
    link = row.select_one('.notice_col3 a')
    return {
        'title': link.select('span span')[-1].get_text(strip=True),
        'url': link['href'],
        'date': row.select_one('.notice_col1').get_text(strip=True),
        'desc': summary(fetch_page(link['href']).select_one('#contents hr + div')),
    }


def latest_college():
    """단과대(AI대학) 공지 목록의 맨 위 글"""
    list_url = 'https://ai.ssu.ac.kr/board/notice'
    link = fetch_page(list_url).select_one('.tb_style_1 tbody .title a')
    url = urljoin(list_url, link['href'].split('?')[0])
    page = fetch_page(url)
    return {
        'title': link.get_text(strip=True),
        'url': url,
        'date': page.select_one('.detail_info p').get_text(strip=True),
        'desc': summary(page.select_one('.detail_cont')),
    }


def latest_insta(username):
    """인스타그램 계정의 가장 최근 게시물"""
    profile = instaloader.Profile.from_username(insta.context, username)
    # 고정 게시물(최대 3개)이 맨 앞에 오므로 앞의 4개 중 가장 최근 것을 고른다
    post = max(islice(profile.get_posts(), 4), key=lambda p: p.date_local)
    # 본문 첫 줄을 제목으로, 나머지를 내용으로 쓴다
    title, _, rest = (post.caption or '').strip().partition('\n')
    return {
        'title': title or '(내용 없음)',
        'url': f'https://www.instagram.com/p/{post.shortcode}/',
        'date': post.date_local.strftime('%Y.%m.%d'),
        'desc': re.sub(r'\s+', ' ', rest).strip()[:200],
    }


# notice.html 각 항목의 data-source 값 → 최신 공지를 가져오는 함수
SOURCES = {'pr': latest_pr, 'college': latest_college}
for account in ['soongsil1897', 'focussu.66th', 'ai_soongsil', 'ssu_aisw', 'ssu_it_dept']:
    SOURCES['insta:' + account] = partial(latest_insta, account)

# 요청마다 사이트를 다시 긁지 않도록 결과를 보관한다: source → (가져온 시각, 공지)
# 인스타그램은 자주 조회하면 막히므로 실패한 결과도 같은 시간 동안 보관한다
CACHE_SECONDS = 30 * 60
cache = {}


# 느린 출처(인스타그램)가 빠른 출처를 붙잡지 않도록 출처 하나씩 따로 응답한다
@app.get('/api/notices/<source>')
def notice(source):
    saved = cache.get(source)
    if not saved or time.time() - saved[0] > CACHE_SECONDS:
        try:
            latest = SOURCES[source]()
        except Exception:
            # 사이트가 죽거나 구조가 바뀌면 그 항목만 실패로 표시한다
            latest = None
        saved = cache[source] = (time.time(), latest)
    return jsonify(saved[1])


if __name__ == '__main__':
    app.run(port=5500)
