import sys
import types
import os

repo_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if repo_dir not in sys.path:
    sys.path.insert(0, repo_dir)

# Mock third-party dependencies if not installed in current environment
for mod in ['fastapi', 'fastapi.responses', 'sqlalchemy', 'sqlalchemy.orm', 'pydantic']:
    if mod not in sys.modules:
        sys.modules[mod] = types.ModuleType(mod)
sys.modules['fastapi'].APIRouter = lambda *a, **k: types.SimpleNamespace(
    post=lambda *a, **k: (lambda f: f),
    get=lambda *a, **k: (lambda f: f),
    put=lambda *a, **k: (lambda f: f),
    delete=lambda *a, **k: (lambda f: f)
)
sys.modules['fastapi'].Depends = lambda *a, **k: None
sys.modules['fastapi'].HTTPException = Exception
sys.modules['fastapi'].UploadFile = None
sys.modules['fastapi'].File = lambda *a, **k: None
sys.modules['fastapi'].Form = lambda *a, **k: None
sys.modules['sqlalchemy.orm'].Session = None
sys.modules['pydantic'].BaseModel = object

if 'backend.auth' not in sys.modules:
    sys.modules['backend.auth'] = types.SimpleNamespace(get_current_user=None)
if 'backend.database' not in sys.modules:
    sys.modules['backend.database'] = types.SimpleNamespace(get_db=None)
if 'backend.models' not in sys.modules:
    sys.modules['backend.models'] = types.SimpleNamespace(ObservatoryTalk=None, User=None)
if 'backend.schemas' not in sys.modules:
    sys.modules['backend.schemas'] = types.SimpleNamespace(TalkInput=None)
if 'backend.services' not in sys.modules:
    sys.modules['backend.services'] = types.ModuleType('backend.services')
if 'backend.services.email_service' not in sys.modules:
    sys.modules['backend.services.email_service'] = types.SimpleNamespace(parse_mail=None)
if 'backend.routers.files' not in sys.modules:
    sys.modules['backend.routers.files'] = types.SimpleNamespace(MAX_BYTES=15*1024*1024, store_file=None)

from backend.routers.talks import (
    clean_html_to_text,
    extract_main_content,
    extract_json_ld_event,
    normalize_url
)

sample_indico_html = """
<!DOCTYPE html>
<html>
<head>
  <title>Strong Lensing in the Next Decade - Overview (11-15 January 2027) &middot; Tsung-Dao Lee Institute</title>
  <meta property="og:title" content="Strong Lensing in the Next Decade (11-15 January 2027)">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "Strong Lensing in the Next Decade",
    "startDate": "2027-01-11",
    "endDate": "2027-01-15",
    "url": "https://web.gravity.sjtu.edu.cn/event/13/",
    "location": {
      "@type": "Place",
      "name": "Jin Jiang Hotel",
      "address": "59 Maoming South Road, Huangpu District, Shanghai"
    },
    "description": "International conference on strong gravitational lensing"
  }
  </script>
</head>
<body>
  <header>
    <div class="header-logo">TDLI Event Management</div>
    <nav><a href="/login">Login</a></nav>
  </header>

  <div class="timezone-picker">
    <select name="tz">
      <option value="Africa/Abidjan">Africa/Abidjan</option>
      <option value="America/New_York">America/New_York</option>
      <option value="Asia/Shanghai">Asia/Shanghai</option>
      <option value="Europe/London">Europe/London</option>
    </select>
    <span>Choose timezone</span>
  </div>

  <div class="language-selector">
    <span>Deutsch</span>
    <span>Español</span>
    <span>Français</span>
    <span>中文</span>
  </div>

  <div class="conf_leftMenu">
    <h2>Event menu</h2>
    <ul id="outer">
      <li><a href="/event/13/overview">Overview</a></li>
      <li><a href="/event/13/page/34-key-dates">Key dates</a></li>
      <li><a href="/event/13/abstracts/">Call for Abstracts</a></li>
      <li><a href="/event/13/page/39-registration-info">Registration info</a></li>
      <li><a href="/event/13/page/33-venue">Venue</a></li>
      <li><a href="/event/13/page/35-visa-information">Visa information</a></li>
      <li><a href="/event/13/timetable/?view=standard">Timetable (Standard)</a></li>
      <li><a href="/event/13/timetable/?view=standard_inline_minutes">Timetable (Minutes)</a></li>
    </ul>
  </div>

  <div class="conference-page">
    <div class="page-content">
      <h1>Strong Lensing in the Next Decade</h1>
      <p>Dates: 11-15 January 2027</p>
      <p>Location: Jin Jiang Hotel, 59 Maoming South Road, Shanghai</p>
      <p>Registration deadline: 2026-10-31</p>
      <p>Abstract submission deadline: 2026-09-15</p>
      <p>Visa applications should be submitted at least 2 months in advance.</p>
    </div>
  </div>

  <footer>
    <p>Powered by Indico</p>
  </footer>
</body>
</html>
"""

def test_clean_html_to_text():
    text = clean_html_to_text(sample_indico_html)
    assert 'Africa/Abidjan' not in text
    assert 'America/New_York' not in text
    assert 'Europe/London' not in text
    assert 'Choose timezone' not in text
    assert 'TDLI Event Management' not in text
    assert 'Powered by Indico' not in text
    assert 'Español' not in text
    assert 'Français' not in text

    assert 'Strong Lensing in the Next Decade' in text
    assert '11-15 January 2027' in text
    assert 'Jin Jiang Hotel' in text
    assert 'Registration deadline: 2026-10-31' in text
    assert 'Abstract submission deadline: 2026-09-15' in text
    assert 'Visa applications should be submitted' in text
    print('PASS: test_clean_html_to_text')

def test_extract_json_ld_event():
    ev = extract_json_ld_event(sample_indico_html)
    assert ev is not None
    assert ev['title'] == 'Strong Lensing in the Next Decade'
    assert ev['startDate'] == '2027-01-11'
    assert ev['endDate'] == '2027-01-15'
    assert 'Jin Jiang Hotel' in ev['location']
    assert '59 Maoming South Road' in ev['location']
    assert 'gravitational lensing' in ev['description']
    print('PASS: test_extract_json_ld_event')

def test_extract_main_content():
    content = extract_main_content(sample_indico_html)
    assert 'Strong Lensing in the Next Decade' in content
    assert 'Jin Jiang Hotel' in content
    assert 'Africa/Abidjan' not in content
    print('PASS: test_extract_main_content')

def test_normalize_url():
    u1 = normalize_url('https://web.gravity.sjtu.edu.cn/event/13/timetable/?view=standard')
    u2 = normalize_url('https://web.gravity.sjtu.edu.cn/event/13/timetable/?view=standard_inline_minutes')
    assert u1 == 'https://web.gravity.sjtu.edu.cn/event/13/timetable'
    assert u2 == 'https://web.gravity.sjtu.edu.cn/event/13/timetable'
    assert u1 == u2

    u3 = normalize_url('https://example.com/conf/?lang=en&foo=bar')
    assert 'lang=' not in u3
    assert 'foo=bar' in u3
    print('PASS: test_normalize_url')

if __name__ == '__main__':
    test_clean_html_to_text()
    test_extract_json_ld_event()
    test_extract_main_content()
    test_normalize_url()
    print('All python scraper tests passed successfully!')
