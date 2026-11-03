import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type DateTimeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type: "date" | "datetime-local";
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day)
    return undefined;
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const DateTimeInput = forwardRef<HTMLInputElement, DateTimeInputProps>(
  function DateTimeInput(
    {
      type,
      className,
      value,
      defaultValue,
      onChange,
      onBlur,
      id,
      name,
      min,
      max,
      disabled,
      required,
      placeholder,
      "aria-label": ariaLabel,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedby,
      ...inputProps
    },
    ref,
  ) {
    const nativeRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const timeInputId = useId();
    const calendarId = useId();
    const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? ""));
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const currentValue =
      value === undefined ? (nativeRef.current?.value ?? uncontrolledValue) : String(value ?? "");
    const selectedDate = parseDate(currentValue);
    const [visibleMonth, setVisibleMonth] = useState(
      () => selectedDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
    const [draftTime, setDraftTime] = useState(() => currentValue.split("T")[1] || "09:00");
    const dateValue = currentValue.slice(0, 10);
    const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const calendarStart = new Date(
      firstOfMonth.getFullYear(),
      firstOfMonth.getMonth(),
      1 - firstOfMonth.getDay(),
    );
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);
      return date;
    });

    useImperativeHandle(ref, () => {
      if (!nativeRef.current) throw new Error("The date and time input ref is not mounted.");
      return nativeRef.current;
    }, []);

    useEffect(() => {
      if (value !== undefined || defaultValue !== undefined || !nativeRef.current) return;
      setUncontrolledValue(nativeRef.current.value);
    }, [defaultValue, value]);

    useEffect(() => {
      if (!open) return;
      const updatePosition = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24);
        const height = Math.min(390, window.innerHeight - 24);
        const top =
          window.innerHeight - rect.bottom >= height || rect.top >= height
            ? Math.min(rect.bottom + 8, window.innerHeight - height - 12)
            : Math.max(12, rect.top - height - 8);
        setPosition({
          top,
          left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
          width,
        });
      };
      updatePosition();
      const closeOnOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
          setOpen(false);
        }
      };
      const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      };
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      document.addEventListener("mousedown", closeOnOutside);
      document.addEventListener("keydown", closeOnEscape);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
        document.removeEventListener("mousedown", closeOnOutside);
        document.removeEventListener("keydown", closeOnEscape);
      };
    }, [open]);

    const updateValue = (nextValue: string) => {
      const input = nativeRef.current;
      if (!input) return;
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!valueSetter) throw new Error("The date and time input could not update its value.");
      valueSetter.call(input, nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setUncontrolledValue(nextValue);
    };

    const selectDate = (date: Date) => {
      const nextDate = localDateKey(date);
      if (type === "date") {
        updateValue(nextDate);
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      const selectedTime = currentValue.split("T")[1] || draftTime;
      if (!timePattern.test(selectedTime)) return;
      updateValue(`${nextDate}T${selectedTime}`);
    };

    const formattedValue = selectedDate
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(selectedDate) +
        (type === "datetime-local" && currentValue.includes("T")
          ? ` · ${currentValue.slice(11, 16)}`
          : "")
      : (placeholder ?? (type === "date" ? "Choose a date" : "Choose date and time"));

    return (
      <>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={calendarId}
          aria-invalid={ariaInvalid}
          aria-required={required}
          aria-describedby={ariaDescribedby}
          onBlur={() => {
            if (!onBlur || !nativeRef.current) return;
            nativeRef.current.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
          }}
          onClick={() => {
            if (selectedDate) setVisibleMonth(selectedDate);
            if (currentValue.includes("T")) setDraftTime(currentValue.slice(11, 16));
            setOpen((current) => !current);
          }}
          className={cn(
            "flex min-h-touch w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left text-base text-ink shadow-sm shadow-indigo-950/[0.02] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={currentValue ? "truncate" : "truncate text-muted"}>
            {formattedValue}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden="true" />
        </button>
        <input
          {...inputProps}
          ref={nativeRef}
          className="sr-only"
          type="text"
          name={name}
          value={currentValue}
          disabled={disabled}
          onChange={onChange}
          onBlur={onBlur}
          tabIndex={-1}
          aria-hidden="true"
        />
        {open
          ? createPortal(
              <div
                ref={panelRef}
                id={calendarId}
                role="dialog"
                aria-label={type === "date" ? "Choose a date" : "Choose date and time"}
                className="fixed z-[80] rounded-xl border border-border bg-white p-3 shadow-xl"
                style={{ top: position.top, left: position.left, width: position.width }}
              >
                {type === "datetime-local" ? (
                  <label className="mb-3 block text-sm font-semibold text-ink">
                    Time (24-hour)
                    <input
                      id={timeInputId}
                      aria-label="Time (24-hour)"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="HH:MM"
                      value={draftTime}
                      aria-invalid={!timePattern.test(draftTime)}
                      onChange={(event) => {
                        const nextTime = event.target.value.slice(0, 5);
                        setDraftTime(nextTime);
                        if (dateValue && timePattern.test(nextTime)) {
                          updateValue(`${dateValue}T${nextTime}`);
                        }
                      }}
                      className="mt-1 min-h-touch w-full rounded-lg border border-border px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                    />
                    {!timePattern.test(draftTime) ? (
                      <span role="alert" className="mt-1 block text-xs text-danger">
                        Enter a time in HH:MM format.
                      </span>
                    ) : null}
                  </label>
                ) : null}
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setVisibleMonth(
                        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
                      )
                    }
                    className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="font-semibold text-ink">
                    {new Intl.DateTimeFormat(undefined, {
                      month: "long",
                      year: "numeric",
                    }).format(visibleMonth)}
                  </span>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setVisibleMonth(
                        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                      )
                    }
                    className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <span key={day} className="py-2">
                      {day}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const key = localDateKey(day);
                    const outsideMonth = day.getMonth() !== visibleMonth.getMonth();
                    const unavailable =
                      (min && key < String(min).slice(0, 10)) ||
                      (max && key > String(max).slice(0, 10)) ||
                      (type === "datetime-local" && !timePattern.test(draftTime));
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={Boolean(unavailable)}
                        aria-pressed={key === dateValue}
                        aria-label={new Intl.DateTimeFormat(undefined, {
                          dateStyle: "full",
                        }).format(day)}
                        onClick={() => selectDate(day)}
                        className={cn(
                          "min-h-9 rounded-lg text-sm hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-30",
                          outsideMonth ? "text-muted" : "text-ink",
                          key === dateValue
                            ? "bg-action font-semibold text-white hover:bg-action"
                            : "",
                        )}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
                {type === "datetime-local" ? (
                  <p className="mt-2 text-xs text-muted">
                    Select a day to set the date; adjust the time above if needed.
                  </p>
                ) : null}
                {currentValue ? (
                  <button
                    type="button"
                    className="mt-3 min-h-touch text-sm font-semibold text-action underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                    onClick={() => {
                      updateValue("");
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    Clear selection
                  </button>
                ) : null}
              </div>,
              document.body,
            )
          : null}
      </>
    );
  },
);
