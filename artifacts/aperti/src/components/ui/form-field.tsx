import { ReactNode, useState, ChangeEvent, TextareaHTMLAttributes, InputHTMLAttributes } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_INPUT = [
  "w-full px-3.5 py-2.5 rounded-xl border text-sm",
  "transition-all duration-150 outline-none",
  "focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500",
  "placeholder:text-gray-400",
  "bg-white dark:bg-gray-900",
].join(" ");

const STATE_CLASSES = {
  default: "border-gray-200 text-gray-900",
  valid:   "border-green-400 text-gray-900 focus:ring-green-500/20 focus:border-green-500",
  invalid: "border-red-400 text-gray-900 focus:ring-red-500/20 focus:border-red-500",
};

export interface FieldValidation {
  message: string;
  valid: boolean;
}

function validate(value: string, rules?: FormFieldProps["rules"]): FieldValidation | null {
  if (!rules) return null;
  if (rules.required && !value.trim()) return { message: rules.required === true ? "This field is required" : rules.required, valid: false };
  if (rules.minLength && value.length < rules.minLength) return { message: `Minimum ${rules.minLength} characters`, valid: false };
  if (rules.maxLength && value.length > rules.maxLength) return { message: `Maximum ${rules.maxLength} characters`, valid: false };
  if (rules.pattern && !rules.pattern.regex.test(value)) return { message: rules.pattern.message, valid: false };
  if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { message: "Enter a valid email address", valid: false };
  if (rules.custom) return rules.custom(value);
  return { message: rules.successMessage || "", valid: true };
}

interface FormFieldProps {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  success?: string;
  className?: string;
  children?: ReactNode;
  rules?: {
    required?: boolean | string;
    minLength?: number;
    maxLength?: number;
    email?: boolean;
    pattern?: { regex: RegExp; message: string };
    custom?: (value: string) => FieldValidation;
    successMessage?: string;
  };
  showCharCount?: boolean;
  maxLength?: number;
  value?: string;
}

function FieldWrapper({ label, hint, required, error, success, className, children, showCharCount, maxLength, value }: FormFieldProps) {
  const charCount = value?.length ?? 0;
  const isNearLimit = maxLength && charCount > maxLength * 0.85;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {showCharCount && maxLength && (
            <span className={cn("text-[10px] font-medium", isNearLimit ? "text-amber-500" : "text-gray-400")}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      )}
      {children}
      {hint && !error && !success && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div key="error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
        {success && !error && (
          <motion.div key="success" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  wrapperClassName?: string;
  rules?: FormFieldProps["rules"];
  onChange?: (value: string) => void;
  showCharCount?: boolean;
}

export function InputField({
  label,
  hint,
  error: externalError,
  success: externalSuccess,
  wrapperClassName,
  rules,
  onChange,
  onBlur,
  className,
  required,
  maxLength,
  showCharCount,
  value = "",
  type,
  ...rest
}: InputFieldProps) {
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const validation = touched ? validate(value as string, rules) : null;

  const err   = externalError || (validation && !validation.valid ? validation.message : "");
  const succ  = externalSuccess || (validation?.valid && validation.message ? validation.message : "");
  const state = err ? "invalid" : succ ? "valid" : "default";

  const isPassword = type === "password";

  return (
    <FieldWrapper
      label={label} hint={hint} required={required}
      error={err} success={succ}
      className={wrapperClassName}
      showCharCount={showCharCount} maxLength={maxLength} value={value as string}
    >
      <div className="relative">
        <input
          {...rest}
          type={isPassword && showPassword ? "text" : type}
          value={value}
          maxLength={maxLength}
          required={required}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
          onBlur={(e) => { setTouched(true); onBlur?.(e); }}
          className={cn(BASE_INPUT, STATE_CLASSES[state], isPassword && "pr-10", className)}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        {state === "valid" && !isPassword && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none" />
        )}
        {state === "invalid" && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />
        )}
      </div>
    </FieldWrapper>
  );
}

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  wrapperClassName?: string;
  rules?: FormFieldProps["rules"];
  onChange?: (value: string) => void;
  showCharCount?: boolean;
}

export function TextareaField({
  label,
  hint,
  error: externalError,
  success: externalSuccess,
  wrapperClassName,
  rules,
  onChange,
  onBlur,
  className,
  required,
  maxLength,
  showCharCount,
  value = "",
  ...rest
}: TextareaFieldProps) {
  const [touched, setTouched] = useState(false);
  const validation = touched ? validate(value as string, rules) : null;

  const err   = externalError || (validation && !validation.valid ? validation.message : "");
  const succ  = externalSuccess || (validation?.valid && validation.message ? validation.message : "");
  const state = err ? "invalid" : succ ? "valid" : "default";

  return (
    <FieldWrapper
      label={label} hint={hint} required={required}
      error={err} success={succ}
      className={wrapperClassName}
      showCharCount={showCharCount} maxLength={maxLength} value={value as string}
    >
      <textarea
        {...rest}
        value={value}
        maxLength={maxLength}
        required={required}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)}
        onBlur={(e) => { setTouched(true); onBlur?.(e); }}
        className={cn(BASE_INPUT, STATE_CLASSES[state], "resize-none", className)}
      />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
}

export function SelectField({
  label,
  hint,
  error,
  wrapperClassName,
  onChange,
  className,
  required,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} required={required} error={error} className={wrapperClassName}>
      <select
        {...rest}
        required={required}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(BASE_INPUT, error ? STATE_CLASSES.invalid : STATE_CLASSES.default, "cursor-pointer", className)}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
