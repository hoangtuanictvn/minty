import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { User, Trophy, Coins, TrendingUp } from 'lucide-react';

interface StatisticsTabProps {
    authenticated: boolean;
}

export function StatisticsTab({ authenticated }: StatisticsTabProps) {
    const mockUserStats = {
        totalTrades: 156,
        totalVolume: 45678.92,
        profitLoss: 8.7,
        rank: 42,
        ownedTokens: 12
    };

    return (
        <div className="space-y-6">
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
        </div>
    );
}
