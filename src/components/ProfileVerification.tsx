import { useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertCircle } from 'lucide-react';
import { ProfileTab, VerificationTab, StatisticsTab, TokenCreationTab } from './profile';

interface ProfileVerificationProps {
  authenticated: boolean;
  walletAddress: string;
}

export function ProfileVerification({ authenticated, walletAddress }: ProfileVerificationProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [xHandle, setXHandle] = useState('');

  const handleVerificationComplete = (handle: string) => {
    setXHandle(handle);
    setIsVerified(handle !== '');
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="create">Create Token</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab
            authenticated={authenticated}
            walletAddress={walletAddress}
            isVerified={isVerified}
            xHandle={xHandle}
          />
        </TabsContent>

        <TabsContent value="verification">
          <VerificationTab
            authenticated={authenticated}
            walletAddress={walletAddress}
            isVerified={isVerified}
            xHandle={xHandle}
            onVerificationComplete={handleVerificationComplete}
          />
        </TabsContent>

        <TabsContent value="stats">
          <StatisticsTab authenticated={authenticated} />
        </TabsContent>

        <TabsContent value="create">
          <TokenCreationTab authenticated={authenticated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}