import asyncio
import logging

from celery import bootsteps

logger = logging.getLogger(__name__)


class Recovery(bootsteps.StartStopStep):
    requires = {"celery.worker.components:Timer"}

    def start(self, worker):
        self.entry = worker.timer.call_repeatedly(60, self.tick)

    def tick(self):
        try:
            asyncio.run(bounded_recovery())
        except Exception:
            logger.warning("Article reconciliation could not run; it will retry in 60 seconds")

    def stop(self, worker):
        if self.entry:
            self.entry.cancel()


async def bounded_recovery() -> None:
    from app.workers.reconcile import run

    async with asyncio.timeout(15):
        await run()
