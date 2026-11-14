"use client";

import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiX } from "react-icons/fi";
import { toast } from "sonner";
import { resetUserPassword } from "@/lib/users";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)";

export default function ResetPasswordModal({ user, onClose }) {
  const [form, setForm] = useState({ new_password: "", confirm_password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    const errors = {};
    if (!form.new_password) {
      errors.new_password = ["Password is required."];
    } else if (form.new_password.length < 8) {
      errors.new_password = ["Password must be at least 8 characters."];
    }
    if (form.new_password !== form.confirm_password) {
      errors.confirm_password = ["Passwords do not match."];
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await resetUserPassword(user.id, form);
      toast.success(`Password reset for ${user.name || user.email || user.phone}.`);
      onClose();
    } catch (err) {
      if (err.status === 400 && err.data && typeof err.data === "object") {
        setFieldErrors(err.data);
        setFormError(
          err.data.non_field_errors?.[0] ||
            (typeof err.data.detail === "string" ? err.data.detail : "") ||
            ""
        );
      } else {
        setFormError(err.message || "Could not reset the password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/40"
      />
      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
        >
          <FiX size={18} />
        </button>

        <h2 id="reset-password-title" className="text-lg font-semibold text-neutral-900">
          Reset password
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Set a new password for{" "}
          <span className="font-medium text-neutral-700">
            {user.name || user.email || user.phone}
          </span>
          . They will be asked to change it the next time they sign in.
        </p>

        {formError && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                autoComplete="new-password"
                className={`${inputClass} pr-11`}
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
            {fieldErrors.new_password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.new_password[0]}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              Confirm password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              name="confirm_password"
              value={form.confirm_password}
              onChange={handleChange}
              autoComplete="new-password"
              className={inputClass}
            />
            {fieldErrors.confirm_password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.confirm_password[0]}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--primary)/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Resetting..." : "Reset password"}
          </button>
        </div>
      </form>
    </div>
  );
}
