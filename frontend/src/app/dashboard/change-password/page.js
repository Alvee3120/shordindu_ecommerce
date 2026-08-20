"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changePassword } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({ old_password: "", new_password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setLoading(true);

    try {
      await changePassword(form);
      toast.success("Password changed successfully");
      setForm({ old_password: "", new_password: "" });
      router.push(`/dashboard/${user?.role ?? "customer"}`);
    } catch (err) {
      if (err.status === 400 && err.data) {
        setFieldErrors(err.data);
      } else {
        setFormError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Change Password</h1>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && (
          <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Current Password
          </label>
          <input
            type="password"
            name="old_password"
            value={form.old_password}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          />
          {fieldErrors.old_password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.old_password[0]}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            New Password
          </label>
          <input
            type="password"
            name="new_password"
            value={form.new_password}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)"
          />
          {fieldErrors.new_password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.new_password[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-(--primary) py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}
