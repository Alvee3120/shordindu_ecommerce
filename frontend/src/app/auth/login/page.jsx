// app/login/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiEye, FiEyeOff } from "react-icons/fi";
import AuthLayout from "@/components/auth/AuthLayout";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
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
      const user = await login(form);
      toast.success("Signed in successfully");

      if (user.force_password_change) {
        router.push("/account/set-password");
        return;
      }

      router.push("/"); // or wherever a logged-in user should land
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
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && (
          <p className="rounded-lg bg-red-500/15 px-4 py-2.5 text-sm text-red-100">
            {formError}
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
            className="w-full rounded-lg border border-white/20 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-(--primary)"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-200">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••••"
              required
              className="w-full rounded-lg border border-white/20 bg-white px-4 py-3 pr-11 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-(--primary)"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-200">{fieldErrors.password[0]}</p>
          )}
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-white/90 underline underline-offset-2 hover:text-white"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-lg bg-(--primary) py-3 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="mt-2 text-center text-sm text-white/80">
          Are you new?{" "}
          <Link
            href="/auth/register"
            className="font-semibold text-white underline underline-offset-2"
          >
            Create an Account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}