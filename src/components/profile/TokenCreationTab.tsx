import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from 'react-toastify';
import { useSendTransaction, useSolanaWallets } from "@privy-io/react-auth/solana";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { usePrivy } from "@privy-io/react-auth";
import { X_TOKEN_PROGRAM_ADDRESS } from "../../lib/xToken/programs";
import { getInitializeInstruction, InitializeInput } from "../../lib/xToken/instructions";
import { AccountMeta, AccountRole, Address, TransactionSigner } from "@solana/kit";
import { Buffer } from "buffer";
import { TOKEN_PROGRAM_ID, MINT_SIZE } from "@solana/spl-token";

// Helper function to convert username to 32-byte array
const encodeOwner = (username: string | undefined): number[] => {
    const name = username || '';
    const bytes = Array.from(Buffer.from(name, 'utf8'));
    const padded = new Array(32).fill(0);
    padded[0] = Math.min(bytes.length, 31); // Length in first byte
    for (let i = 0; i < Math.min(bytes.length, 31); i++) {
        padded[i + 1] = bytes[i];
    }
    return padded;
};

interface TokenCreationTabProps {
    authenticated: boolean;
}

export function TokenCreationTab({ authenticated }: TokenCreationTabProps) {
    const { sendTransaction } = useSendTransaction();
    const { wallets } = useSolanaWallets();
    const { user } = usePrivy();

    const twitterUsername = user?.twitter?.username;

    const createToken = async () => {
        try {
            if (!wallets || wallets.length === 0) {
                console.error("No wallet connected");
                return;
            }

            const connection = new Connection("https://api.devnet.solana.com", "confirmed");
            const userAddress = new PublicKey(wallets[0].address);
            const mintKeypair = Keypair.generate();
            const bondingCurveSeeds = [Buffer.from("x_token"), mintKeypair.publicKey.toBuffer()];
            const [bondingCurvePda] = PublicKey.findProgramAddressSync(bondingCurveSeeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));

            // Create treasury PDA for holding SOL (must match program seeds)
            const treasurySeeds = [Buffer.from("treasury"), mintKeypair.publicKey.toBuffer()];
            const [treasuryPda] = PublicKey.findProgramAddressSync(treasurySeeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));

            const initializeInput: InitializeInput = {
                authority: { address: wallets[0].address as Address } as TransactionSigner,
                bondingCurve: bondingCurvePda.toBase58() as Address,
                mint: mintKeypair.publicKey.toBase58() as Address,
                treasury: treasuryPda.toBase58() as Address, // Treasury PDA for holding SOL
                payer: { address: wallets[0].address as Address } as TransactionSigner,
                systemProgram: SystemProgram.programId.toBase58() as Address,
                tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
                rent: "SysvarRent111111111111111111111111111111111" as Address,
                decimals: 9,
                curveType: 0, // Linear curve for visible price changes
                feeBasisPoints: 50,
                owner: encodeOwner(twitterUsername),
                basePrice: 1, // 0.001 SOL
                slope: 1, // 0.001 SOL increase per token (tăng chậm hơn)
                maxSupply: 100_000_000_000_000_000, // 100M * 1e9 base units
                feeRecipient: wallets[0].address as Address,
            };

            const initializeInstruction = getInitializeInstruction(initializeInput);
            const keys = initializeInstruction.accounts.map((meta: AccountMeta<string>) => ({
                pubkey: new PublicKey(meta.address),
                isSigner: meta.role === AccountRole.READONLY_SIGNER || meta.role === AccountRole.WRITABLE_SIGNER,
                isWritable: meta.role === AccountRole.WRITABLE || meta.role === AccountRole.WRITABLE_SIGNER,
            }));

            const txInstruction = new TransactionInstruction({
                keys,
                programId: new PublicKey(initializeInstruction.programAddress),
                data: Buffer.from(initializeInstruction.data)
            });

            const transaction = new Transaction();
            const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
            const createMintIx = SystemProgram.createAccount({
                fromPubkey: userAddress,
                newAccountPubkey: mintKeypair.publicKey,
                lamports: mintRent + 1_000_000,
                space: MINT_SIZE,
                programId: TOKEN_PROGRAM_ID,
            });

            const latestBlockhash = await connection.getLatestBlockhash();
            transaction.recentBlockhash = latestBlockhash.blockhash;
            transaction.feePayer = userAddress;
            transaction.add(createMintIx, txInstruction);
            transaction.partialSign(mintKeypair);

            const receipt = await sendTransaction({ transaction, connection, address: wallets[0].address });
            await connection.confirmTransaction({
                signature: receipt.signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            }, "confirmed");

            console.log("Token created:", receipt.signature);
            toast.success((
                <div className="space-y-2">
                    <div>Token created successfully.</div>
                    <Button size="sm" variant="outline" onClick={() => window.open(`https://solscan.io/tx/${receipt.signature}?cluster=devnet`, '_blank')}>View transaction</Button>
                </div>
            ));
        } catch (error: any) {
            console.error("Error:", error?.message || error);
            toast.error(String(error?.message || error));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create New Token</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                    Create a new token with bonding curve pricing. This will deploy a new token with customizable parameters.
                </p>

                <div className="space-y-2">
                    <h4 className="font-medium">Token Parameters:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Decimals: 9</li>
                        <li>• Curve Type: Linear (price changes with supply)</li>
                        <li>• Fee: 0.5%</li>
                        <li>• Base Price: 0.001 SOL per token (1,000,000 lamports)</li>
                        <li>• Slope: 0.001 SOL increase per token (1,000,000 lamports)</li>
                        <li>• Max Supply: 100M tokens (100,000,000 * 1e9 base units)</li>
                        <li>• Treasury: Program-controlled PDA (holds SOL for bonding curve)</li>
                    </ul>
                </div>

                <Button
                    className="w-full"
                    disabled={!authenticated}
                    onClick={createToken}
                >
                    Create Token
                </Button>
            </CardContent>
        </Card>
    );
}
