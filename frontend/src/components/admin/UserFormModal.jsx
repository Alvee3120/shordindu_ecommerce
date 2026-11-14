"use client";

import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiX } from "react-icons/fi";
import { toast } from "sonner";
import { createUser, updateUser } from "@/lib/users";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--primary)";
const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700";
const errorClass = "mt-1 text-xs text-red-600";

export default function UserFormModal({ mode = "create", user = null, isSelf = false, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    role: user?.role || "customer",
    is_active: user?.is_active ?? true,
    password: "",
    confirm_password: "",
  });
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

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = ["Full name is required."];
    if (!form.phone.trim()) {
      errors.phone = ["Phone number is required."];
    } else if (form.phone.trim().length < 6) {
      errors.phone = ["Enter a valid phone number."];
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = ["Enter a valid email address."];
    }
    if (!isEdit) {
      if (!form.password) {
        errors.password = ["Password is required."];
      } else if (form.password.length < 8) {
        errors.password = ["Password must be at least 8 characters."];
      }
      if (form.password !== form.confirm_password) {
        errors.confirm_password = ["Passwords do not match."];
      }
    }
    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      role: form.role,
      is_active: form.is_active,
    };
    if (!isEdit) {
      payload.password = form.password;
      payload.confirm_password = form.confirm_password;
    }

    setSubmitting(true);
    try {
      const saved = isEdit ? await updateUser(user.id, payload) : await createUser(payload);
      toast.success(isEdit ? "User updated" : "User created");
      onSaved?.(saved);
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
        setFormError(err.message || "Could not save the user.");
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
      aria-labelledby="user-form-title"
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
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
        >
          <FiX size={18} />
        </button>

        <h2 id="user-form-title" className="text-lg font-semibold text-neutral-900">
          {isEdit ? "Edit user" : "Create user"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {isEdit
            ? "Update this account's details, role and status."
            : "Add a new customer, CCE or admin account. They can sign in with their email or phone number."}
        </p>

        {formError && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{formError}</p>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="user-name">
              Full name
            </label>
            <input
              id="user-name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              className={inputClass}
            />
            {fieldErrors.name && <p className={errorClass}>{fieldErrors.name[0]}</p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-phone">
              Phone number
            </label>
            <input
              id="user-phone"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              className={inputClass}
            />
            {fieldErrors.phone && <p className={errorClass}>{fieldErrors.phone[0]}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="user-email">
              Email address <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="user-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              className={inputClass}
            />
            {fieldErrors.email && <p className={errorClass}>{fieldErrors.email[0]}</p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-role">
              Role
            </label>
            <select
              id="user-role"
              name="role"
              value={form.role}
              onChange={handleChange}
              disabled={isEdit && isSelf}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="customer">Customer</option>
              <option value="cce">CCE</option>
              <option value="admin">Admin</option>
            </select>
            {fieldErrors.role && <p className={errorClass}>{fieldErrors.role[0]}</p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-status">
              Account status
            </label>
            <select
              id="user-status"
              name="is_active"
              value={form.is_active ? "active" : "inactive"}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_active: event.target.value === "active" }))
              }
              disabled={isEdit && isSelf}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {isEdit && isSelf && (
            <p className="text-xs text-neutral-500 sm:col-span-2">
              You cannot change your own role or account status.
            </p>
          )}

          {!isEdit && (
            <>
              <div>
                <label className={labelClass} htmlFor="user-password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="user-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
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
                {fieldErrors.password && <p className={errorClass}>{fieldErrors.password[0]}</p>}
              </div>

              <div>
                <label className={labelClass} htmlFor="user-confirm-password">
                  Confirm password
                </label>
                <input
                  id="user-confirm-password"
                  type={showPassword ? "text" : "password"}
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className={inputClass}
                />
                {fieldErrors.confirm_password && (
                  <p className={errorClass}>{fieldErrors.confirm_password[0]}</p>
                )}
              </div>

              <p className="text-xs text-neutral-500 sm:col-span-2">
                At least 8 characters. Passwords are hashed before they are stored.
              </p>
            </>
          )}
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
            {submitting
              ? isEdit
                ? "Saving..."
                : "Creating account..."
              : isEdit
                ? "Save changes"
                : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}
