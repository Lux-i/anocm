export namespace Encryption {
  function bufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  function base64ToBuffer(base64: string): Uint8Array | null {
    try {
      return new Uint8Array(
        atob(base64)
          .split("")
          .map((char) => char.charCodeAt(0))
      );
    } catch (e: any) {
      console.log(e);
      return null;
    }
  }

  /**
   *
   * @param keyName The chatId of the chat the key is for
   * @param key The base64 string representation of the chatkey
   */
  export async function storeKey(keyName: string, key: CryptoKey) {
    const raw = await crypto.subtle.exportKey("raw", key);
    const base64Key = bufferToBase64(raw);
    localStorage.setItem(keyName, base64Key);
  }

  export async function loadKey(keyName: string): Promise<CryptoKey | null> {
    const base64Key = localStorage.getItem(keyName);
    if (!base64Key) return null;

    const raw = base64ToBuffer(base64Key);
    return await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  }

  export async function generateChatKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  export async function generateDHKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
  }

  export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey("raw", publicKey);
    return bufferToBase64(raw);
  }

  export async function importPublicKey(base64: string): Promise<CryptoKey> {
    const raw = base64ToBuffer(base64);
    return await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
  }

  export async function deriveSharedKey(
    privateKey: CryptoKey,
    theirPublicKey: CryptoKey
  ): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: theirPublicKey,
      },
      privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  export async function exportAndEncryptChatKey(
    chatKey: CryptoKey,
    sharedKey: CryptoKey
  ): Promise<string> {
    const rawKey = await crypto.subtle.exportKey("raw", chatKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sharedKey,
      rawKey
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return bufferToBase64(combined);
  }

  export async function decryptChatKey(
    combinedBase64: string,
    sharedKey: CryptoKey
  ): Promise<CryptoKey> {
    const combined = base64ToBuffer(combinedBase64);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sharedKey,
      ciphertext
    );

    return await crypto.subtle.importKey(
      "raw",
      decrypted,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  }

  export async function encryptMessage(
    chatKey: CryptoKey,
    message: string
  ): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      chatKey,
      encoded
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return bufferToBase64(combined);
  }

  export async function decryptMessage(
    chatKey: CryptoKey,
    combinedString: string
  ): Promise<string> {
    try {
      const combined = base64ToBuffer(combinedString);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        chatKey,
        ciphertext
      );
      return new TextDecoder().decode(decrypted);
    } catch (e: any) {
      console.log(e);
      return combinedString;
    }
  }
}
