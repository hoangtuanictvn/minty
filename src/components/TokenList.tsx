import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Search, Twitter, ExternalLink, Sparkles } from 'lucide-react';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { X_TOKEN_PROGRAM_ADDRESS } from '../lib/xToken/programs';
import { fetchMultipleUserProfiles } from '../lib/profile';
import { useSendTransaction, useSolanaWallets } from '@privy-io/react-auth/solana';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'react-toastify';
import { getInitializeInstruction, InitializeInput } from '../lib/xToken/instructions';
import { AccountMeta, AccountRole, Address, TransactionSigner } from '@solana/kit';
import { TOKEN_PROGRAM_ID, MINT_SIZE } from '@solana/spl-token';
import { Buffer } from 'buffer';

interface TokenListProps {
  authenticated: boolean;
  onSelectToken: (token: any) => void;
}

type OnchainToken = {
  id: string;
  tokenMint: string;
  authority: string;
  feeRecipient: string;
  owner?: string;
  solReserve: number;
  tokenReserve: number;
  totalSupply: number;
  basePrice: number;
  slope: number;
  maxSupply: number;
  feeBasisPoints: number;
  curveType: number;
  username?: string;
  bio?: string;

  currentPrice: number; // Current price per token in SOL
  marketCap: number; // Market cap in SOL
};

