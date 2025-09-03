import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import { useSendTransaction, useSolanaWallets } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { X_TOKEN_PROGRAM_ADDRESS } from "../../lib/xToken/programs";
import { getUpdateProfileInstruction } from "../../lib/xToken/instructions";
import { deriveUserProfilePda, fetchUserProfile as fetchUserProfileOnchain, prepareProfilePayload } from "../../lib/profile";
import { AccountMeta, AccountRole, Address, TransactionSigner } from "@solana/kit";

interface ProfileTabProps {
    authenticated: boolean;
    walletAddress: string;
    twitterUsername: string;
}

export function ProfileTab({ authenticated, walletAddress, twitterUsername }: ProfileTabProps) {
    const { sendTransaction } = useSendTransaction();
    const { wallets } = useSolanaWallets();

    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');

    // Load on-chain profile (username, bio) if exists
    useEffect(() => {
        const loadProfile = async () => {
            try {
                if (!wallets || wallets.length === 0) return;
                const connection = new Connection("https://api.devnet.solana.com", "confirmed");
                const userAddress = new PublicKey(wallets[0].address);
                const profile = await fetchUserProfileOnchain(connection, userAddress, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));
                if (profile?.username) setUsername(profile.username);
                if (profile?.bio) setBio(profile.bio);
            } catch (e) {
                console.warn('Load profile failed:', (e as any)?.message || e);
            }
        };
        loadProfile();
    }, [wallets && wallets[0]?.address]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const updateProfile = async () => {
        try {
            if (!wallets || wallets.length === 0) {
                console.error("No wallet connected");
                return;
            }
            if (!username) {
                console.error("Username is required");
                return;
            }

            const connection = new Connection("https://api.devnet.solana.com", "confirmed");
            const userAddress = new PublicKey(wallets[0].address);

            // Derive user_profile PDA: seeds ["user_profile", user]
            const userProfilePda = deriveUserProfilePda(userAddress, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));

            // Encode data using helper to prepare fixed-size fields
            const { usernameFixed, bioFixed, usernameLen, bioLen } = prepareProfilePayload(username, bio);

            const ixCodama = getUpdateProfileInstruction({
                userProfile: userProfilePda.toBase58() as Address,
                user: { address: wallets[0].address as Address } as TransactionSigner,
                systemProgram: SystemProgram.programId.toBase58() as Address,
                usernameLen,
                bioLen,
                padding: 0,
                username: Array.from(usernameFixed),
                bio: Array.from(bioFixed),
            });

            const keys = ixCodama.accounts.map((meta: AccountMeta<string>) => ({
                pubkey: new PublicKey(meta.address),
                isSigner: meta.role === AccountRole.READONLY_SIGNER || meta.role === AccountRole.WRITABLE_SIGNER,
                isWritable: meta.role === AccountRole.WRITABLE || meta.role === AccountRole.WRITABLE_SIGNER,
            }));

            const ix = new TransactionInstruction({
                keys,
                programId: new PublicKey(ixCodama.programAddress),
                data: Buffer.from(ixCodama.data),
            });

            const tx = new Transaction();
            const latestBlockhash = await connection.getLatestBlockhash();
            tx.recentBlockhash = latestBlockhash.blockhash;
            tx.feePayer = userAddress;
            tx.add(ix);

            const receipt = await sendTransaction({ transaction: tx, connection, address: wallets[0].address });
            await connection.confirmTransaction({
                signature: receipt.signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            }, "confirmed");

            console.log("Profile updated:", receipt.signature);
            toast.success((
                <div className="space-y-2">
                    <div>Profile updated.</div>
                </div>
            ));

            try {
                const refreshed = await fetchUserProfileOnchain(connection, userAddress, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));
                if (refreshed?.username !== undefined) setUsername(refreshed.username);
                if (refreshed?.bio !== undefined) setBio(refreshed.bio);
            } catch { }
        } catch (error: any) {
            console.error("Update profile error:", error?.message || error);
            toast.error(String(error?.message || error));
        }
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-center">
                        <Avatar className="h-24 w-24">
                            <AvatarFallback className="text-2xl">
                                {username ? username[0].toUpperCase() : 'U'}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={!authenticated}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Input
                            id="bio"
                            placeholder="Tell us about yourself"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            disabled={!authenticated}
                        />
                    </div>

                    <Button className="w-full" disabled={!authenticated} onClick={updateProfile}>
                        Update Profile
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Wallet Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Wallet Address</span>
                            <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm">
                                    {authenticated
                                        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                                        : 'Not Connected'
                                    }
                                </span>
                                {authenticated && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => copyToClipboard(walletAddress)}
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">X Verification</span>
                            <Badge variant={isVerified ? "default" : "secondary"}>
                                {isVerified ? (
                                    <div className="flex items-center space-x-1">
                                        <CheckCircle className="h-3 w-3" />
                                        <span>Verified</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-1">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>Unverified</span>
                                    </div>
                                )}
                            </Badge>
                        </div> */}

                        {twitterUsername && (
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">X Username</span>
                                <span className="text-blue-500">@{twitterUsername}</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">Account Status</h4>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Wallet Connected</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {twitterUsername ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                )}
                                <span className="text-sm">X Account Verification</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
