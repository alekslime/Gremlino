from flask import Blueprint, request, jsonify

settings_bp = Blueprint('settings', __name__)

# Provider config stored in memory per session — keys never written to disk
_provider_config = {
    'provider': 'ollama',
    'openai_model': 'gpt-4o',
    'anthropic_model': 'claude-sonnet-4-6',
    'gemini_model': 'gemini-1.5-pro',
    'groq_model': 'llama3-70b-8192',
    'custom_url': '',
    'custom_model': '',
    # Keys held in memory only
    'openai_key': '',
    'anthropic_key': '',
    'gemini_key': '',
    'groq_key': '',
    'custom_key': '',
}

def get_provider_config():
    return _provider_config

@settings_bp.route('/api/settings/provider', methods=['GET'])
def get_provider():
    safe = {k: v for k, v in _provider_config.items() if not k.endswith('_key')}
    return jsonify(safe)

@settings_bp.route('/api/settings/provider', methods=['POST'])
def set_provider():
    data = request.get_json(silent=True) or {}
    allowed = {
        'provider', 'openai_model', 'anthropic_model', 'gemini_model',
        'groq_model', 'custom_url', 'custom_model',
        'openai_key', 'anthropic_key', 'gemini_key', 'groq_key', 'custom_key',
    }
    for k, v in data.items():
        if k in allowed:
            _provider_config[k] = v
    return jsonify({'ok': True})
