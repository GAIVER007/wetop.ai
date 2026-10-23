import pytest

from voice.config import ConfigError, VoiceSettings

ENV = {
    "VIDEOSDK_AUTH_TOKEN": "t",
    "GOOGLE_API_KEY": "g",
    "VOICE_AGENT_ID": "agent-1",
    "VOICE_WETOP_BASE_URL": "https://wetop.test",
    "VOICE_WETOP_SERVICE_KEY": "k",
    "VOICE_JOURNAL_PATH": "/tmp/calls.jsonl",
    "VOICE_INGEST_KEY": "ik",
}


def test_valid_env_gives_settings_with_defaults():
    s = VoiceSettings.from_env(ENV)
    assert s.agent_id == "agent-1"
    assert s.port == 8081
    assert s.max_processes == 10
    assert s.number_map is not None


@pytest.mark.parametrize("missing", sorted(ENV))
def test_missing_required_var_names_the_variable_not_its_value(missing):
    env = {k: v for k, v in ENV.items() if k != missing}
    with pytest.raises(ConfigError) as err:
        VoiceSettings.from_env(env)
    assert missing in str(err.value)
    assert "t" != str(err.value)


def test_error_never_contains_secret_values():
    env = {**ENV, "VOICE_NUMBER_MAP": "not json"}
    with pytest.raises(ConfigError) as err:
        VoiceSettings.from_env(env)
    for secret in ("https://wetop.test", "agent-1"):
        assert secret not in str(err.value)


def test_bad_port_is_config_error():
    with pytest.raises(ConfigError):
        VoiceSettings.from_env({**ENV, "VOICE_WORKER_PORT": "abc"})


def test_several_numbers_are_allowed_profile_comes_from_the_platform():
    import json

    org, agent = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
    many = json.dumps(
        {
            "+77001112233": {"organization_id": org, "agent_id": agent},
            "+77004445566": {"organization_id": org, "agent_id": agent},
        }
    )
    assert len(VoiceSettings.from_env({**ENV, "VOICE_NUMBER_MAP": many}).number_map) == 2


def test_ingest_key_is_required_and_outbox_dir_has_a_default():
    s = VoiceSettings.from_env(ENV)
    assert s.ingest_key == "ik"
    assert s.outbox_dir.endswith("calls.outbox")
    with pytest.raises(ConfigError) as err:
        VoiceSettings.from_env({k: v for k, v in ENV.items() if k != "VOICE_INGEST_KEY"})
    assert "VOICE_INGEST_KEY" in str(err.value)


def test_plain_http_base_url_is_refused_except_localhost():
    with pytest.raises(ConfigError):
        VoiceSettings.from_env({**ENV, "VOICE_WETOP_BASE_URL": "http://wetop.test"})
    VoiceSettings.from_env({**ENV, "VOICE_WETOP_BASE_URL": "http://localhost:3000"})


def test_booking_key_is_optional_and_trimmed():
    assert VoiceSettings.from_env(ENV).book_key == ""
    assert VoiceSettings.from_env({**ENV, "VOICE_BOOK_KEY": "  bk  "}).book_key == "bk"
