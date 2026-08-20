"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import AuthLayout from "@/components/auth/AuthLayout";
import { changePassword } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

export default function SetPasswordPage() {
  const router = useRouter();
  const { user, loading, refetch } = useAuth();
  const [form, setForm] = useState({ old_password: "", new_password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setSubmitting(true);

    try {
      await changePassword(form);
      await refetch();
      toast.success("Password set successfully");
      router.push("/");
    } catch (err) {
      if (err.status === 400 && err.data) {
        setFieldErrors(err.data);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Set a new password</h2>
          <p className="mt-1 text-sm text-white/70">
            An account was created for you during checkout. Enter the temporary password
            from your email, then choose a new one.
          </p>
        </div>

        {formError && (
          <p className="rounded-lg bg-red-500/15 px-4 py-2.5 text-sm text-red-100">
            {formError}
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white">
            Temporary Password
          </label>
          <input
            type="password"
            name="old_password"
            value={form.old_password}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-white/20 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-(--primary)"
          />
          {fieldErrors.old_password && (
            <p className="mt-1 text-xs text-red-200">{fieldErrors.old_password[0]}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white">New Password</label>
          <input
            type="password"
            name="new_password"
            value={form.new_password}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-white/20 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-(--primary)"
          />
          {fieldErrors.new_password && (
            <p className="mt-1 text-xs text-red-200">{fieldErrors.new_password[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full rounded-lg bg-(--primary) py-3 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Set Password"}
        </button>
      </form>
    </AuthLayout>
  );
}
