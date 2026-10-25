import asyncio
import socket
from unittest.mock import AsyncMock, MagicMock

import aiohappyeyeballs
import aiohttp
import pytest

from app.services import extraction
from app.services.public_web import (
    MAX_BYTES,
    ExtractionError,
    PublicResolver,
    UnsafeURL,
    canonicalize_url,
    fetch_public_html,
    read_html,
)

HTML = (
    "<html><head><title>Learning that lasts</title></head><body><article>"
    "<h1>Learning that lasts</h1>" + "<p>Active recall helps learners remember important concepts. "
    "Regular practice and thoughtful questions build durable understanding over time. "
    "Reading with curiosity makes it easier to connect new ideas with existing knowledge.</p>"
    * 8
    + "</article></body></html>"
).encode()


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/article",
        "https://user:secret@example.com/a",
        "http://localhost/a",
        "http://127.0.0.1",
        "http://127.1",
        "http://2130706433",
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://192.168.1.1",
        "http://169.254.169.254",
        "http://100.100.100.200",
        "http://168.63.129.16",
        "http://0.0.0.0",
        "http://224.0.0.1",
        "http://[::1]",
        "http://[::ffff:8.8.8.8]",
        "http://[64:ff9b::a00:1]",
        "https://metadata.google.internal",
        "https://server.local",
        "https://internal",
        "http://example.com:8080",
        "https://example.com\\@127.0.0.1",
        "https://example.com/\nfoo",
        "http://[fe80::1%25eth0]",
        "https://example.com/" + "é" * 1000,
    ],
)
def test_reject_unsafe_urls(url):
    with pytest.raises(UnsafeURL):
        canonicalize_url(url)


def test_canonicalization_preserves_query_semantics():
    assert canonicalize_url("https://example.com") == "https://example.com/"
    assert (
        canonicalize_url("HTTPS://Example.COM:443/a?b=2&a=1#section")
        == "https://example.com/a?b=2&a=1"
    )
    assert canonicalize_url("https://example.com./a") == "https://example.com/a"


def dns_record(address):
    return (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (address, 443))


@pytest.mark.asyncio
async def test_all_dns_answers_must_be_public(monkeypatch):
    lookup = AsyncMock(return_value=[dns_record("93.184.216.34"), dns_record("10.0.0.1")])
    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", lookup)
    with pytest.raises(UnsafeURL):
        await PublicResolver().resolve("example.com", 443)


@pytest.mark.asyncio
async def test_connector_uses_validated_addresses_without_rebinding(monkeypatch):
    lookup = AsyncMock(
        side_effect=[
            [dns_record("93.184.216.34")],
            [dns_record("127.0.0.1")],
        ]
    )
    connected_addresses = []

    async def blocked_connect(**kwargs):
        connected_addresses.extend(address[4][0] for address in kwargs["addr_infos"])
        raise OSError("connection blocked by deterministic test")

    connect = AsyncMock(side_effect=blocked_connect)
    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", lookup)
    monkeypatch.setattr(aiohappyeyeballs, "start_connection", connect)
    with pytest.raises(ExtractionError):
        await fetch_public_html("https://example.com/article")
    assert lookup.await_count == 1
    assert connect.await_count == 1
    assert set(connected_addresses) == {"93.184.216.34"}


class FakeResponse:
    def __init__(
        self, body=b"<html></html>", *, status=200, mime="text/html", headers=None, length=None
    ):
        self.status = status
        self.content_type = mime
        self.headers = headers or {}
        self.content_length = length
        self.body = body
        self.content = self

    async def iter_chunked(self, size):
        for offset in range(0, len(self.body), size):
            yield self.body[offset : offset + size]

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [
        FakeResponse(status=403),
        FakeResponse(mime="application/pdf"),
        FakeResponse(length=MAX_BYTES + 1),
        FakeResponse(body=b"x" * (MAX_BYTES + 1)),
        FakeResponse(headers={"Content-Encoding": "gzip"}),
    ],
)
async def test_response_safety_limits(response):
    with pytest.raises(ExtractionError):
        await read_html(response)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "destination",
    ["http://127.0.0.1/secret", "file:///etc/passwd", "https://user:pass@example.com"],
)
async def test_redirect_validation(monkeypatch, destination):
    session = MagicMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock()
    session.get.return_value = FakeResponse(status=302, headers={"Location": destination})
    factory = MagicMock(return_value=session)
    monkeypatch.setattr(aiohttp, "ClientSession", factory)
    with pytest.raises(ExtractionError):
        await fetch_public_html("https://example.com/a")
    assert session.get.call_count == 1
    assert session.get.call_args.kwargs == {"allow_redirects": False}
    assert factory.call_args.kwargs["trust_env"] is False
    assert factory.call_args.kwargs["auto_decompress"] is False
    await factory.call_args.kwargs["connector"].close()


@pytest.mark.asyncio
async def test_redirect_limit(monkeypatch):
    session = MagicMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock()
    session.get.return_value = FakeResponse(status=302, headers={"Location": "/again"})
    factory = MagicMock(return_value=session)
    monkeypatch.setattr(aiohttp, "ClientSession", factory)
    with pytest.raises(ExtractionError):
        await fetch_public_html("https://example.com/a")
    assert session.get.call_count == 4
    await factory.call_args.kwargs["connector"].close()


@pytest.mark.asyncio
async def test_real_parser_with_mocked_public_html(monkeypatch):
    monkeypatch.setattr(extraction, "fetch_public_html", AsyncMock(return_value=HTML))
    result = await extraction.extract_article("https://example.com/article")
    assert result.title == "Learning that lasts"
    assert "Active recall" in result.content
    assert result.source == "example.com"
    assert len(result.excerpt) <= 300


@pytest.mark.asyncio
async def test_empty_html_fails_without_fabricated_content(monkeypatch):
    monkeypatch.setattr(
        extraction, "fetch_public_html", AsyncMock(return_value=b"<html><p>Hello</p></html>")
    )
    with pytest.raises(ExtractionError, match="No meaningful"):
        await extraction.extract_article("https://example.com/article")


@pytest.mark.asyncio
async def test_network_timeout_covers_dns(monkeypatch):
    async def stalled_dns(*args, **kwargs):
        await asyncio.sleep(10)

    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", stalled_dns)
    monkeypatch.setattr("app.services.public_web.NETWORK_TIMEOUT", 0.01)
    with pytest.raises(ExtractionError, match="time limit"):
        await fetch_public_html("https://example.com/article")


@pytest.mark.asyncio
async def test_parser_timeout_kills_and_reaps_process(monkeypatch):
    async def stalled_parse(*args):
        await asyncio.sleep(10)

    process = MagicMock()
    process.returncode = None
    process.communicate = stalled_parse
    process.wait = AsyncMock()
    monkeypatch.setattr(extraction, "fetch_public_html", AsyncMock(return_value=HTML))
    monkeypatch.setattr(asyncio, "create_subprocess_exec", AsyncMock(return_value=process))
    monkeypatch.setattr(extraction, "PARSE_TIMEOUT", 0.01)
    with pytest.raises(ExtractionError, match="time limit"):
        await extraction.extract_article("https://example.com/article")
    process.kill.assert_called_once()
    process.wait.assert_awaited_once()
