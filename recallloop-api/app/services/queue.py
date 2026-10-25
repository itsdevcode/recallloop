from uuid import UUID

from starlette.concurrency import run_in_threadpool

from app.workers.celery_app import celery_app


def publish_article(article_id: UUID) -> None:
    # Only the identifier crosses the broker; no content, URLs, API keys or auth cookies.
    celery_app.send_task("recallloop.process_article", args=[str(article_id)], retry=False)


async def enqueue_article(article_id: UUID) -> None:
    await run_in_threadpool(publish_article, article_id)
