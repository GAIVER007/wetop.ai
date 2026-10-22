import pytest

from voice.config import ConfigError, VoiceSettings

ENV = {
    "VIDEOSDK_AUTH_TOKEN": "t",
    "GOOGLE_API_KEY": "g",
    "VOICE_AGENT_ID": "agent-1",
    "VOICE_WETOP_BASE_URL": "https://wetop.test",
    "VOICE_WETOP_SERVICE_KEY": "k",
    "VOICE_JOURNAL_PATH": "/tmp/calls.jsonl",
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