export function TokenList({ authenticated, onSelectToken }: TokenListProps) {
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useSolanaWallets();
  const { user } = usePrivy();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'trending'>('all');
  const [tokens, setTokens] = useState<OnchainToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        setError(null);
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const programId = new PublicKey(X_TOKEN_PROGRAM_ADDRESS);

        const accounts = await connection.getProgramAccounts(programId, {
          filters: [
            { dataSize: 216 },
          ],
        });

        const parsed: OnchainToken[] = accounts.map(a => {
          const data = a.account.data as Buffer;
          // Decode struct XToken (updated with owner field)
          const authority = new PublicKey(data.subarray(0, 32)).toBase58();
          const tokenMintPk = new PublicKey(data.subarray(32, 64));
          const feeRecipient = new PublicKey(data.subarray(64, 96)).toBase58();

          // Decode owner field (32 bytes starting at offset 96)
          const ownerBytes = data.subarray(96, 128);
          const ownerLength = ownerBytes[0];
          const ownerString = ownerLength > 0 && ownerLength <= 31
            ? Buffer.from(ownerBytes.subarray(1, 1 + ownerLength)).toString('utf8')
            : '';

          const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
          const solReserveLamports = Number(view.getBigUint64(128, true));
          const tokenReserve = Number(view.getBigUint64(136, true));
          const totalSupply = Number(view.getBigUint64(144, true));
          const basePriceLamports = Number(view.getBigUint64(152, true));
          const slope = Number(view.getBigUint64(160, true));
          const maxSupply = Number(view.getBigUint64(168, true));
          const feeBasisPoints = view.getUint16(176, true);
          const curveType = data[178];
          const isInitialized = data[179] === 1;
          if (!isInitialized) throw new Error('uninitialized');

          const currentPrice = basePriceLamports / 1_000_000_000 + (slope * totalSupply) / (1_000_000_000 * 1_000_000_000);
          const marketCap = currentPrice * totalSupply / 1_000_000_000;

          return {
            id: a.pubkey.toBase58(),
            tokenMint: tokenMintPk.toBase58(),
            authority,
            feeRecipient,
            owner: ownerString || undefined,
            solReserve: solReserveLamports / 1_000_000_000,
            tokenReserve,
            totalSupply,
            basePrice: basePriceLamports / 1_000_000_000,
            slope,
            maxSupply,
            feeBasisPoints,
            curveType,
            currentPrice,
            marketCap,
          };
        });

        const uniqueAuthorities = [...new Set(parsed.map(token => token.authority))];
        const authorityPks = uniqueAuthorities.map(auth => new PublicKey(auth));
        const profilesMap = await fetchMultipleUserProfiles(connection, authorityPks, programId);

        const tokensWithProfiles = parsed.map(token => {
          const profile = profilesMap.get(token.authority);
          return {
            ...token,
            username: profile?.username || undefined,
            bio: profile?.bio || undefined,
          };
        });

        setTokens(tokensWithProfiles);
      } catch (e: any) {
        console.error('Failed to load onchain tokens:', e?.message || e);
        setError('Failed to load onchain tokens.');
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [refreshNonce]);


  const filteredTokens = tokens.filter(token => {
    const name = `${token.tokenMint.slice(0, 4)}`;
    const display = token.owner || token.username || `Mint ${token.tokenMint.slice(0, 6)}...${token.tokenMint.slice(-4)}`;
    const handle = `@${token.authority.slice(0, 6)}`;
    const hay = `${name} ${display} ${handle}`.toLowerCase();
    const matchesSearch = hay.includes(searchTerm.toLowerCase());

    if (filter === 'verified') return matchesSearch;
    if (filter === 'trending') return matchesSearch;
    return matchesSearch;
  });

  const openXProfile = (xHandle: string) => {
    window.open(`https://x.com/${xHandle.replace('@', '')}`, '_blank');
  };

  const encodeOwner = (username: string | undefined): number[] => {
    const name = username || '';
    const bytes = Array.from(Buffer.from(name, 'utf8'));
    const padded = new Array(32).fill(0);
    padded[0] = Math.min(bytes.length, 31);
    for (let i = 0; i < Math.min(bytes.length, 31); i++) {
      padded[i + 1] = bytes[i];
    }
    return padded;
  };

  const createToken = async () => {
    try {
      if (!authenticated) throw new Error('Please connect wallet');
      if (!wallets || wallets.length === 0) throw new Error('No wallet connected');

      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const userAddress = new PublicKey(wallets[0].address);
      const twitterUsername = user?.twitter?.username;

      const mintKeypair = Keypair.generate();
      const bondingCurveSeeds = [Buffer.from('x_token'), mintKeypair.publicKey.toBuffer()];
      const [bondingCurvePda] = PublicKey.findProgramAddressSync(bondingCurveSeeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));

      const treasurySeeds = [Buffer.from('treasury'), mintKeypair.publicKey.toBuffer()];
      const [treasuryPda] = PublicKey.findProgramAddressSync(treasurySeeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));

      const initializeInput: InitializeInput = {
        authority: { address: wallets[0].address as Address } as TransactionSigner,
        bondingCurve: bondingCurvePda.toBase58() as Address,
        mint: mintKeypair.publicKey.toBase58() as Address,
        treasury: treasuryPda.toBase58() as Address,
        payer: { address: wallets[0].address as Address } as TransactionSigner,
        systemProgram: SystemProgram.programId.toBase58() as Address,
        tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
        rent: 'SysvarRent111111111111111111111111111111111' as Address,
        decimals: 9,
        curveType: 0,
        feeBasisPoints: 25,
        owner: encodeOwner(twitterUsername),
        basePrice: 100,
        slope: 100,
        maxSupply: 100_000_000_000_000_000,
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
        data: Buffer.from(initializeInstruction.data),
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
      }, 'confirmed');

      console.log("Token created:", receipt.signature);
      toast.success('Token created successfully.');
      setRefreshNonce((n) => n + 1);
    } catch (error: any) {
      toast.error(String(error?.message || error));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            Onchain Token Creators
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 w-40">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
          Onchain Token Creators
        </h2>
        {error && (
          <p className="text-sm text-orange-600">{error}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by mint, authority..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>

          <Button onClick={createToken} disabled={!authenticated}>
            Create Token
          </Button>
        </div>
      </div>

      {filteredTokens.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchTerm ? 'No matching token found.' : 'There are no tokens yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTokens.map((token) => {
            const tokenName = `${token.tokenMint.slice(0, 4)}...${token.tokenMint.slice(-4)}`;
            const displayName = token.username || `${token.tokenMint.slice(0, 6)}...${token.tokenMint.slice(-4)}`;
            const xHandle = `@${token.owner}`;
            return (
              <Card key={token.id} className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center relative`}>
                        <span className="text-white font-bold">
                          {(token.owner || token.username) ? (token.owner || token.username)![0].toUpperCase() : tokenName[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{displayName}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-blue-500 truncate">{xHandle}</p>
                          <button
                            onClick={() => openXProfile(xHandle)}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex items-center space-x-1">
                      <Sparkles className="h-3 w-3" />
                      <span>${tokenName}</span>
                    </Badge>
                  </div>
                  {token.bio && (
                    <p className="text-sm text-muted-foreground mt-2">{token.bio}</p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Price</span>
                      <span className="font-medium text-green-600">{token.currentPrice.toFixed(6)} SOL</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Market Cap</span>
                      <span className="font-medium text-blue-600">{token.marketCap.toFixed(4)} SOL</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Supply</span>
                      <span className="text-sm font-medium">{(token.totalSupply / 1_000_000_000).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Fee</span>
                      <span className="text-sm font-medium">{(token.feeBasisPoints / 100).toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1"
                      onClick={() => onSelectToken(token)}
                      disabled={!authenticated}
                    >
                      Trade ${tokenName}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openXProfile(xHandle)}
                      className="flex items-center space-x-1"
                    >
                      <Twitter className="h-3 w-3" />
                    </Button>
                  </div>

                  {!authenticated && (
                    <p className="text-xs text-muted-foreground text-center">
                      Connect your wallet to start trading
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}