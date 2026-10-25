from celery import Celery

from app.core.config import LEASE_SECONDS, get_settings
from app.workers.recovery import Recovery

celery_app = Celery(
    "recallloop",
    broker=get_settings().celery_broker_url.get_secret_value(),
    include=["app.workers.tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_ignore_result=True,
    result_backend=None,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    worker_concurrency=1,
    task_soft_time_limit=105,
    task_time_limit=120,
    broker_connection_retry_on_startup=True,
    broker_connection_timeout=2,
    broker_pool_limit=2,
    task_publish_retry=False,
    broker_transport_options={
        "visibility_timeout": LEASE_SECONDS,
        "max_retries": 0,
        "socket_connect_timeout": 2,
        "socket_timeout": 2,
    },
    worker_cancel_long_running_tasks_on_connection_loss=True,
    worker_max_tasks_per_child=50,
)

celery_app.steps["worker"].add(Recovery)
