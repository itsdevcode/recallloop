"""Read-only validation: uv run --with pyyaml --with jsonschema python scripts/validate-render.py."""

import json
from pathlib import Path
from urllib.request import urlopen

import jsonschema
import yaml

root = Path(__file__).resolve().parents[1]
with urlopen("https://render.com/schema/render.yaml.json", timeout=20) as response:
    schema = json.load(response)
blueprint = yaml.safe_load((root / "render.yaml").read_text())
validator = jsonschema.validators.validator_for(schema)
validator.check_schema(schema)
validator(schema).validate(blueprint)
print("render.yaml: valid against current Render JSON Schema; no resources changed")
