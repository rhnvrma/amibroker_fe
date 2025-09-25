"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { isElectron } from "@/lib/utils";

const formSchema = z.object({
  rootFolder: z.string().min(1, "Root folder is required."),
  apiKey: z.string().min(1, "API key is required."),
  apiSecret: z.string().min(1, "API secret is required."),
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits."),
  pin: z.string().min(4, "PIN must be at least 4 digits."),
  toptSecret: z.string().min(1, "TOPT Secret is required."),
  autoAddSymbols: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof formSchema>;

type LoginFormProps = {
  onLoginSuccess: () => void;
};

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rootFolder: "",
      apiKey: "",
      apiSecret: "",
      mobileNumber: "",
      pin: "",
      toptSecret: "",
      autoAddSymbols: true,
    },
  });

  useEffect(() => {
    const checkCredentials = async () => {
      const savedCredentials = await window.electron.getCredentials();
      if (savedCredentials) {
        form.reset(savedCredentials);
      }
    };
    checkCredentials();
  }, [form]);

  const handleSelectFolder = async () => {
    try {
      const folderPath = await window.electron.selectFolder();
      if (folderPath) {
        form.setValue("rootFolder", folderPath, { shouldValidate: true });
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not open folder selection dialog.",
      });
    }
  };

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setAccessToken(null);
    try {
      const response = await window.electron.login(data);
      console.log("Response from Electron main process:", response);
      if (response && response.success) {
        await window.electron.saveCredentials(data);
        setAccessToken(response.token);
        toast({
          title: "Login Successful",
          description: "Credentials saved.",
        });
        onLoginSuccess();
      } else {
        throw new Error(response.error || "An unknown error occurred on the server.");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: (error as Error).message,
      });
      console.error("Frontend Login Catch Block:", error);
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <Card className="w-full max-w-lg border-0 shadow-none">
      <CardHeader>
        <CardTitle>Upstox Login</CardTitle>
        <CardDescription>Enter your API credentials to log in.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="rootFolder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application Root Folder</FormLabel>
                  <div className="flex w-full items-center space-x-2">
                    <FormControl>
                      <Input
                        placeholder="Select the amibroker's root folder"
                        readOnly
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSelectFolder}
                    >
                      Browse...
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            {/* <FormField
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
            /> */}
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
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4">
            <div className="w-full flex flex-col sm:flex-row items-center gap-2">
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto grow">
                {isLoading ? "Logging in..." : "Login"}
              </Button>
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