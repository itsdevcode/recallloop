import re

from pydantic import BaseModel, ConfigDict, Field, model_validator


def normalized(value: str) -> str:
    return " ".join(value.split())


def question_key(value: str) -> str:
    return re.sub(r"\W+", " ", value.casefold()).strip()


class GeneratedConcept(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=3, max_length=255)
    explanation: str = Field(min_length=20, max_length=2000)
    source_excerpt: str = Field(min_length=20, max_length=600)
    question: str = Field(min_length=15, max_length=500)
    answer: str = Field(min_length=20, max_length=2000)


class GeneratedLearning(BaseModel):
    model_config = ConfigDict(extra="forbid")
    concepts: list[GeneratedConcept] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def no_duplicates(self) -> "GeneratedLearning":
        questions = [question_key(c.question) for c in self.concepts]
        titles = [question_key(c.title) for c in self.concepts]
        if len(set(questions)) != len(questions) or len(set(titles)) != len(titles):
            raise ValueError("Repeated concepts or questions")
        return self

    def validate_evidence(self, selected_text: str) -> None:
        source = normalized(selected_text)
        for concept in self.concepts:
            if normalized(concept.source_excerpt) not in source:
                raise ValueError("Source excerpt is not present in the supplied article text")
