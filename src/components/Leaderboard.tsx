import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Trophy, Medal, Award, TrendingUp, Zap } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Connection, PublicKey } from '@solana/web3.js';
import { X_TOKEN_PROGRAM_ADDRESS } from '../lib/xToken/programs';

type LeaderboardEntry = {
  rank: number;
  username: string;
  walletAddress: string;
  totalVolume: number;
  trades: number;
  verified: boolean;
  xHandle: string | null;
};



const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="h-5 w-5 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
  }
};

export function Leaderboard() {
  const [onchainEntries, setOnchainEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  function deriveUserProfilePda(owner: PublicKey) {
    const seeds = [Buffer.from('user_profile'), owner.toBuffer()];
    const [pda] = PublicKey.findProgramAddressSync(seeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));
    return pda;
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const programId = new PublicKey(X_TOKEN_PROGRAM_ADDRESS);
        // TradingStats account size = 128 bytes.
        const accounts = await connection.getProgramAccounts(programId, { filters: [{ dataSize: 128 }] });

        const decoded = await Promise.all(accounts.map(async (acc, index) => {
          const data = acc.account.data as Buffer;
          const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
          const userPubkey = new PublicKey(data.subarray(0, 32));
          const totalVolume = Number(view.getBigUint64(32, true));
          // const totalProfitLoss = Number(view.getBigInt64(40, true)); // P&L disabled
          const tradeCount = view.getUint32(56, true);

          // Fetch username & verified from UserProfile PDA if exists
          let username = userPubkey.toBase58().slice(0, 6);
          let verified = false;
          try {
            const profilePda = deriveUserProfilePda(userPubkey);
            const info = await connection.getAccountInfo(profilePda);
            if (info && info.data && info.data.length >= 269) {
              const pbuf = info.data as Buffer;
              const unameLen = pbuf[32];
              const uname = pbuf.subarray(36, 36 + Math.min(unameLen, 32)).toString();
              const isInit = pbuf[268] === 1;
              if (uname && uname.length > 0) username = uname;
              verified = !!isInit;
            }
          } catch { }

          const entry: LeaderboardEntry = {
            rank: index + 1,
            username,
            walletAddress: userPubkey.toBase58(),
            totalVolume: totalVolume / 1_000_000_000, // to SOL
            trades: tradeCount,
            verified,
            xHandle: null,
          };
          return entry;
        }));

        // Sort by totalVolume desc and add rank
        const sorted = decoded.sort((a, b) => b.totalVolume - a.totalVolume).map((e, i) => ({ ...e, rank: i + 1 })).slice(0, 50);
        setOnchainEntries(sorted);
      } catch {
        setOnchainEntries(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Top Traders Leaderboard</h2>
        <p className="text-muted-foreground">
          Rankings based on total trading volume {loading ? '(loading...)' : ''}
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={`sk-top-${i}`} className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2">
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
                <div className="flex justify-center mb-2">
                  <Skeleton className="h-16 w-16 rounded-full" />
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center space-y-1">
                  <Skeleton className="h-6 w-36 mx-auto" />
                  <Skeleton className="h-4 w-20 mx-auto" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trades:</span>
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-3 w-40 mx-auto" />
              </CardContent>
            </Card>
          ))
        ) : (
          onchainEntries?.slice(0, 3).map((trader) => (
            <Card key={trader.rank} className={`${trader.rank === 1 ? 'ring-2 ring-yellow-400' : ''} hover:shadow-lg transition-shadow`}>
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2">
                  {getRankIcon(trader.rank)}
                </div>
                <div className="flex justify-center mb-2">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg font-bold">
                      {trader.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle className="flex items-center justify-center space-x-2">
                  <span>{trader.username}</span>
                  {trader.verified && <Zap className="h-4 w-4 text-blue-500" />}
                </CardTitle>
                {trader.xHandle && (
                  <p className="text-sm text-blue-500">{trader.xHandle}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {trader.totalVolume.toLocaleString()} SOL
                  </p>
                  <p className="text-sm text-muted-foreground">Total Volume</p>
                </div>

                {/* P&L removed */}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trades:</span>
                  <span className="font-medium">{trader.trades.toLocaleString()}</span>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {`${trader.walletAddress.slice(0, 6)}...${trader.walletAddress.slice(-4)}`}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Full Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>Full Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                <div key={`sk-row-${i}`} className="flex items-center justify-between p-3 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8">
                      <Skeleton className="h-5 w-5" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-right">
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <p className="text-muted-foreground">Volume</p>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-10 ml-auto" />
                      <p className="text-muted-foreground">Trades</p>
                    </div>
                  </div>
                </div>
              ))
              : onchainEntries?.map((trader) => (
                <div key={trader.rank} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(trader.rank)}
                    </div>

                    <Avatar>
                      <AvatarFallback>
                        {trader.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{trader.username}</h3>
                        {trader.verified && <Zap className="h-3 w-3 text-blue-500" />}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>{`${trader.walletAddress.slice(0, 6)}...${trader.walletAddress.slice(-4)}`}</span>
                        {trader.xHandle && (
                          <>
                            <span>•</span>
                            <span className="text-blue-500">{trader.xHandle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-right">
                      <p className="font-medium">{trader.totalVolume.toLocaleString()} SOL</p>
                      <p className="text-muted-foreground">Volume</p>
                    </div>

                    {/* P&L column removed */}

                    <div className="text-right">
                      <p className="font-medium">{trader.trades.toLocaleString()}</p>
                      <p className="text-muted-foreground">Trades</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}