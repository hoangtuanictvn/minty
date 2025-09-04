import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { User, Trophy, Coins, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { X_TOKEN_PROGRAM_ADDRESS } from '../../lib/xToken/programs';

interface StatisticsTabProps {
    authenticated: boolean;
}

export function StatisticsTab({ authenticated }: StatisticsTabProps) {
    const { wallets } = useSolanaWallets();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [userStats, setUserStats] = useState<{ totalTrades: number; totalVolume: number; rank: number | null }>({ totalTrades: 0, totalVolume: 0, rank: null });
    const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
    const [history, setHistory] = useState<Array<{
        signature: string;
        time: string;
        type: 'buy' | 'sell' | 'unknown';
        solDelta: number;
        tokenMint?: string;
        tokenDelta?: number;
    }>>([]);

    const ownerPubkey = useMemo(() => {
        try {
            if (!authenticated || !wallets || wallets.length === 0) return null;
            return new PublicKey(wallets[0].address);
        } catch {
            return null;
        }
    }, [authenticated, wallets && wallets[0]?.address]);

    function deriveTradingStatsPda(owner: PublicKey) {
        const seeds = [Buffer.from('trading_stats'), owner.toBuffer()];
        const [pda] = PublicKey.findProgramAddressSync(seeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));
        return pda;
    }

    async function fetchOwnStatsAndRank() {
        if (!ownerPubkey) {
            setUserStats({ totalTrades: 0, totalVolume: 0, rank: null });
            return;
        }
        setIsLoading(true);
        try {
            const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

            const statsPda = deriveTradingStatsPda(ownerPubkey);
            const info = await connection.getAccountInfo(statsPda);
            let myVolumeLamports = 0n;
            let myTrades = 0;
            if (info && info.data) {
                const data = info.data as Buffer;
                const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                myVolumeLamports = view.getBigUint64(32, true);
                myTrades = view.getUint32(56, true);
            }

            const programId = new PublicKey(X_TOKEN_PROGRAM_ADDRESS);

            const accounts = await connection.getProgramAccounts(programId, { filters: [{ dataSize: 128 }] });
            const volumes: Array<{ key: string; vol: bigint }> = accounts.map((acc) => {
                const buf = acc.account.data as Buffer;
                const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
                const vol = dv.getBigUint64(32, true);
                const userKey = new PublicKey(buf.subarray(0, 32)).toBase58();
                return { key: userKey, vol };
            });
            volumes.sort((a, b) => (b.vol > a.vol ? 1 : b.vol < a.vol ? -1 : 0));
            const myKey = ownerPubkey.toBase58();
            const rankIndex = volumes.findIndex((v) => v.key === myKey);
            const rank = rankIndex >= 0 ? rankIndex + 1 : null;

            setUserStats({
                totalTrades: myTrades,
                totalVolume: Number(myVolumeLamports) / 1_000_000_000,
                rank,
            });
        } catch {
            setUserStats({ totalTrades: 0, totalVolume: 0, rank: null });
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        (async () => {
            await fetchOwnStatsAndRank();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ownerPubkey?.toBase58()]);

    function findTradeType(logs: string[] | null | undefined): 'buy' | 'sell' | 'unknown' {
        if (!logs) return 'unknown';
        for (const log of logs) {
            if (log.includes('Buy')) return 'buy';
            if (log.includes('Sell')) return 'sell';
        }
        return 'unknown';
    }

    async function fetchTradingHistory() {
        if (!ownerPubkey) { setHistory([]); return; }
        setIsLoadingHistory(true);
        try {
            const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
            const statsPda = deriveTradingStatsPda(ownerPubkey);

            const sigs = await connection.getSignaturesForAddress(statsPda, { limit: 5 });
            const items: Array<{ signature: string; time: string; type: 'buy' | 'sell' | 'unknown'; solDelta: number; tokenMint?: string; tokenDelta?: number; }> = [];
            for (const s of sigs) {
                try {
                    const tx = await connection.getTransaction(s.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
                    if (!tx || !tx.meta || tx.meta.err) continue;

                    const type = findTradeType(tx.meta.logMessages);

                    const payerIndex = 0;
                    const pre = tx.meta.preBalances?.[payerIndex] ?? 0;
                    const post = tx.meta.postBalances?.[payerIndex] ?? 0;

                    const key0 = tx.transaction.message.getAccountKeys().get(0);
                    if (!key0 || key0.toBase58() !== ownerPubkey.toBase58()) {

                        continue;
                    }

                    const lamportsDelta = post - pre;
                    const solDelta = lamportsDelta / 1_000_000_000;

                    let tokenMint: string | undefined;
                    let tokenDelta: number | undefined;
                    try {
                        const preTokenBalances = tx.meta.preTokenBalances || [];
                        const postTokenBalances = tx.meta.postTokenBalances || [];

                        const byIndex = new Map<number, { pre: typeof preTokenBalances[number] | null; post: typeof postTokenBalances[number] | null }>();
                        for (const b of preTokenBalances) {
                            byIndex.set(b.accountIndex, { pre: b, post: null });
                        }
                        for (const b of postTokenBalances) {
                            const cur = byIndex.get(b.accountIndex) || { pre: null, post: null };
                            cur.post = b;
                            byIndex.set(b.accountIndex, cur);
                        }

                        let maxAbs = 0;
                        byIndex.forEach((v) => {
                            if (!v.pre && !v.post) return;
                            const preAmt = Number(v.pre?.uiTokenAmount?.amount || 0);
                            const postAmt = Number(v.post?.uiTokenAmount?.amount || 0);
                            const decimals = v.post?.uiTokenAmount?.decimals ?? v.pre?.uiTokenAmount?.decimals ?? 0;
                            const deltaRaw = postAmt - preAmt;
                            const delta = decimals > 0 ? deltaRaw / Math.pow(10, decimals) : deltaRaw;
                            const abs = Math.abs(delta);
                            if (abs > maxAbs) {
                                maxAbs = abs;
                                tokenMint = v.post?.mint || v.pre?.mint;
                                tokenDelta = delta;
                            }
                        });
                    } catch { }

                    items.push({
                        signature: s.signature,
                        time: s.blockTime ? new Date(s.blockTime * 1000).toLocaleString('en-US') : '',
                        type,
                        solDelta,
                        tokenMint,
                        tokenDelta,
                    });
                } catch { }
            }

            items.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
            setHistory(items);
        } catch {
            setHistory([]);
        } finally {
            setIsLoadingHistory(false);
        }
    }

    useEffect(() => {
        (async () => {
            await fetchTradingHistory();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ownerPubkey?.toBase58()]);

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center space-x-2">
                            <Trophy className="h-8 w-8 text-yellow-500" />
                            <div>
                                <p className="text-2xl font-bold">{userStats.rank ? `#${userStats.rank}` : (isLoading ? '...' : '#—')}</p>
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
                                <p className="text-2xl font-bold">{isLoading ? '...' : userStats.totalTrades}</p>
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
                                <p className="text-2xl font-bold">{isLoading ? '...' : `${userStats.totalVolume.toLocaleString()} SOL`}</p>
                                <p className="text-xs text-muted-foreground">Total Volume</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>


            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Trading History (Last 5 trades)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {isLoadingHistory ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Token</TableHead>
                                        <TableHead>Token Amount Change</TableHead>
                                        <TableHead>SOL Amount Change</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : history.length === 0 ? (
                            <div className="text-center text-muted-foreground">
                                <p>No trades found for this wallet.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Token address</TableHead>
                                        <TableHead>Token Amount Change</TableHead>
                                        <TableHead>SOL Amount Change</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((h) => {
                                        const tokenShort = h.tokenMint ? `${h.tokenMint.substring(0, 4)}...${h.tokenMint.substring(h.tokenMint.length - 4)}` : '-';
                                        const tokenDeltaText = typeof h.tokenDelta === 'number' ? `${h.tokenDelta >= 0 ? '+' : ''}${h.tokenDelta.toFixed(4)}` : '-';
                                        const solDeltaText = `${h.solDelta >= 0 ? '+' : ''}${h.solDelta.toFixed(9)} SOL`;

                                        return (
                                            <TableRow key={h.signature}>
                                                <TableCell>
                                                    <span className={h.type === 'buy' ? 'text-green-600' : h.type === 'sell' ? 'text-red-600' : 'text-muted-foreground'}>
                                                        {h.type.toUpperCase()}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{h.time}</TableCell>
                                                <TableCell className="text-muted-foreground">{tokenShort}</TableCell>
                                                <TableCell className={` ${typeof h.tokenDelta === 'number' ? (h.tokenDelta >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>{tokenDeltaText}</TableCell>
                                                <TableCell className={`${h.solDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{solDeltaText}</TableCell>
                                                <TableCell className="text-right">
                                                    <a
                                                        className="text-xs text-blue-500 hover:underline"
                                                        href={`https://explorer.solana.com/tx/${h.signature}?cluster=devnet`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        View
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
