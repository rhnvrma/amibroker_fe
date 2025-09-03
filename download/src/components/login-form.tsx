
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from 'next/link';

const formSchema = z.object({
  apiKey: z.string().min(1, "API key is required."),
  apiSecret: z.string().min(1, "API secret is required."),
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits."),
  pin: z.string().min(4, "PIN must be at least 4 digits."),
  toptSecret: z.string().min(1, "TOPT Secret is required."),
  autoAddSymbols: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof formSchema>;

// Mock function to simulate API login
const mockLogin = async (data: LoginFormValues): Promise<{ accessToken: string }> => {
    console.log("Login attempt with:", data);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate a 50% chance of failure
            if (Math.random() > 0.5) {
                resolve({ accessToken: `mock_access_token_${new Date().getTime()}` });
            } else {
                reject(new Error("Failed to authenticate"));
            }
        }, 1500);
    });
};

export function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: "",
      apiSecret: "",
      mobileNumber: "",
      pin: "",
      toptSecret: "",
      autoAddSymbols: true,
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setAccessToken(null);
    try {
      const response = await mockLogin(data);
      setAccessToken(response.accessToken);
      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
      });
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Please try again after some time.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Upstox Login</CardTitle>
        <CardDescription>Enter your API credentials to log in, or continue to the app.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Upstox API key</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your API key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API secret</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your API secret" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your mobile number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PIN</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your PIN" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toptSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TOPT Secret</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your TOPT Secret" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="autoAddSymbols"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                        Auto-add symbols from AmiBroker
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4">
            <div className="w-full flex flex-col sm:flex-row items-center gap-2">
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto grow">
                {isLoading ? "Logging in..." : "Login"}
                </Button>
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full">
                    Go to Watchtower
                  </Button>
                </Link>
            </div>
            {accessToken && (
                <div className="w-full p-3 bg-muted rounded-md">
                    <p className="text-sm font-semibold text-foreground">Access Token:</p>
                    <p className="text-xs text-muted-foreground break-all">{accessToken}</p>
                </div>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
