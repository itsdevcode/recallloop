"""Read-only validation: uv run --with pyyaml --with jsonschema python scripts/validate-render.py."""

import json
import sys
from pathlib import Path
from urllib.request import urlopen

import jsonschema
import yaml

root = Path(__file__).resolve().parents[1]
files = sys.argv[1:] if len(sys.argv) > 1 else ["render.yaml", "render.free.yaml"]

with urlopen("https://render.com/schema/render.yaml.json", timeout=20) as response:
    schema = json.load(response)

validator_cls = jsonschema.validators.validator_for(schema)
validator_cls.check_schema(schema)
validator = validator_cls(schema)

for filename in files:
    path = root / filename
    if not path.exists():
        print(f"Skipping {filename}: file not found", file=sys.stderr)
        continue
    blueprint = yaml.safe_load(path.read_text())
    validator.validate(blueprint)
    print(f"{filename}: valid against current Render JSON Schema; no resources changed")
