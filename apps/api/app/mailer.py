from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    body: str


class Mailer(Protocol):
    def send(self, msg: EmailMessage) -> None: ...


class ConsoleMailer:
    def send(self, msg: EmailMessage) -> None:
        print("=== DEV MAILER ===")
        print(f"TO: {msg.to}")
        print(f"SUBJECT: {msg.subject}")
        print(msg.body)
        print("==================")
