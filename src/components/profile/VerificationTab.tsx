import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Twitter, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { checkUserTweetContains } from "../../lib/twitter";

interface VerificationTabProps {
    authenticated: boolean;
    walletAddress: string;
    isVerified: boolean;
    xHandle: string;
    onVerificationComplete: (handle: string) => void;
}

export function VerificationTab({
    authenticated,
    walletAddress,
    isVerified,
    xHandle,
    onVerificationComplete
}: VerificationTabProps) {
    const [verificationStep, setVerificationStep] = useState(1);
    const [localXHandle, setLocalXHandle] = useState(xHandle);

    const verificationMessage = `I am verifying my wallet address ${walletAddress} on Minty.fun platform. #MintyFunVerification`;

    const handleXVerification = async () => {
        if (verificationStep === 1) {
            // Step 1: Generate verification message
            setVerificationStep(2);
        } else if (verificationStep === 2) {
            // Step 2: Mock verification check
            checkUserTweetContains('HauCong268904', 'MintyFunVerification')
            onVerificationComplete(localXHandle);
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

    const resetVerification = () => {
        setVerificationStep(1);
        setLocalXHandle('');
        onVerificationComplete('');
    };

    return (
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
                                        value={localXHandle}
                                        onChange={(e) => setLocalXHandle(e.target.value)}
                                        disabled={!authenticated}
                                    />
                                </div>

                                <Button
                                    onClick={handleXVerification}
                                    disabled={!authenticated || !localXHandle}
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
                                    Your X account @{localXHandle} has been successfully verified.
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
                            onClick={resetVerification}
                        >
                            Re-verify Account
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
