import { Alert, AlertDescription } from "@/components/ui/alert";
import { API_URL } from "@/api/queryKeys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function Landing() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("test123");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatusMessage, setBackendStatusMessage] = useState<string | null>(
    "Backend is waking up on Render. This can take about a minute.",
  );
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }, []);

  useEffect(() => {
    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkBackendHealth = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${API_URL}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!disposed) {
            setBackendStatusMessage("Backend is initializing. Please wait a moment and try again.");
          }
          return;
        }

        const health = (await response.json()) as {
          status?: string;
          demo_mode?: boolean;
          demo_seeded?: boolean | null;
        };

        if (disposed) return;

        if (health.status !== "ok") {
          setBackendStatusMessage("Backend is initializing. Please wait a moment and try again.");
          return;
        }

        if (health.demo_mode && health.demo_seeded !== true) {
          setBackendStatusMessage("Backend is preparing demo data. This can take up to a minute.");
          return;
        }

        setBackendStatusMessage(null);
      } catch {
        if (!disposed) {
          setBackendStatusMessage("Backend is waking up on Render. This can take about a minute.");
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    void checkBackendHealth();
    intervalId = setInterval(() => {
      void checkBackendHealth();
    }, 8000);

    return () => {
      disposed = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authService.login({ email, password });
      void navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Login error:", error);
      setError(error instanceof Error ? error.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
      <div className="container flex items-center justify-center gap-12 px-4 md:px-6">
        <div className="hidden lg:flex flex-col gap-4 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight">WealthManager</h1>
          <p className="text-xl text-muted-foreground">
            Take control of your financial future with our comprehensive wealth management platform
          </p>
          <div className="grid gap-4 mt-6">
            {[
              "Track multiple accounts and investments",
              "Monitor your portfolio performance",
              "Manage budgets and expenses",
              "Analyze your wealth growth",
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <Icons.check className="w-5 h-5 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader>
            <h2 className="text-2xl font-semibold text-center">Welcome back</h2>
          </CardHeader>
          <CardContent>
            {backendStatusMessage && (
              <Alert className="mb-4">
                <AlertDescription>{backendStatusMessage}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Button
                variant="link"
                className="p-0"
                onClick={() => void navigate({ to: "/signup" })}
              >
                Sign up
              </Button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
