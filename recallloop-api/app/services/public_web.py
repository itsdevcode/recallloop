"""Public HTML only. DNS validation runs inside the resolver used by the connector."""

import asyncio
import ipaddress
import re
import socket

import aiohttp
from aiohttp.abc import AbstractResolver, ResolveResult
from yarl import URL

MAX_BYTES = 1024 * 1024
MAX_REDIRECTS = 3
NETWORK_TIMEOUT = 12


class UnsafeURL(ValueError):
    pass


class ExtractionError(Exception):
    """Only predefined, safe display messages may be used."""


class TransientExtractionError(ExtractionError):
    pass


def require_public_ip(value: str) -> None:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        raise UnsafeURL("The URL must resolve to public internet addresses.") from None
    if (
        not address.is_global
        or address.is_multicast
        or address.is_reserved
        or value == "168.63.129.16"
        or (
            isinstance(address, ipaddress.IPv6Address)
            and (
                address.ipv4_mapped is not None
                or address.sixtofour is not None
                or address.teredo is not None
                or address in ipaddress.ip_network("64:ff9b::/96")
            )
        )
    ):
        raise UnsafeURL("Only public internet addresses are supported.")


def canonicalize_url(value: str) -> str:
    if len(value) > 2048 or re.search(r"[\\\s\x00-\x1f\x7f]", value):
        raise UnsafeURL("Enter an HTTP or HTTPS article URL without whitespace.")
    try:
        url = URL(value)
        host = url.raw_host
        if (
            url.scheme not in {"http", "https"}
            or not host
            or url.user is not None
            or url.password is not None
            or url.port != (443 if url.scheme == "https" else 80)
        ):
            raise UnsafeURL(
                "Only HTTP(S) article URLs on standard ports without credentials are supported."
            )
        try:
            ipaddress.ip_address(host)
        except ValueError:
            host = host.rstrip(".")
            if (
                "." not in host
                or len(host) > 253
                or host.rsplit(".", 1)[-1].isdigit()
                or not all(
                    re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", part)
                    for part in host.split(".")
                )
                or host.rsplit(".", 1)[-1]
                in {"localhost", "local", "internal", "intranet", "lan", "home", "test", "invalid"}
            ):
                raise UnsafeURL("Use a public internet hostname.") from None
            url = url.with_host(host)
        else:
            require_public_ip(host)
        if url.raw_path == "/":
            url = url.with_path("/", keep_query=True)
        canonical = str(url.with_fragment(None))
        if len(canonical.encode("utf-8")) > 2048:
            raise UnsafeURL("The normalized URL is too long.")
        return canonical
    except (ValueError, TypeError, UnicodeError):
        raise UnsafeURL("Enter a supported public HTTP or HTTPS article URL.") from None


class PublicResolver(AbstractResolver):
    async def resolve(
        self, host: str, port: int = 0, family: int = socket.AF_INET
    ) -> list[ResolveResult]:
        records = await asyncio.get_running_loop().getaddrinfo(
            host,
            port,
            family=socket.AF_UNSPEC,
            type=socket.SOCK_STREAM,
        )
        if not records:
            raise UnsafeURL("The article hostname could not be resolved.")
        # Reject the entire answer when ANY address is unsafe. These exact numeric
        # addresses are passed to TCPConnector; there is no second DNS lookup.
        for record in records:
            require_public_ip(record[4][0])
        return [
            ResolveResult(
                hostname=host,
                host=record[4][0],
                port=port,
                family=record[0],
                proto=record[2],
                flags=socket.AI_NUMERICHOST,
            )
            for record in records
        ]

    async def close(self) -> None:
        pass


async def read_html(response: aiohttp.ClientResponse) -> bytes:
    if response.status == 429 or response.status >= 500:
        raise TransientExtractionError("The website is temporarily unavailable.")
    if response.status != 200:
        raise ExtractionError(
            "The website could not be accessed. It may require a login or block downloads."
        )
    if response.content_type not in {"text/html", "application/xhtml+xml"}:
        raise ExtractionError(
            "Only HTML articles are supported; this URL returned another file type."
        )
    if response.headers.get("Content-Encoding", "identity").lower() != "identity":
        raise ExtractionError("The website returned unsupported compressed content.")
    if response.content_length is not None and response.content_length > MAX_BYTES:
        raise ExtractionError("The article exceeds the 1 MiB download limit.")
    body = bytearray()
    async for chunk in response.content.iter_chunked(16384):
        body.extend(chunk)
        if len(body) > MAX_BYTES:
            raise ExtractionError("The article exceeds the 1 MiB download limit.")
    return bytes(body)


async def fetch_public_html(value: str) -> bytes:
    try:
        async with asyncio.timeout(NETWORK_TIMEOUT):
            url = canonicalize_url(value)
            connector = aiohttp.TCPConnector(
                resolver=PublicResolver(), use_dns_cache=False, limit=1
            )
            async with aiohttp.ClientSession(
                connector=connector,
                trust_env=False,
                auto_decompress=False,
                cookie_jar=aiohttp.DummyCookieJar(),
                timeout=aiohttp.ClientTimeout(total=10, connect=3, sock_read=3),
                headers={
                    "User-Agent": "RecallLoop/0.1 article-reader",
                    "Accept": "text/html, application/xhtml+xml",
                    "Accept-Encoding": "identity",
                },
            ) as session:
                for hop in range(MAX_REDIRECTS + 1):
                    # Original hostname remains intact for Host/SNI/certificate checks.
                    async with session.get(url, allow_redirects=False) as response:
                        if response.status in {301, 302, 303, 307, 308}:
                            location = response.headers.get("Location")
                            if not location or hop == MAX_REDIRECTS:
                                raise ExtractionError("The website returned too many redirects.")
                            url = canonicalize_url(str(URL(url).join(URL(location))))
                            continue
                        return await read_html(response)
    except UnsafeURL:
        raise ExtractionError(
            "The URL or a redirect does not point to a permitted public website."
        ) from None
    except (TimeoutError, aiohttp.ClientConnectionError, OSError):
        raise TransientExtractionError(
            "The article could not be downloaded safely within the time limit."
        ) from None
    except (aiohttp.ClientError, ValueError):
        raise ExtractionError("The website could not be accessed safely.") from None
    raise ExtractionError("The website could not be accessed.")
