"""MV10 approved read-only seller contracts. Identity comes from the turn."""
from src.integrations.providers import ProviderUnavailable


class WetopVerticalMixin:
    async def _agent_read(self, path: str) -> dict:
        from src.dependencies import get_current_agent_id
        agent = get_current_agent_id()
        if not agent:
            raise ProviderUnavailable("no_agent")
        return await self._request("GET", path, params={"agent": agent})

    async def agent_context(self) -> dict:
        return await self._agent_read("/bot/agent-context")

    async def beauty_services(self) -> dict:
        return await self._agent_read("/bot/beauty-services")

    async def food_service_periods(self) -> dict:
        return await self._agent_read("/bot/food-service-periods")
