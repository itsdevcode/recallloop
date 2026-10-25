from app.ai.gemma import LearningResult
from app.ai.schemas import GeneratedLearning

LEARNING_JSON = {
    "concepts": [
        {
            "title": "Active recall",
            "explanation": "Recalling ideas from memory helps learners retain important concepts.",
            "source_excerpt": "Active recall helps learners remember important concepts.",
            "question": "How does active recall help a learner retain important ideas?",
            "answer": "It helps learners remember important concepts by recalling them.",
        },
        {
            "title": "Regular practice",
            "explanation": (
                "Regular practice and thoughtful questions build understanding over time."
            ),
            "source_excerpt": (
                "Regular practice and thoughtful questions build durable understanding over time."
            ),
            "question": "Why should a learner practice regularly and ask thoughtful questions?",
            "answer": (
                "Regular practice and thoughtful questions build durable understanding over time."
            ),
        },
        {
            "title": "Curious reading",
            "explanation": "Reading with curiosity connects new ideas with existing knowledge.",
            "source_excerpt": (
                "Reading with curiosity makes it easier to connect new ideas "
                "with existing knowledge."
            ),
            "question": "How does curiosity while reading connect new and existing knowledge?",
            "answer": "Curiosity makes it easier to connect new ideas with existing knowledge.",
        },
    ]
}


def learning_result():
    return LearningResult(
        GeneratedLearning.model_validate(LEARNING_JSON), "Based on the full article."
    )
