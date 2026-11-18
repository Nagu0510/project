"""P14 stage E: the production settings checker reports problems and never prints a value."""
import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "check_production_env.py"
spec = importlib.util.spec_from_file_location("check_production_env", SCRIPT)
cpe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cpe)

STRONG = "q7Gx2LpV9aTz4WmK8RbN1cJd6HsEu3YfXo5Ai0QvPtMg"
GOOD = {
    "ENV": "production", "JWT_SECRET_KEY": STRONG, "MONGODB_URL": "mongodb+srv://dbuser:dbpass-AAA111@cluster0.abcde.mongodb.net/?retryWrites=true",
    "FRONTEND_URL": "https://skillsense.example.org", "SANDBOX_MODE": "online", "BCRYPT_ROUNDS": "12", "EMAIL_ENABLED": "true",
    "SMTP_USER": "me@example.org", "SMTP_APP_PASSWORD": "app-pass-ZZZ999", "GOOGLE_CLIENT_ID": "1234.apps.googleusercontent.com",
}


def levels(env, **kw):
    return {(f[0], f[1]) for f in cpe.check(env, **kw)}


def test_a_good_production_setup_has_no_failures():
    found = cpe.check(GOOD)
    assert not [f for f in found if f[0] == "FAIL"], found


@pytest.mark.parametrize("change,setting", [
    ({"ENV": "development"}, "ENV"),
    ({"DEBUG": "true"}, "DEBUG"),
    ({"JWT_SECRET_KEY": ""}, "JWT_SECRET_KEY"),
    ({"JWT_SECRET_KEY": "short"}, "JWT_SECRET_KEY"),
    ({"JWT_SECRET_KEY": "change-me-" + "x" * 40}, "JWT_SECRET_KEY"),
    ({"JWT_SECRET_KEY": "a" * 50}, "JWT_SECRET_KEY"),
    ({"ENABLE_MEMORY_FALLBACK": "true"}, "ENABLE_MEMORY_FALLBACK"),
    ({"MONGODB_URL": "mongodb://localhost:27017"}, "MONGODB_URL"),
    ({"MONGODB_URL": ""}, "MONGODB_URL"),
    ({"FRONTEND_URL": "*"}, "FRONTEND_URL"),
    ({"FRONTEND_URL": "http://skillsense.example.org"}, "FRONTEND_URL"),
    ({"FRONTEND_URL": "https://localhost:5173"}, "FRONTEND_URL"),
    ({"FRONTEND_URL": ""}, "FRONTEND_URL"),
    ({"CORS_ORIGINS": "https://a.example.org,*"}, "CORS_ORIGINS"),
    ({"SANDBOX_MODE": "subprocess"}, "SANDBOX_MODE"),
    ({"BCRYPT_ROUNDS": "4"}, "BCRYPT_ROUNDS"),
    ({"BCRYPT_ROUNDS": "lots"}, "BCRYPT_ROUNDS"),
    ({"SMTP_APP_PASSWORD": ""}, "EMAIL_ENABLED"),
    ({"DEMO_MODE": "1"}, "DEMO_MODE"),
    ({"ENABLE_DEMO_ACCOUNTS": "true"}, "ENABLE_DEMO_ACCOUNTS"),
])
def test_each_unsafe_setting_is_reported_as_a_failure(change, setting):
    assert ("FAIL", setting) in levels({**GOOD, **change})


def test_demo_records_in_the_database_fail_the_check():
    assert ("FAIL", "database") in levels(GOOD, demo_records=12)
    assert ("OK", "database") in levels(GOOD, demo_records=0)
    assert not any(f[1] == "database" for f in cpe.check(GOOD, demo_records=None))


def test_warnings_for_things_that_work_but_are_not_ideal():
    found = levels({**GOOD, "EMAIL_ENABLED": "false", "GOOGLE_CLIENT_ID": "", "FRONTEND_URL": "https://skillsense.example.org/", "BCRYPT_ROUNDS": "11"})
    for setting in ("EMAIL_ENABLED", "GOOGLE_CLIENT_ID", "FRONTEND_URL", "BCRYPT_ROUNDS"):
        assert ("WARN", setting) in found and ("FAIL", setting) not in found


def test_main_prints_names_and_messages_but_never_a_value(tmp_path, capsys, monkeypatch):
    for key in list(GOOD) + ["DEBUG", "CORS_ORIGINS"]:
        monkeypatch.delenv(key, raising=False)
    bad = {**GOOD, "ENV": "development", "JWT_SECRET_KEY": "change-me-" + "Z" * 40, "MONGODB_URL": "mongodb://admin:SuperSecretPw99@localhost:27017", "SMTP_APP_PASSWORD": "app-pass-ZZZ999"}
    env_file = tmp_path / "prod.env"
    env_file.write_text("\n".join(f"{k}={v}" for k, v in bad.items()), encoding="utf-8")
    code = cpe.main(["--env-file", str(env_file)])
    out = capsys.readouterr().out
    assert code == 1 and "FAILED" in out and "[FAIL] JWT_SECRET_KEY" in out and "[FAIL] MONGODB_URL" in out
    for value in ("SuperSecretPw99", "ZZZZZZZZZZ", "app-pass-ZZZ999", "admin:", STRONG, "me@example.org"):
        assert value not in out, "a setting value was printed"


def test_main_exits_zero_for_a_good_file(tmp_path, capsys, monkeypatch):
    for key in list(GOOD) + ["DEBUG", "CORS_ORIGINS", "DEMO_MODE"]:
        monkeypatch.delenv(key, raising=False)
    env_file = tmp_path / "good.env"
    env_file.write_text("\n".join(f"{k}={v}" for k, v in GOOD.items()), encoding="utf-8")
    assert cpe.main(["--env-file", str(env_file)]) == 0
    assert "Production check: OK" in capsys.readouterr().out


def test_the_environment_wins_over_the_file(tmp_path, monkeypatch):
    env_file = tmp_path / "x.env"
    env_file.write_text("ENV=development\nJWT_SECRET_KEY=" + STRONG + "\n", encoding="utf-8")
    monkeypatch.setenv("ENV", "production")
    assert cpe.load_env(env_file)["ENV"] == "production"
