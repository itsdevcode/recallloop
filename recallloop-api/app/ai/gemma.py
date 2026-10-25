import asyncio
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
        raise AIError("AI processing is not configured. Please try again later.")
    if len(content.strip()) < 200:
        raise AIError("The article does not contain enough reliable text for learning material.")
    selected, note = select_input(content)
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
                            raise ValueError("Output too large")
                        learning = GeneratedLearning.model_validate_json(raw)
                        learning.validate_evidence(selected)
                        learning.validate_evidence(content)
                        return LearningResult(learning, note)
                    except (ValidationError, ValueError):
                        if attempt == max_repairs:
                            raise AIError(
                                "AI output could not be verified. You can retry processing."
                            ) from None
    except errors.APIError as exc:
        if exc.code == 429 or (exc.code and exc.code >= 500):
            raise TransientAIError(
                "The AI provider is temporarily busy. Processing will retry."
            ) from None
        raise AIError(
            "The AI provider could not process this article. Please check service availability."
        ) from None
    except (TimeoutError, httpx.RequestError, aiohttp.ClientError, OSError):
        raise TransientAIError(
            "The AI provider timed out or could not be reached. Processing will retry."
        ) from None
    raise AIError("AI output could not be verified.")
