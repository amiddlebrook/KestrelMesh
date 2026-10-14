export default {
  "name": "KestrelMesh",
  "tagline": "AI inference routing and telemetry",
  "accent": "#d0b082",
  "icon": "⟐",
  "sections": [
    {
      "id": "models",
      "label": "Model Registry",
      "endpoint": "/api/models",
      "fields": [
        {
          "name": "name",
          "type": "text",
          "default": "Llama 3.1 8B"
        },
        {
          "name": "provider",
          "type": "select",
          "options": [
            "fixture",
            "workers_ai"
          ]
        },
        {
          "name": "model_ref",
          "type": "select",
          "options": [
            "@cf/meta/llama-3.1-8b-instruct-fp8",
            "@cf/meta/llama-3.1-8b-instruct"
          ]
        },
        {
          "name": "priority",
          "type": "number",
          "default": 10
        }
      ],
      "columns": [
        "name",
        "provider",
        "model_ref",
        "priority",
        "enabled"
      ],
      "action": {
        "title": "Enable / disable",
        "endpoint": "/api/models/{id}/toggle",
        "input": []
      }
    },
    {
      "id": "rules",
      "label": "Routing Rules",
      "endpoint": "/api/rules",
      "fields": [
        {
          "name": "name",
          "type": "text",
          "default": "Priority tasks"
        },
        {
          "name": "match_prefix",
          "type": "text",
          "default": "priority:"
        },
        {
          "name": "model_id",
          "type": "reference",
          "source": "/api/models"
        }
      ],
      "columns": [
        "name",
        "match_prefix",
        "model"
      ]
    },
    {
      "id": "playground",
      "label": "Inference Gateway",
      "custom": "infer"
    },
    {
      "id": "requests",
      "label": "Request Traces",
      "endpoint": "/api/requests",
      "columns": [
        "model",
        "status",
        "latency_ms",
        "input_chars",
        "output_chars",
        "cache_hit",
        "created_at"
      ]
    },
    {
      "id": "metrics",
      "label": "Performance",
      "custom": "metrics"
    }
  ]
};
