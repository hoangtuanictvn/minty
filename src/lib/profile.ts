import { PublicKey, Connection } from "@solana/web3.js";
import { Buffer } from "buffer";

if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer
}

export function deriveUserProfilePda(userAddress: PublicKey, programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), userAddress.toBuffer()],
        programId
    );
    return pda;
}

export function decodeUserProfileAccount(data: Uint8Array): { username: string; bio: string; usernameLen: number; bioLen: number; isInitialized: number } {
    const usernameLen = data[32] ?? 0;
    const bioLen = data[33] ?? 0;
    const usernameBytes = data.slice(36, 36 + 32);
    const bioBytes = data.slice(68, 68 + 200);
    const isInitialized = data[268] ?? 0;
    const dec = new TextDecoder();
    const username = dec
        .decode(usernameBytes.slice(0, Math.min(usernameLen, 32)))
        .replace(/\0+$/, "");
    const bio = dec
        .decode(bioBytes.slice(0, Math.min(bioLen, 200)))
        .replace(/\0+$/, "");
    return { username, bio, usernameLen, bioLen, isInitialized };
}

export async function fetchUserProfile(
    connection: Connection,
    userAddress: PublicKey,
    programId: PublicKey
): Promise<{ username: string; bio: string } | null> {
    const pda = deriveUserProfilePda(userAddress, programId);
    const info = await connection.getAccountInfo(pda);
    if (!info || !info.data) return null;
    const data = new Uint8Array(info.data as unknown as ArrayBufferLike);
    const { username, bio } = decodeUserProfileAccount(data);
    if (!username && !bio) return null;
    return { username, bio };
}

export function prepareProfilePayload(inputUsername: string, inputBio: string): {
    usernameFixed: Uint8Array;
    bioFixed: Uint8Array;
    usernameLen: number;
    bioLen: number;
} {
    const enc = new TextEncoder();
    const usernameBytes = enc.encode(inputUsername).slice(0, 32);
    const bioBytes = enc.encode(inputBio).slice(0, 200);
    const usernameFixed = new Uint8Array(32);
    usernameFixed.set(usernameBytes);
    const bioFixed = new Uint8Array(200);
    bioFixed.set(bioBytes);
    return { usernameFixed, bioFixed, usernameLen: usernameBytes.length, bioLen: bioBytes.length };
}
