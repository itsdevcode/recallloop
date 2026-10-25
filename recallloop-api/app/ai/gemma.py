import asyncio
import json
import re
from dataclasses import dataclass

import aiohttp
import httpx
from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.ai.prompts import SYSTEM_INSTRUCTION, select_input, user_prompt
from app.ai.schemas import GeneratedLearning
from app.core.config import Settings


class AIError(Exception):
    pass


class TransientAIError(AIError):
    pass


class ProviderConfigurationError(AIError):
    pass


ProviderConfigError = ProviderConfigurationError


class OutputLimitError(AIError):
    pass


class JSONFormattingError(AIError):
    pass


JSONFormatError = JSONFormattingError


class SchemaValidationError(AIError):
    pass


class EvidenceMatchingError(AIError):
    pass


EvidenceMismatchError = EvidenceMatchingError


def extract_json_payload(raw: str) -> str:
    """Extract JSON content from raw model output, stripping markdown fences or prose."""
    text = raw.strip()

    # Try matching fenced code blocks (greedy first for nested backticks, then non-greedy)
    for pattern in (r"```(?:json)?\s*\n?(.*)\n?```", r"```(?:json)?\s*\n?(.*?)\n?```"):
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            try:
                json.loads(candidate)
                return candidate
            except Exception:
                pass

    # If fenced at start but unclosed
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        candidate = "\n".join(lines).strip()
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    # If raw response has surrounding prose without fences, extract outermost braces
    if not (text.startswith("{") or text.startswith("[")):
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = text[start : end + 1].strip()
            try:
                json.loads(candidate)
                return candidate
            except Exception:
                pass

    return text


@dataclass
class LearningResult:
    learning: GeneratedLearning
    coverage_note: str


async def generate_learning(
    content: str, settings: Settings, *, max_repairs: int = 1
) -> LearningResult:
    if max_repairs not in {0, 1}:
        raise ValueError("Only zero or one repair is supported")
    if not settings.gemini_api_key or not settings.gemini_api_key.get_secret_value():
        raise ProviderConfigurationError("AI processing is not configured. Please try again later.")
    if len(content.strip()) < 200:
        raise AIError("The article does not contain enough reliable text for learning material.")
    selected, note = select_input(content)
    last_error: AIError | None = None
    try:
        async with asyncio.timeout(65):
            async with genai.Client(
                api_key=settings.gemini_api_key.get_secret_value(),
                vertexai=False,
                http_options=types.HttpOptions(
                    timeout=30000, retry_options=types.HttpRetryOptions(attempts=1)
                ),
            ).aio as client:
                for attempt in range(max_repairs + 1):
                    response = await client.models.generate_content(
                        model=settings.gemma_model,
                        contents=user_prompt(selected, repair=attempt == 1),
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION,
                            temperature=0.2,
                            max_output_tokens=4096,
                            automatic_continuation=False,
                            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                                disable=True
                            ),
                            thinking_config=types.ThinkingConfig(thinking_level="minimal"),
                        ),
                    )
                    raw = response.text or ""
                    try:
                        if len(raw) > 40000:
                            raise OutputLimitError("Model output exceeded allowed size.")
                        payload = extract_json_payload(raw)
                        try:
                            parsed = json.loads(payload)
                        except Exception:
                            raise JSONFormattingError(
                                "Model output could not be parsed as JSON."
                            ) from None

                        if isinstance(parsed, list):
                            parsed = {"concepts": parsed}

                        try:
                            learning = GeneratedLearning.model_validate(parsed)
                        except ValidationError:
                            raise SchemaValidationError(
                                "Model output did not match expected schema."
                            ) from None

                        try:
                            learning.validate_evidence(selected)
                            learning.validate_evidence(content)
                        except ValueError:
                            raise EvidenceMatchingError(
                                "Generated concepts not supported by source text."
                            ) from None

                        return LearningResult(learning, note)
                    except (
                        OutputLimitError,
                        JSONFormattingError,
                        SchemaValidationError,
                        EvidenceMatchingError,
                    ) as err:
                        last_error = err
                        if attempt == max_repairs:
                            raise last_error from None
    except errors.APIError as exc:
        if exc.code == 429 or (exc.code and exc.code >= 500):
            raise TransientAIError(
                "The AI provider is temporarily busy. Processing will retry."
            ) from None
        if exc.code in {400, 401, 403}:
            raise ProviderConfigurationError(
                "The AI provider rejected the request configuration or credentials."
            ) from None
        raise AIError(
            "The AI provider could not process this article. Please check service availability."
        ) from None
    except (TimeoutError, httpx.RequestError, aiohttp.ClientError, OSError):
        raise TransientAIError(
            "The AI provider timed out or could not be reached. Processing will retry."
        ) from None
    if last_error is not None:
        raise last_error
    raise AIError("AI output could not be verified.")
