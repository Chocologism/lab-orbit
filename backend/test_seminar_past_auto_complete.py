import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from backend.main import app
from backend.database import get_db, Base, engine
from backend.models import User, SeminarSchedule
from backend.auth import get_password_hash, create_access_token

client = TestClient(app)

@pytest.fixture
def auth_admin():
    result = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "123456"})
    return {"Authorization": "Bearer " + result.json()["access_token"]}

def test_past_seminar_auto_completes(auth_admin):
    db = next(get_db())
    today = datetime.now(ZoneInfo('Asia/Shanghai')).date()
    past_date = (today - timedelta(days=2)).isoformat()
    today_date = today.isoformat()
    future_date = (today + timedelta(days=5)).isoformat()

    # 创建过去、今天、未来的测试组会
    s_past = SeminarSchedule(date=past_date, time='14:30', topic='过去组会', presenter_name='张三', status='upcoming')
    s_today = SeminarSchedule(date=today_date, time='14:30', topic='今天组会', presenter_name='李四', status='upcoming')
    s_future = SeminarSchedule(date=future_date, time='14:30', topic='未来组会', presenter_name='王五', status='upcoming')
    db.add_all([s_past, s_today, s_future])
    db.commit()

    # GET /api/seminars 列表
    res = client.get('/api/seminars', headers=auth_admin)
    assert res.status_code == 200
    items = res.json()
    past_item = next((i for i in items if i['id'] == s_past.id), None)
    today_item = next((i for i in items if i['id'] == s_today.id), None)
    future_item = next((i for i in items if i['id'] == s_future.id), None)

    assert past_item is not None
    assert past_item['status'] == 'completed'  # 过去的组会自动标记为 completed

    assert today_item is not None
    assert today_item['status'] == 'upcoming'   # 今天的组会仍为 upcoming

    assert future_item is not None
    assert future_item['status'] == 'upcoming'  # 未来的组会仍为 upcoming
