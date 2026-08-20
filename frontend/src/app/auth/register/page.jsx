// app/auth/register/page.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiEye, FiEyeOff } from "react-icons/fi";
import AuthLayout from "@/components/auth/AuthLayout";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
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
      // signup sets auth cookies immediately — user is logged in right after this
      await register(form);
      toast.success("Account created successfully");
      router.push("/");
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
            Full Name
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
            className="w-full rounded-lg border border-white/20 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-(--primary)"
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-200">{fieldErrors.name[0]}</p>
          )}
        </div>

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
            Phone <span className="text-white/50">(optional)</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="01700000000"
            className="w-full rounded-lg border border-white/20 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-(--primary)"
          />
          {fieldErrors.phone && (
            <p className="mt-1 text-xs text-red-200">{fieldErrors.phone[0]}</p>
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-lg bg-(--primary) py-3 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="mt-2 text-center text-sm text-white/80">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-white underline underline-offset-2"
          >
            Sign In
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}