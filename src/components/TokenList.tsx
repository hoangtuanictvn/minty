import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Search, TrendingUp, TrendingDown, Twitter, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { X_TOKEN_PROGRAM_ADDRESS } from '../lib/xToken/programs';

interface TokenListProps {
  authenticated: boolean;
  onSelectToken: (token: any) => void;
}

type OnchainToken = {
  id: string;
  tokenMint: string;
  authority: string;
  feeRecipient: string;
  solReserve: number; // in SOL
  tokenReserve: number;
  totalSupply: number;
  basePrice: number; // in SOL
  slope: number; // raw
  maxSupply: number;
  feeBasisPoints: number;
  curveType: number;
};

export function TokenList({ authenticated, onSelectToken }: TokenListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'trending'>('all');
  const [tokens, setTokens] = useState<OnchainToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // Decode struct XToken
          const authority = new PublicKey(data.subarray(0, 32)).toBase58();
          const tokenMintPk = new PublicKey(data.subarray(32, 64));
          const feeRecipient = new PublicKey(data.subarray(64, 96)).toBase58();
          const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
          const solReserveLamports = Number(view.getBigUint64(96, true));
          const tokenReserve = Number(view.getBigUint64(104, true));
          const totalSupply = Number(view.getBigUint64(112, true));
          const basePriceLamports = Number(view.getBigUint64(120, true));
          const slope = Number(view.getBigUint64(128, true));
          const maxSupply = Number(view.getBigUint64(136, true));
          const feeBasisPoints = view.getUint16(144, true);
          const curveType = data[146];
          const isInitialized = data[147] === 1;
          if (!isInitialized) throw new Error('uninitialized');

          return {
            id: a.pubkey.toBase58(),
            tokenMint: tokenMintPk.toBase58(),
            authority,
            feeRecipient,
            solReserve: solReserveLamports / 1_000_000_000,
            tokenReserve,
            totalSupply,
            basePrice: basePriceLamports / 1_000_000_000,
            slope,
            maxSupply,
            feeBasisPoints,
            curveType,
          };
        });

        setTokens(parsed);
      } catch (e: any) {
        console.error('Failed to load onchain tokens:', e?.message || e);
        setError('Không tải được danh sách token onchain.');
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, []);

  console.log(tokens);


  const filteredTokens = tokens.filter(token => {
    const name = `TOKEN-${token.tokenMint.slice(0, 4)}`;
    const display = `Mint ${token.tokenMint.slice(0, 6)}...${token.tokenMint.slice(-4)}`;
    const handle = `@${token.authority.slice(0, 6)}`;
    const hay = `${name} ${display} ${handle}`.toLowerCase();
    const matchesSearch = hay.includes(searchTerm.toLowerCase());

    if (filter === 'verified') return matchesSearch; // Chưa có verified onchain
    if (filter === 'trending') return matchesSearch; // Chưa có trend metric
    return matchesSearch;
  });

  const openXProfile = (xHandle: string) => {
    window.open(`https://x.com/${xHandle.replace('@', '')}`, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            Onchain Token Creators
          </h2>
          <p className="text-muted-foreground">Đang tải danh sách token từ blockchain...</p>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading tokens...</span>
          </div>
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
            placeholder="Tìm theo mint, authority..."
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
          <Button
            variant={filter === 'verified' ? 'default' : 'outline'}
            onClick={() => setFilter('verified')}
          >
            Verified
          </Button>
          <Button
            variant={filter === 'trending' ? 'default' : 'outline'}
            onClick={() => setFilter('trending')}
          >
            Trending
          </Button>
        </div>
      </div>

      {filteredTokens.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchTerm ? 'Không tìm thấy token phù hợp.' : 'Chưa có token nào.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTokens.map((token) => {
            const tokenName = `TOKEN-${token.tokenMint.slice(0, 4)}`;
            const displayName = `Mint ${token.tokenMint.slice(0, 6)}...${token.tokenMint.slice(-4)}`;
            const xHandle = `@${token.authority.slice(0, 6)}`;
            return (
              <Card key={token.id} className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center relative`}>
                        <span className="text-white font-bold">{tokenName[0]}</span>
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
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Base Price (SOL)</span>
                      <span className="font-medium">{token.basePrice.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Supply</span>
                      <span className="text-sm font-medium">{token.totalSupply.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">SOL Reserve</span>
                      <span className="text-sm font-medium">{token.solReserve.toFixed(4)} SOL</span>
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