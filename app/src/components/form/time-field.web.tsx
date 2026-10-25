import { formatTime, withTime } from '@/components/form/format-time';
import { useTheme } from '@/hooks/use-theme';

type TimeFieldProps = {
  /** Accessible name, e.g. "Start time". */
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  invalid?: boolean;
};

export { formatTime };

/**
 * Time of day on the web. The native picker package has no web implementation (it renders nothing),
 * so this uses the browser's own time input.
 */
export function TimeField({ label, value, onChange, invalid }: TimeFieldProps) {
  const theme = useTheme();

  return (
    <input
      type="time"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={formatTime(value)}
      onChange={(event) => {
        // Empty while the user is mid-edit or clears the field: keep the last valid time.
        const next = withTime(value, event.target.value);
        if (next) onChange(next);
      }}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 48,
        padding: '0 12px',
        borderRadius: 12,
        border: `1.5px solid ${invalid ? theme.danger : 'transparent'}`,
        backgroundColor: theme.backgroundElement,
        color: theme.text,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: 16,
        fontWeight: 700,
        textAlign: 'center',
      }}
    />
  );
}
