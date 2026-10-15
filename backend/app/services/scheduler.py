"""Background loop for the daily placement-deadline check.

It wakes every hour and asks `notification_service.run_daily_if_due()`, which runs the check at most once per calendar day
(the last run date is stored in the database, so a restart does not repeat it). A failure is logged by type and retried at the
next wake-up; it never stops the loop or the app.
"""
import asyncio
import logging

from app.services import notification_service

logger = logging.getLogger("skillsense_scheduler")

CHECK_EVERY_SECONDS = 3600


async def daily_loop(interval: float = CHECK_EVERY_SECONDS) -> None:
    while True:
        try:
            if await notification_service.run_daily_if_due():
                logger.info("Daily placement deadline check ran.")
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # database or email trouble: try again at the next wake-up
            logger.error("Daily placement deadline check failed (%s); it will be retried.", type(exc).__name__)
        await asyncio.sleep(interval)
