import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertCircle, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface TradingInterfaceProps {
  authenticated: boolean;
  selectedToken: any;
}

export function TradingInterface({ authenticated, selectedToken }: TradingInterfaceProps) {
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [solBalance] = useState(12.5678); // Mock SOL balance

  const defaultToken = {
    name: 'SolanaToken',
    symbol: 'SOLT',
    price: 156.78,
    change24h: 12.5
  };

  const token = selectedToken || defaultToken;

  const handleBuy = () => {
    if (!authenticated) return;
    // Mock trading logic
    alert(`Buying ${buyAmount} ${token.symbol} for ${(parseFloat(buyAmount) * token.price).toFixed(4)} SOL`);
    setBuyAmount('');
  };

  const handleSell = () => {
    if (!authenticated) return;
    // Mock trading logic
    alert(`Selling ${sellAmount} ${token.symbol} for ${(parseFloat(sellAmount) * token.price).toFixed(4)} SOL`);
    setSellAmount('');
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
        {/* Trading Panel */}
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
                  <p className="font-bold text-lg">${token.price.toFixed(4)}</p>
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
                    <Input
                      id="buy-amount"
                      type="number"
                      placeholder="0.00"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      disabled={!authenticated}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Total Cost (SOL)</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="font-medium">
                        {buyAmount ? (parseFloat(buyAmount) * token.price).toFixed(4) : '0.00'} SOL
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setBuyAmount((solBalance * 0.25 / token.price).toFixed(4))}
                      disabled={!authenticated}
                    >
                      25%
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setBuyAmount((solBalance * 0.5 / token.price).toFixed(4))}
                      disabled={!authenticated}
                    >
                      50%
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setBuyAmount((solBalance * 0.75 / token.price).toFixed(4))}
                      disabled={!authenticated}
                    >
                      75%
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setBuyAmount((solBalance / token.price).toFixed(4))}
                      disabled={!authenticated}
                    >
                      Max
                    </Button>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleBuy}
                    disabled={!authenticated || !buyAmount}
                  >
                    Buy {token.symbol}
                  </Button>
                </TabsContent>

                <TabsContent value="sell" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sell-amount">Amount ({token.symbol})</Label>
                    <Input
                      id="sell-amount"
                      type="number"
                      placeholder="0.00"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      disabled={!authenticated}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>You'll Receive (SOL)</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="font-medium">
                        {sellAmount ? (parseFloat(sellAmount) * token.price).toFixed(4) : '0.00'} SOL
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSell}
                    disabled={!authenticated || !sellAmount}
                  >
                    Sell {token.symbol}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Wallet & Recent Trades */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Balance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">SOL</span>
                <span className="font-medium">{solBalance.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{token.symbol}</span>
                <span className="font-medium">2.3456</span>
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
                    <p className="font-medium">${trade.price.toFixed(2)}</p>
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