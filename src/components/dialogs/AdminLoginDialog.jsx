import { useState } from "react";

import { signInAdmin, getIsCoopAdmin } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const DEFAULT_ADMIN_EMAIL = "joshuamarkle25@gmail.com";

// ----- Dialog ----- //

export default function AdminLoginDialog({ open, onOpenChange, onLogin }) {
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage("");

      await signInAdmin(email.trim(), password);

      const admin = await getIsCoopAdmin();

      if (!admin) {
        throw new Error("Logged in, but this account is not a coop admin.");
      }

      onLogin();
      setPassword("");
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error?.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Admin connection</DialogTitle>
          <DialogDescription>
            Enter the secret password to make changes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* <div className="space-y-2"> */}
          {/*   <Label htmlFor="admin-email">Email</Label> */}
          {/*   <Input */}
          {/*     id="admin-email" */}
          {/*     value={email} */}
          {/*     onChange={(event) => setEmail(event.target.value)} */}
          {/*     type="email" */}
          {/*     autoComplete="email" */}
          {/*     required */}
          {/*   /> */}
          {/* </div> */}
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Connecting..." : "Connect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
