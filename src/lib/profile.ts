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

export async function fetchMultipleUserProfiles(
    connection: Connection,
    userAddresses: PublicKey[],
    programId: PublicKey
): Promise<Map<string, { username: string; bio: string }>> {
    if (userAddresses.length === 0) return new Map();

    // Derive PDAs for all user addresses
    const pdas = userAddresses.map(address => deriveUserProfilePda(address, programId));

    // Fetch all accounts in one call
    const accountInfos = await connection.getMultipleAccountsInfo(pdas);

    const profilesMap = new Map<string, { username: string; bio: string }>();

    accountInfos.forEach((info, index) => {
        if (info && info.data) {
            try {
                const data = new Uint8Array(info.data as unknown as ArrayBufferLike);
                const { username, bio } = decodeUserProfileAccount(data);
                if (username || bio) {
                    const userAddress = userAddresses[index].toBase58();
                    profilesMap.set(userAddress, { username, bio });
                }
            } catch (error) {
                console.warn(`Failed to decode profile for user ${userAddresses[index].toBase58()}:`, error);
            }
        }
    });

    return profilesMap;
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
