"""Encryption service for secure storage of sensitive data.

Uses Fernet symmetric encryption from the cryptography library.
Provides encryption for both text data and files.
"""

import base64
import hashlib
import os
import secrets
from pathlib import Path
from typing import TYPE_CHECKING

from cryptography.fernet import Fernet, InvalidToken

if TYPE_CHECKING:
    pass


class EncryptionService:
    """Service for encrypting and decrypting sensitive data.

    Uses Fernet symmetric encryption which provides:
    - AES-128-CBC encryption
    - HMAC-SHA256 authentication
    - Timestamp-based token versioning

    If no encryption key is configured, generates a deterministic
    dev key from the JWT secret (for development only).
    """

    _instance: "EncryptionService | None" = None
    _fernet: Fernet | None = None
    _key: bytes | None = None

    def __init__(self) -> None:
        """Initialize encryption service with configured or derived key."""
        from app.config import get_settings

        settings = get_settings()

        if settings.encryption_key:
            # Use configured key (must be valid Fernet key - 32 bytes base64 encoded)
            try:
                self._key = settings.encryption_key.encode()
                self._fernet = Fernet(self._key)
            except Exception as e:
                raise ValueError(
                    f"Invalid ENCRYPTION_KEY format. Must be a valid Fernet key "
                    f"(32 bytes, base64 encoded). Generate with: "
                    f"python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'. "
                    f"Error: {e}"
                ) from e
        else:
            # Dev mode: derive deterministic key from JWT secret
            # WARNING: Not for production - key should be randomly generated
            derived = hashlib.sha256(
                f"{settings.jwt_secret}-encryption-key".encode()
            ).digest()
            self._key = base64.urlsafe_b64encode(derived)
            self._fernet = Fernet(self._key)
            print("[ENCRYPTION] Using derived dev key from JWT secret. Set ENCRYPTION_KEY for production.")

    @classmethod
    def get_instance(cls) -> "EncryptionService":
        """Get singleton instance of encryption service."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64-encoded ciphertext.

        Args:
            data: Plain text string to encrypt

        Returns:
            Base64-encoded encrypted data (Fernet token)
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")
        encrypted = self._fernet.encrypt(data.encode())
        return encrypted.decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt a Fernet token back to plain text.

        Args:
            encrypted_data: Base64-encoded Fernet token

        Returns:
            Decrypted plain text string

        Raises:
            InvalidToken: If data is corrupted or tampered with
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")
        try:
            decrypted = self._fernet.decrypt(encrypted_data.encode())
            return decrypted.decode()
        except InvalidToken as e:
            raise ValueError("Failed to decrypt data - invalid or corrupted token") from e

    def encrypt_bytes(self, data: bytes) -> bytes:
        """Encrypt raw bytes.

        Args:
            data: Raw bytes to encrypt

        Returns:
            Encrypted bytes (Fernet token)
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")
        return self._fernet.encrypt(data)

    def decrypt_bytes(self, encrypted_data: bytes) -> bytes:
        """Decrypt bytes back to original data.

        Args:
            encrypted_data: Fernet token bytes

        Returns:
            Decrypted bytes

        Raises:
            InvalidToken: If data is corrupted or tampered with
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")
        try:
            return self._fernet.decrypt(encrypted_data)
        except InvalidToken as e:
            raise ValueError("Failed to decrypt data - invalid or corrupted token") from e

    def encrypt_file(self, file_path: Path, output_path: Path | None = None) -> Path:
        """Encrypt a file and save to disk.

        Args:
            file_path: Path to file to encrypt
            output_path: Where to save encrypted file (default: same path with .enc extension)

        Returns:
            Path to encrypted file
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")

        if output_path is None:
            output_path = file_path.with_suffix(file_path.suffix + ".enc")

        with open(file_path, "rb") as f:
            data = f.read()

        encrypted = self._fernet.encrypt(data)

        with open(output_path, "wb") as f:
            f.write(encrypted)

        return output_path

    def decrypt_file(self, encrypted_path: Path, output_path: Path | None = None) -> Path:
        """Decrypt a file and save to disk.

        Args:
            encrypted_path: Path to encrypted file
            output_path: Where to save decrypted file (default: remove .enc extension)

        Returns:
            Path to decrypted file
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")

        if output_path is None:
            if encrypted_path.suffix == ".enc":
                output_path = encrypted_path.with_suffix("")
            else:
                output_path = encrypted_path.with_suffix(".dec")

        with open(encrypted_path, "rb") as f:
            encrypted_data = f.read()

        decrypted = self._fernet.decrypt(encrypted_data)

        with open(output_path, "wb") as f:
            f.write(decrypted)

        return output_path

    def decrypt_file_to_bytes(self, encrypted_path: Path) -> bytes:
        """Decrypt a file and return contents as bytes.

        Args:
            encrypted_path: Path to encrypted file

        Returns:
            Decrypted file contents as bytes
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")

        with open(encrypted_path, "rb") as f:
            encrypted_data = f.read()

        return self._fernet.decrypt(encrypted_data)

    def encrypt_and_save(self, data: bytes, output_path: Path) -> Path:
        """Encrypt bytes and save directly to file.

        Args:
            data: Raw bytes to encrypt
            output_path: Where to save encrypted file

        Returns:
            Path to encrypted file
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")

        encrypted = self._fernet.encrypt(data)

        # Ensure directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "wb") as f:
            f.write(encrypted)

        return output_path

    @staticmethod
    def generate_secure_filename(original_filename: str) -> str:
        """Generate a secure random filename while preserving extension.

        Args:
            original_filename: Original filename to derive extension from

        Returns:
            Secure random filename with .enc suffix
        """
        ext = Path(original_filename).suffix.lower()
        random_name = secrets.token_hex(16)
        return f"{random_name}{ext}.enc"


# Convenience function for getting the encryption service
def get_encryption_service() -> EncryptionService:
    """Get the encryption service singleton."""
    return EncryptionService.get_instance()
