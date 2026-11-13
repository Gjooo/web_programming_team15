# 로컬 실행용 작은 서버: 정적 파일 제공 + 출처별 최신 공지 수집(/api/notices)
# 실행: pip install -r requirements.txt → python server.py → http://localhost:5500/notice.html
import re
from urllib.parse import urljoin
from urllib.request import urlopen

from bs4 import BeautifulSoup
from flask import Flask, jsonify

app = Flask(__name__, static_folder='.', static_url_path='')


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


# notice.html 각 항목의 data-source 값 → 최신 공지를 가져오는 함수
# 인스타그램은 자동 수집을 막아 두어 여기에 없다
SOURCES = {'pr': latest_pr, 'college': latest_college}


@app.get('/api/notices')
def notices():
    result = {}
    for source, load in SOURCES.items():
        try:
            result[source] = load()
        except Exception:
            # 한 사이트가 죽거나 구조가 바뀌어도 나머지는 보여 준다
            result[source] = None
    return jsonify(result)


if __name__ == '__main__':
    app.run(port=5500)
