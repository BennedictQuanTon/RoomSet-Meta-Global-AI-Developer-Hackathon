"""Fetch a user-supplied URL without letting it reach private networks (SSRF guard).

Each hop is resolved, every address is checked, and the connection goes to the checked IP, so
DNS rebinding cannot swap the target between check and connect. HTTPS only, bounded in time
and size, with every redirect re-validated.
"""

import ipaddress
import socket
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from app.core.errors import AppError

MAX_BYTES = 3 * 1024 * 1024
MAX_REDIRECTS = 4
TIMEOUT_S = 12.0
USER_AGENT = "RoomsetBot/0.1 (furniture planning; reads a single listing a person pasted)"


class UrlBlocked(AppError):
    def __init__(self, message: str = "That link can't be read. Add the details yourself."):
        super().__init__("url_blocked", message, 422)


class FetchFailed(AppError):
    def __init__(self, message: str = "We could not read that page. Upload a screenshot instead."):
        super().__init__("fetch_failed", message, 422)


@dataclass
class FetchResult:
    url: str
    content_type: str
    body: bytes


Resolver = Callable[[str], list[str]]


def system_resolver(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise FetchFailed() from exc
    return list({info[4][0] for info in infos})


def is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def validate_target(url: str, resolver: Resolver) -> tuple[str, str]:
    """Returns (host, a public IP). Raises when any resolved address is not public."""
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        raise UrlBlocked("Only https product links can be read.")
    if parts.username or parts.password or parts.port not in (None, 443):
        raise UrlBlocked()
    addresses = resolver(parts.hostname)
    if not addresses or not all(is_public(a) for a in addresses):
        raise UrlBlocked()
    return parts.hostname, addresses[0]


def _pinned_request(client: httpx.Client, url: str, host: str, ip: str):
    parts = urlsplit(url)
    netloc = f"[{ip}]" if ":" in ip else ip
    pinned = urlunsplit(("https", netloc, parts.path or "/", parts.query, ""))
    request = client.build_request(
        "GET",
        pinned,
        headers={"Host": host, "User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.5"},
        extensions={"sni_hostname": host},
    )
    return client.send(request, stream=True)


def fetch_public(
    url: str,
    resolver: Resolver = system_resolver,
    transport: httpx.BaseTransport | None = None,
) -> FetchResult:
    with httpx.Client(timeout=TIMEOUT_S, follow_redirects=False, transport=transport) as client:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            host, ip = validate_target(current, resolver)
            try:
                response = _pinned_request(client, current, host, ip)
            except httpx.HTTPError as exc:
                raise FetchFailed() from exc
            try:
                if response.is_redirect:
                    current = urljoin(current, response.headers.get("location", ""))
                    continue
                if response.status_code != 200:
                    raise FetchFailed()
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_BYTES:
                        raise FetchFailed("That page is too large to read.")
                return FetchResult(current, response.headers.get("content-type", ""), bytes(body))
            except httpx.HTTPError as exc:
                raise FetchFailed() from exc
            finally:
                response.close()
    raise FetchFailed("That link redirects too many times.")
