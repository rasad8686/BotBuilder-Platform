"""
BotBuilder SDK for Python
Official SDK for interacting with the BotBuilder API
"""

import os
import requests
from typing import Optional, Dict, Any, List

__version__ = "1.0.0"

class BotBuilder:
    """Main client for the BotBuilder API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.botbuilder.com",
        timeout: int = 30
    ):
        self.api_key = api_key or os.environ.get("BOTBUILDER_API_KEY")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        if not self.api_key:
            raise ValueError(
                "API key is required. Set it via api_key parameter or BOTBUILDER_API_KEY env variable."
            )

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"BotBuilder-SDK-Python/{__version__}"
        })

        # Initialize resource clients
        self.bots = BotsClient(self)
        self.messages = MessagesClient(self)
        self.knowledge = KnowledgeClient(self)
        self.analytics = AnalyticsClient(self)
        self.webhooks = WebhooksClient(self)

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make an API request"""
        url = f"{self.base_url}{endpoint}"
        kwargs["timeout"] = self.timeout

        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()

        return response.json()


class BotsClient:
    """Client for bot operations"""

    def __init__(self, client: BotBuilder):
        self._client = client

    def list(self, **params) -> List[Dict[str, Any]]:
        """List all bots"""
        return self._client._request("GET", "/api/bots", params=params)

    def get(self, bot_id: str) -> Dict[str, Any]:
        """Get a specific bot"""
        return self._client._request("GET", f"/api/bots/{bot_id}")

    def create(self, **data) -> Dict[str, Any]:
        """Create a new bot"""
        return self._client._request("POST", "/api/bots", json=data)

    def update(self, bot_id: str, **data) -> Dict[str, Any]:
        """Update a bot"""
        return self._client._request("PUT", f"/api/bots/{bot_id}", json=data)

    def delete(self, bot_id: str) -> Dict[str, Any]:
        """Delete a bot"""
        return self._client._request("DELETE", f"/api/bots/{bot_id}")


class MessagesClient:
    """Client for message operations"""

    def __init__(self, client: BotBuilder):
        self._client = client

    def send(self, **data) -> Dict[str, Any]:
        """Send a message"""
        return self._client._request("POST", "/api/messages", json=data)

    def list(self, bot_id: str, **params) -> List[Dict[str, Any]]:
        """List messages for a bot"""
        return self._client._request("GET", f"/api/bots/{bot_id}/messages", params=params)

    def get(self, message_id: str) -> Dict[str, Any]:
        """Get a specific message"""
        return self._client._request("GET", f"/api/messages/{message_id}")


class KnowledgeClient:
    """Client for knowledge base operations"""

    def __init__(self, client: BotBuilder):
        self._client = client

    def list(self, **params) -> List[Dict[str, Any]]:
        """List knowledge documents"""
        return self._client._request("GET", "/api/knowledge", params=params)

    def upload(self, file, **metadata) -> Dict[str, Any]:
        """Upload a document"""
        files = {"file": file}
        return self._client._request("POST", "/api/knowledge/upload", files=files, data=metadata)

    def delete(self, document_id: str) -> Dict[str, Any]:
        """Delete a document"""
        return self._client._request("DELETE", f"/api/knowledge/{document_id}")


class AnalyticsClient:
    """Client for analytics operations"""

    def __init__(self, client: BotBuilder):
        self._client = client

    def get_overview(self, **params) -> Dict[str, Any]:
        """Get analytics overview"""
        return self._client._request("GET", "/api/analytics/overview", params=params)

    def get_messages(self, **params) -> Dict[str, Any]:
        """Get message analytics"""
        return self._client._request("GET", "/api/analytics/messages", params=params)

    def get_users(self, **params) -> Dict[str, Any]:
        """Get user analytics"""
        return self._client._request("GET", "/api/analytics/users", params=params)


class WebhooksClient:
    """Client for webhook operations"""

    def __init__(self, client: BotBuilder):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        """List all webhooks"""
        return self._client._request("GET", "/api/webhooks")

    def create(self, **data) -> Dict[str, Any]:
        """Create a webhook"""
        return self._client._request("POST", "/api/webhooks", json=data)

    def update(self, webhook_id: str, **data) -> Dict[str, Any]:
        """Update a webhook"""
        return self._client._request("PUT", f"/api/webhooks/{webhook_id}", json=data)

    def delete(self, webhook_id: str) -> Dict[str, Any]:
        """Delete a webhook"""
        return self._client._request("DELETE", f"/api/webhooks/{webhook_id}")
