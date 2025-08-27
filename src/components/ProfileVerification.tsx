import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'react-toastify';
import {
  Twitter,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  User,
  Trophy,
  Coins,
  TrendingUp
} from 'lucide-react';
import { checkUserTweetContains } from "../lib/twitter";
import { useSendTransaction, useSolanaWallets } from "@privy-io/react-auth/solana";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js"
import { X_TOKEN_PROGRAM_ADDRESS } from "../lib/xToken/programs";
import { getInitializeInstruction, InitializeInput } from "../lib/xToken/instructions";
import { getUpdateProfileInstruction } from "../lib/xToken/instructions";
import { deriveUserProfilePda, fetchUserProfile as fetchUserProfileOnchain, prepareProfilePayload } from "../lib/profile";
import { AccountMeta, AccountRole, Address, TransactionSigner } from "@solana/kit";
import { Buffer } from "buffer";
import { TOKEN_PROGRAM_ID, MINT_SIZE } from "@solana/spl-token";
import bs58 from 'bs58';


interface ProfileVerificationProps {
  authenticated: boolean;
  walletAddress: string;
}

export function ProfileVerification({ authenticated, walletAddress }: ProfileVerificationProps) {
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useSolanaWallets();

  const [xHandle, setXHandle] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verificationStep, setVerificationStep] = useState(1);
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

  const mockUserStats = {
    totalTrades: 156,
    totalVolume: 45678.92,
    profitLoss: 8.7,
    rank: 42,
    ownedTokens: 12
  };

  const verificationMessage = `I am verifying my wallet address ${walletAddress} on Minty.fun platform. #MintyFunVerification`;

  const handleXVerification = async () => {
    if (verificationStep === 1) {
      createToken()
      // Step 1: Generate verification message
      // setVerificationStep(2);
    } else if (verificationStep === 2) {
      // Step 2: Mock verification check
      checkUserTweetContains('HoaL1483171', 'MintyFunVerification')
      setIsVerified(true);
      setVerificationStep(3);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openTwitterPost = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(verificationMessage)}`;
    window.open(tweetUrl, '_blank');
  };

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

      const initializeInput: InitializeInput = {
        authority: { address: wallets[0].address as Address } as TransactionSigner,
        bondingCurve: bondingCurvePda.toBase58() as Address,
        mint: mintKeypair.publicKey.toBase58() as Address,
        payer: { address: wallets[0].address as Address } as TransactionSigner,
        systemProgram: SystemProgram.programId.toBase58() as Address,
        tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
        rent: "SysvarRent111111111111111111111111111111111" as Address,
        decimals: 9,
        curveType: 1,
        feeBasisPoints: 50,
        padding: 0,
        basePrice: 1,
        slope: 1,
        maxSupply: 100,
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
    <div className="space-y-6">
      {!authenticated && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please connect your wallet to access profile features.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
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

                  <div className="flex justify-between items-center">
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
                  </div>

                  {isVerified && xHandle && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">X Handle</span>
                      <span className="text-blue-500">@{xHandle}</span>
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
                      {isVerified ? (
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
        </TabsContent>

        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Twitter className="h-5 w-5" />
                <span>X Account Verification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isVerified ? (
                <>
                  {verificationStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="x-handle">X Handle (without @)</Label>
                        <Input
                          id="x-handle"
                          placeholder="yourusername"
                          value={xHandle}
                          onChange={(e) => setXHandle(e.target.value)}
                          disabled={!authenticated}
                        />
                      </div>

                      <Button
                        onClick={handleXVerification}
                        disabled={!authenticated || !xHandle}
                        className="w-full"
                      >
                        Start Verification
                      </Button>
                    </div>
                  )}

                  {verificationStep === 2 && (
                    <div className="space-y-4">
                      <Alert>
                        <Twitter className="h-4 w-4" />
                        <AlertDescription>
                          Post the verification message on X to confirm ownership of your account.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-2">
                        <Label>Verification Message</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-mono">{verificationMessage}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={openTwitterPost}
                          className="flex-1 flex items-center space-x-2"
                        >
                          <Twitter className="h-4 w-4" />
                          <span>Post on X</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(verificationMessage)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button
                        onClick={handleXVerification}
                        variant="secondary"
                        className="w-full"
                      >
                        I've Posted - Verify Now
                      </Button>
                    </div>
                  )}

                  {verificationStep === 3 && (
                    <div className="text-center space-y-4">
                      <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                      <h3 className="text-xl font-semibold">Verification Complete!</h3>
                      <p className="text-muted-foreground">
                        Your X account @{xHandle} has been successfully verified.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                  <h3 className="text-xl font-semibold">Account Verified</h3>
                  <p className="text-muted-foreground">
                    Your X account @{xHandle} is verified and linked to your wallet.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsVerified(false);
                      setVerificationStep(1);
                      setXHandle('');
                    }}
                  >
                    Re-verify Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">#{mockUserStats.rank}</p>
                    <p className="text-xs text-muted-foreground">Global Rank</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Coins className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{mockUserStats.totalTrades}</p>
                    <p className="text-xs text-muted-foreground">Total Trades</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">${mockUserStats.totalVolume.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Volume</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <User className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">+{mockUserStats.profitLoss}%</p>
                    <p className="text-xs text-muted-foreground">Profit/Loss</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trading History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center text-muted-foreground">
                  <p>Your trading history will appear here once you start trading.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}