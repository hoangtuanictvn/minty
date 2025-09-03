import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
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
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useSolanaWallets();

  const defaultToken = { name: 'SolanaToken', symbol: 'TKN', price: 0, change24h: 0 };
  const token = selectedToken || defaultToken;

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

  async function fetchBondingCurveState(connection: Connection, bondingCurve: PublicKey) {
    const info = await connection.getAccountInfo(bondingCurve);
    if (!info || !info.data) throw new Error('Bonding curve account not found');
    const data = info.data as Buffer;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const tokenMint = new PublicKey(data.subarray(32, 64));
    const feeRecipientPk = new PublicKey(data.subarray(64, 96));
    // Offsets theo struct on-chain: owner [96..128), sau đó đến các u64/u16/u8
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
    let total = unitPrice * buyUnits;
    if (state.feeBasisPoints) total += (total * BigInt(state.feeBasisPoints)) / 10000n;
    // Trả về lamports, UI sẽ chia cho 1e9 để hiển thị SOL
    return total;
  }

  function estimateSellLamports(state: { basePriceLamports: number; slope: number; totalSupply: number; feeBasisPoints: number; curveType: number; }, sellUnits: bigint) {
    const oneE9n = 1_000_000_000n;
    const base = BigInt(state.basePriceLamports);
    const slope = BigInt(state.slope ?? 0);
    const start = BigInt(state.totalSupply);
    const end = start - sellUnits; // Giảm supply khi bán
    const avg = (start + end) / 2n;
    let unitPrice = base;
    if (state.curveType === 0) {
      unitPrice = base + (slope * avg) / oneE9n;
    } else if (state.curveType === 1) {
      unitPrice = (base * (oneE9n + slope)) / oneE9n;
    } else if (state.curveType === 2) {
      unitPrice = base + (base * avg) / 1_000_000_000_000n;
    }
    let total = unitPrice * sellUnits;
    // Khi bán, người bán phải trả phí (giảm số SOL nhận được)
    if (state.feeBasisPoints) total -= (total * BigInt(state.feeBasisPoints)) / 10000n;
    // Trả về lamports, UI sẽ chia cho 1e9 để hiển thị SOL
    return total > 0n ? total : 0n;
  }

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

        // Debug log
        console.log('[PRICE_DEBUG] State:', {
          basePriceLamports: state.basePriceLamports,
          slope: state.slope,
          totalSupply: state.totalSupply,
          curveType: state.curveType,
          feeBasisPoints: state.feeBasisPoints
        });

        const priceSol = computeCurrentPriceSol({ basePriceLamports: state.basePriceLamports, slope: state.slope, totalSupply: state.totalSupply, curveType: state.curveType });
        setCurrentPriceSol(priceSol);

        if (buyAmount) {
          const units = BigInt(Math.floor(parseFloat(buyAmount) * Math.pow(10, 9)));
          const estLamports = estimateTotalLamports(state, units);

          // Debug log
          console.log('[PRICE_DEBUG] Buy calculation:', {
            buyAmount,
            units: units.toString(),
            estLamports: estLamports.toString(),
            estSol: Number(estLamports) / 1_000_000_000
          });

          setEstTotalSol(Number(estLamports) / 1_000_000_000);
        } else {
          setEstTotalSol(0);
        }

        if (sellAmount) {
          const units = BigInt(Math.floor(parseFloat(sellAmount) * Math.pow(10, 9)));
          const estLamports = estimateSellLamports(state, units);

          // Debug log
          console.log('[PRICE_DEBUG] Sell calculation:', {
            sellAmount,
            units: units.toString(),
            estLamports: estLamports.toString(),
            estSol: Number(estLamports) / 1_000_000_000
          });

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
  }, [token?.mint, buyAmount, sellAmount]);

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

      // Ước lượng chính xác theo curve và đặt slippage 10%
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
        data: Buffer.from(ixCodama.data) // Sử dụng data gốc 17 bytes (có discriminator)
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

      // Kiểm tra balance của ví test
      const tokenBalance = await connection.getTokenAccountBalance(sellerAta);
      console.log('🧪 [TEST] Test wallet token balance:', tokenBalance.value.uiAmount);

      if (!tokenBalance.value.uiAmount || tokenBalance.value.uiAmount < parseFloat(sellAmount)) {
        throw new Error(`Test wallet has insufficient tokens: ${tokenBalance.value.uiAmount} < ${sellAmount}`);
      }

      // Ước lượng số SOL sẽ nhận được và đặt slippage 10%
      const estLamports = estimateSellLamports(state, tokenAmountUnits);
      let minSolLamportsBI = (estLamports * 90n) / 100n; // 10% slippage
      if (minSolLamportsBI < 1n) minSolLamportsBI = 1n;

      const feeRecipient = (token.raw?.feeRecipient || token.feeRecipient || state.feeRecipientPk?.toBase58?.()) as string | undefined;
      if (!feeRecipient) throw new Error('Missing fee recipient');

      // Treasury PDA (system-owned)
      const treasuryPda = deriveTreasuryPda(mint);

      console.log('[SELL] Creating sellTokens instruction...');

      const ixCodama = getSellTokensInstruction({
        seller: { address: sellerPubkey.toBase58() } as any,
        bondingCurve: bondingCurve.toBase58() as Address,
        mint: mint.toBase58() as Address,
        sellerTokenAccount: sellerAta.toBase58() as Address,
        treasury: treasuryPda.toBase58() as Address,
        feeRecipient: feeRecipient as Address,
        tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
        systemProgram: SystemProgram.programId.toBase58() as Address,
        tokenAmount: tokenAmountUnits,
        minSolAmount: minSolLamportsBI,
      });

      console.log('[SELL] Instruction data:', {
        length: ixCodama.data.length,
        hex: Buffer.from(ixCodama.data).toString('hex'),
        accountsCount: ixCodama.accounts.length
      });

      const keys = ixCodama.accounts.map((meta: AccountMeta<string>) => ({
        pubkey: new PublicKey(meta.address),
        isSigner: meta.role === AccountRole.READONLY_SIGNER || meta.role === AccountRole.WRITABLE_SIGNER,
        isWritable: meta.role === AccountRole.WRITABLE || meta.role === AccountRole.WRITABLE_SIGNER,
      }));

      // Đảm bảo seller là signer
      if (keys[0] && keys[0].pubkey.equals(sellerPubkey)) {
        keys[0].isSigner = true;
      }

      console.log('[SELL] Account keys:', keys.map((k, i) => `${i}: ${k.pubkey.toBase58()} (signer: ${k.isSigner}, writable: ${k.isWritable})`));

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
      } catch { }
    } catch (e: any) {
      console.error('[SELL] error:', e);
      if (e.logs) {
        console.error('[SELL] Program logs:', e.logs);
      }
      toast.error(String(e?.message || e));
    }
  };

  const recentTrades = [
    { type: 'buy', amount: 1.5, price: 156.78, time: '2 mins ago' },
    { type: 'sell', amount: 0.8, price: 155.23, time: '5 mins ago' },
    { type: 'buy', amount: 3.2, price: 157.45, time: '8 mins ago' },
    { type: 'sell', amount: 2.1, price: 154.67, time: '12 mins ago' },
    { type: 'buy', amount: 0.5, price: 156.12, time: '15 mins ago' }
  ];

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
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{token.symbol}</span>
                <span className="font-medium">—</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTrades.map((trade, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Badge variant={trade.type === 'buy' ? 'default' : 'secondary'}>
                      {trade.type === 'buy' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    </Badge>
                    <span>{trade.amount} {token.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">—</p>
                    <p className="text-muted-foreground text-xs">{trade.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}