import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { toast } from 'react-toastify';
import { useSendTransaction, useSolanaWallets } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { X_TOKEN_PROGRAM_ADDRESS } from '../lib/xToken/programs';
import { getBuyTokensInstruction, getSellTokensInstruction } from '../lib/xToken/instructions';
import { Address, AccountMeta, AccountRole, TransactionSigner } from '@solana/kit';

interface TradingInterfaceProps {
  authenticated: boolean;
  selectedToken: any;
}

export function TradingInterface({ authenticated, selectedToken }: TradingInterfaceProps) {
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [currentPriceSol, setCurrentPriceSol] = useState<number>(0);
  const [estTotalSol, setEstTotalSol] = useState<number>(0);
  const [estSellSol, setEstSellSol] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [walletSol, setWalletSol] = useState<number | null>(null);
  const [walletToken, setWalletToken] = useState<number | null>(null);
  const [debouncedBuyAmount, setDebouncedBuyAmount] = useState<string>('');
  const [debouncedSellAmount, setDebouncedSellAmount] = useState<string>('');
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState<boolean>(false);
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useSolanaWallets();

  const defaultToken = { name: 'SolanaToken', symbol: 'TKN', price: 0, change24h: 0 };
  const token = selectedToken || defaultToken;

  async function refreshBalances(connection: Connection, owner: PublicKey, mint?: PublicKey) {
    try {
      const solLamports = await connection.getBalance(owner, { commitment: 'confirmed' });
      setWalletSol(solLamports / 1_000_000_000);
    } catch {
      setWalletSol(null);
    }
    try {
      if (mint) {
        const ata = getAssociatedTokenAddressSync(mint, owner);
        const info = await connection.getAccountInfo(ata);
        if (!info) {
          setWalletToken(0);
        } else {
          const bal = await connection.getTokenAccountBalance(ata);
          setWalletToken(bal.value.uiAmount || 0);
        }
      }
    } catch {
      setWalletToken(null);
    }
  }

  const deriveBondingCurvePda = (mint: PublicKey) => {
    const seeds = [Buffer.from('x_token'), mint.toBuffer()];
    const [pda] = PublicKey.findProgramAddressSync(seeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));
    return pda;
  };

  const deriveTreasuryPda = (mint: PublicKey) => {
    const seeds = [Buffer.from('treasury'), mint.toBuffer()];
    const [pda] = PublicKey.findProgramAddressSync(seeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));
    return pda;
  };

  const deriveTradingStatsPda = (owner: PublicKey) => {
    const seeds = [Buffer.from('trading_stats'), owner.toBuffer()];
    const [pda] = PublicKey.findProgramAddressSync(seeds, new PublicKey(X_TOKEN_PROGRAM_ADDRESS));
    return pda;
  };

  async function fetchRecentTrades(connection: Connection, mint: PublicKey) {
    try {
      setIsLoadingTrades(true);

      // Lấy signatures từ tất cả các account liên quan
      const [bondingCurve, treasuryPda] = [deriveBondingCurvePda(mint), deriveTreasuryPda(mint)];
      const signatures = await Promise.all([
        connection.getSignaturesForAddress(bondingCurve, { limit: 10 }),
        connection.getSignaturesForAddress(mint, { limit: 10 }),
        connection.getSignaturesForAddress(treasuryPda, { limit: 10 })
      ]);

      const allSignatures = signatures.flat()
        .filter((sig, index, arr) => arr.findIndex(s => s.signature === sig.signature) === index)
        .sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0))
        .slice(0, 5);

      const trades: any[] = [];

      for (const sigInfo of allSignatures) {
        try {
          const tx = await connection.getTransaction(sigInfo.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });

          if (!tx?.meta || tx.meta.err) continue;

          const tradeType = findTradeType(tx.meta.logMessages || []);
          if (!tradeType) continue;

          const { tokenAmount, solAmount } = calculateAmounts(tx, mint, tradeType);
          if (tokenAmount <= 0 || solAmount <= 0) continue;

          trades.push({
            type: tradeType,
            amount: tokenAmount,
            price: solAmount / tokenAmount,
            time: new Date(sigInfo.blockTime * 1000).toLocaleString('en-US'),
            signature: sigInfo.signature,
          });

        } catch (error) {
          console.error('Error processing transaction:', error);
        }
      }

      setRecentTrades(trades);
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      setRecentTrades([]);
    } finally {
      setIsLoadingTrades(false);
    }
  }

  // Helper functions
  function findTradeType(logs: string[]): string | null {
    for (const log of logs) {
      if (log.includes('Buy')) return 'buy';
      if (log.includes('Sell')) return 'sell';
    }
    return null;
  }

  function calculateAmounts(tx: any, mint: PublicKey, tradeType: string) {
    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];
    const preSolBalance = tx.meta.preBalances[0] || 0;
    const postSolBalance = tx.meta.postBalances[0] || 0;
    const fee = tx.meta.fee || 0;

    const tokenAccount = preBalances.find(b => b.mint === mint.toBase58()) ||
      postBalances.find(b => b.mint === mint.toBase58());

    if (!tokenAccount) return { tokenAmount: 0, solAmount: 0 };

    const preBalance = preBalances.find(b => b.accountIndex === tokenAccount.accountIndex)?.uiTokenAmount?.uiAmount || 0;
    const postBalance = postBalances.find(b => b.accountIndex === tokenAccount.accountIndex)?.uiTokenAmount?.uiAmount || 0;
    const tokenAmount = tradeType === 'buy' ? postBalance - preBalance : preBalance - postBalance;

    const solAmount = Math.abs((tradeType === 'buy' ? preSolBalance - postSolBalance - fee : postSolBalance - preSolBalance) / 1_000_000_000);

    return { tokenAmount, solAmount };
  }

  async function fetchBondingCurveState(connection: Connection, bondingCurve: PublicKey) {
    const info = await connection.getAccountInfo(bondingCurve);
    if (!info || !info.data) throw new Error('Bonding curve account not found');
    const data = info.data as Buffer;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const tokenMint = new PublicKey(data.subarray(32, 64));
    const feeRecipientPk = new PublicKey(data.subarray(64, 96));

    const solReserveLamports = Number(view.getBigUint64(128, true));
    const tokenReserve = Number(view.getBigUint64(136, true));
    const totalSupply = Number(view.getBigUint64(144, true));
    const basePriceLamports = Number(view.getBigUint64(152, true));
    const slope = Number(view.getBigUint64(160, true));
    const maxSupply = Number(view.getBigUint64(168, true));
    const feeBasisPoints = view.getUint16(176, true);
    const curveType = data[178];
    const isInitialized = data[179] === 1;
    return { tokenMint, feeRecipientPk, solReserveLamports, tokenReserve, totalSupply, basePriceLamports, slope, maxSupply, feeBasisPoints, curveType, isInitialized };
  }

  function computeCurrentPriceSol(state: { basePriceLamports: number; slope: number; totalSupply: number; curveType: number; }) {
    const oneE9 = 1_000_000_000;
    let pricePerUnitLamports = state.basePriceLamports;
    if (state.curveType === 0) {
      pricePerUnitLamports = state.basePriceLamports + Math.floor((state.slope * state.totalSupply) / oneE9);
    } else if (state.curveType === 1) {
      pricePerUnitLamports = Math.floor((state.basePriceLamports * (oneE9 + state.slope)) / oneE9);
    } else if (state.curveType === 2) {
      pricePerUnitLamports = state.basePriceLamports + Math.floor((state.basePriceLamports * state.totalSupply) / 1_000_000_000_000);
    }
    return (pricePerUnitLamports * oneE9) / 1_000_000_000_000_000_000;
  }

  function estimateTotalLamports(state: { basePriceLamports: number; slope: number; totalSupply: number; feeBasisPoints: number; curveType: number; }, buyUnits: bigint) {
    const oneE9n = 1_000_000_000n;
    const base = BigInt(state.basePriceLamports);
    const slope = BigInt(state.slope ?? 0);
    const start = BigInt(state.totalSupply);
    const end = start + buyUnits;
    const avg = (start + end) / 2n;
    let unitPrice = base;
    if (state.curveType === 0) {
      unitPrice = base + (slope * avg) / oneE9n;
    } else if (state.curveType === 1) {
      unitPrice = (base * (oneE9n + slope)) / oneE9n;
    } else if (state.curveType === 2) {
      unitPrice = base + (base * avg) / 1_000_000_000_000n;
    }
    let total = (unitPrice * buyUnits) / oneE9n;
    if (state.feeBasisPoints) total += (total * BigInt(state.feeBasisPoints)) / 10000n;
    return total;
  }

  function estimateSellLamports(state: { basePriceLamports: number; slope: number; totalSupply: number; feeBasisPoints: number; curveType: number; }, sellUnits: bigint) {
    const oneE9n = 1_000_000_000n;
    const base = BigInt(state.basePriceLamports);
    const slope = BigInt(state.slope ?? 0);
    const start = BigInt(state.totalSupply);
    const end = start - sellUnits;
    const avg = (start + end) / 2n;
    let unitPrice = base;
    if (state.curveType === 0) {
      unitPrice = base + (slope * avg) / oneE9n;
    } else if (state.curveType === 1) {
      unitPrice = (base * (oneE9n + slope)) / oneE9n;
    } else if (state.curveType === 2) {
      unitPrice = base + (base * avg) / 1_000_000_000_000n;
    }
    let total = (unitPrice * sellUnits) / oneE9n;
    if (state.feeBasisPoints) total -= (total * BigInt(state.feeBasisPoints)) / 10000n;
    return total > 0n ? total : 0n;
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBuyAmount(buyAmount), 500);
    return () => clearTimeout(t);
  }, [buyAmount]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSellAmount(sellAmount), 500);
    return () => clearTimeout(t);
  }, [sellAmount]);

  useEffect(() => {
    (async () => {
      try {
        if (!token?.mint) return;
        setIsLoadingPrice(true);
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const mint = new PublicKey(token.mint);
        const bondingCurve = deriveBondingCurvePda(mint);
        const state = await fetchBondingCurveState(connection, bondingCurve);
        if (!state.isInitialized || !state.tokenMint.equals(mint)) { setCurrentPriceSol(0); setEstTotalSol(0); return; }

        const priceSol = computeCurrentPriceSol({ basePriceLamports: state.basePriceLamports, slope: state.slope, totalSupply: state.totalSupply, curveType: state.curveType });
        setCurrentPriceSol(priceSol);

        if (debouncedBuyAmount) {
          const units = BigInt(Math.floor(parseFloat(debouncedBuyAmount) * Math.pow(10, 9)));
          const estLamports = estimateTotalLamports(state, units);
          setEstTotalSol(Number(estLamports) / 1_000_000_000);
        } else {
          setEstTotalSol(0);
        }

        if (debouncedSellAmount) {
          const units = BigInt(Math.floor(parseFloat(debouncedSellAmount) * Math.pow(10, 9)));
          const estLamports = estimateSellLamports(state, units);

          setEstSellSol(Number(estLamports) / 1_000_000_000);
        } else {
          setEstSellSol(0);
        }
      } catch {
        setCurrentPriceSol(0);
        setEstTotalSol(0);
        setEstSellSol(0);
      }
      finally { setIsLoadingPrice(false); }
    })();
  }, [token?.mint, debouncedBuyAmount, debouncedSellAmount]);

  useEffect(() => {
    (async () => {
      try {
        if (!authenticated || !wallets || wallets.length === 0) { setWalletSol(null); setWalletToken(null); return; }
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const owner = new PublicKey(wallets[0].address);
        const solLamports = await connection.getBalance(owner, { commitment: 'confirmed' });
        setWalletSol(solLamports / 1_000_000_000);
        if (selectedToken?.mint) {
          const mint = new PublicKey(selectedToken.mint);
          const ata = getAssociatedTokenAddressSync(mint, owner);
          const ataInfo = await connection.getAccountInfo(ata);
          if (!ataInfo) {
            setWalletToken(0);
          } else {
            const bal = await connection.getTokenAccountBalance(ata);
            setWalletToken(bal.value.uiAmount || 0);
          }
        } else {
          setWalletToken(null);
        }
      } catch {
        setWalletSol(null);
        setWalletToken(null);
      }
    })();
  }, [authenticated, wallets && wallets[0]?.address, selectedToken?.mint]);

  // Fetch recent trades when token changes
  useEffect(() => {
    (async () => {
      if (!token?.mint) {
        setRecentTrades([]);
        return;
      }

      try {
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const mint = new PublicKey(token.mint);
        await fetchRecentTrades(connection, mint);
      } catch (error) {
        console.error('Error fetching recent trades:', error);
        setRecentTrades([]);
      }
    })();
  }, [token?.mint]);

  const handleBuy = async () => {
    try {
      if (!authenticated || !wallets || wallets.length === 0) throw new Error('No wallet connected');
      if (!token?.mint) throw new Error('Missing token mint');
      if (!buyAmount || parseFloat(buyAmount) <= 0) return;

      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const mint = new PublicKey(token.mint);
      const bondingCurve = deriveBondingCurvePda(mint);

      const state = await fetchBondingCurveState(connection, bondingCurve);
      if (!state.isInitialized || !state.tokenMint.equals(mint)) throw new Error('Curve not initialized');

      const decimals = 9;
      const tokenAmountUnits = BigInt(Math.floor(parseFloat(buyAmount) * Math.pow(10, decimals)));
      if (tokenAmountUnits === BigInt(0)) throw new Error('Amount too small');
      const newSupply = BigInt(state.totalSupply) + tokenAmountUnits;
      if (newSupply > BigInt(state.maxSupply)) throw new Error('Amount exceeds remaining supply');

      const buyerPubkey = new PublicKey(wallets[0].address);
      const buyerAta = getAssociatedTokenAddressSync(mint, buyerPubkey);

      const estLamports = estimateTotalLamports(state, tokenAmountUnits);
      let maxSolLamportsBI = (estLamports * 110n) / 100n; // 10%
      if (maxSolLamportsBI < 1n) maxSolLamportsBI = 1n;

      const feeRecipient = (token.raw?.feeRecipient || token.feeRecipient || state.feeRecipientPk?.toBase58?.()) as string | undefined;
      if (!feeRecipient) throw new Error('Missing fee recipient');

      // Treasury PDA (system-owned) theo seeds ["treasury", mint]
      const treasuryPda = deriveTreasuryPda(mint);

      const ixCodama = getBuyTokensInstruction({
        buyer: { address: wallets[0].address as Address } as TransactionSigner,
        bondingCurve: bondingCurve.toBase58() as Address,
        mint: mint.toBase58() as Address,
        buyerTokenAccount: buyerAta.toBase58() as Address,
        feeRecipient: feeRecipient as Address,
        systemProgram: SystemProgram.programId.toBase58() as Address,
        tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58() as Address,
        tradingStats: deriveTradingStatsPda(buyerPubkey).toBase58() as Address,
        tokenAmount: tokenAmountUnits,
        maxSolAmount: maxSolLamportsBI,
        treasury: treasuryPda.toBase58() as Address,
      });

      const keys = ixCodama.accounts.map((meta: AccountMeta<string>) => ({
        pubkey: new PublicKey(meta.address),
        isSigner: meta.role === AccountRole.READONLY_SIGNER || meta.role === AccountRole.WRITABLE_SIGNER,
        isWritable: meta.role === AccountRole.WRITABLE || meta.role === AccountRole.WRITABLE_SIGNER,
      }));
      if (keys[0] && keys[0].pubkey.equals(buyerPubkey)) keys[0].isSigner = true;

      const ix = new TransactionInstruction({
        keys,
        programId: new PublicKey(ixCodama.programAddress),
        data: Buffer.from(ixCodama.data)
      });

      const tx = new Transaction();
      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = buyerPubkey;
      tx.add(ix);

      const receipt = await sendTransaction({ transaction: tx, connection, address: wallets[0].address });
      await connection.confirmTransaction({ signature: receipt.signature, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight }, 'confirmed');

      toast.success('Buy order sent successfully.');
      setBuyAmount('');

      try {
        const refreshed = await fetchBondingCurveState(connection, bondingCurve);
        setCurrentPriceSol(computeCurrentPriceSol({ basePriceLamports: refreshed.basePriceLamports, slope: refreshed.slope, totalSupply: refreshed.totalSupply, curveType: refreshed.curveType }));
        await refreshBalances(connection, buyerPubkey, mint);
        await fetchRecentTrades(connection, mint);
      } catch { }
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  };

  const handleSell = async () => {
    try {
      if (!authenticated || !wallets || wallets.length === 0) throw new Error('No wallet connected');
      if (!token?.mint) throw new Error('Missing token mint');
      if (!sellAmount || parseFloat(sellAmount) <= 0) return;

      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const mint = new PublicKey(token.mint);
      const bondingCurve = deriveBondingCurvePda(mint);

      const state = await fetchBondingCurveState(connection, bondingCurve);
      if (!state.isInitialized || !state.tokenMint.equals(mint)) throw new Error('Curve not initialized');

      const decimals = 9;
      const tokenAmountUnits = BigInt(Math.floor(parseFloat(sellAmount) * Math.pow(10, decimals)));
      if (tokenAmountUnits === BigInt(0)) throw new Error('Amount too small');
      if (tokenAmountUnits > BigInt(state.totalSupply)) throw new Error('Amount exceeds total supply');

      const sellerPubkey = new PublicKey(wallets[0].address);
      const sellerAta = getAssociatedTokenAddressSync(mint, sellerPubkey);

      const tokenBalance = await connection.getTokenAccountBalance(sellerAta);
      if (!tokenBalance.value.uiAmount || tokenBalance.value.uiAmount < parseFloat(sellAmount)) {
        throw new Error(`Test wallet has insufficient tokens: ${tokenBalance.value.uiAmount} < ${sellAmount}`);
      }

      const estLamports = estimateSellLamports(state, tokenAmountUnits);
      let minSolLamportsBI = (estLamports * 90n) / 100n; // 10% slippage
      if (minSolLamportsBI < 1n) minSolLamportsBI = 1n;

      const feeRecipient = (token.raw?.feeRecipient || token.feeRecipient || state.feeRecipientPk?.toBase58?.()) as string | undefined;
      if (!feeRecipient) throw new Error('Missing fee recipient');

      const treasuryPda = deriveTreasuryPda(mint);

      const ixCodama = getSellTokensInstruction({
        seller: { address: sellerPubkey.toBase58() } as any,
        bondingCurve: bondingCurve.toBase58() as Address,
        mint: mint.toBase58() as Address,
        sellerTokenAccount: sellerAta.toBase58() as Address,
        treasury: treasuryPda.toBase58() as Address,
        feeRecipient: feeRecipient as Address,
        tradingStats: deriveTradingStatsPda(sellerPubkey).toBase58() as Address,
        tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
        systemProgram: SystemProgram.programId.toBase58() as Address,
        tokenAmount: tokenAmountUnits,
        minSolAmount: minSolLamportsBI,
      });

      const keys = ixCodama.accounts.map((meta: AccountMeta<string>) => ({
        pubkey: new PublicKey(meta.address),
        isSigner: meta.role === AccountRole.READONLY_SIGNER || meta.role === AccountRole.WRITABLE_SIGNER,
        isWritable: meta.role === AccountRole.WRITABLE || meta.role === AccountRole.WRITABLE_SIGNER,
      }));

      if (keys[0] && keys[0].pubkey.equals(sellerPubkey)) {
        keys[0].isSigner = true;
      }

      const ix = new TransactionInstruction({
        keys,
        programId: new PublicKey(ixCodama.programAddress),
        data: Buffer.from(ixCodama.data)
      });

      const tx = new Transaction();
      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = sellerPubkey;
      tx.add(ix);

      const receipt = await sendTransaction({ transaction: tx, connection, address: wallets[0].address });
      await connection.confirmTransaction({
        signature: receipt.signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, 'confirmed');
      toast.success('Sell order sent successfully.');
      setSellAmount('');

      try {
        const refreshed = await fetchBondingCurveState(connection, bondingCurve);
        setCurrentPriceSol(computeCurrentPriceSol({
          basePriceLamports: refreshed.basePriceLamports,
          slope: refreshed.slope,
          totalSupply: refreshed.totalSupply,
          curveType: refreshed.curveType
        }));
        await refreshBalances(connection, sellerPubkey, mint);
        await fetchRecentTrades(connection, mint);
      } catch { }
    } catch (e: any) {
      console.error('[SELL] error:', e);
      if (e.logs) {
        console.error('[SELL] Program logs:', e.logs);
      }
      toast.error(String(e?.message || e));
    }
  };


  return (
    <div className="space-y-6">
      {!authenticated && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please connect your Phantom wallet to start trading.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{token.symbol[0]}</span>
                  </div>
                  <div>
                    <span>{token.name}</span>
                    <p className="text-sm text-muted-foreground font-normal">{token.symbol}</p>
                  </div>
                </CardTitle>
                <div className="text-right">
                  <p className="font-bold text-lg">{isLoadingPrice ? '...' : `${currentPriceSol.toFixed(9)} SOL`}</p>
                  <div className={`flex items-center space-x-1 ${token.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {token.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span className="text-sm">{Math.abs(token.change24h)}%</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="buy" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="buy">Buy</TabsTrigger>
                  <TabsTrigger value="sell">Sell</TabsTrigger>
                </TabsList>

                <TabsContent value="buy" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="buy-amount">Amount ({token.symbol})</Label>
                    <Input id="buy-amount" type="number" placeholder="0.00" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} disabled={!authenticated} />
                  </div>

                  <div className="space-y-2">
                    <Label>Estimated Total (SOL)</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="font-medium">
                        {buyAmount ? estTotalSol.toFixed(9) : '0.000000000'} SOL
                      </span>
                    </div>
                  </div>

                  <Button className="w-full" onClick={handleBuy} disabled={!authenticated || !buyAmount}>
                    Buy {token.symbol}
                  </Button>
                </TabsContent>

                <TabsContent value="sell" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sell-amount">Amount ({token.symbol})</Label>
                    <Input id="sell-amount" type="number" placeholder="0.00" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} disabled={!authenticated} />
                  </div>

                  <div className="space-y-2">
                    <Label>You'll Receive (SOL)</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="font-medium">
                        {sellAmount ? estSellSol.toFixed(9) : '0.000000000'} SOL
                      </span>
                    </div>
                  </div>

                  <Button className="w-full" onClick={handleSell} disabled={!authenticated || !sellAmount}>
                    Sell {token.symbol}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Balance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">SOL</span>
                <span className="font-medium">{walletSol !== null ? walletSol.toFixed(4) : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{token.symbol}</span>
                <span className="font-medium">{walletToken !== null ? walletToken.toFixed(4) : '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingTrades ? (
                // Skeleton loading cho 5 items
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="text-right space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))
              ) : recentTrades.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-muted-foreground">No recent trades</div>
                </div>
              ) : (
                recentTrades.map((trade, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <Badge variant={trade.type === 'buy' ? 'default' : 'secondary'}>
                        {trade.type === 'buy' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </Badge>
                      <span>{trade.amount.toFixed(4)} {token.symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{trade.price.toFixed(9)} SOL</p>
                      <p className="text-muted-foreground text-xs">{trade.time}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}