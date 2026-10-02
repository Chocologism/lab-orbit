import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User
from backend.auth import get_password_hash

client = TestClient(app)


def login(email, password='testpassword'):
    response = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert response.status_code == 200, response.text
    data = response.json()
    return data['user'], {'Authorization': 'Bearer ' + data['access_token']}


def test_cross_device_home_layout_api():
    # Setup test user
    email = 'layout-user@example.org'
    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            db.add(User(name='Layout Test User', email=email, hashed_password=get_password_hash('testpassword'), role='student'))
            db.commit()

    # 1. Unauthorized access should fail
    assert client.get('/api/account/home-layout').status_code == 401
    assert client.put('/api/account/home-layout', json={}).status_code == 401
    assert client.delete('/api/account/home-layout').status_code == 401

    # 2. Initial state: no custom layout
    user, headers = login(email, 'testpassword')
    res = client.get('/api/account/home-layout', headers=headers)
    assert res.status_code == 200
    assert res.json() == {'has_custom_layout': False, 'layout': None}

    # 3. Save custom layout
    sample_layout = {
        'slot1': {
            'type': 'medium-wide',
            'items': [
                {'id': 'slot1-conferences', 'widgetId': 'conferences', 'size': 'medium-wide', 'slot1Index': 0},
                {'id': 'slot1-weather', 'widgetId': 'weather', 'size': 'medium-wide', 'slot1Index': 1}
            ]
        },
        'rightGrid': [
            {'id': 'grid-next-seminar', 'widgetId': 'next-seminar', 'size': 'large', 'col': 1, 'row': 1, 'colSpan': 2, 'rowSpan': 4},
            {'id': 'grid-mailbox', 'widgetId': 'mailbox', 'size': 'small', 'col': 1, 'row': 5, 'colSpan': 2, 'rowSpan': 1}
        ],
        'updatedAt': 1727800000000
    }
    save_res = client.put('/api/account/home-layout', headers=headers, json=sample_layout)
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data['has_custom_layout'] is True
    assert save_data['saved'] is True
    assert save_data['layout']['slot1']['type'] == 'medium-wide'

    # 4. Fetch saved layout from "second device"
    device2_user, device2_headers = login(email, 'testpassword')
    get_res = client.get('/api/account/home-layout', headers=device2_headers)
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data['has_custom_layout'] is True
    assert get_data['layout']['slot1']['type'] == 'medium-wide'
    assert len(get_data['layout']['rightGrid']) == 2

    # 5. Reset layout on second device
    del_res = client.delete('/api/account/home-layout', headers=device2_headers)
    assert del_res.status_code == 200
    assert del_res.json()['has_custom_layout'] is False
    assert del_res.json()['reset'] is True

    # 6. Fetch again on first device
    get_res_after_reset = client.get('/api/account/home-layout', headers=headers)
    assert get_res_after_reset.status_code == 200
    assert get_res_after_reset.json() == {'has_custom_layout': False, 'layout': None}
